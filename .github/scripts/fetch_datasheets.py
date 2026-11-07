#!/usr/bin/env python3
"""Download every PDF linked from the site's Google Sheets into datasheets/.

For each web link in the sheets:
  1. Try the original link. If it returns a real PDF, save it.
  2. Otherwise look for the newest copy in the Internet Archive's
     Wayback Machine and save that instead.
  3. Otherwise record it as "not found" so a person can search for it.

Files that already exist in datasheets/ are left alone, so the job can be
re-run safely. Links that aren't PDFs (e.g. a product web page) are skipped.

Writes a Markdown report to the path given by --report, listing what to
put in each sheet cell. Uses only the Python standard library.
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASHEETS = os.path.join(ROOT, "datasheets")
PAGES = {"Roller Doors": "index.html", "Controllers": "controllers.html"}

# Overridable for testing.
WAYBACK_CDX = os.environ.get("WAYBACK_CDX", "https://web.archive.org/cdx/search/cdx")
WAYBACK_RAW = os.environ.get("WAYBACK_RAW", "https://web.archive.org/web/{ts}id_/{url}")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 rollerdoordb-datasheet-fetcher"
)
MAX_BYTES = 60 * 1024 * 1024  # GitHub rejects files over 100 MB; datasheets are far smaller.
TIMEOUT = 45


def log(msg):
    print(msg, flush=True)


def http_get(url, max_bytes=MAX_BYTES):
    """Return (status, content_type, body). Body is None if too large."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read(max_bytes + 1)
            if len(body) > max_bytes:
                return resp.status, resp.headers.get("Content-Type", ""), None
            return resp.status, resp.headers.get("Content-Type", ""), body
    except urllib.error.HTTPError as e:
        return e.code, "", b""
    except Exception as e:  # DNS failure, timeout, TLS error, ...
        return 0, str(e), b""


def is_pdf(body):
    return bool(body) and body.lstrip()[:5] == b"%PDF-"


def expects_pdf(column, link):
    """True if this cell is meant to point at a PDF."""
    path = urllib.parse.urlparse(link).path.lower()
    return "datasheet" in column.lower() or path.endswith(".pdf")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "file"


def sheet_url(page_file):
    html = open(os.path.join(ROOT, page_file), encoding="utf-8").read()
    m = re.search(r'data-sheet-url="([^"]+)"', html)
    if not m:
        sys.exit(f"Couldn't find data-sheet-url in {page_file}")
    return m.group(1).replace("&amp;", "&")


def load_sheet(url):
    status, _, body = http_get(url, max_bytes=20 * 1024 * 1024)
    if status != 200 or not body:
        sys.exit(f"Couldn't download sheet ({status}): {url}")
    text = body.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def wayback_latest_pdf(url):
    """Return (timestamp, body) of the newest archived PDF copy, or (None, None)."""
    query = urllib.parse.urlencode(
        {
            "url": url,
            "output": "json",
            "filter": "statuscode:200",
            "fl": "timestamp,mimetype",
            "limit": "-8",  # newest 8 captures
        }
    )
    for attempt in range(3):
        status, _, body = http_get(f"{WAYBACK_CDX}?{query}", max_bytes=2 * 1024 * 1024)
        if status == 200:
            break
        time.sleep(5 * (attempt + 1))
    else:
        return None, None
    try:
        rows = json.loads(body or b"[]")
    except ValueError:
        return None, None
    captures = [r[0] for r in rows[1:]]  # first row is the header
    for ts in reversed(captures):  # newest first
        time.sleep(1.5)
        status, _, pdf = http_get(WAYBACK_RAW.format(ts=ts, url=url))
        if status == 200 and is_pdf(pdf):
            return ts, pdf
    return None, None


def fmt_ts(ts):
    return f"{ts[6:8]}/{ts[4:6]}/{ts[0:4]}" if ts and len(ts) >= 8 else "unknown date"


