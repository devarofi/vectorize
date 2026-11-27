/**
 * Hit-testing: map a world-space pointer position to the topmost shape
 * under it, and expose bounding-box handles for the selection overlay.
 *
 * Works on plain document data (see core/document.js) — no DOM required.
 */

import { shapeBounds } from './document.js';
import { pointInBox, distanceToSegment } from '../utils/geometry.js';

const DEFAULT_TOLERANCE_PX = 6; // screen pixels, converted to world by caller

/**
 * Is `point` (world) inside/touching `shape`?
 * @param {Shape} shape
 * @param {{x:number,y:number}} point world coords
 * @param {number} tol tolerance in world units
 */
export function hitShape(shape, point, tol) {
  if (!shape.visible) return false;
  const g = shape.geometry;
  const strokeTol = tol + (shape.style.strokeWidth || 0) / 2;

  switch (shape.kind) {
    case 'rect': {
      const box = { x: g.x, y: g.y, width: g.width, height: g.height };
      if (shape.style.fill) return pointInBox(point, box, tol);
      // Outline-only rects need a near-edge hit.
      const outer = pointInBox(point, box, strokeTol);
      const inner = pointInBox(point, { ...box, x: box.x + strokeTol, y: box.y + strokeTol, width: Math.max(box.width - strokeTol * 2, 0), height: Math.max(box.height - strokeTol * 2, 0) }, -strokeTol);
      return outer && !inner;
    }
    case 'ellipse': {
      const nx = (point.x - g.cx) / Math.max(g.rx, 1e-6);
      const ny = (point.y - g.cy) / Math.max(g.ry, 1e-6);
      const d = nx * nx + ny * ny;
      if (shape.style.fill) return d <= 1 + tol / Math.min(g.rx, g.ry || 1);
      return Math.abs(Math.sqrt(d) - 1) <= strokeTol / Math.min(g.rx, g.ry || 1);
    }
    case 'line': {
      const [a, b] = g.points;
      return distanceToSegment(point, a, b) <= strokeTol;
    }
    case 'path': {
      const pts = g.points;
      if (pts.length < 2) return false;
      // Filled closed path: bbox approximation + even-odd raycast is overkill
      // for the MVP; use segment proximity, plus bbox interior when filled.
      for (let i = 0; i < pts.length - 1; i++) {
        if (distanceToSegment(point, pts[i], pts[i + 1]) <= strokeTol) return true;
      }
      if (g.closed && distanceToSegment(point, pts[pts.length - 1], pts[0]) <= strokeTol) return true;
      if (shape.style.fill && g.closed) {
        return pointInBox(point, shapeBounds(shape), tol) && pointInPolygon(point, pts);
      }
      return false;
    }
    default:
      return false;
  }
}

/** Even-odd polygon test used for closed filled paths. */
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > p.y) !== (yj > p.y) &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Topmost shape at a world point. Shapes are given bottom-to-top; we scan
 * in reverse so later (higher) shapes win.
 *
 * @param {Shape[]} shapes bottom-to-top visible shapes
 * @param {{x:number,y:number}} point world coords
 * @param {number} [tolPx] screen-pixel tolerance
 * @param {number} [scale] current zoom (to convert px -> world units)
 * @returns {Shape|null}
 */
export function hitTest(shapes, point, tolPx = DEFAULT_TOLERANCE_PX, scale = 1) {
  const tol = tolPx / Math.max(scale, 1e-6);
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitShape(shapes[i], point, tol)) return shapes[i];
  }
  return null;
}

/**
 * Which shapes intersect a marquee rectangle (selection box drag)?
 * @param {Shape[]} shapes
 * @param {{x,y,width,height}} rect world box
 */
export function shapesInMarquee(shapes, rect) {
  return shapes.filter((s) => {
    const b = shapeBounds(s);
    return !(b.x + b.width < rect.x || b.x > rect.x + rect.width ||
             b.y + b.height < rect.y || b.y > rect.y + rect.height);
  });
}

/* ------------------------------------------------------------------ */
/* Bounding-box handles                                                */
/* ------------------------------------------------------------------ */

export const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Cursor CSS name for a resize handle. */
export const HANDLE_CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

/**
 * Compute handle anchor points in WORLD space for a box. The renderer can
 * project them with its own viewport without importing viewport math here.
 * @param {Box} box
 * @returns {Record<string,{x:number,y:number}>}
 */
export function worldHandleAnchors(box) {
  const mx = box.x + box.width / 2;
  const my = box.y + box.height / 2;
  const r = box.x + box.width;
  const b = box.y + box.height;
  return {
    nw: { x: box.x, y: box.y }, n: { x: mx, y: box.y }, ne: { x: r, y: box.y },
    e: { x: r, y: my }, se: { x: r, y: b }, s: { x: mx, y: b },
    sw: { x: box.x, y: b }, w: { x: box.x, y: my },
  };
}

/**
 * Find which handle (if any) is under a world point, using a screen-pixel
 * tolerance converted through the current zoom.
 * @returns {'nw'|'n'|...|'w'|null}
 */
export function pickHandle(box, point, scale, tolPx = 8) {
  const anchors = worldHandleAnchors(box);
  const tol = tolPx / Math.max(scale, 1e-6);
  for (const name of HANDLE_NAMES) {
    if (pointInBox(point, { x: anchors[name].x, y: anchors[name].y, width: 0, height: 0 }, tol)) {
      return name;
    }
  }
  return null;
}
