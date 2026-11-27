/**
 * Document data model — plain, serialisable objects only.
 *
 * This module knows nothing about the DOM or Jetz: it is the single source of
 * truth for "what is in the artwork". The store layer wraps these structures
 * in reactive state; the engine renders them; the exporter serialises them.
 */

import { nextId } from './id.js';
import { round } from '../utils/format.js';
import { boxFromCorners, unionAll } from '../utils/geometry.js';

/** Supported primitive kinds. */
export const SHAPE_KINDS = ['rect', 'ellipse', 'line', 'path'];

/** Default paint applied to newly created shapes. */
export const DEFAULT_STYLE = Object.freeze({
  fill: '#4f8ef7',
  stroke: '#1e3a8a',
  strokeWidth: 2,
  opacity: 1,
});

/**
 * @typedef {Object} ShapeStyle
 * @property {string|null} fill        CSS colour or null for "none"
 * @property {string|null} stroke      CSS colour or null for "none"
 * @property {number} strokeWidth
 * @property {number} opacity          0..1
 *
 * @typedef {Object} Shape
 * @property {string} id
 * @property {'rect'|'ellipse'|'line'|'path'} kind
 * @property {string} name              human readable, shown in Layers panel
 * @property {boolean} visible
 * @property {ShapeStyle} style
 * @property {Object} geometry          kind-specific payload (see below)
 *
 * rect    geometry: { x, y, width, height }
 * ellipse geometry: { cx, cy, rx, ry }
 * line    geometry: { points: [{x,y}, {x,y}] }
 * path    geometry: { points: [{x,y}, ...], closed: boolean }
 *
 * @typedef {Object} Layer
 * @property {string} id
 * @property {string} name
 * @property {boolean} visible
 * @property {Shape[]} shapes           bottom-to-top draw order inside layer
 *
 * @typedef {Object} Document
 * @property {string} id
 * @property {string} name
 * @property {number} width             artboard width (world units)
 * @property {number} height            artboard height (world units)
 * @property {Layer[]} layers           bottom-to-top stacking (index 0 = bottom)
 */

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

function makeStyle(overrides = {}) {
  return { ...DEFAULT_STYLE, ...overrides };
}

/** Create a rectangle shape. */
export function createRect(x, y, width, height, style) {
  return {
    id: nextId('rect'),
    kind: 'rect',
    name: 'Rectangle',
    visible: true,
    style: makeStyle(style),
    geometry: { x: round(x), y: round(y), width: round(width), height: round(height) },
  };
}

/** Create an ellipse from its bounding box. */
export function createEllipse(box, style) {
  const b = box;
  return {
    id: nextId('ellipse'),
    kind: 'ellipse',
    name: 'Ellipse',
    visible: true,
    style: makeStyle(style),
    geometry: {
      cx: round(b.x + b.width / 2),
      cy: round(b.y + b.height / 2),
      rx: round(b.width / 2),
      ry: round(b.height / 2),
    },
  };
}

/** Create a straight line through two points. */
export function createLine(a, b, style) {
  return {
    id: nextId('line'),
    kind: 'line',
    name: 'Line',
    visible: true,
    style: makeStyle({ fill: null, stroke: '#1e3a8a', ...style }),
    geometry: { points: [ { x: round(a.x), y: round(a.y) }, { x: round(b.x), y: round(b.y) } ] },
  };
}

/**
 * Create a freehand/poly-line path (Pen tool output).
 * @param {{x:number,y:number}[]} points
 * @param {{ closed?: boolean }} opts
 */
export function createPath(points, opts = {}, style) {
  return {
    id: nextId('path'),
    kind: 'path',
    name: 'Path',
    visible: true,
    style: makeStyle({ fill: null, stroke: '#1e3a8a', ...style }),
    geometry: {
      points: points.map((p) => ({ x: round(p.x), y: round(p.y) })),
      closed: !!opts.closed,
    },
  };
}

/** Create a layer container. */
export function createLayer(name = 'Layer') {
  return { id: nextId('layer'), name, visible: true, shapes: [] };
}

