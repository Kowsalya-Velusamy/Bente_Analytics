"""
app.py  —  Flask backend for the Bente Analytics Dashboard.

Setup:
    pip install -r requirements.txt
    python init_db.py          # one-time CSV → SQLite import
    python run_segmentation.py # generate segments.json
    python app.py              # start dev server on http://localhost:5000
"""
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE = Path(__file__).parent
DB_PATH = BASE / "bente.db"
SEGMENTS_PATH = BASE / "segments.json"

app = Flask(__name__, template_folder=str(BASE / "templates"))

# ── Static per-venue metadata (colors + review scores) ────────────────────────
# Review scores are pre-computed quality metrics; they do not change with date
# filtering, so we store them here alongside the color palette.
VENUE_CONFIG: dict[str, dict] = {
    "VEN001": {
        "name": "Metro Nightclub", "category": "Nightclub", "color": "#ff4d6d",
        "reviews": {"atmosphere": 3.6, "cleanliness": 4.1, "wifi": 3.5,
                    "service": 3.5, "value_for_money": 3.4, "noise_level": 3.0},
    },
    "VEN002": {
        "name": "Harborview Bar", "category": "Bar/Lounge", "color": "#f5a623",
        "reviews": {"atmosphere": 3.2, "cleanliness": 4.1, "wifi": 3.5,
                    "service": 3.8, "value_for_money": 3.2, "noise_level": 3.0},
    },
    "VEN003": {
        "name": "Central Coffee House", "category": "Cafe", "color": "#00f5c4",
        "reviews": {"atmosphere": 2.7, "cleanliness": 4.2, "wifi": 4.5,
                    "service": 3.5, "value_for_money": 3.0, "noise_level": 2.6},
    },
    "VEN004": {
        "name": "Seaside Restaurant", "category": "Restaurant", "color": "#6c63ff",
        "reviews": {"atmosphere": 3.1, "cleanliness": 4.0, "wifi": 3.5,
                    "service": 3.7, "value_for_money": 3.2, "noise_level": 3.2},
    },
    "VEN005": {
        "name": "Greenfield Gym", "category": "Gym", "color": "#10b981",
        "reviews": {"atmosphere": 2.8, "cleanliness": 4.3, "wifi": 3.5,
                    "service": 3.3, "value_for_money": 3.1, "noise_level": 2.3},
    },
    "VEN006": {
        "name": "Grand Theater", "category": "Entertainment", "color": "#e879f9",
        "reviews": {"atmosphere": 3.3, "cleanliness": 4.1, "wifi": 3.5,
                    "service": 3.7, "value_for_money": 3.3, "noise_level": 3.0},
    },
    "VEN007": {
        "name": "Downtown Food Court", "category": "Food Court", "color": "#fb923c",
        "reviews": {"atmosphere": 2.7, "cleanliness": 4.1, "wifi": 3.5,
                    "service": 3.6, "value_for_money": 3.1, "noise_level": 3.0},
    },
    "VEN008": {
        "name": "City Mall", "category": "Mall", "color": "#38bdf8",
        "reviews": {"atmosphere": 3.2, "cleanliness": 4.1, "wifi": 3.5,
                    "service": 3.7, "value_for_money": 3.3, "noise_level": 3.0},
    },
    "VEN009": {
        "name": "TechHub Coworking", "category": "Coworking", "color": "#a3e635",
        "reviews": {"atmosphere": 3.9, "cleanliness": 4.3, "wifi": 4.5,
                    "service": 3.6, "value_for_money": 3.5, "noise_level": 2.3},
    },
    "VEN010": {
        "name": "Riverwalk Park", "category": "Park", "color": "#fbbf24",
        "reviews": {"atmosphere": 2.8, "cleanliness": 4.2, "wifi": 3.5,
                    "service": 3.5, "value_for_money": 3.1, "noise_level": 2.5},
    },
}

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _where_global(start: str | None, end: str | None) -> tuple[str, list]:
    clauses, params = [], []
    if start:
        clauses.append("date(timestamp) >= ?")
        params.append(start)
    if end:
        clauses.append("date(timestamp) <= ?")
        params.append(end)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def _where_venue(start: str | None, end: str | None, venue_id: str) -> tuple[str, list]:
    clauses = ["venue_id = ?"]
    params: list = [venue_id]
    if start:
        clauses.append("date(timestamp) >= ?")
        params.append(start)
    if end:
        clauses.append("date(timestamp) <= ?")
        params.append(end)
    return "WHERE " + " AND ".join(clauses), params


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("dashboard.html")


