/**
 * Number formatting helpers shared by the renderer, the inspector and the
 * SVG exporter. Keeping rounding in one place guarantees that exported files
 * and UI readouts never disagree.
 */

const DEFAULT_PRECISION = 2;

/**
 * Round a number to `precision` decimals and strip trailing zeros.
 * Returns a plain Number (safe for Math ops); NaN/Infinity collapse to 0.
 * @param {number} value
 * @param {number} [precision]
 * @returns {number}
 */
export function round(value, precision = DEFAULT_PRECISION) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * Format a number as a compact attribute string ("12", "12.5", not "12.50").
 * @param {number} value
 * @param {number} [precision]
 * @returns {string}
 */
export function fmt(value, precision = DEFAULT_PRECISION) {
  const r = round(value, precision);
  // Avoid "-0" leaking into markup.
  return Object.is(r, -0) ? '0' : String(r);
}

/** Clamp helper used across tools and panels. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