/** Create an empty document with one layer. */
export function createDocument({ name = 'Untitled', width = 1280, height = 800 } = {}) {
  return {
    id: nextId('doc'),
    name,
    width,
    height,
    layers: [createLayer('Layer 1')],
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Flatten all shapes across layers, preserving bottom-to-top order. */
export function allShapes(doc) {
  const out = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const shape of layer.shapes) {
      if (shape.visible) out.push(shape);
    }
  }
  return out;
}

/** Find a shape and its owning layer/index by id. */
export function findShape(doc, id) {
  for (let li = 0; li < doc.layers.length; li++) {
    const layer = doc.layers[li];
    const si = layer.shapes.findIndex((s) => s.id === id);
    if (si !== -1) return { layer, layerIndex: li, shapeIndex: si, shape: layer.shapes[si] };
  }
  return null;
}

/** Axis-aligned world-space bounding box of a single shape. */
export function shapeBounds(shape) {
  const g = shape.geometry;
  switch (shape.kind) {
    case 'rect':
      return { x: g.x, y: g.y, width: g.width, height: g.height };
    case 'ellipse':
      return { x: g.cx - g.rx, y: g.cy - g.ry, width: g.rx * 2, height: g.ry * 2 };
    case 'line':
    case 'path':
      return unionAll(
        g.points.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 }))
      ) || { x: 0, y: 0, width: 0, height: 0 };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/** Bounding box of many shapes (or null when empty). */
export function boundsOf(shapes) {
  return unionAll(shapes.map(shapeBounds));
}

/* ------------------------------------------------------------------ */
/* Pure mutators (operate on a draft copy — used by commands)          */
/* ------------------------------------------------------------------ */

/** Translate a shape's geometry by (dx, dy). Mutates `shape`. */
export function translateShape(shape, dx, dy) {
  const g = shape.geometry;
  switch (shape.kind) {
    case 'rect':
      g.x = round(g.x + dx);
      g.y = round(g.y + dy);
      break;
    case 'ellipse':
      g.cx = round(g.cx + dx);
      g.cy = round(g.cy + dy);
      break;
    case 'line':
    case 'path':
      for (const p of g.points) {
        p.x = round(p.x + dx);
        p.y = round(p.y + dy);
      }
      break;
  }
  return shape;
}

/**
 * Scale a shape so its bounding box becomes `target` (world box).
 * Handles every kind uniformly because each maps to/from a bbox.
 * Mutates `shape`.
 */
export function resizeShapeToBox(shape, target) {
  const src = shapeBounds(shape);
  const sx = src.width === 0 ? 1 : target.width / src.width;
  const sy = src.height === 0 ? 1 : target.height / src.height;
  const g = shape.geometry;

  switch (shape.kind) {
    case 'rect':
      g.x = round(target.x);
      g.y = round(target.y);
      g.width = round(target.width);
      g.height = round(target.height);
      break;
    case 'ellipse': {
      const cx = src.x + src.width / 2;
      const cy = src.y + src.height / 2;
      g.cx = round(target.x + (cx - src.x) * sx);
      g.cy = round(target.y + (cy - src.y) * sy);
      g.rx = round((src.width / 2) * sx);
      g.ry = round((src.height / 2) * sy);
      break;
    }
    case 'line':
    case 'path':
      for (const p of g.points) {
        p.x = round(target.x + (p.x - src.x) * sx);
        p.y = round(target.y + (p.y - src.y) * sy);
      }
      break;
  }
  return shape;
}

/** Rebuild a rect/ellipse shape from a normalised corner pair. */
export function setShapeFromBox(kind, box, style) {
  return kind === 'ellipse' ? createEllipse(box, style) : createRect(box.x, box.y, box.width, box.height, style);
}


/**
 * Validate untrusted imported Vectorize JSON before it enters the renderer.
 * The document model intentionally accepts only the primitive kinds it can
 * render and hit-test correctly.
 */