@app.route("/api/data")
def api_data():
    start = request.args.get("start") or None
    end   = request.args.get("end")   or None

    if not DB_PATH.exists():
        return jsonify({"error": "Database not found. Run: python init_db.py"}), 503

    conn = get_db()
    gw, gp = _where_global(start, end)

    # ── Global summary ────────────────────────────────────────────────────
    g = conn.execute(f"""
        SELECT
            count(*)                                              AS total_checkins,
            count(DISTINCT user_id)                              AS unique_users,
            round(avg(user_engagement_score), 1)                 AS avg_engagement,
            round(avg(avg_dwell_minutes), 1)                     AS overall_avg_dwell,
            min(date(timestamp))                                  AS date_min,
            max(date(timestamp))                                  AS date_max,
            sum(CASE WHEN visit_frequency='High'    THEN 1 ELSE 0 END) AS freq_high,
            sum(CASE WHEN visit_frequency='Medium'  THEN 1 ELSE 0 END) AS freq_medium,
            sum(CASE WHEN visit_frequency='Low'     THEN 1 ELSE 0 END) AS freq_low,
            sum(CASE WHEN user_status='New'         THEN 1 ELSE 0 END) AS new_users,
            sum(CASE WHEN user_status='Returning'   THEN 1 ELSE 0 END) AS returning_users
        FROM checkins {gw}
    """, gp).fetchone()

    total = g["total_checkins"] or 1  # avoid div-by-zero
    summary = {
        "total_checkins":   g["total_checkins"],
        "unique_users":     g["unique_users"],
        "avg_engagement":   g["avg_engagement"],
        "overall_avg_dwell": g["overall_avg_dwell"],
        "date_min":         g["date_min"],
        "date_max":         g["date_max"],
        "new_users":        g["new_users"],
        "returning_users":  g["returning_users"],
        "freq_high_pct":    round(g["freq_high"] / total * 100, 1),
        "freq_counts": {
            "High":   g["freq_high"],
            "Medium": g["freq_medium"],
            "Low":    g["freq_low"],
        },
    }

    # ── Per-venue aggregations ────────────────────────────────────────────
    venues: dict[str, dict] = {}
    for vid, cfg in VENUE_CONFIG.items():
        vw, vp = _where_venue(start, end, vid)

        row = conn.execute(f"""
            SELECT
                count(*)                                                 AS checkins,
                count(DISTINCT user_id)                                  AS unique_users,
                sum(CASE WHEN user_status='New'       THEN 1 ELSE 0 END) AS new_users,
                sum(CASE WHEN user_status='Returning' THEN 1 ELSE 0 END) AS returning_users,
                round(avg(avg_dwell_minutes), 1)                         AS avg_dwell,
                round(avg(crowd_density), 1)                             AS avg_crowd,
                round(avg(user_engagement_score), 1)                     AS avg_engagement,
                round(avg(venue_popularity_score), 1)                    AS avg_popularity,
                sum(is_weekend)                                          AS weekend,
                sum(1 - is_weekend)                                      AS weekday
            FROM checkins {vw}
        """, vp).fetchone()

        if not row or (row["checkins"] or 0) == 0:
            continue

        vtotal = row["checkins"]

        freq_raw = {r["visit_frequency"]: r["cnt"] for r in conn.execute(
            f"SELECT visit_frequency, count(*) AS cnt FROM checkins {vw} GROUP BY visit_frequency",
            vp,
        )}

        hour_dist = [0] * 24
        for hr in conn.execute(
            f"SELECT hour_of_day, count(*) AS cnt FROM checkins {vw} GROUP BY hour_of_day", vp
        ):
            hour_dist[hr["hour_of_day"]] = hr["cnt"]

        day_map = {d: 0 for d in DAY_ORDER}
        for dr in conn.execute(
            f"SELECT day_of_week, count(*) AS cnt FROM checkins {vw} GROUP BY day_of_week", vp
        ):
            day_map[dr["day_of_week"]] = dr["cnt"]

        top_events = [
            [r["event_type"], r["cnt"]]
            for r in conn.execute(
                f"SELECT event_type, count(*) AS cnt FROM checkins {vw} "
                f"GROUP BY event_type ORDER BY cnt DESC LIMIT 3",
                vp,
            )
        ]

        age_dist = {r["user_age_group"]: r["cnt"] for r in conn.execute(
            f"SELECT user_age_group, count(*) AS cnt FROM checkins {vw} GROUP BY user_age_group",
            vp,
        )}

        venues[vid] = {
            **cfg,
            "checkins":        vtotal,
            "unique_users":    row["unique_users"],
            "new_users":       row["new_users"],
            "returning_users": row["returning_users"],
            "avg_dwell":       row["avg_dwell"],
            "avg_crowd":       row["avg_crowd"],
            "avg_engagement":  row["avg_engagement"],
            "avg_popularity":  row["avg_popularity"],
            "freq_high":   round(freq_raw.get("High",   0) / vtotal * 100, 1),
            "freq_medium": round(freq_raw.get("Medium", 0) / vtotal * 100, 1),
            "freq_low":    round(freq_raw.get("Low",    0) / vtotal * 100, 1),
            "hour_dist":  hour_dist,
            "day_dist":   [day_map[d] for d in DAY_ORDER],
            "top_events": top_events,
            "age_dist":   age_dist,
            "weekend":    row["weekend"] or 0,
            "weekday":    row["weekday"] or 0,
        }

    conn.close()

    # ── Segments (pre-computed; date-independent) ─────────────────────────
    segments: dict = {}
    matrix:   dict = {}
    if SEGMENTS_PATH.exists():
        with open(SEGMENTS_PATH) as fh:
            seg_data = json.load(fh)
            segments = seg_data.get("segments", {})
            matrix   = seg_data.get("matrix",   {})

    return jsonify({"venues": venues, "segments": segments,
                    "matrix": matrix, "summary": summary})


