import { cmPer360 } from '../core/sensitivity.js';

const DASH = '—';

export const pct = (v) => (v == null ? DASH : `${Math.round(v * 100)}%`);
export const sec = (v) => (v == null ? DASH : `${v.toFixed(3)}초`);
export const deg = (v) => (v == null ? DASH : `${v.toFixed(2)}°`);
export const cm360Label = (dpi, sens) => `한 바퀴 ${cmPer360(dpi, sens).toFixed(1)}cm`;

export function sessionFileName(date, mode) {
  return `${date.toISOString().slice(0, 19).replace(/:/g, '-')}-${mode}.json`;
}
