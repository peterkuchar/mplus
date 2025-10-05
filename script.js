/* --------------------
   Pomocné: normalizácia mien dungeonov
   -------------------- */
function normalizeName(s) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019\u2018\u0060\u02BB\u2032]/g, "'")
    .replace(/[\u2013\u2014\u2212\u002D]/g, "-")
    .replace(/[^a-zA-Z0-9'\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* --------------------
   Mapa dungeonov -> obrázky
   -------------------- */
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

const dungeonBackgrounds = {};
Object.entries(rawDungeonBackgrounds).forEach(([name, img]) => {
  dungeonBackgrounds[normalizeName(name)] = img;
});

const dungeonOrder = Object.keys(rawDungeonBackgrounds);

/* --------------------
   Načítanie realms.json
   -------------------- */
async function loadRealms() {
  try {
    const res = await fetch("realms.json");
    if (!res.ok) throw new Error(`realms.json load failed: ${res.status}`);
    const realms = await res.json();
    const realmSelect = document.getElementById("realm");
    realmSelect.innerHTML = `<option value="">-- choose realm --</option>`;
    realms.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.slug ?? r;
      opt.textContent = r.name ?? r;
      realmSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Error at loading realms.json:", err);
  }
}

/* --------------------
   Správa postáv (localStorage)
   -------------------- */
let characters = JSON.parse(localStorage.getItem("characters")) || [];

function saveCharacters() {
  localStorage.setItem("characters", JSON.stringify(characters));
}

function renderCharacterList() {
  const select = document.getElementById("savedCharacters");
  if (!select) return;
  select.innerHTML = `<option value="">-- choose character --</option>`;

  characters.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${c.name} (${c.realm}, ${c.region})`;
    select.appendChild(opt);
  });

  select.onchange = e => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx)) loadCharacterData(characters[idx]);
  };

  const removeBtn = document.getElementById("removeCharacter");
  if (removeBtn) {
    removeBtn.onclick = () => {
      const idx = parseInt(select.value, 10);
      if (isNaN(idx)) return;
      characters.splice(idx, 1);
      saveCharacters();
      renderCharacterList();
      document.getElementById("dungeons").innerHTML = "<p>No character is selected.</p>";
      updateMythicRating("-");
    };
  }
}

/* --------------------
   Pridanie postavy
   -------------------- */
async function addCharacter() {
  const region = document.getElementById("region").value;
  const realm = document.getElementById("realm").value;
  const name = document.getElementById("character").value.trim();

  if (!region || !realm || !name) {
    alert("Fill all fields!");
    return;
  }

  const existingIndex = characters.findIndex(c =>
    c.region.toLowerCase() === region.toLowerCase() &&
    c.realm.toLowerCase() === realm.toLowerCase() &&
    c.name.toLowerCase() === name.toLowerCase()
  );

  if (existingIndex !== -1) {
    document.getElementById("savedCharacters").value = existingIndex;
    loadCharacterData(characters[existingIndex]);
    return;
  }

  const newChar = { region, realm, name };
  characters.push(newChar);
  saveCharacters();
  renderCharacterList();
  document.getElementById("character").value = "";
  loadCharacterData(newChar);
}

/* --------------------
   Načítanie dát z Raider.IO
   -------------------- */
async function loadCharacterData(char) {
  try {
    const url = `https://raider.io/api/v1/characters/profile?region=${char.region}&realm=${encodeURIComponent(char.realm)}&name=${encodeURIComponent(char.name)}&fields=mythic_plus_best_runs:all:1,mythic_plus_scores_by_season:current,gear`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Raider.IO ${res.status}`);
    const data = await res.json();

    const rating = data.mythic_plus_scores_by_season?.[0]?.scores?.all ?? "No rating";
    updateMythicRating(rating);
    updateCharacterInfo(data);
    renderDungeons(data);
  } catch (err) {
    console.error("Error at reading data for character:", err);
    document.getElementById("dungeons").innerHTML = "<p>ERROR at reading data.</p>";
    updateMythicRating("No rating");
  }
}

/* --------------------
   Info o postave
   -------------------- */
function updateCharacterInfo(data) {
  const el = document.getElementById("charInfo");
  if (!el) return;
  const name = data.name ?? "-";
  const race = data.race ?? "-";
  const cls = data.class ?? "-";
  const spec = data.active_spec_name ?? "-";
  const ilvl = data.gear?.item_level_equipped ?? "-";
  el.textContent = `${name} | ${race} | ${cls} | ${spec} | ${ilvl} ilvl`;
}

/* --------------------
   Render dungeonov (8, aj neodohrané)
   -------------------- */
function renderDungeons(data) {
  const container = document.getElementById("dungeons");
  container.innerHTML = "";

  const runs = data?.mythic_plus_best_runs ?? [];

  // Mapa: dungeonName -> runData
  const runMap = {};
  runs.forEach(run => runMap[normalizeName(run.dungeon)] = run);

  dungeonOrder.forEach(dName => {
    const norm = normalizeName(dName);
    const bg = dungeonBackgrounds[norm];
    const div = document.createElement("div");
    div.className = "dungeon";

    div.style.backgroundImage = `url('${bg}')`;
    div.style.backgroundSize = "cover";
    div.style.backgroundPosition = "center";

    const run = runMap[norm];
    if (!run) {
      // neodohraný dungeon → grayscale
      div.style.filter = "grayscale(100%) brightness(0.6)";
    } else {
      const title = document.createElement("h3");
      title.textContent = run.dungeon;
      div.appendChild(title);

      const level = document.createElement("div");
      level.className = "level";
      level.textContent = `+${run.mythic_level}`;
      div.appendChild(level);

      const score = document.createElement("div");
      score.className = "score";
      score.textContent = `Score: ${run.score ? Math.round(run.score) : 0}`;
      div.appendChild(score);

      const time = document.createElement("div");
      time.className = "time";
      if (run.clear_time_ms != null && run.par_time_ms != null) {
        const formatTime = ms => {
          const totalSeconds = Math.floor(ms / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        };
        time.textContent = `${formatTime(run.clear_time_ms)} / ${Math.floor(run.par_time_ms / 60000)}`;
      } else {
        time.textContent = "UNFINISHED";
      }
      div.appendChild(time);
    }

    container.appendChild(div);
  });
}

/* --------------------
   Farebný Mythic+ Rating
   -------------------- */
function updateMythicRating(rating) {
  const el = document.getElementById("mythicRating");
  if (!el) return;
  el.textContent = `Mythic+ Rating: ${rating}`;

  const num = typeof rating === "number" ? rating : Number(rating);
  let color = "#ccc";
  if (num >= 2500) color = "#ff8000";
  else if (num >= 2000) color = "#a335ee";
  else if (num >= 1500) color = "#0070dd";
  else if (num >= 1) color = "#1eff00";

  el.style.color = color;

  if (Number.isFinite(num) && num > 0) {
    el.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.05)", filter: "brightness(1.25)" },
        { transform: "scale(1)", filter: "brightness(1)" }
      ],
      { duration: 700, easing: "ease-out" }
    );
  }
}

/* --------------------
   Inicializácia
   -------------------- */
window.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.querySelector("button[onclick='addCharacter()']") || document.getElementById("addCharacter");
  if (addBtn) addBtn.onclick = addCharacter;

  loadRealms();
  renderCharacterList();

  if (characters.length > 0) {
    loadCharacterData(characters[0]);
    const savedSelect = document.getElementById("savedCharacters");
    if (savedSelect) savedSelect.value = 0;
  } else {
    document.getElementById("dungeons").innerHTML = "<p>No character is selected.</p>";
  }
});
