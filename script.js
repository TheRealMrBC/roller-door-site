// script.js

/**
 * Handles the display of roller door data from a Google Sheet.
 * This script fetches the data, parses it using PapaParse, and
 * dynamically creates collapsible UI elements for each roller door model.
 */

// Wait for the DOM to be fully loaded before running scripts
document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
// Handle theme toggle button for dark/light mode
    const themeToggle = document.getElementById("themeToggle");
  
    // Ensure theme toggle button exists
    if (!themeToggle) {
      console.error("Theme toggle button not found!");
      return;
    }
  
    // Load saved theme preference from localStorage
    if (localStorage.getItem("theme") === "dark") {
      body.classList.add("dark");
// Handle theme toggle button for dark/light mode
      themeToggle.textContent = "☀️"; // Sun icon for switching to light mode
    }
  
    // Toggle light/dark theme on click
// Handle theme toggle button for dark/light mode
    themeToggle.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark");
// Handle theme toggle button for dark/light mode
      themeToggle.textContent = isDark ? "☀️" : "🌙";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  
    // Google Sheets public CSV export URL for door data
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTI34lxrAWXmVwfwTukxCbWtKRNcAK1WV3r7SieyULannTwpsRF2WXBS35VJj0kH-3tLPXzTkye2kyI/pub?output=csv";
  
    // DOM element references
    const doorList = document.getElementById("doorList");
    const searchInput = document.getElementById("searchInput");
    const noResults = document.getElementById("noResults");
    const clearBtn = document.getElementById("clearSearch");
  
    let doorsData = []; // Will hold parsed data
  
    // Use PapaParse to load CSV data from Google Sheets
    const loading = document.getElementById("loadingMessage");
// Parse data from external CSV (Google Sheets) using PapaParse
    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      complete: function (results) {
        loading.style.display = "none";
        doorsData = results.data.map(door => {
          const normalized = {};
          for (const key in door) {
            normalized[key.trim().toLowerCase()] = door[key]?.trim();
          }
          return normalized;
        });
        displayDoors(doorsData);
      },
      error: function (err) {
        loading.textContent = "Failed to load data.";
        console.error("Error loading sheet:", err);
        doorList.innerHTML = "<p>Error loading door data.</p>";
      }
    });
  
    /**
     * Renders each door's data into the DOM as collapsible sections.
     * @param {Array<Object>} doors - List of door data entries
     */
// Render the product data as expandable/collapsible cards
    function displayDoors(doors) {
      doorList.innerHTML = "";
  
      doors.forEach(door => {
        if (!door.model) return; // Skip empty entries
  
        const wrapper = document.createElement("div");
        wrapper.className = "door-spec";
  
        const toggleBtn = document.createElement("button");
        const uniqueId = `specs-${Math.random().toString(36).substr(2, 9)}`;
        toggleBtn.className = "door-toggle";
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.setAttribute("aria-controls", uniqueId);
        toggleBtn.innerHTML = `
          <span class="label">Model: ${door.model}</span>
          <span class="arrow">▶</span>
        `;
  
        const specsDiv = document.createElement("div");
        specsDiv.className = "specs";
        specsDiv.id = uniqueId;
  
        const specsList = document.createElement("ul");
  
        Object.keys(door).forEach(key => {
          if (key.toLowerCase() === "model") return;
  
          const label = key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const value = door[key] || "N/A";
  
          const li = document.createElement("li");
  
          // Turn links into anchor tags if the value is a URL
          if (value.startsWith("http")) {
            const displayText = key.includes("datasheet") ? "Download" : value;
            li.innerHTML = `${label}: <a href="${value}" target="_blank">${displayText}</a>`;
          } else {
            li.textContent = `${label}: ${value}`;
          }
  
          specsList.appendChild(li);
        });
  
        specsDiv.appendChild(specsList);
  
        // Toggle open/close specs
        toggleBtn.addEventListener("click", () => {
          const isOpen = specsDiv.classList.toggle("open");
          toggleBtn.classList.toggle("open");
          toggleBtn.setAttribute("aria-expanded", isOpen);
        });
  
        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(specsDiv);
        doorList.appendChild(wrapper);
      });
    }
  
    // Handle live filtering of doors as user types
// Filter the displayed products in real-time as user types
    searchInput.addEventListener("input", () => {
      const filter = searchInput.value.trim().toLowerCase();
      const filtered = doorsData.filter(door =>
// Only search by the model name field
        door.model && door.model.toLowerCase().includes(filter)
      );
  
      if (filtered.length === 0) {
        noResults.textContent = `🔍 No results found for "${searchInput.value}"`;
        noResults.classList.add("visible");
      } else {
        noResults.classList.remove("visible");
      }
  
      displayDoors(filtered);
    });
  
    // Clear search input and reset the full list
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      noResults.classList.remove("visible");
      displayDoors(doorsData);
    });
  });