/**
 * Viewport transform math: world-space <-> screen-space.
 *
 * The viewport is described by a simple affine map:
 *   screen = world * scale + pan
 *   world  = (screen - pan) / scale
 *
 * `pan` is expressed in CSS pixels of the canvas element, origin at its
 * top-left corner. All functions are pure so they can be unit-tested and
 * reused by both the renderer and the interaction controller.
 */

import { clamp } from '../utils/format.js';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 64;
const ZOOM_STEP = 1.2; // multiplier per wheel notch

/** @typedef {{ x: number, y: number, scale: number }} Viewport */

/** Create a default viewport centred on the origin. */
export function createViewport({ width = 800, height = 600, margin = 48 } = {}) {
  return { x: margin, y: margin, scale: 1, width, height };
}

/** Fit a world rect into the viewport with padding; returns a new viewport. */
export function fitViewport(viewport, worldRect, padding = 48) {
  const w = Math.max(worldRect.width, 1);
  const h = Math.max(worldRect.height, 1);
  const scale = clamp(
    Math.min(
      (viewport.width - padding * 2) / w,
      (viewport.height - padding * 2) / h
    ),
    MIN_ZOOM,
    MAX_ZOOM
  );
  return {
    ...viewport,
    scale,
    x: (viewport.width - w * scale) / 2 - worldRect.x * scale,
    y: (viewport.height - h * scale) / 2 - worldRect.y * scale,
  };
}

/** Convert a screen point ({x,y} CSS px) to world coordinates. */
export function screenToWorld(viewport, p) {
  return { x: (p.x - viewport.x) / viewport.scale, y: (p.y - viewport.y) / viewport.scale };
}

/** Convert a world point to screen coordinates. */
export function worldToScreen(viewport, p) {
  return { x: p.x * viewport.scale + viewport.x, y: p.y * viewport.scale + viewport.y };
}

/** Pan the viewport by a screen-space delta. Returns a new viewport. */
export function panBy(viewport, dx, dy) {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/**
 * Zoom around a fixed screen anchor (the mouse position), keeping the world
 * point under the cursor stationary.
 *
 * @param {Viewport} viewport
 * @param {{x:number,y:number}} anchor screen point
 * @param {number} factor multiplicative zoom (e.g. 1.2 or 1/1.2)
 */
export function zoomAt(viewport, anchor, factor) {
  const nextScale = clamp(viewport.scale * factor, MIN_ZOOM, MAX_ZOOM);
  const k = nextScale / viewport.scale;
  return {
    ...viewport,
    scale: nextScale,
    x: anchor.x - (anchor.x - viewport.x) * k,
    y: anchor.y - (anchor.y - viewport.y) * k,
  };
}

/** Wheel-friendly helper: convert a normalized deltaY into a zoom factor. */
export function wheelZoomFactor(deltaY) {
  const notches = clamp(deltaY / 100, -3, 3);
  return ZOOM_STEP ** -notches;
}

/** Round a zoom level for display (percent). */
export function zoomPercent(scale) {
  return Math.round(scale * 100);
}
