document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const themeToggle = document.getElementById("themeToggle");
  
    // Check if the button was found
    if (!themeToggle) {
      console.error("Theme toggle button not found!");
      return;
    }
  
    // Load saved theme
    if (localStorage.getItem("theme") === "dark") {
      body.classList.add("dark");
      themeToggle.textContent = "☀️";
    }
  
    themeToggle.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark");
      themeToggle.textContent = isDark ? "☀️" : "🌙";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });

  

    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTI34lxrAWXmVwfwTukxCbWtKRNcAK1WV3r7SieyULannTwpsRF2WXBS35VJj0kH-3tLPXzTkye2kyI/pub?output=csv";
    const doorList = document.getElementById("doorList");
    const searchInput = document.getElementById("searchInput");
    const noResults = document.getElementById("noResults");

    let doorsData = [];
  
    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      complete: function (results) {
        doorsData = results.data;
        console.log("Parsed data:", results.data);
        displayDoors(doorsData);
      },
      error: function (err) {
        console.error("Error loading sheet:", err);
        doorList.innerHTML = "<p>Error loading door data.</p>";
      }
    });
  
    function displayDoors(doors) {
      doorList.innerHTML = "";
  
      doors.forEach(door => {
        if (!door.model) return; // Skip empty rows
  
        const wrapper = document.createElement("div");
        wrapper.className = "door-spec";
  
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "door-toggle";
        toggleBtn.innerHTML = `
          <span class="label">Model: ${door.model}</span>
          <span class="arrow">▶</span>
        `;
  
        const specsDiv = document.createElement("div");
        specsDiv.className = "specs";
        specsDiv.style.display = "none";
    
        const specsList = document.createElement("ul");

        Object.keys(door).forEach(key => {
            if (key.toLowerCase() === "model") return;
          
            const label = key
              .replace(/-/g, " ")
              .replace(/\b\w/g, char => char.toUpperCase());
          
            const value = door[key]?.trim() || "N/A";
          
            const li = document.createElement("li");
          
            if (value.startsWith("http")) {
              li.innerHTML = `${label}: <a href="${value}" target="_blank">${value.includes("Download") ? "Download" : value}</a>`;
            } else {
              li.textContent = `${label}: ${value}`;
            }
          
            specsList.appendChild(li);
          });
          


        specsDiv.appendChild(specsList);
  
        toggleBtn.addEventListener("click", () => {
          const isOpen = specsDiv.style.display === "block";
          specsDiv.style.display = isOpen ? "none" : "block";
          toggleBtn.classList.toggle("open", !isOpen);
        });
  
        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(specsDiv);
        doorList.appendChild(wrapper);
      });
    }
  

searchInput.addEventListener("input", () => {
  const filter = searchInput.value.trim().toLowerCase();

  const filtered = doorsData.filter(door =>
    door.model && door.model.toLowerCase().includes(filter)
  );

  // Show or hide "No results"
  if (filtered.length === 0) {
    noResults.textContent = `🔍 No results found for "${searchInput.value}"`;
    noResults.classList.add("visible");
  } else {
    noResults.classList.remove("visible");
  }

  displayDoors(filtered);
});          
});

  


