// --- script.js (kompletný) ---

/* --------------------
   Pomocné: normalizácia mien dungeonov
   odstráni rôzne apostrofy/pomlčky/diakritiku a zmení na lowercase
   -------------------- */
function normalizeName(s) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")              // diakritika
    .replace(/[\u2019\u2018\u0060\u02BB\u2032]/g, "'") // rôzne apostrofy -> '
    .replace(/[\u2013\u2014\u2212\u002D]/g, "-")  // rôzne pomlčky -> -
    .replace(/[^a-zA-Z0-9'\- ]+/g, " ")          // povolené znaky
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* --------------------
   Raw mapovanie (čitateľné názvy -> obrázky)
   Ak chceš, môžeš sem doplniť ďalšie názvy.
   -------------------- */
const rawDungeonBackgrounds = {
  "Eco-Dome Al'dani": "eco.jpg",
  "Eco-Dome Al'dari": "eco.jpg", // tolerancia variant
  "Ara-Kara, City of Echoes": "ara.jpg",
  "The Dawnbreaker": "dawn.jpg",
  "Priory of the Sacred Flame": "priory.jpg",
  "Operation: Floodgate": "flood.jpg",
  "Halls of Atonement": "halls.jpg",
  "Tazavesh: Streets of Wonder": "streets.jpg",
  "Tazavesh: So'leah's Gambit": "gambit.jpg"
};

// vytvoríme normalizovanú mapu: normalizedName -> filename
const dungeonBackgrounds = {};
Object.entries(rawDungeonBackgrounds).forEach(([name, img]) => {
  dungeonBackgrounds[normalizeName(name)] = img;
});

// Debug (môžeš zakomentovať ak chceš)
console.log("Dungeon bg keys:", Object.keys(dungeonBackgrounds));

/* --------------------
   Načítanie realms.json (lokálny súbor)
   -------------------- */
async function loadRealms() {
  try {
    const res = await fetch("realms.json");
    if (!res.ok) throw new Error(`realms.json load failed: ${res.status}`);
    const realms = await res.json();
    const realmSelect = document.getElementById("realm");
    if (!realmSelect) return;

    // clear a pridaj
    realmSelect.innerHTML = `<option value="">Vyber realm</option>`;
    realms.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.slug ?? r;
      opt.textContent = r.name ?? r;
      realmSelect.appendChild(opt);
    });
    console.log("Loaded realms:", realmSelect.options.length - 1);
  } catch (err) {
    console.error("Chyba pri načítaní realms.json:", err);
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
  select.innerHTML = `<option value="">-- vyber postavu --</option>`;

  characters.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${c.name} (${c.realm}, ${c.region})`;
    select.appendChild(opt);
  });

  // change handler: načítať vybranú postavu
  select.onchange = (e) => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx)) {
      loadCharacterData(characters[idx]);
    }
  };

  // remove button
  const removeBtn = document.getElementById("removeCharacter");
  if (removeBtn) {
    removeBtn.onclick = () => {
      const idx = parseInt(select.value, 10);
      if (isNaN(idx)) return;
      characters.splice(idx, 1);
      saveCharacters();
      renderCharacterList();
      document.getElementById("dungeons").innerHTML = "<p>Žiadna postava nie je pridaná.</p>";
      updateMythicRating("-");
    };
  }
}

/* --------------------
   Pridanie postavy (s kontrolou duplicit)
   -------------------- */
async function addCharacter() {
  const region = document.getElementById("region").value;
  const realm = document.getElementById("realm").value;
  const name = document.getElementById("character").value.trim();

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
    // už existuje -> vyber a načítaj
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
   Požiadame o mythic_plus_best_runs aj mythic_plus_scores_by_season (current)
   -------------------- */
async function loadCharacterData(char) {
  try {
    const url = `https://raider.io/api/v1/characters/profile?region=${char.region}&realm=${encodeURIComponent(char.realm)}&name=${encodeURIComponent(char.name)}&fields=mythic_plus_best_runs:all:1,mythic_plus_scores_by_season:current`;
    console.log("Fetching Raider.IO:", url);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Raider.IO ${res.status}`);
    const data = await res.json();
    console.log("Received data:", data);

    // rating: preferujeme mythic_plus_scores_by_season[0].scores.all
    let rating = "Žiadny rating";
    try {
      if (Array.isArray(data.mythic_plus_scores_by_season) && data.mythic_plus_scores_by_season.length > 0) {
        rating = data.mythic_plus_scores_by_season[0]?.scores?.all ?? "Žiadny rating";
      } else if (data.mythic_plus_scores) {
        rating = data.mythic_plus_scores.all ?? "Žiadny rating";
      }
    } catch (err) {
      console.warn("Rating parse fallback:", err);
      rating = data.mythic_plus_scores?.all ?? "Žiadny rating";
    }

    updateMythicRating(rating);
    renderDungeons(data);
  } catch (err) {
    console.error("Chyba pri načítaní dát pre postavu:", err);
    const container = document.getElementById("dungeons");
    if (container) container.innerHTML = "<p>Chyba pri načítaní dát.</p>";
    updateMythicRating("Žiadny rating");
  }
}

/* --------------------
   Render dungeonov (2x4 alebo 4x2 podľa CSS)
   -------------------- */
function renderDungeons(data) {
  const container = document.getElementById("dungeons");
  if (!container) return;
  container.innerHTML = "";

  const runs = data?.mythic_plus_best_runs ?? [];
  if (!runs || runs.length === 0) {
    container.innerHTML = "<p>Žiadne dokončené runy.</p>";
    return;
  }

  // zobrazíme prvých 8 runov (pokiaľ by ich API vracalo viac)
  const runsToShow = runs.slice(0, 8);

  runsToShow.forEach(run => {
    const div = document.createElement("div");
    div.className = "dungeon";

    // nájdeme pozadie cez normalizované kľúče
    const key = normalizeName(run.dungeon);
    const bg = dungeonBackgrounds[key] || null;
    if (bg) {
      div.style.backgroundImage = `url('${bg}')`;
      div.style.backgroundSize = "cover";
      div.style.backgroundPosition = "center";
    }

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
      time.textContent = "Nedokončené";
    }
    div.appendChild(time);

    container.appendChild(div);
  });
}

/* --------------------
   Farebný Mythic+ Rating + animácia (bez rozbitia)
   rating môže byť číslo alebo text ("Žiadny rating")
   -------------------- */
function updateMythicRating(rating) {
  const el = document.getElementById("mythicRating");
  if (!el) return;

  el.textContent = `Mythic+ Rating: ${rating}`;

  // ak je to string, pokúsime sa z neho dostať číslo
  const num = typeof rating === "number" ? rating : Number(rating);
  let color = "#cccccc"; // default / šedé
  if (!Number.isFinite(num) || num <= 0) {
    color = "#cccccc";
  } else if (num >= 2500) {
    color = "#ff8000"; // legendary
  } else if (num >= 2000) {
    color = "#a335ee"; // epic
  } else if (num >= 1500) {
    color = "#0070dd"; // rare
  } else {
    color = "#1eff00"; // uncommon / green
  }

  el.style.color = color;

  // krátke "flash" zvýraznenie pri aktualizácii (len ak je number)
  if (Number.isFinite(num) && num > 0) {
    el.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.04)", filter: "brightness(1.25)" },
        { transform: "scale(1)", filter: "brightness(1)" }
      ],
      { duration: 700, easing: "ease-out" }
    );
  }
}

/* --------------------
   Inicializácia pri načítaní stránky
   -------------------- */
window.addEventListener("DOMContentLoaded", () => {
  // priradíme tlačidlo Pridať (ak nie je onclick v HTML)
  const addBtn = document.querySelector("button[onclick='addCharacter()']") || document.getElementById("addCharacter");
  if (addBtn) addBtn.onclick = addCharacter;

  loadRealms();
  renderCharacterList();

  if (characters.length > 0) {
    loadCharacterData(characters[0]);
    const savedSelect = document.getElementById("savedCharacters");
    if (savedSelect) savedSelect.value = 0;
  } else {
    const d = document.getElementById("dungeons");
    if (d) d.innerHTML = "<p>Žiadna postava nie je pridaná.</p>";
  }
});
