#!/usr/bin/env python3
"""Download every PDF linked from the site's Google Sheets into datasheets/.

For each web link in the sheets:
  1. Try the original link. If it returns a real PDF, save it.
  2. Otherwise look on the model's product page (any working non-PDF link
     in the same row) for a PDF with a matching filename, and save that.
  3. Otherwise look for the newest copy in the Internet Archive's
     Wayback Machine and save that instead.
  4. Otherwise record it as "not found" so a person can search for it.

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
WAYBACK_AVAILABLE = os.environ.get("WAYBACK_AVAILABLE", "https://archive.org/wayback/available")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 rollerdoordb-datasheet-fetcher"
)
MAX_BYTES = 60 * 1024 * 1024  # GitHub rejects files over 100 MB; datasheets are far smaller.
TIMEOUT = 45


def log(msg):
    print(msg, flush=True)


def http_get(url, max_bytes=MAX_BYTES, timeout=TIMEOUT):
    """Return (status, content_type, body). Body is None if too large."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


def _wayback_fetch(ts, url):
    time.sleep(1.5)
    status, _, pdf = http_get(WAYBACK_RAW.format(ts=ts, url=url), timeout=90)
    return pdf if status == 200 and is_pdf(pdf) else None


def wayback_latest_pdf(url):
    """Find the newest archived PDF copy of `url`.

    Returns (timestamp, body, note). note is "" on success, "no archive copy"
    if the archive has none, or "archive didn't respond" if it couldn't be asked.
    """
    responded = False

    # 1. CDX search: lists every capture, so we can try several, newest first.
    query = urllib.parse.urlencode(
        {"url": url, "output": "json", "filter": "statuscode:200", "fl": "timestamp", "limit": "-8"}
    )
    for attempt in range(3):
        status, err, body = http_get(f"{WAYBACK_CDX}?{query}", max_bytes=2 * 1024 * 1024, timeout=90)
        if status == 200:
            responded = True
            try:
                rows = json.loads(body or b"[]")
            except ValueError:
                rows = []
            captures = [r[0] for r in rows[1:]]  # first row is the header
            log(f"    archive search: {len(captures)} capture(s)")
            for ts in reversed(captures):
                pdf = _wayback_fetch(ts, url)
                if pdf:
                    return ts, pdf, ""
            break
        log(f"    archive search failed ({status or err}); retry {attempt + 1}/3")
        time.sleep(10 * (attempt + 1))

    # 2. Availability API: a different service, often up when the search isn't.
    for attempt in range(2):
        status, err, body = http_get(
            f"{WAYBACK_AVAILABLE}?" + urllib.parse.urlencode({"url": url}), timeout=60
        )
        if status == 200:
            responded = True
            try:
                closest = json.loads(body or b"{}").get("archived_snapshots", {}).get("closest") or {}
            except ValueError:
                closest = {}
            ts = closest.get("timestamp")
            log(f"    archive lookup: {'capture ' + ts if ts else 'no capture'}")
            if ts and closest.get("available"):
                pdf = _wayback_fetch(ts, url)
                if pdf:
                    return ts, pdf, ""
            break
        log(f"    archive lookup failed ({status or err})")
        time.sleep(10)

    return None, None, ("no archive copy" if responded else "archive didn't respond")


def page_pdf_links(page_url, cache={}):
    """Return the PDF links found in a web page's HTML (cached per page)."""
    if page_url in cache:
        return cache[page_url]
    time.sleep(1)
    status, _, body = http_get(page_url, max_bytes=10 * 1024 * 1024)
    links = []
    if status == 200 and body and not is_pdf(body):
        html = body.decode("utf-8", errors="replace").replace("\\/", "/").replace("&amp;", "&")
        pattern = r"""(?:https?:)?[^"'()\s<>]*?\.pdf(?:\?[^"'()\s<>]*)?"""
        for m in re.finditer(pattern, html, re.I):
            raw = m.group(0).lstrip("=:")
            if not raw or raw.startswith(("data:", "javascript:")):
                continue
            full = urllib.parse.urljoin(page_url, raw)
            if re.match(r"^https?://", full) and full not in links:
                links.append(full)
    log(f"  product page {page_url} -> HTTP {status}, {len(links)} PDF link(s)")
    for link in links:
        log(f"      found: {link}")
    cache[page_url] = links
    return links


def _tokens(text):
    name = urllib.parse.unquote(urllib.parse.urlparse(text).path.rsplit("/", 1)[-1])
    name = re.sub(r"\.pdf$", "", name, flags=re.I)
    return {t for t in re.split(r"[^a-z0-9]+", name.lower()) if t}


def best_match(old_link, column, candidates):
    """Pick the candidate PDF whose filename best matches the broken link's."""
    old = _tokens(old_link)
    col = set(re.split(r"[^a-z0-9]+", column.lower())) - {"", "datasheet"}
    best, best_score = None, 0.0
    for cand in candidates:
        c = _tokens(cand)
        if not c or not old:
            continue
        score = len(old & c) / len(old | c)
        if col & c:  # e.g. "technical" column -> file with "technical" in its name
            score += 0.15
        if score > best_score:
            best, best_score = cand, score
    return best if best_score >= 0.4 else None


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
            # Working product-page links in this row (e.g. a "Web-Site" column).
            pages = [
                (v or "").strip()
                for c, v in row.items()
                if c and c != model_col
                and re.match(r"^https?://", (v or "").strip(), re.I)
                and not expects_pdf(c, (v or "").strip())
            ]
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
                        log(f"    original failed ({reason})")
                        outcome = None
                        # 1. Look for the moved PDF on the model's product page.
                        for page_url in pages:
                            match = best_match(link, col, page_pdf_links(page_url))
                            if not match:
                                continue
                            log(f"    best match on product page: {match}")
                            time.sleep(1)
                            m_status, _, m_body = http_get(match)
                            if m_status == 200 and is_pdf(m_body):
                                with open(path, "wb") as f:
                                    f.write(m_body)
                                outcome = f"🔎 Saved from the product page (new location: {match})"
                                new_value = rel
                                break
                            log(f"    match didn't download (HTTP {m_status})")
                        # 2. Otherwise use the Internet Archive's copy.
                        if outcome is None:
                            log("    checking Wayback Machine")
                            ts, pdf, note = wayback_latest_pdf(link)
                            if pdf:
                                with open(path, "wb") as f:
                                    f.write(pdf)
                                outcome = f"🗄️ Saved archive copy from {fmt_ts(ts)} (original link: {reason})"
                                new_value = rel
                            else:
                                outcome, new_value = f"❌ Not found (original link: {reason}, {note})", ""
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
    relocated = [r for r in results if r[4].startswith("🔎")]

    out = []
    out.append("## Datasheet download report\n")
    out.append(
        f"- **{len(saved)}** links now have a PDF in `datasheets/`"
        f" ({len(relocated)} found at a new address on the product page,"
        f" {len(archived)} from the Internet Archive)\n"
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
