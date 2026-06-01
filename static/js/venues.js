import { mkChart, CHART_DEFAULTS } from './charts.js';
import { vShort } from './utils.js';
import { DAYS } from './constants.js';
import { openDrill } from './drilldown.js';

let _selectorBuilt = false;
let _current       = 'VEN009';
let _compareMode   = false;
let _selected      = new Set(); // venues chosen in compare mode

// ── Single-venue mode ─────────────────────────────────────────────────────────

export function initVenuePage(data) {
  const ids = Object.keys(data.venues);
  if (!_current || !data.venues[_current]) _current = ids[8] || ids[0];

  if (!_selectorBuilt) {
    const sel = document.getElementById('venueSelector');
    ids.forEach(id => {
      const btn = document.createElement('button');
      btn.id        = 'vchip-' + id;
      btn.className = 'v-chip' + (id === _current ? ' active' : '');
      btn.textContent = data.venues[id].name;
      btn.onclick     = () => _compareMode ? toggleCompare(id, data) : selectVenue(id, data);
      sel.appendChild(btn);
    });
    _selectorBuilt = true;
  }

  renderVenueCharts(_current, data);
}

export function selectVenue(id, data) {
  _current = id;
  document.querySelectorAll('#venueSelector .v-chip').forEach(b => {
    const vid = b.id.replace('vchip-', '');
    b.classList.toggle('active',       !_compareMode && vid === id);
    b.classList.toggle('compare-sel',  _compareMode  && _selected.has(vid));
  });
  renderVenueCharts(id, data);
}

export function renderVenueCharts(id, data) {
  if (!data?.venues[id]) return;
  const v = data.venues[id];
  const start = document.getElementById('dateStart').value || null;
  const end   = document.getElementById('dateEnd').value   || null;

  document.getElementById('venueKpis').innerHTML = `
    <div class="kpi-card" style="--kpi-color:${v.color}"><div class="kpi-label">Total Check-ins</div><div class="kpi-value">${v.checkins}</div><div class="kpi-sub">in selected range</div></div>
    <div class="kpi-card" style="--kpi-color:#6c63ff"><div class="kpi-label">Unique Visitors</div><div class="kpi-value">${v.unique_users}</div><div class="kpi-sub">distinct users</div></div>
    <div class="kpi-card" style="--kpi-color:#ff4d6d"><div class="kpi-label">New Users</div><div class="kpi-value">${v.new_users}</div><div class="kpi-sub">${(v.new_users / v.checkins * 100).toFixed(0)}% of visits</div></div>
    <div class="kpi-card" style="--kpi-color:#f5a623"><div class="kpi-label">Returning Users</div><div class="kpi-value">${v.returning_users}</div><div class="kpi-sub">${(v.returning_users / v.checkins * 100).toFixed(0)}% of visits</div></div>
    <div class="kpi-card" style="--kpi-color:#10b981"><div class="kpi-label">Avg Dwell</div><div class="kpi-value">${v.avg_dwell}<span style="font-size:16px">m</span></div><div class="kpi-sub">per visit</div></div>
  `;

  mkChart('hourChart', 'bar', {
    labels: Array.from({ length: 24 }, (_, h) => (h < 10 ? '0' + h : h) + ':00'),
    datasets: [{ data: v.hour_dist, backgroundColor: v.color + '66', borderColor: v.color, borderWidth: 1, borderRadius: 3 }],
  }, {
    ...CHART_DEFAULTS, plugins: { legend: { display: false } },
    onClick: (_, els) => { if (els.length) openDrill({ venueId: id, hour: els[0].index, label: `${v.name} — ${els[0].index}:00`, start, end }); },
  });

  mkChart('dayChart', 'bar', {
    labels: DAYS,
    datasets: [{ data: v.day_dist, backgroundColor: DAYS.map((_, i) => i >= 5 ? v.color + 'cc' : v.color + '55'), borderColor: v.color, borderWidth: 1, borderRadius: 4 }],
  }, {
    ...CHART_DEFAULTS, plugins: { legend: { display: false } },
    onClick: (_, els) => { if (els.length) openDrill({ venueId: id, day: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][els[0].index], label: `${v.name} — ${DAYS[els[0].index]}`, start, end }); },
  });

  mkChart('venueFreqChart', 'doughnut', {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{ data: [v.freq_high, v.freq_medium, v.freq_low], backgroundColor: ['rgba(0,245,196,0.8)', 'rgba(108,99,255,0.7)', 'rgba(245,166,35,0.6)'], borderWidth: 0 }],
  }, { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 10, boxWidth: 8 } } } });

  mkChart('venueAgeChart', 'doughnut', {
    labels: Object.keys(v.age_dist),
    datasets: [{ data: Object.values(v.age_dist), backgroundColor: ['rgba(255,77,109,0.8)', 'rgba(108,99,255,0.8)', 'rgba(0,245,196,0.8)', 'rgba(245,166,35,0.8)'], borderWidth: 0 }],
  }, { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 10, boxWidth: 8 } } } });

  mkChart('venueEventsChart', 'bar', {
    labels: v.top_events.map(e => e[0]),
    datasets: [{ data: v.top_events.map(e => e[1]), backgroundColor: [v.color + 'cc', 'rgba(108,99,255,0.7)', 'rgba(245,166,35,0.7)', 'rgba(255,77,109,0.7)', 'rgba(16,185,129,0.7)'], borderRadius: 4 }],
  }, { ...CHART_DEFAULTS, indexAxis: 'y', plugins: { legend: { display: false } } });
}

