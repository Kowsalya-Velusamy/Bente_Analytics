import { mkChart, CHART_DEFAULTS } from './charts.js';
import { vShort } from './utils.js';
import { exportVisitors } from './export.js';

export function renderVisitors(data) {
  const ids   = Object.keys(data.venues);
  const cols  = ids.map(id => data.venues[id].color);
  const short = ids.map(id => vShort(data.venues[id].name));
  const s     = data.summary;

  // KPI cards
  document.getElementById('visitorKpis').innerHTML = `
    <div class="kpi-card" style="--kpi-color:#00f5c4"><div class="kpi-label">Total Visitors</div><div class="kpi-value">${s.total_checkins.toLocaleString()}</div><div class="kpi-sub">check-in events</div></div>
    <div class="kpi-card" style="--kpi-color:#ff4d6d"><div class="kpi-label">New Users</div><div class="kpi-value">${s.new_users}</div><div class="kpi-sub">${((s.new_users / s.total_checkins) * 100).toFixed(1)}% of total</div></div>
    <div class="kpi-card" style="--kpi-color:#6c63ff"><div class="kpi-label">Returning Users</div><div class="kpi-value">${s.returning_users}</div><div class="kpi-sub">${((s.returning_users / s.total_checkins) * 100).toFixed(1)}% of total</div></div>
    <div class="kpi-card" style="--kpi-color:#f5a623"><div class="kpi-label">Avg Dwell Time</div><div class="kpi-value">${s.overall_avg_dwell}<span style="font-size:18px">m</span></div><div class="kpi-sub">platform average</div></div>
    <div class="kpi-card" style="--kpi-color:#10b981"><div class="kpi-label">High Freq Visitors</div><div class="kpi-value">${s.freq_high_pct}%</div><div class="kpi-sub">visit often</div></div>
  `;

  // New vs Returning stacked
  mkChart('newReturnChart', 'bar', {
    labels: short,
    datasets: [
      { label: 'New',       data: ids.map(id => data.venues[id].new_users),       backgroundColor: 'rgba(255,77,109,0.7)', borderRadius: 3, stack: 's' },
      { label: 'Returning', data: ids.map(id => data.venues[id].returning_users), backgroundColor: 'rgba(0,245,196,0.7)',  borderRadius: 3, stack: 's' },
    ],
  }, { ...CHART_DEFAULTS, plugins: { legend: { display: true, position: 'top', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 12, boxWidth: 8 } } } });

  // Avg dwell
  mkChart('dwellChart', 'bar', {
    labels: short,
    datasets: [{ data: ids.map(id => data.venues[id].avg_dwell), backgroundColor: cols.map(c => c + '99'), borderColor: cols, borderWidth: 1, borderRadius: 4 }],
  }, { ...CHART_DEFAULTS, plugins: { legend: { display: false } } });

  // Frequency bars
  const fc = s.freq_counts;
  document.getElementById('freqBarsAll').innerHTML = [
    { name: 'High',   val: fc.High,   color: '#00f5c4' },
    { name: 'Medium', val: fc.Medium, color: '#6c63ff' },
    { name: 'Low',    val: fc.Low,    color: '#f5a623' },
  ].map(f => `
    <div class="freq-row">
      <div class="freq-name">${f.name}</div>
      <div class="freq-bar-bg"><div class="freq-bar-fill" style="width:${(f.val / s.total_checkins * 100).toFixed(0)}%;background:${f.color}"></div></div>
      <div class="freq-pct">${(f.val / s.total_checkins * 100).toFixed(1)}%</div>
    </div>`).join('');

  // Stacked freq per venue
  mkChart('venueFreqStackChart', 'bar', {
    labels: short,
    datasets: [
      { label: 'High',   data: ids.map(id => data.venues[id].freq_high),   backgroundColor: 'rgba(0,245,196,0.75)', stack: 'f', borderRadius: 2 },
      { label: 'Med',    data: ids.map(id => data.venues[id].freq_medium),  backgroundColor: 'rgba(108,99,255,0.7)',  stack: 'f', borderRadius: 2 },
      { label: 'Low',    data: ids.map(id => data.venues[id].freq_low),     backgroundColor: 'rgba(245,166,35,0.65)', stack: 'f', borderRadius: 2 },
    ],
  }, {
    ...CHART_DEFAULTS,
    plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 8, boxWidth: 8 } } },
    scales: { ...CHART_DEFAULTS.scales, x: { ...CHART_DEFAULTS.scales.x, stacked: true }, y: { ...CHART_DEFAULTS.scales.y, stacked: true } },
  });

  // Age group totals
  const ageGroups = ['18-24', '25-34', '35-44', '45+'];
  mkChart('ageStatusChart', 'bar', {
    labels: ageGroups,
    datasets: [{
      data: ageGroups.map(ag => ids.reduce((t, id) => t + (data.venues[id].age_dist[ag] || 0), 0)),
      backgroundColor: ['rgba(255,77,109,0.8)', 'rgba(108,99,255,0.8)', 'rgba(0,245,196,0.8)', 'rgba(245,166,35,0.8)'],
      borderRadius: 5,
    }],
  }, { ...CHART_DEFAULTS, plugins: { legend: { display: false } } });

  // Visitor metrics table
  document.getElementById('visitorTable').innerHTML =
    `<thead><tr><th>Venue</th><th>Total Visits</th><th>New Users</th><th>Returning</th><th>Return Rate</th><th>High Freq %</th><th>Avg Dwell</th><th>Weekend %</th></tr></thead><tbody>` +
    ids.map(id => {
      const v      = data.venues[id];
      const retPct = ((v.returning_users / v.checkins) * 100).toFixed(0);
      const wkPct  = ((v.weekend / (v.weekend + v.weekday)) * 100).toFixed(0);
      return `<tr>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${v.color};margin-right:8px"></span>${v.name}</td>
        <td style="font-family:'DM Mono',monospace">${v.checkins}</td>
        <td style="color:#ff4d6d;font-family:'DM Mono',monospace">${v.new_users}</td>
        <td style="color:#00f5c4;font-family:'DM Mono',monospace">${v.returning_users}</td>
        <td><span class="v-badge" style="background:rgba(0,245,196,0.12);color:#00f5c4">${retPct}%</span></td>
        <td style="font-family:'DM Mono',monospace">${v.freq_high}%</td>
        <td style="font-family:'DM Mono',monospace;color:${v.color}">${v.avg_dwell}m</td>
        <td style="font-family:'DM Mono',monospace">${wkPct}%</td>
      </tr>`;
    }).join('') + `</tbody>`;

  // Attach CSV export
  document.getElementById('visitorExportBtn')?.addEventListener('click', () => exportVisitors(data));
}
