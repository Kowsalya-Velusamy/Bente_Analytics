import { fetchAnomalies } from './api.js';
import { exportAnomalies } from './export.js';

const POLL_INTERVAL_MS = 60_000; // refresh every 60 s
let _timer = null;
let _lastData = [];

export function startAnomalyPanel() {
  fetchAndRender();
  _timer = setInterval(fetchAndRender, POLL_INTERVAL_MS);
}

export function stopAnomalyPanel() {
  clearInterval(_timer);
  _timer = null;
}

async function fetchAndRender() {
  try {
    const { anomalies } = await fetchAnomalies(1.5);
    _lastData = anomalies;
    renderPanel(anomalies);
  } catch (e) {
    const el = document.getElementById('anomalyContent');
    if (el) el.innerHTML = `<p style="color:var(--text3);padding:12px">Could not load anomaly data.</p>`;
  }
}

function renderPanel(anomalies) {
  const el = document.getElementById('anomalyContent');
  if (!el) return;

  // Update last-refreshed timestamp
  const ts = document.getElementById('anomalyTimestamp');
  if (ts) ts.textContent = 'Updated ' + new Date().toLocaleTimeString();

  if (!anomalies.length) {
    el.innerHTML = '<p style="color:var(--text3);padding:12px 0;font-size:13px">No anomalies detected above threshold.</p>';
    return;
  }

  el.innerHTML = `<div class="anomaly-list">` +
    anomalies.map(a => {
      const arrow = a.direction === 'high' ? '▲' : '▼';
      const arrowColor = a.direction === 'high' ? '#ff4d6d' : '#38bdf8';
      return `<div class="anomaly-row ${a.severity}">
        <span class="anomaly-sev ${a.severity}">${a.severity}</span>
        <span class="anomaly-venue">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${a.color};margin-right:6px"></span>
          ${a.venue_name}
        </span>
        <span class="anomaly-hour">${String(a.hour).padStart(2,'0')}:00</span>
        <span class="anomaly-density">Density: ${a.avg_density}</span>
        <span class="anomaly-z">z = ${a.z_score > 0 ? '+' : ''}${a.z_score}</span>
        <span class="anomaly-dir" style="color:${arrowColor}">${arrow}</span>
      </div>`;
    }).join('') + `</div>`;
}

// Wired from HTML
window.refreshAnomalies = () => fetchAndRender();
window.exportAnomaliesCSV = () => exportAnomalies(_lastData);
