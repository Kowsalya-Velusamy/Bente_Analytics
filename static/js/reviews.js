import { mkChart, CHART_DEFAULTS } from './charts.js';
import { vShort } from './utils.js';
import { REVIEW_LABELS, REVIEW_COLORS } from './constants.js';

let _built = false;
let _current = null;

export function initReviewPage(data) {
  const ids = Object.keys(data.venues);
  if (!_current || !data.venues[_current]) _current = ids[8] || ids[0];

  if (!_built) {
    const sel = document.getElementById('reviewVenueSelector');
    ids.forEach(id => {
      const btn = document.createElement('button');
      btn.className = 'v-chip' + (id === _current ? ' active' : '');
      btn.textContent = data.venues[id].name;
      btn.onclick = () => selectReviewVenue(id, data);
      sel.appendChild(btn);
    });
    _built = true;
  }

  renderReview(_current, data);
  renderAllReviewCharts(data);
}

export function selectReviewVenue(id, data) {
  _current = id;
  document.querySelectorAll('#reviewVenueSelector .v-chip').forEach((b, i) => {
    b.classList.toggle('active', Object.keys(data.venues)[i] === id);
  });
  renderReview(id, data);
}

export function renderReview(id, data) {
  const v = data.venues[id];
  if (!v?.reviews) return;
  const r        = v.reviews;
  const avgScore = (Object.values(r).reduce((a, b) => a + b, 0) / Object.keys(r).length).toFixed(1);
  const bestCrit = Object.entries(r).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('reviewKpis').innerHTML = `
    <div class="kpi-card" style="--kpi-color:${v.color}"><div class="kpi-label">Venue</div><div class="kpi-value" style="font-size:18px;padding-top:4px">${v.name}</div><div class="kpi-sub">${v.category}</div></div>
    <div class="kpi-card" style="--kpi-color:#f5a623"><div class="kpi-label">Avg Score</div><div class="kpi-value">${avgScore}<span style="font-size:18px">/5</span></div><div class="kpi-sub">across all criteria</div></div>
    <div class="kpi-card" style="--kpi-color:#10b981"><div class="kpi-label">Engagement</div><div class="kpi-value">${v.avg_engagement}</div><div class="kpi-sub">avg score</div></div>
    <div class="kpi-card" style="--kpi-color:#6c63ff"><div class="kpi-label">Popularity</div><div class="kpi-value">${v.avg_popularity}</div><div class="kpi-sub">venue score</div></div>
    <div class="kpi-card" style="--kpi-color:#00f5c4"><div class="kpi-label">Best Criteria</div><div class="kpi-value" style="font-size:20px">${REVIEW_LABELS[bestCrit[0]].split(' ')[0]} ${bestCrit[1]}</div><div class="kpi-sub">${bestCrit[0].replace(/_/g, ' ')}</div></div>
  `;

  document.getElementById('reviewBars').innerHTML = Object.entries(r).map(([k, score]) => `
    <div class="star-row">
      <div class="star-label">${REVIEW_LABELS[k]}</div>
      <div class="star-bar-bg"><div class="star-bar-fill" style="width:${(score / 5 * 100).toFixed(0)}%;background:${REVIEW_COLORS[k]}"></div></div>
      <div class="star-score">${score}</div>
    </div>`).join('');

  mkChart('radarChart', 'radar', {
    labels: Object.values(REVIEW_LABELS).map(l => l.split(' ').slice(1).join(' ')),
    datasets: [{
      data: Object.values(r), backgroundColor: v.color + '33',
      borderColor: v.color, borderWidth: 2,
      pointBackgroundColor: v.color, pointRadius: 4,
    }],
  }, {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { r: { ticks: { color: '#4a5168', font: { family: 'DM Mono', size: 8 }, backdropColor: 'transparent' }, grid: { color: 'rgba(28,34,53,0.8)' }, pointLabels: { color: '#8b93a8', font: { family: 'DM Sans', size: 11 } }, min: 0, max: 5, beginAtZero: true, angleLines: { color: 'rgba(28,34,53,0.6)' } } },
  });
}

export function renderAllReviewCharts(data) {
  const ids   = Object.keys(data.venues);
  const cols  = ids.map(id => data.venues[id].color);
  const short = ids.map(id => vShort(data.venues[id].name));

  const avg = ids.map(id => {
    const vals = Object.values(data.venues[id].reviews || {});
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
  });

  mkChart('allReviewChart', 'bar', {
    labels: short,
    datasets: [{ data: avg, backgroundColor: cols.map(c => c + 'aa'), borderColor: cols, borderWidth: 1, borderRadius: 4 }],
  }, { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 2, max: 5 } }, plugins: { legend: { display: false } } });

  mkChart('reviewCompareChart', 'bar', {
    labels: short,
    datasets: [
      { label: 'Cleanliness', data: ids.map(id => (data.venues[id].reviews || {}).cleanliness || 0), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 2, stack: 'r' },
      { label: 'Atmosphere',  data: ids.map(id => (data.venues[id].reviews || {}).atmosphere  || 0), backgroundColor: 'rgba(245,166,35,0.7)',   borderRadius: 2, stack: 'r' },
      { label: 'WiFi',        data: ids.map(id => (data.venues[id].reviews || {}).wifi        || 0), backgroundColor: 'rgba(56,189,248,0.7)',   borderRadius: 2, stack: 'r' },
    ],
  }, { ...CHART_DEFAULTS, plugins: { legend: { display: true, position: 'top', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 10, boxWidth: 8 } } } });
}
