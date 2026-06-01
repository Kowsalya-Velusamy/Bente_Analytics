"""
init_db.py  —  Load bente_master_dataset_1200.csv into a SQLite database.
Run once (or whenever the CSV changes):  python init_db.py
"""
import csv
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "bente.db"
CSV_PATH = Path(__file__).parent / "bente_master_dataset_1200.csv"

DDL = """
CREATE TABLE IF NOT EXISTS checkins (
    checkin_id           TEXT,
    user_id              TEXT,
    venue_id             TEXT,
    venue_name           TEXT,
    venue_category       TEXT,
    latitude             REAL,
    longitude            REAL,
    timestamp            TEXT,   -- ISO-8601: YYYY-MM-DD HH:MM:SS
    crowd_density        INTEGER,
    avg_dwell_minutes    INTEGER,
    day_of_week          TEXT,
    hour_of_day          INTEGER,
    is_weekend           INTEGER,
    weather_condition    TEXT,
    user_age_group       TEXT,
    user_preference      TEXT,
    visit_frequency      TEXT,
    user_engagement_score    REAL,
    venue_popularity_score   REAL,
    event_type           TEXT,
    user_status          TEXT,
    recommended_venue    TEXT
);
CREATE INDEX IF NOT EXISTS idx_timestamp  ON checkins (timestamp);
CREATE INDEX IF NOT EXISTS idx_venue      ON checkins (venue_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user       ON checkins (user_id);
"""


def init():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(DDL)
    conn.execute("DELETE FROM checkins")

    rows = []
    with open(CSV_PATH, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            ts = datetime.strptime(r["timestamp"], "%m/%d/%Y %I:%M:%S %p")
            rows.append((
                r["checkin_id"], r["user_id"], r["venue_id"],
                r["venue_name"], r["venue_category"],
                float(r["latitude"]), float(r["longitude"]),
                ts.strftime("%Y-%m-%d %H:%M:%S"),
                int(r["crowd_density"]), int(r["avg_dwell_minutes"]),
                r["day_of_week"], int(r["hour_of_day"]), int(r["is_weekend"]),
                r["weather_condition"], r["user_age_group"], r["user_preference"],
                r["visit_frequency"],
                float(r["user_engagement_score"]), float(r["venue_popularity_score"]),
                r["event_type"], r["user_status"], r["recommended_venue"],
            ))

    conn.executemany(
        "INSERT INTO checkins VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        rows,
    )
    conn.commit()
    conn.close()
    print(f"Loaded {len(rows):,} rows → {DB_PATH}")


if __name__ == "__main__":
    init()
