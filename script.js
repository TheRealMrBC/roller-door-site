document.addEventListener("DOMContentLoaded", () => {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTI34lxrAWXmVwfwTukxCbWtKRNcAK1WV3r7SieyULannTwpsRF2WXBS35VJj0kH-3tLPXzTkye2kyI/pub?output=csv";
    const doorList = document.getElementById("doorList");
    const searchInput = document.getElementById("searchInput");
  
    let doorsData = [];
  
    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      complete: function (results) {
        doorsData = results.data;
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
  
        const colorList = door.colors.split(";").join(", ");
  
        const specsList = document.createElement("ul");
        specsList.innerHTML = `
          <li>Type: ${door.type}</li>
          <li>Width: ${door.width}</li>
          <li>Height: ${door.height}</li>
          <li>Material: ${door.material}</li>
          <li>Color Options: ${colorList}</li>
        `;
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
      const filter = searchInput.value.toLowerCase();
      const filtered = doorsData.filter(door =>
        JSON.stringify(door).toLowerCase().includes(filter)
      );
      displayDoors(filtered);
    });
  });
  