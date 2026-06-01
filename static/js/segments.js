import { mkChart } from './charts.js';
import { SEG_COLORS, SEG_ICONS } from './constants.js';
import { loadData } from './api.js';
import { renderAll } from './main.js';

export function renderSegments(data) {
  const segs   = data.segments || {};
  const matrix = data.matrix   || {};
  const names  = Object.keys(segs);

  // Segment cards
  document.getElementById('segCards').innerHTML = names.length
    ? names.map((seg, i) => {
        const s      = segs[seg];
        const col    = SEG_COLORS[seg] || '#888';
        const top    = Object.keys(s.top_prefs || {})[0] || 'Mixed';
        return `<div class="seg-card" style="--seg-color:${col}" onclick="highlightSeg(${i})">
          <div class="seg-icon">${SEG_ICONS[seg] || '◎'}</div>
          <div class="seg-name">${seg}</div>
          <div class="seg-highlight" style="color:${col}">${s.count}</div>
          <div class="seg-count">users · ${s.avg_venues} avg venues</div>
          <div class="seg-stat-row">
            <span class="seg-pill">Eng: ${s.avg_eng}</span>
            <span class="seg-pill">Dwell: ${s.avg_dwell}m</span>
            <span class="seg-pill">${top}</span>
          </div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);padding:20px 0">No segmentation data yet — click Refresh below.</p>';

  if (!names.length) return;

  mkChart('segPieChart', 'doughnut', {
    labels: names,
    datasets: [{ data: names.map(s => segs[s].count), backgroundColor: names.map(s => (SEG_COLORS[s] || '#888') + 'cc'), borderWidth: 0 }],
  }, { responsive: true, maintainAspectRatio: true, cutout: '58%', plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 12, boxWidth: 10 } } } });

  mkChart('segScatterChart', 'scatter', {
    datasets: names.map(s => ({
      label: s,
      data: [{ x: segs[s].avg_dwell, y: segs[s].avg_eng }],
      backgroundColor: (SEG_COLORS[s] || '#888') + 'cc',
      pointRadius: Math.sqrt(segs[s].count) * 2.5,
      pointHoverRadius: Math.sqrt(segs[s].count) * 3,
    })),
  }, {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b93a8', font: { family: 'DM Mono', size: 9 }, padding: 10, boxWidth: 8 } } },
    scales: {
      x: { title: { display: true, text: 'Avg Dwell (min)', color: '#4a5168', font: { size: 10 } }, ticks: { color: '#4a5168' }, grid: { color: 'rgba(28,34,53,0.6)' } },
      y: { title: { display: true, text: 'Avg Engagement',  color: '#4a5168', font: { size: 10 } }, ticks: { color: '#4a5168' }, grid: { color: 'rgba(28,34,53,0.6)' } },
    },
  });

  // Affinity matrix
  const venueIds   = Object.keys(matrix);
  const segsOrder  = ['Power Users', 'Event Seekers', 'Casual Visitors', 'Venue Explorers'].filter(s => names.includes(s));
  const maxVal     = Math.max(...venueIds.flatMap(vid => Object.values(matrix[vid] || {})), 1);

  document.getElementById('matrixTable').innerHTML =
    `<thead><tr><th>Venue</th>${segsOrder.map(s => `<th style="color:${SEG_COLORS[s] || '#888'}">${s}</th>`).join('')}<th>Best Match</th></tr></thead><tbody>` +
    venueIds.map(vid => {
      if (!data.venues[vid]) return '';
      const v    = data.venues[vid];
      const m    = matrix[vid] || {};
      const best = segsOrder.reduce((a, b) => (m[a] || 0) >= (m[b] || 0) ? a : b, segsOrder[0]);
      return `<tr>
        <td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${v.color};margin-right:7px"></span>${v.name}</td>
        ${segsOrder.map(s => {
          const val = m[s] || 0;
          const col = SEG_COLORS[s] || '#888';
          const hex = Math.round(val / maxVal * 160 + 20).toString(16).padStart(2, '0');
          return `<td><span class="heat-cell" style="background:${col}${hex};color:${col}">${val}</span></td>`;
        }).join('')}
        <td><span class="v-badge" style="background:${(SEG_COLORS[best] || '#888')}22;color:${SEG_COLORS[best] || '#888'};font-size:10px">${best}</span></td>
      </tr>`;
    }).join('') + `</tbody>`;

  // Recommendations
  document.getElementById('matchGrid').innerHTML = segsOrder.map(seg => {
    const col   = SEG_COLORS[seg] || '#888';
    const icon  = SEG_ICONS[seg]  || '◎';
    const prefs = Object.keys((segs[seg] || {}).top_prefs || {}).slice(0, 2).join(' & ') || 'Mixed';
    const recs  = venueIds
      .filter(vid => data.venues[vid])
      .map(vid => ({ name: data.venues[vid].name, score: (matrix[vid] || {})[seg] || 0, col: data.venues[vid].color }))
      .sort((a, b) => b.score - a.score).slice(0, 3);
    const top = recs[0]?.score || 1;
    return `<div class="match-card">
      <div class="match-header">
        <div class="match-avatar" style="background:${col}22">${icon}</div>
        <div class="match-info"><h4>${seg}</h4><p>${prefs}</p></div>
      </div>
      <div class="match-venues">${recs.map((r, i) => `
        <div class="match-venue-row">
          <span class="match-venue-name">${i + 1}. ${r.name}</span>
          <div class="match-score-bar">
            <div class="msb-bg"><div class="msb-fill" style="width:${(r.score / top * 100).toFixed(0)}%;background:${r.col}"></div></div>
            <span class="msb-val">${r.score}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// Called from HTML onclick
window.highlightSeg = i => {
  document.querySelectorAll('.seg-card').forEach((c, j) => c.classList.toggle('active', i === j));
};

export async function doRefreshSegments() {
  const btn = document.getElementById('refreshSegBtn');
  btn.textContent = '⟳ Running…';
  btn.disabled = true;
  try {
    const { refreshSegmentsAPI } = await import('./api.js');
    const res = await refreshSegmentsAPI();
    if (res.status === 'ok') {
      const start = document.getElementById('dateStart').value || null;
      const end   = document.getElementById('dateEnd').value   || null;
      const fresh = await loadData(start, end);
      renderAll(fresh);
      renderSegments(fresh);
    } else {
      alert('Segmentation error:\n' + res.message);
    }
  } catch (e) {
    alert('Request failed: ' + e.message);
  }
  btn.textContent = '⟳ Refresh AI Segmentation';
  btn.disabled = false;
}

window.doRefreshSegments = doRefreshSegments;