// ── Comparison mode ───────────────────────────────────────────────────────────

export function toggleCompareMode(data) {
  _compareMode = !_compareMode;
  const btn = document.getElementById('compareToggle');
  btn.textContent = _compareMode ? '✕ Exit Compare' : '⊕ Compare Venues';
  btn.classList.toggle('active', _compareMode);
  document.getElementById('compareHint').textContent = _compareMode
    ? 'Select 2–3 venues to compare side by side'
    : '';

  if (!_compareMode) {
    _selected.clear();
    document.querySelectorAll('#venueSelector .v-chip').forEach(b => {
      const vid = b.id.replace('vchip-', '');
      b.classList.remove('compare-sel');
      b.classList.toggle('active', vid === _current);
    });
    document.getElementById('compareSection').innerHTML = '';
    renderVenueCharts(_current, data);
  }
}

function toggleCompare(id, data) {
  if (_selected.has(id)) {
    _selected.delete(id);
  } else if (_selected.size < 3) {
    _selected.add(id);
  }
  document.querySelectorAll('#venueSelector .v-chip').forEach(b => {
    const vid = b.id.replace('vchip-', '');
    b.classList.toggle('compare-sel', _selected.has(vid));
    b.classList.remove('active');
  });

  if (_selected.size >= 2) renderComparison([..._selected], data);
  else document.getElementById('compareSection').innerHTML = '';
}

function renderComparison(ids, data) {
  const n = ids.length;
  const colClass = n === 2 ? 'cols-2' : 'cols-3';

  const cards = ids.map(id => {
    const v = data.venues[id];
    const retPct = ((v.returning_users / v.checkins) * 100).toFixed(0);
    return `<div class="compare-venue-card">
      <div class="compare-venue-header">
        <span class="compare-dot" style="background:${v.color}"></span>
        <span class="compare-venue-name">${v.name}</span>
      </div>
      <div class="compare-stat-row">
        <div class="compare-stat"><div class="compare-stat-val" style="color:${v.color}">${v.checkins}</div><div class="compare-stat-lbl">Check-ins</div></div>
        <div class="compare-stat"><div class="compare-stat-val" style="color:${v.color}">${v.avg_engagement}</div><div class="compare-stat-lbl">Engagement</div></div>
        <div class="compare-stat"><div class="compare-stat-val" style="color:${v.color}">${v.avg_dwell}m</div><div class="compare-stat-lbl">Avg Dwell</div></div>
        <div class="compare-stat"><div class="compare-stat-val" style="color:${v.color}">${v.unique_users}</div><div class="compare-stat-lbl">Uniq Users</div></div>
        <div class="compare-stat"><div class="compare-stat-val" style="color:${v.color}">${retPct}%</div><div class="compare-stat-lbl">Return Rate</div></div>
        <div class="compare-stat"><div class="compare-stat-val" style="color:${v.color}">${v.freq_high}%</div><div class="compare-stat-lbl">High Freq</div></div>
      </div>
      <canvas id="cmp-hour-${id}" style="max-height:120px"></canvas>
    </div>`;
  }).join('');

  document.getElementById('compareSection').innerHTML =
    `<div class="chart-card full" style="margin-top:16px">
      <div class="chart-title"><div class="chart-title-left"><span class="ct-dot" style="background:#6c63ff"></span>Venue Comparison</div></div>
      <div class="compare-grid ${colClass}">${cards}</div>
    </div>`;

  // Render mini hourly charts inside each card
  ids.forEach(id => {
    const v = data.venues[id];
    mkChart(`cmp-hour-${id}`, 'bar', {
      labels: Array.from({ length: 24 }, (_, h) => h % 6 === 0 ? (h < 10 ? '0' + h : h) + 'h' : ''),
      datasets: [{ data: v.hour_dist, backgroundColor: v.color + '77', borderColor: v.color, borderWidth: 1, borderRadius: 2 }],
    }, { ...CHART_DEFAULTS, plugins: { legend: { display: false } }, scales: { x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxRotation: 0 } }, y: CHART_DEFAULTS.scales.y } });
  });
}

window.toggleCompareMode = toggleCompareMode;
