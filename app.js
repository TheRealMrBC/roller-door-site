// app.js
//
// Shared logic for both product pages (roller doors and controllers).
// Each page sets its Google Sheet URL on <body data-sheet-url="...">
// and a noun for counts on <body data-item-noun="door">.
//
// The sheet must have a "Model" column. Every other column is shown as a
// spec row, in sheet order. Columns whose values are URLs are shown as
// link buttons; columns with "datasheet" in the header are labelled as
// downloads.

(() => {
  "use strict";

  const body = document.body;
  const SHEET_URL = body.dataset.sheetUrl;
  const NOUN = body.dataset.itemNoun || "item";

  const els = {
    list: document.getElementById("productList"),
    status: document.getElementById("status"),
    search: document.getElementById("searchInput"),
    clear: document.getElementById("clearSearch"),
    count: document.getElementById("resultCount"),
    expandAll: document.getElementById("expandAll"),
    collapseAll: document.getElementById("collapseAll"),
    themeToggle: document.getElementById("themeToggle"),
  };

  let products = []; // [{ model, slug, fields: [{label, key, value}], haystack }]

  /* ---------- Theme ---------- */

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function syncThemeButton() {
    const dark = currentTheme() === "dark";
    els.themeToggle.textContent = dark ? "☀️" : "🌙";
    els.themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    els.themeToggle.title = els.themeToggle.getAttribute("aria-label");
  }

  els.themeToggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (_) { /* storage unavailable */ }
    syncThemeButton();
  });
  syncThemeButton();

  /* ---------- Helpers ---------- */

  const isUrl = (v) => /^https?:\/\//i.test(v);

  function prettyLabel(header) {
    const text = header.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    // Only re-case headers that were typed all-lowercase; leave "Max Width (mm)" alone.
    if (text === text.toLowerCase()) {
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return text;
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  }

  // Append `text` to `parent`, wrapping case-insensitive matches of `term` in <mark>.
  function appendHighlighted(parent, text, term) {
    if (!term) {
      parent.append(text);
      return;
    }
    const lower = text.toLowerCase();
    let i = 0;
    let hit;
    while ((hit = lower.indexOf(term, i)) !== -1) {
      if (hit > i) parent.append(text.slice(i, hit));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(hit, hit + term.length);
      parent.append(mark);
      i = hit + term.length;
    }
    if (i < text.length) parent.append(text.slice(i));
  }

  function setStatus(message, { isError = false, retry = false } = {}) {
    els.status.replaceChildren();
    els.status.hidden = !message;
    els.status.classList.toggle("error", isError);
    if (!message) return;
    const p = document.createElement("p");
    p.textContent = message;
    els.status.append(p);
    if (retry) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = "Try again";
      btn.addEventListener("click", load);
      els.status.append(btn);
    }
  }

  /* ---------- Data ---------- */

  function toProducts(rows, headers) {
    const modelHeader = headers.find((h) => h.trim().toLowerCase() === "model");
    if (!modelHeader) return [];
    const otherHeaders = headers.filter((h) => h !== modelHeader && h.trim() !== "");
    const usedSlugs = new Set();

    return rows
      .map((row) => {
        const model = (row[modelHeader] || "").trim();
        if (!model) return null;

        let slug = slugify(model);
        for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(model)}-${n}`;
        usedSlugs.add(slug);

        const fields = otherHeaders.map((h) => ({
          key: h.trim().toLowerCase(),
          label: prettyLabel(h),
          value: (row[h] || "").trim(),
        }));

        const haystack = [model, ...fields.filter((f) => !isUrl(f.value)).map((f) => f.value)]
          .join(" \u0000 ")
          .toLowerCase();

        return { model, slug, fields, haystack };
      })
      .filter(Boolean);
  }

  function load() {
    setStatus("Loading specifications…");
    els.list.replaceChildren();

    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      skipEmptyLines: "greedy",
      complete(results) {
        products = toProducts(results.data, results.meta.fields || []);
        if (products.length === 0) {
          setStatus("No products were found in the data sheet.", { isError: true, retry: true });
          return;
        }
        setStatus("");
        render();
        openFromHash();
      },
      error(err) {
        console.error("Error loading sheet:", err);
        setStatus("Couldn't load the specifications. Check your connection and try again.", {
          isError: true,
          retry: true,
        });
      },
    });
  }

  /* ---------- Rendering ---------- */

  function buildCard(product, term) {
    const card = document.createElement("details");
    card.className = "product";
    card.id = product.slug;

    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.className = "product-name";
    appendHighlighted(title, product.model, term);
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.setAttribute("aria-hidden", "true");
    summary.append(title, chevron);

    const specs = document.createElement("dl");
    specs.className = "spec-grid";
    const links = document.createElement("div");
    links.className = "spec-links";

    for (const field of product.fields) {
      if (isUrl(field.value)) {
        const a = document.createElement("a");
        a.className = "btn btn-link";
        a.href = field.value;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = field.key.includes("datasheet") ? `⬇ ${field.label}` : `${field.label} ↗`;
        links.append(a);
        continue;
      }
      const row = document.createElement("div");
      row.className = "spec-row";
      const dt = document.createElement("dt");
      dt.textContent = field.label;
      const dd = document.createElement("dd");
      if (field.value) {
        appendHighlighted(dd, field.value, term);
      } else {
        dd.textContent = "—";
        dd.classList.add("empty");
        dd.setAttribute("aria-label", "Not specified");
      }
      row.append(dt, dd);
      specs.append(row);
    }

    const content = document.createElement("div");
    content.className = "product-body";
    content.append(specs);
    if (links.childElementCount) content.append(links);

    card.append(summary, content);
    return card;
  }

  function render() {
    const raw = els.search.value.trim();
    const term = raw.toLowerCase();
    const openSlugs = new Set(
      [...els.list.querySelectorAll("details[open]")].map((d) => d.id)
    );

    const matches = term ? products.filter((p) => p.haystack.includes(term)) : products;

    const frag = document.createDocumentFragment();
    for (const p of matches) {
      const card = buildCard(p, term);
      if (openSlugs.has(p.slug)) card.open = true;
      frag.append(card);
    }
    els.list.replaceChildren(frag);

    const plural = (n) => `${n} ${NOUN}${n === 1 ? "" : "s"}`;
    if (!term) {
      els.count.textContent = `${plural(products.length)}`;
    } else if (matches.length) {
      els.count.textContent = `${matches.length} of ${plural(products.length)} match “${raw}”`;
    } else {
      els.count.textContent = `No ${NOUN}s match “${raw}”`;
    }

    if (term && !matches.length) {
      setStatus(`No results for “${raw}”. Try a shorter search or a different spec value.`);
    } else if (!els.status.classList.contains("error")) {
      setStatus("");
    }

    els.clear.hidden = !raw;
    els.expandAll.disabled = els.collapseAll.disabled = matches.length === 0;
  }

  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const card = document.getElementById(id);
    if (card && card.tagName === "DETAILS") {
      card.open = true;
      card.scrollIntoView({ block: "start" });
    }
  }

  /* ---------- Search ---------- */

  function syncUrl() {
    const url = new URL(location.href);
    const q = els.search.value.trim();
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  }

  let debounce;
  els.search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      render();
      syncUrl();
    }, 120);
  });

  function clearSearch() {
    els.search.value = "";
    render();
    syncUrl();
    els.search.focus();
  }

  els.clear.addEventListener("click", clearSearch);

  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.search.value) {
      e.preventDefault();
      clearSearch();
    }
  });

  // Press "/" anywhere to jump to search.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
    e.preventDefault();
    els.search.focus();
  });

  els.expandAll.addEventListener("click", () => {
    els.list.querySelectorAll("details").forEach((d) => (d.open = true));
  });
  els.collapseAll.addEventListener("click", () => {
    els.list.querySelectorAll("details").forEach((d) => (d.open = false));
  });

  window.addEventListener("hashchange", openFromHash);

  /* ---------- Start ---------- */

  const initialQuery = new URLSearchParams(location.search).get("q");
  if (initialQuery) els.search.value = initialQuery;

  if (typeof Papa === "undefined") {
    setStatus("Couldn't load the page's data tools. Please refresh the page.", { isError: true });
  } else {
    load();
  }
})();