def md(text):
    return str(text).replace("|", "\\|").replace("\n", " ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default="fetch-report.md")
    ap.add_argument(
        "--only-broken",
        action="store_true",
        help="Only save PDFs whose original link no longer works.",
    )
    args = ap.parse_args()

    os.makedirs(DATASHEETS, exist_ok=True)
    saved_by_url = {}  # same link used by several models -> one file
    results = []  # (sheet, model, column, old_link, outcome, new_value)

    for sheet_name, page in PAGES.items():
        url = sheet_url(page)
        log(f"\n== {sheet_name}: reading sheet")
        rows = load_sheet(url)
        if not rows:
            continue
        model_col = next((c for c in rows[0] if c and c.strip().lower() == "model"), None)
        if not model_col:
            log("  no Model column; skipping")
            continue

        for row in rows:
            model = (row.get(model_col) or "").strip()
            if not model:
                continue
            for col, value in row.items():
                if col is None or col == model_col:
                    continue
                link = (value or "").strip()
                if not re.match(r"^https?://", link, re.I):
                    continue

                if link in saved_by_url:
                    outcome, new_value = saved_by_url[link]
                    results.append((sheet_name, model, col.strip(), link, outcome, new_value))
                    continue

                filename = f"{slugify(model)}-{slugify(col)}.pdf"
                rel = f"datasheets/{filename}"
                path = os.path.join(DATASHEETS, filename)
                log(f"  {model} / {col.strip()}: {link}")

                time.sleep(1)  # be polite to manufacturer sites
                status, ctype, body = http_get(link)

                if status == 200 and is_pdf(body):
                    if args.only_broken:
                        outcome, new_value = "✅ Link still works (left as is)", ""
                    elif os.path.exists(path):
                        outcome, new_value = "✅ Already in datasheets/", rel
                    else:
                        with open(path, "wb") as f:
                            f.write(body)
                        outcome, new_value = "✅ Saved from manufacturer", rel
                elif body is None:
                    outcome, new_value = "⚠️ File too large to store", ""
                elif status == 200 and not expects_pdf(col, link):
                    # A working link to something other than a PDF (e.g. a product page).
                    outcome, new_value = "➖ Not a PDF link (skipped)", ""
                else:
                    if status == 200:
                        # Many sites answer a missing file with a normal page instead of a 404.
                        reason = "returns a web page, not the PDF"
                    else:
                        reason = f"HTTP {status}" if status else "unreachable"
                    if os.path.exists(path):
                        outcome, new_value = f"✅ Already in datasheets/ (original link: {reason})", rel
                    else:
                        log(f"    original failed ({reason}); checking Wayback Machine")
                        ts, pdf = wayback_latest_pdf(link)
                        if pdf:
                            with open(path, "wb") as f:
                                f.write(pdf)
                            outcome = f"🗄️ Saved archive copy from {fmt_ts(ts)} (original link: {reason})"
                            new_value = rel
                        else:
                            outcome, new_value = f"❌ Not found (original link: {reason}, no archive copy)", ""
                log(f"    -> {outcome}")
                saved_by_url[link] = (outcome, new_value)
                results.append((sheet_name, model, col.strip(), link, outcome, new_value))

    write_report(args.report, results, args.only_broken)

    # Exit 0 even if some weren't found; the report says what needs doing.
    return 0


def write_report(path, results, only_broken):
    saved = [r for r in results if r[5]]
    missing = [r for r in results if r[4].startswith("❌") or r[4].startswith("⚠️")]
    archived = [r for r in results if r[4].startswith("🗄️")]

    out = []
    out.append("## Datasheet download report\n")
    out.append(
        f"- **{len(saved)}** links now have a PDF in `datasheets/`"
        f" ({len(archived)} of them from the Internet Archive)\n"
        f"- **{len(missing)}** couldn't be found and need searching for by hand\n"
    )
    if only_broken:
        out.append("- Run in *only broken links* mode: working manufacturer links were left as they are.\n")

    out.append(
        "\n### Next steps\n\n"
        "1. Merge this pull request so the PDFs go live.\n"
        "2. In the Google Sheet, replace each old link below with the value in "
        "**Put this in the sheet**.\n"
        "3. Archive copies (🗄️) may be an older version: check the date, and "
        "replace with the manufacturer's current PDF if you find one.\n"
        "4. For ❌ rows, search for the PDF by hand, upload it to `datasheets/`, "
        "and put its path in the sheet.\n"
    )

    def table(rows, with_new):
        lines = []
        if with_new:
            lines.append("| Page | Model | Column | Result | Put this in the sheet | Old link |")
            lines.append("|---|---|---|---|---|---|")
            for s, m, c, old, outcome, new in rows:
                lines.append(f"| {md(s)} | {md(m)} | {md(c)} | {md(outcome)} | `{new}` | {md(old)} |")
        else:
            lines.append("| Page | Model | Column | Result | Old link |")
            lines.append("|---|---|---|---|---|")
            for s, m, c, old, outcome, _ in rows:
                lines.append(f"| {md(s)} | {md(m)} | {md(c)} | {md(outcome)} | {md(old)} |")
        return "\n".join(lines) + "\n"

    if missing:
        out.append(f"\n### ❌ Need finding by hand ({len(missing)})\n\n")
        out.append(table(missing, with_new=False))
    if saved:
        out.append(f"\n### ✅ Update these in the sheet ({len(saved)})\n\n")
        out.append(table(saved, with_new=True))
    other = [r for r in results if r not in saved and r not in missing]
    if other:
        out.append(f"\n### Other links ({len(other)})\n\n")
        out.append(table(other, with_new=False))

    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(out))
    log(f"\nReport written to {path}: {len(saved)} saved, {len(missing)} missing")


if __name__ == "__main__":
    sys.exit(main())
