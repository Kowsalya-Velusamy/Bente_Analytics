// Pure helper functions — no DOM or browser globals.
// These are exported for both the app and the Jest test suite.

/** Abbreviate a venue name to its first two words. */
export const vShort = name => name.split(' ').slice(0, 2).join(' ');

/** Percentage with fixed decimal places, safe against zero total. */
export const pct = (count, total, decimals = 1) =>
  total === 0 ? 0 : +((count / total) * 100).toFixed(decimals);

/** Return the top-N entries of an object sorted by value descending. */
export function topN(obj, n = 3) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/** Build a 24-element array of hourly counts from an array of row objects. */
export function buildHourDist(rows, hourKey = 'hour_of_day') {
  const dist = new Array(24).fill(0);
  for (const r of rows) {
    const h = r[hourKey];
    if (h >= 0 && h < 24) dist[h]++;
  }
  return dist;
}

/** Population z-scores for an array of numbers. */
export function computeZScores(values) {
  const n = values.length;
  if (n < 2) return values.map(() => 0);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  return values.map(v => (v - mean) / std);
}

/**
 * Given rows with a `crowd_density` field, return the subset whose
 * density z-score (vs the whole array) exceeds `threshold`.
 */
export function detectAnomalies(rows, threshold = 1.5) {
  const densities = rows.map(r => r.crowd_density);
  const zs = computeZScores(densities);
  return rows
    .map((r, i) => ({ ...r, z: zs[i] }))
    .filter(r => Math.abs(r.z) >= threshold);
}

/** Zero-padded hour label, e.g. 9 → "09:00". */
export const hourLabel = h => (h < 10 ? '0' + h : String(h)) + ':00';

/** Format an ISO date string as "Mon YYYY". */
export function fmtMonthYear(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  });
}

/** Convert a 2-D array of rows + headers to a CSV string. */
export function tableToCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
}

/** Trigger a browser file download for a CSV string. */
export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
