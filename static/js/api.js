/** Cached result of the last successful /api/data fetch. */
let _cache = null;

export const getData = () => _cache;

/** Fetch aggregated venue data, optionally filtered by ISO date strings. */
export async function loadData(start, end) {
  const p = new URLSearchParams();
  if (start) p.set('start', start);
  if (end)   p.set('end',   end);
  const resp = await fetch('/api/data?' + p);
  if (!resp.ok) throw new Error(await resp.text());
  _cache = await resp.json();
  return _cache;
}

/** Fetch raw check-in rows for drill-down. All params optional. */
export async function fetchRows({ venueId, hour, day, start, end } = {}) {
  const p = new URLSearchParams();
  if (venueId)          p.set('venue_id', venueId);
  if (hour !== undefined) p.set('hour',   hour);
  if (day)              p.set('day',      day);
  if (start)            p.set('start',   start);
  if (end)              p.set('end',     end);
  const resp = await fetch('/api/rows?' + p);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

/** Fetch crowd-density anomaly buckets. */
export async function fetchAnomalies(threshold = 1.5) {
  const resp = await fetch('/api/anomalies?threshold=' + threshold);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

/** Trigger a segmentation re-run on the server. */
export async function refreshSegmentsAPI() {
  const resp = await fetch('/api/refresh-segments', { method: 'POST' });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
