# 🚪 Roller Door & Controller Specification Viewer

A responsive, searchable, and dark-mode-compatible website for displaying detailed specifications of roller doors and door controllers, sourced dynamically from Google Sheets.

## ✨ Features

- 🔍 Real-time search by model name
- 🌗 Light/Dark mode toggle with saved preference
- 📄 Expandable spec sections for each product
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
├── index.html               # Main page for roller doors
├── controllers.html         # Second page for door controllers
├── script.js                # Logic for loading & displaying roller door data
├── controllers.js           # Logic for controller data
├── styles.css               # Theme, layout, animations
├── favicon.ico              # Tab icon
├── README.md                # This file
```

---

## 🔌 Data Source

- Data is pulled from **Google Sheets** in CSV format using [PapaParse](https://www.papaparse.com/).
- To update door or controller info, simply modify the Google Sheet linked in your scripts.

---

## 🎨 Theme Customization

- All colors are defined using CSS variables in `styles.css`
- To change themes or branding, just update the variables near the top of the file

---

## 🙌 Acknowledgements

- [PapaParse](https://www.papaparse.com/) for CSV parsing
- Google Sheets for easy content management
