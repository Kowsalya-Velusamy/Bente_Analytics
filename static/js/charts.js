import { CHART_DEFAULTS } from './constants.js';

/** Registry of all live Chart instances keyed by canvas id. */
const _reg = {};

/**
 * Create (or replace) a Chart.js chart on the canvas with the given id.
 * Automatically destroys any previous instance to avoid memory leaks.
 */
export function mkChart(id, type, data, options) {
  if (_reg[id]) { _reg[id].destroy(); delete _reg[id]; }
  const el = document.getElementById(id);
  if (!el) return null;
  _reg[id] = new Chart(el.getContext('2d'), { type, data, options });
  return _reg[id];
}

/** Destroy a single chart by canvas id. */
export function destroyChart(id) {
  if (_reg[id]) { _reg[id].destroy(); delete _reg[id]; }
}

export { CHART_DEFAULTS };
