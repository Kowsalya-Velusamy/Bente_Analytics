import { fetchRows } from './api.js';
import { exportDrillRows } from './export.js';

let _overlay = null;
let _currentRows = [];

/** Open a drill-down modal for the given filter params. */
export async function openDrill({ venueId, hour, day, label, start, end } = {}) {
  closeDrill();

  _overlay = buildOverlay(label || 'Check-in Detail');
  document.body.appendChild(_overlay);

  // Show loading state
  _overlay.querySelector('.drill-body').innerHTML =
    '<p style="color:var(--text3);padding:24px;text-align:center">Loading rows…</p>';

  try {
    const { rows } = await fetchRows({ venueId, hour, day, start, end });
    _currentRows = rows;
    renderTable(rows, label);
  } catch (e) {
    _overlay.querySelector('.drill-body').innerHTML =
      `<p class="drill-empty">Failed to load: ${e.message}</p>`;
  }
}

export function closeDrill() {
  _overlay?.remove();
  _overlay = null;
}

function buildOverlay(title) {
  const div = document.createElement('div');
  div.className = 'drill-overlay';
  div.onclick = e => { if (e.target === div) closeDrill(); };
  div.innerHTML = `
    <div class="drill-modal">
      <div class="drill-header">
        <div>
          <div class="drill-title">${title}</div>
          <div class="drill-meta" id="drillMeta">Loading…</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="export-btn" onclick="window._drillExport()">↓ CSV</button>
          <button class="drill-close" onclick="import('./drilldown.js').then(m=>m.closeDrill())">✕</button>
        </div>
      </div>
      <div class="drill-body"></div>
    </div>`;
  return div;
}

function renderTable(rows, label) {
  if (!_overlay) return;

  _overlay.querySelector('#drillMeta').textContent =
    `${rows.length} rows${rows.length === 100 ? ' (capped at 100)' : ''}`;

  if (!rows.length) {
    _overlay.querySelector('.drill-body').innerHTML = '<p class="drill-empty">No check-ins match this filter.</p>';
    return;
  }

  _overlay.querySelector('.drill-body').innerHTML = `
    <table class="drill-table">
      <thead><tr>
        <th>Time</th><th>User</th><th>Status</th>
        <th>Engagement</th><th>Dwell (min)</th><th>Crowd</th>
        <th>Event</th><th>Age</th><th>Freq</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td style="font-family:'DM Mono',monospace;white-space:nowrap">${r.timestamp.slice(0, 16)}</td>
        <td style="font-family:'DM Mono',monospace;color:var(--text3)">${r.user_id}</td>
        <td><span class="v-badge" style="background:${r.user_status === 'New' ? 'rgba(255,77,109,0.15)' : 'rgba(0,245,196,0.12)'};color:${r.user_status === 'New' ? '#ff4d6d' : '#00f5c4'}">${r.user_status}</span></td>
        <td style="font-family:'DM Mono',monospace">${r.user_engagement_score}</td>
        <td style="font-family:'DM Mono',monospace">${r.avg_dwell_minutes}</td>
        <td style="font-family:'DM Mono',monospace">${r.crowd_density}</td>
        <td style="color:var(--text2)">${r.event_type}</td>
        <td style="color:var(--text3)">${r.user_age_group}</td>
        <td style="color:var(--text3)">${r.visit_frequency}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  window._drillExport = () => exportDrillRows(label || 'detail', _currentRows);
}

// Allow closing with Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrill(); });
