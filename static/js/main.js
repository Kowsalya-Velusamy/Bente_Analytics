import { loadData, getData }            from './api.js';
import { renderOverview }               from './overview.js';
import { renderVisitors }               from './visitors.js';
import { initVenuePage, renderVenueCharts, toggleCompareMode } from './venues.js';
import { initReviewPage }               from './reviews.js';
import { renderSegments }               from './segments.js';
import { startAnomalyPanel }            from './anomalies.js';

// ── Re-render all always-visible pages ────────────────────────────────────────
export function renderAll(data) {
  renderOverview(data);
  renderVisitors(data);
}

// ── Page routing ──────────────────────────────────────────────────────────────
window.showPage = function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');

  const data = getData();
  if (!data) return;

  if (id === 'venues')   initVenuePage(data);
  if (id === 'reviews')  initReviewPage(data);
  if (id === 'segments') renderSegments(data);
};

// ── Date-range load ────────────────────────────────────────────────────────────
window.applyDateFilter = async function applyDateFilter() {
  const start = document.getElementById('dateStart').value || null;
  const end   = document.getElementById('dateEnd').value   || null;

  document.getElementById('liveBadgeText').textContent = 'Loading…';

  try {
    const data = await loadData(start, end);
    renderAll(data);

    // Refresh the currently-visible dynamic page
    const active = document.querySelector('.page.active')?.id;
    if (active === 'page-venues')   initVenuePage(data);
    if (active === 'page-reviews')  initReviewPage(data);
    if (active === 'page-segments') renderSegments(data);
  } catch (e) {
    document.getElementById('liveBadgeText').textContent = 'Error';
    console.error(e);
  }
};

// ── Compare-mode toggle (called from HTML) ────────────────────────────────────
window.toggleCompare = function toggleCompare() {
  const data = getData();
  if (data) toggleCompareMode(data);
};

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const data = await loadData(null, null);
    renderAll(data);
    startAnomalyPanel();
  } catch (e) {
    document.getElementById('liveBadgeText').textContent = 'Error — is the server running?';
    console.error('Boot failed:', e);
  }
})();
