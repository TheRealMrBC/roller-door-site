# 🚪 Roller Door & Controller Specification Viewer

A responsive, searchable, and dark-mode-compatible website for displaying detailed specifications of roller doors and door controllers, sourced dynamically from Google Sheets.

## ✨ Features

- 🔍 Real-time search across model names and every spec value, with match highlighting
- 🔗 Shareable searches (`?q=...`) and direct links to a model (`#model-name`)
- ⌨️ Press `/` to jump to search, `Esc` to clear it
- 🌗 Light/Dark mode that follows your system setting, with saved preference and no flash on load
- 📄 Expandable spec sections for each product, plus Expand all / Collapse all
- 📱 Mobile-responsive layout with smooth animations
- 📤 Data loaded from Google Sheets (CSV)
- 🧭 Easy navigation between Roller Doors and Controllers
- 🧠 Clean, well-documented code with professional styling
- 🔗 Downloadable links for product and technical datasheets

## 🖼️ Demo

> [Live Demo on GitHub Pages](https://www.rollerdoordb.co.uk/)  

---

## 📁 File Structure

```plaintext
/
├── index.html               # Roller doors page (sheet URL set on <body data-sheet-url>)
├── controllers.html         # Door controllers page (sheet URL set on <body data-sheet-url>)
├── app.js                   # Shared logic: loading, search, rendering, theme
├── styles.css               # Theme, layout, animations
├── datasheets/              # PDFs hosted on this site (see datasheets/README.md)
├── images/favicon.ico       # Tab icon
├── README.md                # This file
```

---

## 🔌 Data Source

- Data is pulled from **Google Sheets** in CSV format using [PapaParse](https://www.papaparse.com/).
- To update door or controller info, simply modify the Google Sheet. Each page's sheet URL is the `data-sheet-url` attribute on its `<body>` tag.
- The sheet needs a `Model` column. Every other column becomes a spec row, in sheet order. Columns containing links show as buttons, and columns with "datasheet" in the name are labelled as downloads.

### 📎 Hosting datasheets on this site

Manufacturer links break when they reorganise their websites (404 errors). To stop that, upload the PDF to the `datasheets/` folder and put its path in the sheet instead of the manufacturer's link, e.g. `datasheets/excel-77-technical.pdf`. Both kinds of link work side by side, so you can move models over one at a time. See [`datasheets/README.md`](datasheets/README.md) for step-by-step instructions.

### 🤖 Fetching all the PDFs automatically

The **Fetch datasheets** GitHub job downloads every PDF linked from both sheets into `datasheets/`. When a manufacturer link is broken, it saves the newest copy from the Internet Archive's Wayback Machine instead. It then opens a pull request with the PDFs and a report listing what to put in each sheet cell, and which PDFs couldn't be found anywhere.

To run it: **Actions** tab → **Fetch datasheets** → **Run workflow**. Tick *only broken* to leave working manufacturer links alone. It's safe to run again later; PDFs already saved aren't downloaded again.

One-time setup: GitHub must be allowed to open pull requests for you. Go to **Settings → Actions → General → Workflow permissions** and tick **Allow GitHub Actions to create and approve pull requests**.

---

## 🎨 Theme Customization

- All colors are defined using CSS variables in `styles.css`
- To change themes or branding, just update the variables near the top of the file

---

## 🙌 Acknowledgements

- [PapaParse](https://www.papaparse.com/) for CSV parsing
- Google Sheets for easy content management
