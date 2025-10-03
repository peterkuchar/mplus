// ----------------------- script.js (kompletný) -----------------------

// pomocná: nájdi select element pre uložené postavy (support pre rôzne id v HTML)
function getSavedCharactersSelect() {
  return document.getElementById("savedCharacters") || document.getElementById("characters") || null;
}

// Normalizácia názvov dungeonov - používame Unicode escapes, nie "fancy" znaky priamo
function normalizeName(s) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")              // odstráni kombinované diakritické znaky
    .replace(/[\u2019\u2018\u0060\u02BB\u2032]/g, "'") // rôzne apostrofy → ASCII '
    .replace(/[\u2013\u2014\u2212\u002D]/g, "-")  // rôzne pomlčky/minusky → ASCII -
    .replace(/[^a-zA-Z0-9'\- ]+/g, " ")          // povolíme len písmená, čísla, apostrof, pomlčku, medzeru
    .replace(/\s+/g, " ")                        // viac medzier -> jedna
    .trim()
    .toLowerCase();
}

// RAW mapovanie (ľudsky čitateľné názvy) - môžeme sem doplniť ďalšie názvy
const rawDungeonBackgrounds = {
  "Eco-Dome Al'dani": "eco.jpg",
  "Ara-Kara, City of Echoes": "ara.jpg",
  "The Dawnbreaker": "dawn.jpg",
  "Priory of the Sacred Flame": "priory.jpg",
  "Operation: Floodgate": "flood.jpg",
  "Halls of Atonement": "halls.jpg",
  "Tazavesh: Streets of Wonder": "streets.jpg",
  "Tazavesh: So'leah's Gambit": "gambit.jpg"
};

// Vytvorime normalizovanu mapu kde kluce su normalized names -> obrazok
const dungeonBackgrounds = {};
Object.entries(rawDungeonBackgrounds).forEach(([k, v]) => {
  dungeonBackgrounds[normalizeName(k)] = v;
});

// Debug: vypis kluce (môžeš to zakomentovať neskôr)
console.log("Dungeon bg keys:", Object.keys(dungeonBackgrounds));

// ----------------------- Realms / Characters / UI -----------------------

let characters = JSON.parse(localStorage.getItem("characters")) || [];
let selectedCharacterIndex = 0;

// Načítanie realms.json a naplnenie <select id="realm">
async function loadRealms() {
  try {
    const res = await fetch("realms.json");
    if (!res.ok) throw new Error(`realms.json load failed: ${res.status}`);
    const realms = await res.json();
    const realmSelect = document.getElementById("realm");
    if (!realmSelect) {
      console.warn("No #realm element found in DOM.");
      return;
    }
    // očistíme a pridáme
    realmSelect.innerHTML = `<option value="">Vyber realm</option>`;
    realms.forEach(r => {
      const opt = document.createElement("option");
      // realms.json expected { name, slug }
      opt.value = r.slug ?? r;        // support plain array of names too
      opt.textContent = r.name ?? r;
      realmSelect.appendChild(opt);
    });
    console.log("Loaded realms:", realmSelect.options.length - 1);
  } catch (err) {
    console.error("Chyba pri načítaní realms.json:", err);
  }
}

function saveCharacters() {
  localStorage.setItem("characters", JSON.stringify(characters));
}

// vykresli ulozene postavy do selectu (support pre 2 mozne id)
function renderCharacterSelect() {
  const select = getSavedCharactersSelect();
  if (!select) {
    console.warn("No saved-characters select found (ids: savedCharacters or characters).");
    return;
  }
  select.innerHTML = `<option value="">-- vyber postavu --</option>`;

  characters.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${c.name} (${c.realm}, ${c.region})`;
    if (i === selectedCharacterIndex) opt.selected = true;
    select.appendChild(opt);
  });
}

// pridaj postavu, alebo ak existuje, vyber ju
async function addCharacter() {
  const regionEl = document.getElementById("region");
  const realmEl = document.getElementById("realm");
  const nameEl = document.getElementById("character");
  if (!regionEl || !realmEl || !nameEl) {
    alert("Chýba niektorý z inputov (region/realm/character).");
    return;
  }
  const region = regionEl.value;
  const realm = realmEl.value;
  const name = nameEl.value.trim();
  if (!region || !realm || !name) {
    alert("Vyplň všetky polia!");
    return;
  }

  const existingIndex = characters.findIndex(c =>
    c.region.toLowerCase() === region.toLowerCase() &&
    c.realm.toLowerCase() === realm.toLowerCase() &&
    c.name.toLowerCase() === name.toLowerCase()
  );

  if (existingIndex !== -1) {
    // ak existuje, len vyber a nacitaj
    selectedCharacterIndex = existingIndex;
    renderCharacterSelect();
    loadCharacterData(characters[existingIndex]);
    return;
  }

  const newChar = { region, realm, name };
  characters.push(newChar);
  selectedCharacterIndex = characters.length - 1;
  saveCharacters();
  renderCharacterSelect();
  // vyciistime meno input
  nameEl.value = "";
  loadCharacterData(newChar);
}

// odstran vybranu postavu
function removeSelectedCharacter() {
  const select = getSavedCharactersSelect();
  if (!select) return;
  const idx = parseInt(select.value, 10);
  if (isNaN(idx)) return;
  characters.splice(idx, 1);
  if (selectedCharacterIndex >= characters.length) selectedCharacterIndex = characters.length - 1;
  saveCharacters();
  renderCharacterSelect();
  if (characters.length > 0) {
    loadCharacterData(characters[selectedCharacterIndex]);
  } else {
    const d = document.getElementById("dungeons");
    if (d) d.innerHTML = "<p>Žiadna postava nie je pridaná.</p>";
  }
}

// vyber postavy zo selectu
function onSelectCharacterChange(e) {
  const idx = parseInt(e.target.value, 10);
  if (isNaN(idx)) return;
  selectedCharacterIndex = idx;
  saveCharacters();
  loadCharacterData(characters[idx]);
}

// ----------------------- Raider.IO fetch + render -----------------------

async function loadCharacterData(char) {
  try {
    const url = `https://raider.io/api/v1/characters/profile?region=${char.region}&realm=${encodeURIComponent(char.realm)}&name=${encodeURIComponent(char.name)}&fields=mythic_plus_scores_by_season:current,mythic_plus_best_runs`;
    console.log("Fetching Raider.IO:", url);

    const response = await fetch(url);
    if (!response.ok) throw new Error("Chyba pri načítaní dát z Raider.IO");

    const data = await response.json();
    console.log("Received data:", data); // <-- tu uvidíš celé dáta

    const ratingEl = document.getElementById("mythicRating");
    if (ratingEl) {
      const rating = data.mythic_plus_scores_by_season[0].scores.all ?? "Žiadny rating";
      ratingEl.textContent = `Mythic+ Rating: ${rating}`;
    }

    renderDungeons(data);
  } catch (error) {
    console.error("Chyba pri načítaní dát pre postavu:", error);
  }
}



