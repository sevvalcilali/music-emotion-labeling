const moodContainer = document.getElementById("mood-options");
const emotionContainer = document.getElementById("emotion-groups");
const participantInput = document.getElementById("participant-id");
const statusEl = document.getElementById("status");
const songCounterEl = document.getElementById("song-counter");
const saveBtn = document.getElementById("save-btn");

let currentSongId = null;
let currentSongIndex = 0;
let currentSongTotal = 0;
let hicbiriCheckbox = null;
let isLocked = false;

const turkishMap = {
  ö: "o",
  ü: "u",
  ğ: "g",
  ş: "s",
  ı: "i",
  ç: "c",
  Ö: "o",
  Ü: "u",
  Ğ: "g",
  Ş: "s",
  İ: "i",
  I: "i",
  Ç: "c",
};

function normalizeKey(value) {
  if (!value) return "";
  let output = value.trim().toLowerCase();
  output = output
    .split("")
    .map((char) => turkishMap[char] || char)
    .join("");
  output = output.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  output = output.replace(/\s+/g, "_").replace(/_+/g, "_");
  return output;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function renderMoodOptions(moods) {
  moodContainer.innerHTML = "";

  moods.forEach((mood, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "option-card";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "current_mood";
    input.value = mood;
    input.id = `mood-${index}`;

    const text = document.createElement("span");
    text.textContent = mood;

    wrapper.appendChild(input);
    wrapper.appendChild(text);
    moodContainer.appendChild(wrapper);
  });
}

function renderEmotionGroups(groups) {
  emotionContainer.innerHTML = "";
  hicbiriCheckbox = null;

  Object.entries(groups).forEach(([level1, items]) => {
    const group = document.createElement("div");
    group.className = "group";

    const heading = document.createElement("h3");
    heading.textContent = level1;
    group.appendChild(heading);

    if (level1.toLowerCase() === "hicbiri") {
      const wrapper = document.createElement("label");
      wrapper.className = "option-card";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "hicbiri-checkbox";
      checkbox.value = "hicbiri";
      wrapper.appendChild(checkbox);
      wrapper.appendChild(document.createTextNode("Hicbiri"));
      group.appendChild(wrapper);
      emotionContainer.appendChild(group);
      hicbiriCheckbox = checkbox;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "checkbox-grid";

    items.forEach((item, index) => {
      const label = document.createElement("label");
      label.className = "option-card";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "emotion-checkbox";
      checkbox.dataset.level1 = level1;
      checkbox.dataset.level2 = item;
      checkbox.id = `${normalizeKey(level1)}-${normalizeKey(item)}-${index}`;

      const text = document.createElement("span");
      text.textContent = item;

      label.appendChild(checkbox);
      label.appendChild(text);
      grid.appendChild(label);
    });

    group.appendChild(grid);
    emotionContainer.appendChild(group);
  });

  setupHicbiriHandlers();
}

function setupHicbiriHandlers() {
  const emotionCheckboxes = Array.from(
    document.querySelectorAll(".emotion-checkbox")
  );

  if (!hicbiriCheckbox) {
    return;
  }

  hicbiriCheckbox.addEventListener("change", () => {
    if (hicbiriCheckbox.checked) {
      emotionCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = true;
      });
    } else {
      emotionCheckboxes.forEach((checkbox) => {
        checkbox.disabled = false;
      });
    }
  });

  emotionCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked && hicbiriCheckbox.checked) {
        hicbiriCheckbox.checked = false;
        emotionCheckboxes.forEach((item) => {
          item.disabled = false;
        });
      }
    });
  });
}

function getSelectedMood() {
  const selected = document.querySelector(
    'input[name="current_mood"]:checked'
  );
  if (!selected) return null;
  return `mood.${normalizeKey(selected.value)}`;
}

