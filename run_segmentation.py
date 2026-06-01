"""
run_segmentation.py  —  Re-run KMeans segmentation and save segments.json.
Usage:  python run_segmentation.py
Requires:  scikit-learn, numpy  (pip install -r requirements.txt)
"""
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

DB_PATH = Path(__file__).parent / "bente.db"
OUT_PATH = Path(__file__).parent / "segments.json"

SEG_LABEL_ORDER = ["Power Users", "Event Seekers", "Casual Visitors", "Venue Explorers"]


def _assign_names(centroids: np.ndarray) -> dict[int, str]:
    """
    Name the 4 KMeans clusters by their centroid characteristics.
    Feature columns: [avg_eng, avg_dwell, visit_count, unique_venues, weekend_ratio, is_returning]
    """
    remaining = list(range(len(centroids)))
    assigned: dict[int, str] = {}

    def pick(key_col: int, name: str) -> None:
        idx = max(remaining, key=lambda i: centroids[i][key_col])
        assigned[idx] = name
        remaining.remove(idx)

    pick(0, "Power Users")       # highest avg_engagement
    pick(3, "Venue Explorers")   # highest unique_venues
    pick(4, "Event Seekers")     # highest weekend_ratio
    assigned[remaining[0]] = "Casual Visitors"
    return assigned


def run():
    conn = sqlite3.connect(DB_PATH)

    # ── 1. User-level feature aggregation ──────────────────────────────────
    user_rows = conn.execute("""
        SELECT
            user_id,
            avg(user_engagement_score)  AS avg_eng,
            avg(avg_dwell_minutes)      AS avg_dwell,
            count(*)                    AS visit_count,
            count(DISTINCT venue_id)    AS unique_venues,
            avg(is_weekend)             AS weekend_ratio,
            max(CASE WHEN user_status = 'Returning' THEN 1 ELSE 0 END) AS is_returning
        FROM checkins
        GROUP BY user_id
    """).fetchall()

    if not user_rows:
        print("No data in database. Run init_db.py first.")
        return

    user_ids = [r[0] for r in user_rows]
    X = np.array([[r[1], r[2], r[3], r[4], r[5], r[6]] for r in user_rows], dtype=float)

    # ── 2. Scale + cluster ─────────────────────────────────────────────────
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    km = KMeans(n_clusters=4, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)

    centroids_orig = scaler.inverse_transform(km.cluster_centers_)
    cluster_names = _assign_names(centroids_orig)            # {cluster_int: "Name"}
    user_seg = {uid: cluster_names[labels[i]] for i, uid in enumerate(user_ids)}

    # ── 3. Aggregate segment stats ─────────────────────────────────────────
    seg_acc: dict[str, dict] = {
        s: {"count": 0, "sum_eng": 0.0, "sum_dwell": 0.0, "sum_venues": 0,
            "age": defaultdict(int), "prefs": defaultdict(int)}
        for s in SEG_LABEL_ORDER
    }
    for r in user_rows:
        uid, avg_eng, avg_dwell, _, uniq_v, *_ = r
        s = user_seg[uid]
        seg_acc[s]["count"] += 1
        seg_acc[s]["sum_eng"] += avg_eng
        seg_acc[s]["sum_dwell"] += avg_dwell
        seg_acc[s]["sum_venues"] += uniq_v

    # Age groups and preferences per user (batch fetch)
    for uid, venue_id, age, pref in conn.execute(
        "SELECT user_id, venue_id, user_age_group, user_preference FROM checkins"
    ):
        if uid not in user_seg:
            continue
        s = user_seg[uid]
        seg_acc[s]["age"][age] += 1
        seg_acc[s]["prefs"][pref] += 1

    segments_out: dict[str, dict] = {}
    for sname, acc in seg_acc.items():
        n = acc["count"]
        if n == 0:
            continue
        top_prefs = dict(sorted(acc["prefs"].items(), key=lambda x: -x[1])[:4])
        segments_out[sname] = {
            "count": n,
            "avg_eng": round(acc["sum_eng"] / n, 1),
            "avg_dwell": round(acc["sum_dwell"] / n, 1),
            "avg_venues": round(acc["sum_venues"] / n, 1),
            "age": dict(acc["age"]),
            "top_prefs": top_prefs,
        }

    # ── 4. Venue × Segment affinity matrix ────────────────────────────────
    venue_ids = [r[0] for r in conn.execute(
        "SELECT DISTINCT venue_id FROM checkins ORDER BY venue_id"
    )]
    matrix_acc: dict[str, dict[str, int]] = {vid: defaultdict(int) for vid in venue_ids}
    for uid, vid in conn.execute("SELECT user_id, venue_id FROM checkins"):
        if uid in user_seg:
            matrix_acc[vid][user_seg[uid]] += 1

    matrix_out = {vid: dict(matrix_acc[vid]) for vid in venue_ids}

    conn.close()

    # ── 5. Save ────────────────────────────────────────────────────────────
    output = {"segments": segments_out, "matrix": matrix_out}
    with open(OUT_PATH, "w") as fh:
        json.dump(output, fh, indent=2)

    total = sum(s["count"] for s in segments_out.values())
    for sname, s in segments_out.items():
        print(f"  {sname:20s}  n={s['count']:3d}  eng={s['avg_eng']}  dwell={s['avg_dwell']}m")
    print(f"Segmentation complete — {total} users → {OUT_PATH}")


if __name__ == "__main__":
    run()
