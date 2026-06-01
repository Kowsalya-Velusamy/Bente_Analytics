# Bente Analytics — Intelligence Dashboard

A full-stack analytics platform for venue check-in data. Built with Flask + SQLite on the backend and Chart.js on the frontend. Converts a static HTML prototype into a live, filterable dashboard that reads directly from a CSV dataset.

---

## Features

- **Live data** — all charts and KPIs query SQLite at request time; no hardcoded numbers
- **Date range filter** — topbar date pickers filter every chart across all five pages simultaneously
- **AI Segmentation** — KMeans (k=4) clusters users by behavior; one-click refresh re-runs the full pipeline
- **Venue × Segment affinity matrix** — heatmap of visit counts per cluster per venue
- **Venue recommendations** — top-3 venue matches per segment derived from the live affinity matrix
- **Five dashboard pages**: Overview · Venue Analytics · Visitor Insights · Venue Reviews · AI Segmentation

---

## Project Structure

```
Bente_Analytics/
├── app.py                        # Flask app — routes & SQL aggregations
├── init_db.py                    # One-time CSV → SQLite importer
├── run_segmentation.py           # KMeans pipeline → segments.json
├── requirements.txt
├── bente_master_dataset_1200.csv # Source data (1,200 check-in events)
├── bente.db                      # SQLite database (generated)
├── segments.json                 # Cluster output (generated)
├── bente_analytics_dashboard.html # Original static prototype (reference)
└── templates/
    └── dashboard.html            # Live Flask template
```

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Load CSV into SQLite

```bash
python init_db.py
```

This parses all 1,200 rows from `bente_master_dataset_1200.csv` and imports them into `bente.db`. Re-run any time the CSV changes.

### 3. Run the segmentation analysis

```bash
python run_segmentation.py
```

Runs KMeans (k=4) on user-level features and saves cluster assignments + affinity matrix to `segments.json`. Re-run from the dashboard using the **Refresh AI Segmentation** button on the AI Segmentation page.

### 4. Start the server

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

> **Note:** `app.py` will auto-run `init_db.py` on first launch if `bente.db` doesn't exist.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the dashboard |
| `GET` | `/api/data` | All venue aggregations + summary stats |
| `GET` | `/api/data?start=YYYY-MM-DD&end=YYYY-MM-DD` | Same, filtered by date range |
| `POST` | `/api/refresh-segments` | Re-runs `run_segmentation.py` and returns status |

### `/api/data` response shape

```json
{
  "venues": {
    "VEN001": {
      "name": "Metro Nightclub",
      "checkins": 104,
      "unique_users": 83,
      "avg_dwell": 126.5,
      "hour_dist": [...],
      "day_dist": [...],
      "top_events": [["Live Music", 37], ...],
      "reviews": { "atmosphere": 3.6, "cleanliness": 4.1, ... }
    }
  },
  "segments": {
    "Venue Explorers": { "count": 102, "avg_eng": 53.2, "avg_dwell": 85.3, ... }
  },
  "matrix": {
    "VEN001": { "Venue Explorers": 63, "Casual Visitors": 27, ... }
  },
  "summary": {
    "total_checkins": 1200,
    "unique_users": 198,
    "avg_engagement": 53.3,
    "date_min": "2024-03-01",
    "date_max": "2024-05-31",
    "freq_counts": { "High": 301, "Medium": 722, "Low": 177 }
  }
}
```

---

## Dataset

`bente_master_dataset_1200.csv` — 1,200 simulated venue check-in events across 10 venues.

| Column | Description |
|--------|-------------|
| `checkin_id` | Unique event ID |
| `user_id` | Anonymised user |
| `venue_id / venue_name / venue_category` | Venue metadata |
| `timestamp` | Check-in datetime |
| `crowd_density` | 0–100 occupancy score |
| `avg_dwell_minutes` | Time spent at venue |
| `hour_of_day / day_of_week / is_weekend` | Temporal features |
| `user_age_group` | 18-24 / 25-34 / 35-44 / 45+ |
| `user_preference` | Self-reported category interest |
| `visit_frequency` | High / Medium / Low |
| `user_engagement_score` | 0–100 composite score |
| `venue_popularity_score` | 0–100 composite score |
| `event_type` | Event happening during visit |
| `user_status` | New / Returning |

**Venues:** Metro Nightclub · Harborview Bar · Central Coffee House · Seaside Restaurant · Greenfield Gym · Grand Theater · Downtown Food Court · City Mall · TechHub Coworking · Riverwalk Park

---

## AI Segmentation — How It Works

1. **Feature extraction** — aggregate per-user: `avg_engagement`, `avg_dwell`, `visit_count`, `unique_venues`, `weekend_ratio`, `is_returning`
2. **Normalisation** — StandardScaler (zero mean, unit variance)
3. **KMeans clustering** — k=4, random state 42, 10 initialisations
4. **Segment naming** — clusters are labelled by centroid characteristics:
   - **Power Users** — highest average engagement
   - **Venue Explorers** — highest unique venues visited
   - **Event Seekers** — highest weekend visit ratio
   - **Casual Visitors** — remaining cluster
5. **Affinity matrix** — pivot of visit counts (venue × segment)
6. **Recommendations** — top-3 venues per segment ranked by affinity score

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, Flask 2.3 |
| Database | SQLite (via `sqlite3` stdlib) |
| ML | scikit-learn (KMeans, StandardScaler), NumPy |
| Frontend | Vanilla JS (ES2020), Chart.js 4.4 |
| Fonts | DM Sans, DM Mono (Google Fonts) |

---

## Extending the Dashboard

**Add new data** — append rows to the CSV and re-run `python init_db.py`.

**Add a new chart** — add a `<canvas id="myChart">` in the relevant page section of `templates/dashboard.html`, then call `mkChart('myChart', ...)` inside the corresponding `render*()` function.

**Change cluster count** — edit `n_clusters=4` in `run_segmentation.py` and update `SEG_COLORS` / `SEG_ICONS` in the template accordingly.

**Deploy** — swap `app.run(debug=True)` for a production WSGI server (e.g. `gunicorn app:app`). The SQLite file path uses `Path(__file__).parent` so it works from any working directory.
