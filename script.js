const realm = "drakthul"; // všetky tvoje postavy sú na Drak'thul
let characters = JSON.parse(localStorage.getItem("characters")) || [];
let currentChar = localStorage.getItem("currentChar") || null;

const rioRating = document.getElementById("rioRating");
const grid = document.getElementById("grid");
const characterList = document.getElementById("characterList");

// Načítaj zoznam postáv do selectu
function updateCharacterList() {
  characterList.innerHTML = "";
  characters.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    if (name === currentChar) option.selected = true;
    characterList.appendChild(option);
  });
}

// Pridanie postavy
function addCharacter() {
  const input = document.getElementById("charName");
  const name = input.value.trim();
  if (!name) return;

  if (!Array.isArray(characters)) {
    characters = [];
  }

  if (!characters.includes(name)) {
    characters.push(name);
    currentChar = name;
    localStorage.setItem("characters", JSON.stringify(characters));
    localStorage.setItem("currentChar", currentChar);
    updateCharacterList();
    fetchCharacterData(name);
  }
  input.value = "";
}

// Prepnutie postavy
function switchCharacter(name) {
  currentChar = name;
  localStorage.setItem("currentChar", currentChar);
  fetchCharacterData(name);
}

// Fetch z Raider.IO
async function fetchCharacterData(name) {
  rioRating.textContent = "Načítavam...";
  grid.innerHTML = "";
  try {
    const res = await fetch(`https://raider.io/api/v1/characters/profile?region=eu&realm=${realm}&name=${name}&fields=mythic_plus_best_runs,mythic_plus_scores_by_season:current`);
    const data = await res.json();
    renderData(data);
  } catch (err) {
    rioRating.textContent = "Chyba pri načítaní dát.";
    console.error(err);
  }
}

// Render dát
function renderData(data) {
  rioRating.textContent = `M+ Rating: ${data.mythic_plus_scores_by_season[0].scores.all}`;

  grid.innerHTML = "";
  data.mythic_plus_best_runs.forEach((run, idx) => {
    const clearMin = Math.floor(run.clear_time_ms / 1000 / 60);
    const clearSec = Math.floor((run.clear_time_ms / 1000) % 60);
    const limitMin = Math.floor(run.par_time_ms / 1000 / 60);

    const card = document.createElement("div");
    card.className = `card counter-${idx}`;
    card.innerHTML = `
      <h2>${run.dungeon}</h2>
      <div class="level">+${run.mythic_level}</div>
      <div class="score">Score: ${run.score}</div>
      <div class="time">${clearMin}m ${clearSec}s / ${limitMin}m</div>
    `;
    grid.appendChild(card);
  });
}

// Inicializácia
updateCharacterList();
if (currentChar) {
  fetchCharacterData(currentChar);
}
