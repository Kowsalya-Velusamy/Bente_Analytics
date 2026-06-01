/**
 * Jest tests for the pure helper functions in static/js/utils.js.
 * Run:  cd tests && npm install && npm test
 *
 * utils.js uses ES module syntax (export), so we inline equivalent
 * CommonJS implementations here to keep the test setup zero-config.
 */

// ── Inline pure implementations (mirrors utils.js exactly) ───────────────────

const vShort = name => name.split(' ').slice(0, 2).join(' ');

const pct = (count, total, decimals = 1) =>
  total === 0 ? 0 : +((count / total) * 100).toFixed(decimals);

function topN(obj, n = 3) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function buildHourDist(rows, hourKey = 'hour_of_day') {
  const dist = new Array(24).fill(0);
  for (const r of rows) {
    const h = r[hourKey];
    if (h >= 0 && h < 24) dist[h]++;
  }
  return dist;
}

function computeZScores(values) {
  const n = values.length;
  if (n < 2) return values.map(() => 0);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  return values.map(v => (v - mean) / std);
}

function detectAnomalies(rows, threshold = 1.5) {
  const densities = rows.map(r => r.crowd_density);
  const zs = computeZScores(densities);
  return rows
    .map((r, i) => ({ ...r, z: zs[i] }))
    .filter(r => Math.abs(r.z) >= threshold);
}

const hourLabel = h => (h < 10 ? '0' + h : String(h)) + ':00';

function tableToCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('vShort', () => {
  test('returns first two words', () => {
    expect(vShort('Metro Nightclub')).toBe('Metro Nightclub');
    expect(vShort('TechHub Coworking Space')).toBe('TechHub Coworking');
    expect(vShort('Riverwalk')).toBe('Riverwalk');
  });
});

describe('pct', () => {
  test('computes percentage correctly', () => {
    expect(pct(50, 200)).toBe(25.0);
    expect(pct(1, 3, 2)).toBe(33.33);
  });

  test('returns 0 when total is 0', () => {
    expect(pct(5, 0)).toBe(0);
  });

  test('handles 100%', () => {
    expect(pct(200, 200)).toBe(100.0);
  });
});

describe('topN', () => {
  const obj = { a: 10, b: 50, c: 5, d: 30, e: 20 };

  test('returns top 3 by default', () => {
    const result = topN(obj);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(['b', 50]);
    expect(result[1]).toEqual(['d', 30]);
    expect(result[2]).toEqual(['e', 20]);
  });

  test('respects custom N', () => {
    expect(topN(obj, 2)).toHaveLength(2);
    expect(topN(obj, 5)).toHaveLength(5);
  });

  test('handles empty object', () => {
    expect(topN({}, 3)).toEqual([]);
  });
});

describe('buildHourDist', () => {
  test('produces a 24-element array', () => {
    const rows = [{ hour_of_day: 9 }, { hour_of_day: 9 }, { hour_of_day: 22 }];
    const dist = buildHourDist(rows);
    expect(dist).toHaveLength(24);
    expect(dist[9]).toBe(2);
    expect(dist[22]).toBe(1);
    expect(dist[0]).toBe(0);
  });

  test('ignores out-of-range hours', () => {
    const rows = [{ hour_of_day: -1 }, { hour_of_day: 24 }, { hour_of_day: 12 }];
    const dist = buildHourDist(rows);
    expect(dist[12]).toBe(1);
    expect(dist.reduce((a, b) => a + b, 0)).toBe(1);
  });

  test('supports custom key', () => {
    const rows = [{ h: 6 }, { h: 6 }];
    const dist = buildHourDist(rows, 'h');
    expect(dist[6]).toBe(2);
  });
});

describe('computeZScores', () => {
  test('mean becomes 0 after z-scoring', () => {
    const zs = computeZScores([10, 20, 30, 40, 50]);
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    expect(Math.abs(mean)).toBeLessThan(1e-10);
  });

  test('extreme value gets high |z|', () => {
    const zs = computeZScores([50, 50, 50, 50, 200]);
    expect(Math.abs(zs[4])).toBeGreaterThanOrEqual(2);
  });

  test('single element returns [0]', () => {
    expect(computeZScores([42])).toEqual([0]);
  });

  test('identical values return all 0', () => {
    const zs = computeZScores([5, 5, 5, 5]);
    zs.forEach(z => expect(z).toBe(0));
  });
});

describe('detectAnomalies', () => {
  const rows = [
    { crowd_density: 50 }, { crowd_density: 52 }, { crowd_density: 48 },
    { crowd_density: 51 }, { crowd_density: 49 }, { crowd_density: 200 }, // extreme
  ];

  test('flags the outlier at default threshold', () => {
    const result = detectAnomalies(rows);
    expect(result).toHaveLength(1);
    expect(result[0].crowd_density).toBe(200);
  });

  test('returns empty when no anomalies exist', () => {
    const uniform = [10, 10, 10, 10, 10].map(v => ({ crowd_density: v }));
    expect(detectAnomalies(uniform)).toHaveLength(0);
  });

  test('respects custom threshold', () => {
    const result = detectAnomalies(rows, 0.1); // very low threshold
    expect(result.length).toBeGreaterThan(0);
  });

  test('attaches z property to returned rows', () => {
    const result = detectAnomalies(rows);
    expect(result[0]).toHaveProperty('z');
  });
});

describe('hourLabel', () => {
  test('pads single-digit hours', () => {
    expect(hourLabel(0)).toBe('00:00');
    expect(hourLabel(9)).toBe('09:00');
  });

  test('leaves double-digit hours as-is', () => {
    expect(hourLabel(10)).toBe('10:00');
    expect(hourLabel(23)).toBe('23:00');
  });
});

describe('tableToCSV', () => {
  test('produces correct CSV for simple data', () => {
    const csv = tableToCSV(['Name', 'Score'], [['Alice', 95], ['Bob', 82]]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Score');
    expect(lines[1]).toBe('Alice,95');
    expect(lines[2]).toBe('Bob,82');
  });

  test('escapes values containing commas', () => {
    const csv = tableToCSV(['Col'], [['hello, world']]);
    expect(csv).toContain('"hello, world"');
  });

  test('escapes values containing double quotes', () => {
    const csv = tableToCSV(['Col'], [['"quoted"']]);
    expect(csv).toContain('"""quoted"""');
  });

  test('handles null/undefined values', () => {
    const csv = tableToCSV(['A', 'B'], [[null, undefined]]);
    expect(csv.split('\n')[1]).toBe(',');
  });
});
