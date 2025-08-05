// controllers.js

/**
 * Handles the display of door controller data from a Google Sheet.
 * This script fetches the data, parses it using PapaParse, and
 * dynamically creates collapsible UI elements for each controller.
 */

// Wait for the DOM to be fully loaded before running scripts
document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
// Handle theme toggle button for dark/light mode
    const themeToggle = document.getElementById("themeToggle");
  
    // Safety check to ensure theme toggle button exists
    if (!themeToggle) {
      console.error("Theme toggle button not found!");
      return;
    }
  
    // Initialize theme from localStorage if previously saved
    if (localStorage.getItem("theme") === "dark") {
      body.classList.add("dark");
// Handle theme toggle button for dark/light mode
      themeToggle.textContent = "☀️"; // Indicate light mode toggle
    }
  
    // Toggle theme mode on click
// Handle theme toggle button for dark/light mode
    themeToggle.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark");
// Handle theme toggle button for dark/light mode
      themeToggle.textContent = isDark ? "☀️" : "🌙";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  
    // Define constants for UI elements and sheet URL
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTERjt8-EVQ4R3r4ZjzqSVUeQooVKbNo5YzikgWX_SzrYBt3FmjDxQigeGv6pG6a4qELL-cRGIOCzFf/pub?output=csv";
    const doorList = document.getElementById("doorList");
    const searchInput = document.getElementById("searchInput");
    const noResults = document.getElementById("noResults");
    let doorsData = [];
  
    // Fetch and parse CSV data from Google Sheets
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
        loading.textContent = "Failed to load data.";
        console.log("Normalized data:", doorsData);
        displayDoors(doorsData);
      },
      error: function (err) {
        console.error("Error loading sheet:", err);
        doorList.innerHTML = "<p>Error loading door data.</p>";
      }
    });
  
    /**
     * Dynamically creates and displays door specifications as collapsible UI cards.
     * @param {Array<Object>} doors - Array of door data objects
     */
// Render the product data as expandable/collapsible cards
    function displayDoors(doors) {
      doorList.innerHTML = ""; // Clear existing list
  
      doors.forEach(door => {
        if (!door.model) return; // Skip entries with no model
  
        // Container for each door specification
        const wrapper = document.createElement("div");
        wrapper.className = "door-spec";
  
        // Toggle button to expand/collapse specifications
        const toggleBtn = document.createElement("button");
        const uniqueId = `specs-${Math.random().toString(36).substr(2, 9)}`;
        toggleBtn.className = "door-toggle";
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.setAttribute("aria-controls", uniqueId);
        toggleBtn.innerHTML = `
          <span class="label">Model: ${door.model}</span>
          <span class="arrow">▶</span>
        `;
  
        // Specifications container
        const specsDiv = document.createElement("div");
        specsDiv.className = "specs";
        specsDiv.id = uniqueId;
  
        const specsList = document.createElement("ul");
  
        // Populate list with key-value pairs
        Object.keys(door).forEach(key => {
          if (key.toLowerCase() === "model") return;
  
          const label = key
            .replace(/-/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
  
          const value = door[key]?.trim() || "N/A";
  
          const li = document.createElement("li");
  
          // Display links as anchor elements
          if (value.startsWith("http")) {
            const displayText = key.includes("datasheet") ? "Download" : value;
            li.innerHTML = `${label}: <a href="${value}" target="_blank">${displayText}</a>`;
          } else {
            li.textContent = `${label}: ${value}`;
          }
  
          specsList.appendChild(li);
        });
  
        specsDiv.appendChild(specsList);
  
        // Event listener to toggle visibility
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
  
    // Search input handler: filters displayed doors by model
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
  
    // Clear search field and reset display
    const clearBtn = document.getElementById("clearSearch");
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      noResults.classList.remove("visible");
      displayDoors(doorsData);
    });
  });
  