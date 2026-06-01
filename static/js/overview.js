import { mkChart, CHART_DEFAULTS } from './charts.js';
import { vShort, fmtMonthYear } from './utils.js';
import { attachExport, exportOverview } from './export.js';
import { openDrill } from './drilldown.js';

export function renderOverview(data) {
  const ids   = Object.keys(data.venues);
  const cols  = ids.map(id => data.venues[id].color);
  const short = ids.map(id => vShort(data.venues[id].name));
  const s     = data.summary;
  const maxCI = Math.max(...ids.map(id => data.venues[id].checkins), 1);

  // Hero cards
  document.getElementById('heroCheckins').textContent       = s.total_checkins.toLocaleString();
  document.getElementById('heroCheckinsLabel').textContent  = `Across ${ids.length} venues`;
  document.getElementById('heroUsers').textContent          = s.unique_users.toLocaleString();
  document.getElementById('heroEngagement').textContent     = s.avg_engagement;
  document.getElementById('overviewSubtitle').textContent   =
    `Aggregated analytics across ${ids.length} venues · ${s.total_checkins.toLocaleString()} check-in events · ${s.unique_users} unique users`;

  // Live badge
  const badge = document.getElementById('liveBadgeText');
  if (s.date_min && s.date_max) {
    badge.textContent = s.date_min.slice(0, 7) === s.date_max.slice(0, 7)
      ? fmtMonthYear(s.date_min)
      : fmtMonthYear(s.date_min) + ' – ' + fmtMonthYear(s.date_max);
  } else {
    badge.textContent = 'Live';
  }

  // Check-ins bar (with drill-down on click)
  const startDate = document.getElementById('dateStart').value || null;
  const endDate   = document.getElementById('dateEnd').value   || null;

  mkChart('overviewBarChart', 'bar', {
    labels: short,
    datasets: [{ data: ids.map(id => data.venues[id].checkins), backgroundColor: cols.map(c => c + 'bb'), borderColor: cols, borderWidth: 1, borderRadius: 5 }],
  }, {
    ...CHART_DEFAULTS,
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: ([t]) => ids[t.dataIndex] + ' — ' + data.venues[ids[t.dataIndex]].name } } },
    onClick: (_, elements) => {
      if (!elements.length) return;
      const vid = ids[elements[0].index];
      openDrill({ venueId: vid, label: data.venues[vid].name + ' — All hours', start: startDate, end: endDate });
    },
  });

  // Frequency doughnut
  const fc = s.freq_counts;
  mkChart('overviewFreqChart', 'doughnut', {
    labels: ['High Frequency', 'Medium Frequency', 'Low Frequency'],
    datasets: [{ data: [fc.High, fc.Medium, fc.Low], backgroundColor: ['rgba(0,245,196,0.8)', 'rgba(108,99,255,0.8)', 'rgba(245,166,35,0.7)'], borderWidth: 0 }],
  }, { responsive: true, maintainAspectRatio: true, cutout: '62%', plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 12, boxWidth: 10 } } } });

  // Category doughnut
  mkChart('overviewCatChart', 'doughnut', {
    labels: ids.map(id => data.venues[id].category),
    datasets: [{ data: ids.map(id => data.venues[id].checkins), backgroundColor: cols.map(c => c + 'cc'), borderWidth: 0 }],
  }, { responsive: true, maintainAspectRatio: true, cutout: '55%', plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 8, boxWidth: 8 } } } });

  // Weekday vs Weekend
  mkChart('overviewWkChart', 'bar', {
    labels: short,
    datasets: [
      { label: 'Weekday', data: ids.map(id => data.venues[id].weekday), backgroundColor: 'rgba(108,99,255,0.7)', borderRadius: 3, stack: 's' },
      { label: 'Weekend', data: ids.map(id => data.venues[id].weekend), backgroundColor: 'rgba(245,166,35,0.7)', borderRadius: 3, stack: 's' },
    ],
  }, { ...CHART_DEFAULTS, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 10, boxWidth: 8 } } } });

  // Top events
  const allEvents = {};
  ids.forEach(id => data.venues[id].top_events.forEach(([e, c]) => { allEvents[e] = (allEvents[e] || 0) + c; }));
  const topEvt = Object.entries(allEvents).sort((a, b) => b[1] - a[1]).slice(0, 6);
  mkChart('overviewEventsChart', 'bar', {
    labels: topEvt.map(e => e[0]),
    datasets: [{ data: topEvt.map(e => e[1]), backgroundColor: ['#00f5c4bb', '#ff4d6dbb', '#6c63ffbb', '#f5a623bb', '#10b981bb', '#38bdf8bb'], borderRadius: 4 }],
  }, { ...CHART_DEFAULTS, indexAxis: 'y', plugins: { legend: { display: false } } });

  // Leaderboard table
  const sorted = [...ids].sort((a, b) => data.venues[b].checkins - data.venues[a].checkins);
  document.getElementById('overviewTable').innerHTML =
    `<thead><tr><th>#</th><th>Venue</th><th>Category</th><th>Check-ins</th><th>Unique Users</th><th>Avg Engagement</th><th>Avg Popularity</th><th>Avg Dwell</th></tr></thead><tbody>` +
    sorted.map((id, i) => {
      const v = data.venues[id];
      return `<tr>
        <td style="color:var(--text3);font-family:'DM Mono',monospace;font-size:11px">${String(i + 1).padStart(2, '0')}</td>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${v.color};margin-right:8px"></span>${v.name}</td>
        <td><span class="v-badge" style="background:${v.color}22;color:${v.color}">${v.category}</span></td>
        <td><div class="bar-cell"><div class="bar-bg"><div class="bar-fill" style="width:${(v.checkins / maxCI * 100).toFixed(0)}%;background:${v.color}"></div></div>${v.checkins}</div></td>
        <td>${v.unique_users}</td>
        <td style="font-family:'DM Mono',monospace;color:${v.color}">${v.avg_engagement}</td>
        <td style="font-family:'DM Mono',monospace">${v.avg_popularity}</td>
        <td style="font-family:'DM Mono',monospace">${v.avg_dwell}m</td>
      </tr>`;
    }).join('') + `</tbody>`;

  // CSV export button
  attachExport('overviewTableTitle', 'bente_leaderboard.csv', () => exportOverview(data) || { headers: [], rows: [] });
  document.getElementById('overviewTableExportBtn')?.addEventListener('click', () => exportOverview(data));
}