function renderDungeons(data) {
  const container = document.getElementById("dungeons");
  if (!container) {
    console.warn("No #dungeons element found.");
    return;
  }
  container.innerHTML = "";

  const runs = (data && data.mythic_plus_best_runs) ? data.mythic_plus_best_runs : [];
  if (runs.length === 0) {
    container.innerHTML = "<p>Žiadne dokončené runy.</p>";
    return;
  }

  //CSS pre grid 2x4
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(2, 1fr)";
  container.style.gridTemplateRows = "repeat(2, auto)";
  container.style.gap = "10px";
  container.style.padding = "20px";

  // Debug: vypisat names a normalized
  console.log("Received runs:", runs.map(r => r.dungeon));

  runs.forEach(run => {
    const div = document.createElement("div");
    div.className = "dungeon";

    // normalizuj nazov a najdi pozadie
    const norm = normalizeName(run.dungeon);
    const bg = dungeonBackgrounds[norm] || null;
    console.log("Run:", run.dungeon, "->", norm, "bg:", bg);

    if (bg) {
      // skontroluj ci subor existuje cez Network tab, alebo ci je cesta spravna
      div.style.backgroundImage = `url('${bg}')`;
      div.style.backgroundSize = "cover";
      div.style.backgroundPosition = "center";
    } else {
      // optional fallback (nepovinne)
      // div.style.backgroundImage = "url('default.jpg')";
    }

    const h3 = document.createElement("h3");
    h3.textContent = run.dungeon;
    div.appendChild(h3);

    const lvl = document.createElement("div");
    lvl.className = "level";
    lvl.textContent = `+${run.mythic_level}`;
    div.appendChild(lvl);

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = `Score: ${run.score ?? 0}`;
    div.appendChild(score);

    const time = document.createElement("div");
    time.className = "time";
    if (run.clear_time_ms != null && run.par_time_ms != null) {
      const totalSeconds = Math.floor(run.clear_time_ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const clearFormatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      const parMinutes = Math.floor(run.par_time_ms / 60000);
      time.textContent = `${clearFormatted} / ${parMinutes}`;
    } else {
      time.textContent = "Nedokončené";
    }
    div.appendChild(time);

    container.appendChild(div);
  });
}

// ----------------------- init -----------------------
window.addEventListener("DOMContentLoaded", () => {
  // load realms and render saved characters
  loadRealms();
  renderCharacterSelect();

  // attach listeners
  const select = getSavedCharactersSelect();
  if (select) select.addEventListener("change", onSelectCharacterChange);

  const addBtn = document.getElementById("addCharacterBtn") || document.querySelector("button[onclick='addCharacter()']");
  if (addBtn) addBtn.addEventListener("click", addCharacter);

  const removeBtn = document.getElementById("removeCharacter") || null;
  if (removeBtn) removeBtn.addEventListener("click", removeSelectedCharacter);

  // if we have characters, auto-load the selected/last one
  if (characters.length > 0) {
    if (selectedCharacterIndex < 0 || selectedCharacterIndex >= characters.length) selectedCharacterIndex = 0;
    loadCharacterData(characters[selectedCharacterIndex]);
  } else {
    const d = document.getElementById("dungeons");
    if (d) d.innerHTML = "<p>Žiadna postava nie je pridaná.</p>";
  }
});
