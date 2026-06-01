import { tableToCSV, downloadCSV, vShort } from './utils.js';

/**
 * Attach an "↓ Export CSV" button to the right side of a chart-title element.
 * `titleId`  — id of the .chart-title div
 * `filename` — downloaded file name
 * `getData`  — zero-arg function returning { headers: [], rows: [[]] }
 */
export function attachExport(titleId, filename, getData) {
  const title = document.getElementById(titleId);
  if (!title) return;
  // Remove stale button if table was re-rendered
  title.querySelector('.export-btn')?.remove();
  const btn = document.createElement('button');
  btn.className = 'export-btn';
  btn.textContent = '↓ CSV';
  btn.title = 'Export to CSV';
  btn.onclick = e => {
    e.stopPropagation();
    const { headers, rows } = getData();
    downloadCSV(filename, tableToCSV(headers, rows));
  };
  title.appendChild(btn);
}

/** Overview leaderboard table → CSV */
export function exportOverview(data) {
  const ids = [...Object.keys(data.venues)].sort(
    (a, b) => data.venues[b].checkins - data.venues[a].checkins,
  );
  const headers = ['Rank', 'Venue', 'Category', 'Check-ins', 'Unique Users',
                   'Avg Engagement', 'Avg Popularity', 'Avg Dwell (min)'];
  const rows = ids.map((id, i) => {
    const v = data.venues[id];
    return [i + 1, v.name, v.category, v.checkins, v.unique_users,
            v.avg_engagement, v.avg_popularity, v.avg_dwell];
  });
  downloadCSV('bente_leaderboard.csv', tableToCSV(headers, rows));
}

/** Visitor metrics table → CSV */
export function exportVisitors(data) {
  const headers = ['Venue', 'Total Visits', 'New Users', 'Returning',
                   'Return Rate %', 'High Freq %', 'Avg Dwell (min)', 'Weekend %'];
  const rows = Object.values(data.venues).map(v => [
    v.name, v.checkins, v.new_users, v.returning_users,
    ((v.returning_users / v.checkins) * 100).toFixed(1),
    v.freq_high,
    v.avg_dwell,
    ((v.weekend / (v.weekend + v.weekday)) * 100).toFixed(1),
  ]);
  downloadCSV('bente_visitors.csv', tableToCSV(headers, rows));
}

/** Anomaly panel → CSV */
export function exportAnomalies(anomalies) {
  const headers = ['Venue', 'Hour', 'Avg Crowd Density', 'Z-Score', 'Direction', 'Severity'];
  const rows = anomalies.map(a => [
    a.venue_name, a.hour + ':00', a.avg_density, a.z_score, a.direction, a.severity,
  ]);
  downloadCSV('bente_anomalies.csv', tableToCSV(headers, rows));
}

/** Drill-down modal rows → CSV */
export function exportDrillRows(title, rows) {
  const headers = ['Check-in ID', 'User', 'Timestamp', 'Hour', 'Day',
                   'Status', 'Frequency', 'Engagement', 'Dwell (min)',
                   'Crowd', 'Event', 'Age Group', 'Weather'];
  const data = rows.map(r => [
    r.checkin_id, r.user_id, r.timestamp, r.hour_of_day, r.day_of_week,
    r.user_status, r.visit_frequency, r.user_engagement_score, r.avg_dwell_minutes,
    r.crowd_density, r.event_type, r.user_age_group, r.weather_condition,
  ]);
  const safe = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadCSV(`bente_drill_${safe}.csv`, tableToCSV(headers, data));
}
