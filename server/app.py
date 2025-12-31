import csv
import json
import os
from datetime import datetime
from threading import Lock

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLIENT_DIR = os.path.join(BASE_DIR, "client")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
STATE_PATH = os.path.join(DATA_DIR, "state.json")
RESPONSES_PATH = os.path.join(DATA_DIR, "responses.csv")
SONGS_PATH = os.path.join(CLIENT_DIR, "songs.json")

state_lock = Lock()
csv_lock = Lock()

app = Flask(__name__)


def ensure_data_files() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)

    if not os.path.exists(STATE_PATH) or os.path.getsize(STATE_PATH) == 0:
        with open(STATE_PATH, "w", encoding="utf-8") as handle:
            json.dump({"current_index": 0}, handle)

    header = [
        "song_index",
        "song_id",
        "song_title",
        "participant_id",
        "emotion",
        "timestamp",
    ]
    if not os.path.exists(RESPONSES_PATH) or os.path.getsize(RESPONSES_PATH) == 0:
        with open(RESPONSES_PATH, "w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)


def load_songs() -> list:
    try:
        with open(SONGS_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

    if isinstance(data, list):
        return data
    return []


def load_state() -> dict:
    ensure_data_files()
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"current_index": 0}

    try:
        index = int(data.get("current_index", 0))
    except (TypeError, ValueError):
        index = 0

    return {"current_index": max(index, 0)}


def save_state(index: int) -> None:
    with open(STATE_PATH, "w", encoding="utf-8") as handle:
        json.dump({"current_index": index}, handle)


def clamp_index(index: int, total: int) -> int:
    if total <= 0:
        return 0
    return max(0, min(index, total - 1))


def build_song_payload(include_title: bool) -> dict:
    songs = load_songs()
    total = len(songs)

    with state_lock:
        state = load_state()
        index = clamp_index(state["current_index"], total)
        if index != state["current_index"]:
            save_state(index)

    song = songs[index] if total > 0 else None
    payload = {
        "index": index,
        "display_index": index + 1 if total > 0 else 0,
        "total": total,
        "song_id": song.get("id") if song else None,
    }

    if include_title:
        payload["title"] = song.get("title") if song else None
        payload["url"] = song.get("url") if song else None

    return payload


@app.route("/")
def index() -> object:
    return send_from_directory(CLIENT_DIR, "index.html")


@app.route("/admin")
def admin() -> object:
    return send_from_directory(CLIENT_DIR, "admin.html")


@app.route("/client/<path:filename>")
def client_assets(filename: str) -> object:
    return send_from_directory(CLIENT_DIR, filename)


@app.route("/api/current-song", methods=["GET"])
def api_current_song() -> object:
    return jsonify(build_song_payload(include_title=False))


@app.route("/api/admin/current-song", methods=["GET"])
def api_admin_current_song() -> object:
    return jsonify(build_song_payload(include_title=True))


@app.route("/api/admin/songs", methods=["GET"])
def api_admin_songs() -> object:
    return jsonify(load_songs())


@app.route("/api/admin/next-song", methods=["POST"])
def api_admin_next_song() -> object:
    songs = load_songs()
    total = len(songs)

    with state_lock:
        state = load_state()
        index = clamp_index(state["current_index"] + 1, total)
        save_state(index)

    song = songs[index] if total > 0 else None
    return jsonify(
        {
            "index": index,
            "display_index": index + 1 if total > 0 else 0,
            "total": total,
            "song_id": song.get("id") if song else None,
            "title": song.get("title") if song else None,
            "url": song.get("url") if song else None,
        }
    )


@app.route("/api/admin/prev-song", methods=["POST"])
def api_admin_prev_song() -> object:
    songs = load_songs()
    total = len(songs)

    with state_lock:
        state = load_state()
        index = clamp_index(state["current_index"] - 1, total)
        save_state(index)

    song = songs[index] if total > 0 else None
    return jsonify(
        {
            "index": index,
            "display_index": index + 1 if total > 0 else 0,
            "total": total,
            "song_id": song.get("id") if song else None,
            "title": song.get("title") if song else None,
            "url": song.get("url") if song else None,
        }
    )


@app.route("/api/admin/set-song", methods=["POST"])
def api_admin_set_song() -> object:
    data = request.get_json(silent=True) or {}
    raw_index = data.get("index")

    try:
        requested = int(raw_index)
    except (TypeError, ValueError):
        requested = 0

    songs = load_songs()
    total = len(songs)

    with state_lock:
        index = clamp_index(requested, total)
        save_state(index)

    song = songs[index] if total > 0 else None
    return jsonify(
        {
            "index": index,
            "display_index": index + 1 if total > 0 else 0,
            "total": total,
            "song_id": song.get("id") if song else None,
            "title": song.get("title") if song else None,
            "url": song.get("url") if song else None,
        }
    )


@app.route("/api/submit", methods=["POST"])
def api_submit() -> object:
    data = request.get_json(silent=True) or {}

    participant_id = str(data.get("participant_id", "")).strip()
    song_id = data.get("song_id")
    current_mood = str(data.get("current_mood", "")).strip()
    selected_emotions = data.get("selected_emotions") or []
    allow_empty = bool(data.get("allow_empty"))
    advance_song = bool(data.get("advance_song"))

    if not participant_id:
        return jsonify({"error": "participant_id required"}), 400

    try:
        song_id = int(song_id)
    except (TypeError, ValueError):
        return jsonify({"error": "song_id required"}), 400

    if not current_mood or not current_mood.startswith("mood."):
        return jsonify({"error": "current_mood required"}), 400

    if not isinstance(selected_emotions, list):
        return jsonify({"error": "selected_emotions must be a list"}), 400

    if len(selected_emotions) == 0 and not allow_empty:
        return jsonify({"error": "selected_emotions required unless allow_empty"}), 400

    timestamp = str(data.get("timestamp", "")).strip()
    if not timestamp:
        timestamp = datetime.utcnow().isoformat() + "Z"

    songs = load_songs()
    total = len(songs)

    with state_lock:
        state = load_state()
        index = clamp_index(state["current_index"], total)
        if index != state["current_index"]:
            save_state(index)

    song = songs[index] if total > 0 else None
    song_index = index + 1 if total > 0 else 0
    song_title = song.get("title") if song else ""

    rows = [
        [song_index, song_id, song_title, participant_id, current_mood, timestamp]
    ]
    for emotion in selected_emotions:
        if emotion:
            rows.append(
                [song_index, song_id, song_title, participant_id, emotion, timestamp]
            )

    with csv_lock:
        ensure_data_files()
        needs_header = os.path.getsize(RESPONSES_PATH) == 0
        with open(RESPONSES_PATH, "a", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            if needs_header:
                writer.writerow(
                    [
                        "song_index",
                        "song_id",
                        "song_title",
                        "participant_id",
                        "emotion",
                        "timestamp",
                    ]
                )
            writer.writerows(rows)

    if advance_song and total > 0:
        with state_lock:
            state = load_state()
            if state["current_index"] == index:
                next_index = clamp_index(index + 1, total)
                save_state(next_index)

    return jsonify({"status": "ok", "rows_written": len(rows)})


@app.route("/api/admin/responses", methods=["GET"])
def api_admin_responses() -> object:
    limit = request.args.get("limit", 300)
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 300
    limit = max(1, min(limit, 5000))

    if not os.path.exists(RESPONSES_PATH) or os.path.getsize(RESPONSES_PATH) == 0:
        return jsonify([])

    with open(RESPONSES_PATH, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)

    return jsonify(rows[-limit:])


@app.route("/api/admin/participants", methods=["GET"])
def api_admin_participants() -> object:
    if not os.path.exists(RESPONSES_PATH) or os.path.getsize(RESPONSES_PATH) == 0:
        return jsonify([])

    with open(RESPONSES_PATH, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        participants = sorted({row.get("participant_id", "") for row in reader if row})

    participants = [pid for pid in participants if pid]
    return jsonify(participants)


@app.route("/api/admin/participant/<participant_id>", methods=["GET"])
def api_admin_participant(participant_id: str) -> object:
    if not os.path.exists(RESPONSES_PATH) or os.path.getsize(RESPONSES_PATH) == 0:
        return jsonify({"participant_id": participant_id, "groups": []})

    groups = {}
    with open(RESPONSES_PATH, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row.get("participant_id") != participant_id:
                continue
            song_index = row.get("song_index")
            if song_index not in groups:
                groups[song_index] = {
                    "song_index": song_index,
                    "song_title": row.get("song_title", ""),
                    "rows": [],
                }
            groups[song_index]["rows"].append(
                {
                    "song_id": row.get("song_id"),
                    "emotion": row.get("emotion"),
                    "timestamp": row.get("timestamp"),
                }
            )

    ordered = sorted(
        groups.values(), key=lambda group: int(group["song_index"] or 0)
    )
    return jsonify({"participant_id": participant_id, "groups": ordered})


@app.route("/api/admin/summary", methods=["GET"])
def api_admin_summary() -> object:
    if not os.path.exists(RESPONSES_PATH) or os.path.getsize(RESPONSES_PATH) == 0:
        return jsonify(
            {"by_song": [], "by_emotion": [], "by_level1": [], "by_mood": []}
        )

    by_emotion = {}
    by_level1 = {}
    by_mood = {}
    by_song = {}

    with open(RESPONSES_PATH, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            song_index = row.get("song_index")
            emotion = row.get("emotion") or ""
            if not song_index:
                continue

            if song_index not in by_song:
                by_song[song_index] = {
                    "total_rows": 0,
                    "mood_count": 0,
                    "emotion_count": 0,
                    "participants": set(),
                }

            by_song[song_index]["total_rows"] += 1
            participant_id = row.get("participant_id")
            if participant_id:
                by_song[song_index]["participants"].add(participant_id)

            by_emotion[(song_index, emotion)] = by_emotion.get(
                (song_index, emotion), 0
            ) + 1

            if emotion.startswith("mood."):
                by_song[song_index]["mood_count"] += 1
                by_mood[(song_index, emotion)] = by_mood.get(
                    (song_index, emotion), 0
                ) + 1
            else:
                by_song[song_index]["emotion_count"] += 1
                level1 = emotion.split(".")[0] if emotion else ""
                by_level1[(song_index, level1)] = by_level1.get(
                    (song_index, level1), 0
                ) + 1

    def counter_to_list(counter: dict, key_name: str) -> list:
        items = []
        for (song_index, key), count in counter.items():
            try:
                song_value = int(song_index)
            except (TypeError, ValueError):
                song_value = song_index
            items.append({"song_index": song_value, key_name: key, "count": count})
        items.sort(key=lambda item: (item["song_index"], -item["count"], item[key_name]))
        return items

    song_items = []
    for song_index, data in by_song.items():
        try:
            song_value = int(song_index)
        except (TypeError, ValueError):
            song_value = song_index
        song_items.append(
            {
                "song_index": song_value,
                "unique_participants": len(data["participants"]),
                "mood_count": data["mood_count"],
                "emotion_count": data["emotion_count"],
                "total_rows": data["total_rows"],
            }
        )
    song_items.sort(key=lambda item: item["song_index"])

    return jsonify(
        {
            "by_song": song_items,
            "by_emotion": counter_to_list(by_emotion, "emotion"),
            "by_level1": counter_to_list(by_level1, "level1"),
            "by_mood": counter_to_list(by_mood, "mood"),
        }
    )


if __name__ == "__main__":
    ensure_data_files()
    app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False)
