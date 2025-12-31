const adminSongLabel = document.getElementById("admin-song-label");
const adminSongMeta = document.getElementById("admin-song-meta");
const prevBtn = document.getElementById("admin-prev");
const nextBtn = document.getElementById("admin-next");
const setIndexInput = document.getElementById("set-index");
const setIndexBtn = document.getElementById("set-index-btn");
const songList = document.getElementById("song-list");
const responsesBody = document.getElementById("responses-body");
const refreshResponsesBtn = document.getElementById("refresh-responses");
const participantSelect = document.getElementById("participant-select");
const refreshParticipantBtn = document.getElementById("refresh-participant");
const participantRows = document.getElementById("participant-rows");
const summarySongSelect = document.getElementById("summary-song");
const refreshSummaryBtn = document.getElementById("refresh-summary");
const exportBtn = document.getElementById("export-csv");
const summaryBySongBody = document.getElementById("summary-by-song");
const summaryEmotions = document.getElementById("summary-emotions");
const summaryMood = document.getElementById("summary-mood");

let songs = [];
let summaryData = { by_song: [], by_emotion: [], by_level1: [], by_mood: [] };

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function updateCurrentSongDisplay(payload) {
  if (payload.total && payload.display_index) {
    const title = payload.title || "Untitled";
    adminSongLabel.textContent = `SONG ${payload.display_index}/${payload.total} - ${title}`;
    adminSongMeta.textContent = `ID ${payload.song_id ?? "-"}`;
    setIndexInput.max = Math.max(payload.total - 1, 0);
    setIndexInput.value = payload.index;
  } else {
    adminSongLabel.textContent = "Songs not loaded";
    adminSongMeta.textContent = "";
  }
}

async function refreshCurrentSong() {
  const payload = await fetchJson("/api/admin/current-song");
  updateCurrentSongDisplay(payload);
}

async function moveSong(endpoint) {
  const payload = await fetchJson(endpoint, { method: "POST" });
  updateCurrentSongDisplay(payload);
}

async function setSongIndex() {
  const index = Number.parseInt(setIndexInput.value, 10);
  const payload = await fetchJson("/api/admin/set-song", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index }),
  });
  updateCurrentSongDisplay(payload);
}

async function loadSongs() {
  try {
    songs = await fetchJson(`/api/admin/songs?ts=${Date.now()}`);
  } catch (error) {
    try {
      songs = await fetchJson(`/client/songs.json?ts=${Date.now()}`);
    } catch (innerError) {
      songs = [];
    }
  }

  renderSongList();
  summarySongSelect.innerHTML = "";
  if (songs.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No songs";
    summarySongSelect.appendChild(option);
    return;
  }

  songs.forEach((song, idx) => {
    const option = document.createElement("option");
    option.value = String(idx + 1);
    option.textContent = `${idx + 1}-- ${song.title || "Sarki Adi"}`;
    summarySongSelect.appendChild(option);
  });
}

function renderSongList() {
  songList.innerHTML = "";
  if (songs.length === 0) {
    songList.textContent = "Sarki listesi bos.";
    return;
  }

  songs.forEach((song, idx) => {
    const row = document.createElement("div");
    row.className = "song-row";

    const label = document.createElement("span");
    label.textContent = `${idx + 1}-- ${song.title || "Sarki Adi"}`;

    const link = document.createElement("a");
    link.className = "mini-link";
    link.textContent = "Spotify'da Ac";
    if (song.url) {
      link.href = song.url;
      link.target = "_blank";
      link.rel = "noopener";
    } else {
      link.href = "#";
      link.classList.add("disabled");
    }

    row.appendChild(label);
    row.appendChild(link);
    songList.appendChild(row);
  });
}

async function loadResponses() {
  const rows = await fetchJson("/api/admin/responses?limit=300");
  responsesBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    ["timestamp", "participant_id", "song_index", "song_title", "emotion"].forEach(
      (key) => {
        const td = document.createElement("td");
        td.textContent = row[key] ?? "";
        tr.appendChild(td);
      }
    );
    responsesBody.appendChild(tr);
  });
}

async function loadParticipants() {
  let participants = [];
  try {
    participants = await fetchJson("/api/admin/participants");
  } catch (error) {
    participants = [];
  }

  participantSelect.innerHTML = "";
  if (participants.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No participants";
    participantSelect.appendChild(option);
    participantRows.innerHTML = "";
    return;
  }

  participants.forEach((pid) => {
    const option = document.createElement("option");
    option.value = pid;
    option.textContent = pid;
    participantSelect.appendChild(option);
  });

  if (!participantSelect.value) {
    participantSelect.value = participants[0];
  }
}

