# Music Emotion Annotation App

Participants only see a song counter (e.g., `SONG 12/60`). Song titles are visible only on the admin page.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
```

## Run the server

```bash
python server/app.py
```

Open:
- http://127.0.0.1:5000/ (participant page)
- http://127.0.0.1:5000/admin (admin page)

## Songs list

Edit `client/songs.json` to add your playlist:

```json
[
  { "id": 1, "title": "Song 1" },
  { "id": 2, "title": "Song 2" }
]
```

The admin page controls the global song index stored in `server/data/state.json`.
Responses are appended to `server/data/responses.csv`.

## Analysis

Generate CSV summaries from the collected responses:

```bash
python analysis.py
```

Outputs are written to:
- `server/data/summary_by_emotion.csv`
- `server/data/summary_by_level1.csv`
- `server/data/summary_by_mood.csv`