function getSelectedEmotions() {
  const selected = [];
  document.querySelectorAll(".emotion-checkbox").forEach((checkbox) => {
    if (!checkbox.checked) return;
    const level1 = normalizeKey(checkbox.dataset.level1);
    const level2 = normalizeKey(checkbox.dataset.level2);
    selected.push(`${level1}.${level2}`);
  });
  return selected;
}

function clearSelections() {
  document
    .querySelectorAll('input[name="current_mood"]')
    .forEach((input) => {
      input.checked = false;
    });

  document.querySelectorAll(".emotion-checkbox").forEach((checkbox) => {
    checkbox.checked = false;
  });

  if (hicbiriCheckbox) {
    hicbiriCheckbox.checked = false;
  }
}

function setFormEnabled(enabled) {
  participantInput.disabled = !enabled;
  saveBtn.disabled = !enabled;
  document
    .querySelectorAll('input[name="current_mood"]')
    .forEach((input) => {
      input.disabled = !enabled;
    });
  document.querySelectorAll(".emotion-checkbox").forEach((checkbox) => {
    checkbox.disabled = !enabled;
  });
  if (hicbiriCheckbox) {
    hicbiriCheckbox.disabled = !enabled;
  }
}

function lockForm() {
  isLocked = true;
  setFormEnabled(false);
}

function unlockForm() {
  isLocked = false;
  setFormEnabled(true);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "";
}

function updateSongDisplay(payload) {
  currentSongIndex = payload.index ?? 0;
  currentSongTotal = payload.total ?? 0;

  currentSongId = payload.song_id ?? null;
  const displayIndex = payload.display_index ?? 0;
  const total = payload.total ?? 0;
  if (displayIndex && total) {
    songCounterEl.textContent = `SONG ${displayIndex}/${total}`;
  } else {
    songCounterEl.textContent = "SONG --/--";
  }
}

async function pollCurrentSong() {
  try {
    const payload = await fetchJson("/api/current-song");
    if (payload.song_id !== currentSongId && currentSongId !== null) {
      clearSelections();
      unlockForm();
      setStatus("");
    }
    updateSongDisplay(payload);
  } catch (error) {
    setStatus("Sunucuya baglanilamadi.", true);
  }
}

async function submitAnnotation() {
  if (isLocked) {
    setStatus("Bu sarki icin zaten kayit yaptiniz.", true);
    return;
  }

  const participantId = participantInput.value.trim();
  const currentMood = getSelectedMood();
  const selectedEmotions = getSelectedEmotions();
  const allowEmpty = hicbiriCheckbox ? hicbiriCheckbox.checked : false;

  if (!participantId) {
    setStatus("Participant ID gerekli.", true);
    return;
  }

  if (!currentMood) {
    setStatus("Lutfen ruh halinizi secin.", true);
    return;
  }

  if (selectedEmotions.length === 0 && !allowEmpty) {
    setStatus("En az bir duygu secin veya Hicbiri'ni isaretleyin.", true);
    return;
  }

  if (currentSongId === null) {
    setStatus("Sarki listesi yuklenemedi.", true);
    return;
  }

  const payload = {
    participant_id: participantId,
    song_id: currentSongId,
    current_mood: currentMood,
    selected_emotions: selectedEmotions,
    allow_empty: allowEmpty,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetchJson("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setStatus("Kaydedildi. Yeni sarki icin bekleyin.");
    lockForm();
    await pollCurrentSong();
  } catch (error) {
    setStatus("Kayit basarisiz. Tekrar deneyin.", true);
  }
}

async function init() {
  try {
    const emotionTree = await fetchJson("/client/emotion-tree.json");
    renderMoodOptions(emotionTree.current_mood || []);
    renderEmotionGroups(emotionTree.song_emotions || {});
  } catch (error) {
    setStatus("Duygu agaci yuklenemedi.", true);
  }

  await pollCurrentSong();
  setInterval(pollCurrentSong, 2000);

  saveBtn.addEventListener("click", submitAnnotation);
}

init();