@app.route("/api/refresh-segments", methods=["POST"])
def refresh_segments():
    script = BASE / "run_segmentation.py"
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True, text=True, cwd=str(BASE),
    )
    if result.returncode == 0:
        return jsonify({"status": "ok", "message": result.stdout.strip()})
    return jsonify({"status": "error", "message": result.stderr.strip()}), 500


@app.route("/api/anomalies")
def api_anomalies():
    """
    For every (venue, hour_of_day) bucket compute the average crowd density,
    then z-score each bucket against that venue's overall density distribution.
    Returns buckets where |z| >= threshold, sorted by severity.
    """
    threshold = float(request.args.get("threshold", 1.5))

    if not DB_PATH.exists():
        return jsonify({"anomalies": []}), 503

    conn = get_db()

    # Per-venue mean + population std (SQLite has no stddev, so compute manually)
    venue_stats: dict[str, dict] = {}
    for r in conn.execute("""
        SELECT venue_id,
               avg(crowd_density)                                        AS mean,
               avg(crowd_density * crowd_density) - avg(crowd_density) * avg(crowd_density) AS variance
        FROM checkins
        GROUP BY venue_id
    """):
        venue_stats[r["venue_id"]] = {
            "mean": r["mean"],
            "std":  max((r["variance"] or 0) ** 0.5, 1.0),
        }

    # Hourly bucket averages
    buckets = conn.execute("""
        SELECT venue_id, venue_name, hour_of_day,
               round(avg(crowd_density), 1) AS avg_density,
               count(*)                     AS sample_count
        FROM checkins
        GROUP BY venue_id, hour_of_day
    """).fetchall()
    conn.close()

    anomalies = []
    for b in buckets:
        vs = venue_stats.get(b["venue_id"], {"mean": 50.0, "std": 10.0})
        z = (b["avg_density"] - vs["mean"]) / vs["std"]
        if abs(z) < threshold:
            continue
        severity = "critical" if abs(z) >= 2.5 else "warning" if abs(z) >= 2.0 else "notice"
        anomalies.append({
            "venue_id":     b["venue_id"],
            "venue_name":   b["venue_name"],
            "hour":         b["hour_of_day"],
            "avg_density":  b["avg_density"],
            "z_score":      round(z, 2),
            "severity":     severity,
            "direction":    "high" if z > 0 else "low",
            "sample_count": b["sample_count"],
            "color":        VENUE_CONFIG.get(b["venue_id"], {}).get("color", "#888"),
        })

    anomalies.sort(key=lambda x: -abs(x["z_score"]))
    return jsonify({"anomalies": anomalies[:25]})


@app.route("/api/rows")
def api_rows():
    """Raw check-in rows for drill-down modals. Returns up to 100 rows."""
    venue_id = request.args.get("venue_id")
    hour     = request.args.get("hour",  type=int)
    day      = request.args.get("day")
    start    = request.args.get("start") or None
    end      = request.args.get("end")   or None

    clauses: list[str] = []
    params:  list      = []

    if venue_id:
        clauses.append("venue_id = ?");       params.append(venue_id)
    if hour is not None:
        clauses.append("hour_of_day = ?");    params.append(hour)
    if day:
        clauses.append("day_of_week = ?");    params.append(day)
    if start:
        clauses.append("date(timestamp) >= ?"); params.append(start)
    if end:
        clauses.append("date(timestamp) <= ?"); params.append(end)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    if not DB_PATH.exists():
        return jsonify({"rows": []}), 503

    conn = get_db()
    rows = conn.execute(f"""
        SELECT checkin_id, user_id, venue_name, timestamp,
               crowd_density, avg_dwell_minutes, hour_of_day, day_of_week,
               user_age_group, user_status, visit_frequency,
               user_engagement_score, venue_popularity_score,
               event_type, weather_condition
        FROM checkins {where}
        ORDER BY timestamp DESC
        LIMIT 100
    """, params).fetchall()
    conn.close()

    return jsonify({"rows": [dict(r) for r in rows]})


if __name__ == "__main__":
    if not DB_PATH.exists():
        print("Database not found — running init_db.py first...")
        subprocess.run([sys.executable, str(BASE / "init_db.py")], cwd=str(BASE))
    app.run(debug=True, port=5000)