function renderParticipantDetail(payload) {
  const groups = payload?.groups || [];
  participantRows.innerHTML = "";
  if (groups.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No data";
    tr.appendChild(td);
    participantRows.appendChild(tr);
    return;
  }

  groups.forEach((group) => {
    (group.rows || []).forEach((row) => {
      const tr = document.createElement("tr");

      const indexCell = document.createElement("td");
      indexCell.textContent = group.song_index ?? "-";
      tr.appendChild(indexCell);

      const titleCell = document.createElement("td");
      titleCell.textContent = group.song_title || "-";
      tr.appendChild(titleCell);

      const emotionCell = document.createElement("td");
      emotionCell.textContent = row.emotion || "-";
      tr.appendChild(emotionCell);

      const timeCell = document.createElement("td");
      timeCell.textContent = row.timestamp || "-";
      tr.appendChild(timeCell);

      participantRows.appendChild(tr);
    });
  });
}

async function loadParticipantDetail() {
  const participantId = participantSelect.value;
  if (!participantId) {
    participantRows.innerHTML = "";
    return;
  }

  const payload = await fetchJson(
    `/api/admin/participant/${encodeURIComponent(participantId)}`
  );
  renderParticipantDetail(payload);
}

async function loadSummary() {
  summaryData = await fetchJson("/api/admin/summary");
  renderSummaryBySong();
  renderSummary();
}

function topBySong(list, songIndex, keyName, limit = 10) {
  return list
    .filter((item) => String(item.song_index) === String(songIndex))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({ key: item[keyName], count: item.count }));
}

function topEmotionsBySong(list, songIndex, limit = 10) {
  return list
    .filter(
      (item) =>
        String(item.song_index) === String(songIndex) &&
        !String(item.emotion || "").startsWith("mood.")
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({ key: item.emotion, count: item.count }));
}

function renderList(target, items, emptyLabel) {
  target.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = emptyLabel;
    target.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.key} (${item.count})`;
    target.appendChild(li);
  });
}

function renderSummary() {
  const selectedSongIndex = summarySongSelect.value;
  if (!selectedSongIndex) {
    renderList(summaryEmotions, [], "No data");
    renderList(summaryMood, [], "No data");
    return;
  }

  renderList(
    summaryEmotions,
    topEmotionsBySong(summaryData.by_emotion, selectedSongIndex),
    "No data"
  );
  renderList(
    summaryMood,
    topBySong(summaryData.by_mood, selectedSongIndex, "mood"),
    "No data"
  );
}

function renderSummaryBySong() {
  summaryBySongBody.innerHTML = "";
  if (!summaryData.by_song || summaryData.by_song.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No data";
    tr.appendChild(td);
    summaryBySongBody.appendChild(tr);
    return;
  }

  const titleMap = new Map(
    songs.map((song, idx) => [String(idx + 1), song.title || "Sarki Adi"])
  );

  summaryData.by_song.forEach((item) => {
    const tr = document.createElement("tr");

    const indexCell = document.createElement("td");
    indexCell.textContent = item.song_index ?? "-";
    tr.appendChild(indexCell);

    const titleCell = document.createElement("td");
    titleCell.textContent = titleMap.get(String(item.song_index)) || "-";
    tr.appendChild(titleCell);

    const participantCell = document.createElement("td");
    participantCell.textContent = item.unique_participants ?? 0;
    tr.appendChild(participantCell);

    const moodCell = document.createElement("td");
    moodCell.textContent = item.mood_count ?? 0;
    tr.appendChild(moodCell);

    const emotionCell = document.createElement("td");
    emotionCell.textContent = item.emotion_count ?? 0;
    tr.appendChild(emotionCell);

    const totalCell = document.createElement("td");
    totalCell.textContent = item.total_rows ?? 0;
    tr.appendChild(totalCell);

    summaryBySongBody.appendChild(tr);
  });
}

function exportSummaryCsv() {
  const selectedSongIndex = summarySongSelect.value;
  if (!selectedSongIndex) return;

  const rows = [["type", "song_index", "key", "count"]];

  const pushRows = (list, keyName, type) => {
    list
      .filter((item) => String(item.song_index) === String(selectedSongIndex))
      .sort((a, b) => b.count - a.count)
      .forEach((item) => {
        rows.push([type, item.song_index, item[keyName], item.count]);
      });
  };

  pushRows(summaryData.by_emotion, "emotion", "emotion");
  pushRows(summaryData.by_level1, "level1", "level1");
  pushRows(summaryData.by_mood, "mood", "mood");

  const csvContent = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `summary_song_${selectedSongIndex}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function init() {
  await loadSongs();
  await refreshCurrentSong();
  await loadResponses();
  await loadParticipants();
  await loadParticipantDetail();
  await loadSummary();

  prevBtn.addEventListener("click", () => moveSong("/api/admin/prev-song"));
  nextBtn.addEventListener("click", () => moveSong("/api/admin/next-song"));
  setIndexBtn.addEventListener("click", setSongIndex);
  refreshResponsesBtn.addEventListener("click", loadResponses);
  refreshParticipantBtn.addEventListener("click", loadParticipantDetail);
  participantSelect.addEventListener("change", loadParticipantDetail);
  refreshSummaryBtn.addEventListener("click", loadSummary);
  summarySongSelect.addEventListener("change", renderSummary);
  exportBtn.addEventListener("click", exportSummaryCsv);
}

init();
