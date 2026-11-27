/**
 * Pure geometry math: points, axis-aligned boxes, segments.
 * No DOM, no framework — trivially unit-testable.
 */

import { round } from './format.js';

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number, width: number, height: number }} Box
 */

/** Normalise two arbitrary corners into a canonical box (non-negative size). */
export function boxFromCorners(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Is the point inside the box? `tol` expands the box on every side. */
export function pointInBox(point, box, tol = 0) {
  return (
    point.x >= box.x - tol &&
    point.x <= box.x + box.width + tol &&
    point.y >= box.y - tol &&
    point.y <= box.y + box.height + tol
  );
}

/** Union of two boxes (smallest box containing both). */
export function unionBoxes(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/** Union of many boxes; returns null for an empty list. */
export function unionAll(boxes) {
  if (!boxes.length) return null;
  return boxes.reduce(unionBoxes);
}

/** Shortest distance from a point to a line segment ab. */
export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Snap a value to a grid step. `step <= 0` disables snapping.
 * @returns {number}
 */
export function snapToGrid(value, step) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Resize a box from a drag delta on one of its handles.
 * Handles are named nw, n, ne, e, se, s, sw, w. Negative sizes are
 * normalised so the user can drag "through" an edge.
 *
 * @param {Box} box original box
 * @param {'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'} handle
 * @param {Point} delta world-space movement of the pointer
 * @param {{ keepAspect?: boolean }} [opts]
 * @returns {Box} new, normalised box
 */
export function resizeBox(box, handle, delta, opts = {}) {
  let { x, y, width, height } = box;
  let right = x + width;
  let bottom = y + height;

  if (handle.includes('w')) x += delta.x;
  if (handle.includes('e')) right += delta.x;
  if (handle.includes('n')) y += delta.y;
  if (handle.includes('s')) bottom += delta.y;

  let next = {
    x: Math.min(x, right),
    y: Math.min(y, bottom),
    width: Math.abs(right - x),
    height: Math.abs(bottom - y),
  };

  if (opts.keepAspect && width > 0 && height > 0) {
    const ratio = width / height;
    const anchored = handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se';
    if (anchored) {
      // Force the dominant axis, keep the anchor corner fixed.
      const scaleX = next.width / width;
      const scaleY = next.height / height;
      if (scaleX >= scaleY) {
        next.height = round(next.width / ratio);
      } else {
        next.width = round(next.height * ratio);
      }
      if (handle.includes('w')) next.x = box.x + box.width - next.width;
      if (handle.includes('n')) next.y = box.y + box.height - next.height;
    }
  }
  return next;
}