export function validateDocument(value) {
  const finite = (number) => Number.isFinite(number);
  const validColor = (color) => color === null || (typeof color === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color));
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.name !== 'string' || !Array.isArray(value.layers) ||
      !finite(value.width) || !finite(value.height) || value.width < 1 || value.height < 1 ||
      value.width > 100000 || value.height > 100000) {
    throw new TypeError('Invalid Vectorize document dimensions or layers');
  }
  const ids = new Set();
  for (const layer of value.layers) {
    if (!layer || typeof layer.id !== 'string' || typeof layer.name !== 'string' ||
        typeof layer.visible !== 'boolean' || !Array.isArray(layer.shapes)) {
      throw new TypeError('Invalid layer data');
    }
    if (ids.has(layer.id)) throw new TypeError('Duplicate document ID');
    ids.add(layer.id);
    for (const shape of layer.shapes) {
      if (!shape || typeof shape.id !== 'string' || typeof shape.name !== 'string' ||
          typeof shape.visible !== 'boolean' || !['rect', 'ellipse', 'line', 'path'].includes(shape.kind) ||
          !shape.style || !shape.geometry) throw new TypeError('Invalid shape data');
      if (ids.has(shape.id)) throw new TypeError('Duplicate document ID');
      ids.add(shape.id);
      const style = shape.style;
      if (!validColor(style.fill) || !validColor(style.stroke) ||
          !finite(style.strokeWidth) || style.strokeWidth < 0 ||
          !finite(style.opacity) || style.opacity < 0 || style.opacity > 1 ||
          !['butt', 'round', 'square'].includes(style.strokeLinecap || 'butt') ||
          !['miter', 'round', 'bevel'].includes(style.strokeLinejoin || 'miter') ||
          !['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'].includes(style.blendMode || 'normal') ||
          (style.strokeDasharray != null && (typeof style.strokeDasharray !== 'string' || !/^[0-9. ]+$/.test(style.strokeDasharray)))) {
        throw new TypeError('Invalid shape appearance');
      }
      const gradient = style.fillGradient;
      if (gradient != null) {
        if (!gradient || !['linear', 'radial'].includes(gradient.type) || !finite(gradient.angle) ||
            !Array.isArray(gradient.stops) || gradient.stops.length < 2 ||
            gradient.stops.some((stop) => !stop || !finite(stop.offset) || stop.offset < 0 || stop.offset > 1 ||
              (typeof stop.color !== 'string' || !validColor(stop.color)) || !finite(stop.opacity ?? 1) || (stop.opacity ?? 1) < 0 || (stop.opacity ?? 1) > 1)) {
          throw new TypeError('Invalid gradient appearance');
        }
      }
      const g = shape.geometry;
      const nums = shape.kind === 'rect' ? [g.x, g.y, g.width, g.height, g.rx ?? 0, g.ry ?? 0] :
        shape.kind === 'ellipse' ? [g.cx, g.cy, g.rx, g.ry] : [];
      if (nums.some((number) => !finite(number)) || (shape.kind === 'rect' && (g.width < 0 || g.height < 0 || g.rx < 0 || g.ry < 0)) ||
          (shape.kind === 'ellipse' && (g.rx < 0 || g.ry < 0))) throw new TypeError('Invalid shape geometry');
      if (shape.kind === 'line' && (!Array.isArray(g.points) || g.points.length !== 2)) throw new TypeError('Invalid line points');
      if (shape.kind === 'path' && (!Array.isArray(g.points) || g.points.length < 2 || typeof g.closed !== 'boolean')) throw new TypeError('Invalid path points');
      if (shape.kind === 'line' || shape.kind === 'path') {
        if (g.points.some((point) => !point || !finite(point.x) || !finite(point.y))) throw new TypeError('Invalid path coordinates');
      }
    }
  }
  return cloneDocument(value);
}

/** Deep-clone a document (structuredClone where available). */
export function cloneDocument(doc) {
  if (typeof structuredClone === 'function') return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc));
}

/** Convenience: build a rect from two drag corners. */
export function rectFromDrag(a, b, style) {
  const box = boxFromCorners(a, b);
  return createRect(box.x, box.y, box.width, box.height, style);
}
