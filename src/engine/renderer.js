/**
 * SVG renderer — the "engine" view of the scene.
 *
 * Strategy for performance & memory:
 *  - One <g> per layer, one SVG node per shape, kept in an id -> node Map.
 *  - On every document/selection/preview change we run a keyed reconcile
 *    pass: nodes are created once, updated with setAttribute only when the
 *    computed attribute string differs, and removed when their shape is gone.
 *    No innerHTML rebuilds, no per-frame allocation churn.
 *  - Drag previews mutate ONLY the transform attribute of selected nodes;
 *    the full geometry sync happens once when the gesture commits.
 */

import { findShape, shapeBounds } from '../core/document.js';
import { worldHandleAnchors } from '../core/hitTest.js';
import { fmt } from '../utils/format.js';
import { screenToWorld, worldToScreen } from '../core/viewport.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HANDLE_SIZE = 8; // screen px

/** Minimal element helper (SVG needs createElementNS). */
function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export class SvgRenderer {
  /**
   * @param {{ svg: SVGSVGElement, store: Object }} opts
   *  store exposes peek-able states: doc, viewport, selection, dragPreview…
   */
  constructor({ svg, store }) {
    this.svg = svg;
    this.store = store;
    /** id -> { node, kind, sig } cached shape nodes */
    this.nodes = new Map();
    this.layerGroup = new Map();

    // Static scaffolding.
    this.artboardRect = el('rect', { class: 'artboard', x: 0, y: 0 });
    this.gridPattern = null;
    this.sceneRoot = el('g', { class: 'scene' });      // pan/zoom applied here
    this.overlayRoot = el('g', { class: 'overlay' });  // screen-space chrome
    this.defs = el('defs');
    this.gradientNodes = new Map();
    this.svg.append(this.defs, this.artboardRect, this.sceneRoot, this.overlayRoot);

    this.overlay = {
      outline: el('rect', { class: 'sel-outline', fill: 'none', stroke: '#7dd3fc', 'stroke-width': 1, visibility: 'hidden' }),
      handles: {},
      ghost: el('rect', { class: 'ghost ghost-rect', visibility: 'hidden' }),
      ghostEllipse: el('ellipse', { class: 'ghost ghost-ellipse', visibility: 'hidden' }),
      ghostLine: el('line', { class: 'ghost ghost-line', visibility: 'hidden' }),
      marquee: el('rect', { class: 'marquee', fill: 'rgba(125,211,252,.12)', stroke: '#7dd3fc', 'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' }),
      penPath: el('polyline', { class: 'pen-preview', visibility: 'hidden' }),
      penAnchors: el('g', { class: 'pen-anchors' }),
      penCursor: el('circle', { class: 'pen-cursor', r: 4, visibility: 'hidden' }),
    };
    // Handles live in their own group so they can be hidden as a unit.
    this.handleGroup = el('g', { class: 'handles' });
    for (const name of Object.keys(worldHandleAnchors({ x: 0, y: 0, width: 1, height: 1 }))) {
      const h = el('rect', {
        class: `handle handle-${name}`,
        width: HANDLE_SIZE, height: HANDLE_SIZE,
        fill: '#ffffff', stroke: '#0284c7', 'stroke-width': 1,
        'data-handle': name,
      });
      this.overlay.handles[name] = h;
      this.handleGroup.append(h);
    }
    this.overlayRoot.append(this.overlay.outline, this.handleGroup, this.overlay.ghost, this.overlay.ghostEllipse, this.overlay.ghostLine, this.overlay.marquee, this.overlay.penPath, this.overlay.penAnchors, this.overlay.penCursor);
  }

  /* ---------------------------------------------------------------- */
  /* Main entry                                                        */
  /* ---------------------------------------------------------------- */

  /** Full reactive sync: cheap diffing, safe to call on every state bump. */
  render() {
    const vp = this.store.viewport.peek();
    const doc = this.store.doc.peek();
    const preview = this.store.dragPreview.peek();
    const resizePreview = this.store.resizePreview.peek();
    const selected = new Set(this.store.selection.peek());

    // Viewport transform: single group update, never re-renders children.
    this.sceneRoot.setAttribute(
      'transform',
      `translate(${fmt(vp.x)},${fmt(vp.y)}) scale(${fmt(vp.scale, 6)})`
    );
    this.svg.setAttribute('viewBox', `0 0 ${vp.width} ${vp.height}`);

    // Artboard backdrop.
    this.artboardRect.setAttribute('width', doc.width);
    this.artboardRect.setAttribute('height', doc.height);
    this.artboardRect.setAttribute('transform',
      `translate(${fmt(vp.x)},${fmt(vp.y)}) scale(${fmt(vp.scale, 6)})`);

    // Layers → groups (order matters for z).
    this.#syncLayers(doc);

    // Shapes → nodes.
    const liveIds = new Set();
    for (const layer of doc.layers) {
      const g = this.layerGroup.get(layer.id);
      if (!layer.visible) { g.setAttribute('display', 'none'); continue; }
      g.removeAttribute('display');
      for (const shape of layer.shapes) {
        liveIds.add(shape.id);
        this.#syncShape(g, shape, vp, selected.has(shape.id), preview, resizePreview);
      }
    }
    this.#pruneNodes(liveIds);

    // Overlay (screen space). During a move preview the selection box rides
    // along with the shapes via a screen-space offset.
    const overlayOffset = preview && preview.ids.length ? { x: preview.dx, y: preview.dy } : null;
    this.#renderOverlay(doc, vp, selected, overlayOffset, resizePreview);
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                         */
  /* ---------------------------------------------------------------- */

  #syncLayers(doc) {
    const wanted = new Set(doc.layers.map((l) => l.id));
    for (const [id, g] of this.layerGroup) {
      if (!wanted.has(id)) { g.remove(); this.layerGroup.delete(id); }
    }
    for (const layer of doc.layers) {
      if (!this.layerGroup.has(layer.id)) {
        const g = el('g', { 'data-layer': layer.id });
        this.layerGroup.set(layer.id, g);
      }
      // Re-append in document order each pass keeps z-order correct with
      // minimal DOM churn (append of an existing child is a move).
      this.sceneRoot.append(this.layerGroup.get(layer.id));
    }
  }

  #paintAttrs(shape) {
    const s = shape.style;
    const gradientId = `vectorize-gradient-${String(shape.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return {
      fill: s.fillGradient ? `url(#${gradientId})` : (s.fill || 'none'),
      stroke: s.stroke || 'none',
      'stroke-width': s.stroke ? fmt(s.strokeWidth) : '0',
      opacity: fmt(s.opacity),
      'stroke-linecap': s.strokeLinecap || 'butt',
      'stroke-linejoin': s.strokeLinejoin || 'miter',
      'stroke-dasharray': s.strokeDasharray || 'none',
      style: s.blendMode && s.blendMode !== 'normal' ? `mix-blend-mode:${s.blendMode}` : '',
    };
  }

  #syncGradient(shape) {
    const descriptor = shape.style?.fillGradient;
    const id = `vectorize-gradient-${String(shape.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const existing = this.gradientNodes.get(shape.id);
    if (!descriptor) {
      existing?.remove();
      this.gradientNodes.delete(shape.id);
      return;
    }
    const tag = descriptor.type === 'radial' ? 'radialGradient' : 'linearGradient';
    let gradient = existing;
    if (!gradient || gradient.tagName !== tag) {
      gradient?.remove();
      gradient = el(tag, { id, gradientUnits: 'objectBoundingBox' });
      this.gradientNodes.set(shape.id, gradient);
      this.defs.append(gradient);
    }
    if (tag === 'linearGradient') {
      const angle = (Number(descriptor.angle) || 0) * Math.PI / 180;
      const dx = Math.cos(angle) * 0.5, dy = Math.sin(angle) * 0.5;
      gradient.setAttribute('x1', fmt(0.5 - dx, 6));
      gradient.setAttribute('y1', fmt(0.5 - dy, 6));
      gradient.setAttribute('x2', fmt(0.5 + dx, 6));
      gradient.setAttribute('y2', fmt(0.5 + dy, 6));
    } else {
      gradient.setAttribute('cx', '0.5');
      gradient.setAttribute('cy', '0.5');
      gradient.setAttribute('r', '0.5');
    }
    const stops = Array.isArray(descriptor.stops) ? descriptor.stops : [];
    gradient.replaceChildren(...stops.map((stop) => el('stop', {
      offset: fmt(Math.max(0, Math.min(1, stop.offset))),
      'stop-color': stop.color,
      'stop-opacity': fmt(Math.max(0, Math.min(1, stop.opacity ?? 1))),
    })));
  }

  #geometryAttrs(shape) {
    const g = shape.geometry;
    switch (shape.kind) {
      case 'rect':
        return { x: fmt(g.x), y: fmt(g.y), width: fmt(g.width), height: fmt(g.height), rx: fmt(g.rx || 0), ry: fmt(g.ry || 0) };
      case 'ellipse':
        return { cx: fmt(g.cx), cy: fmt(g.cy), rx: fmt(g.rx), ry: fmt(g.ry) };
      case 'line':
        return { x1: fmt(g.points[0].x), y1: fmt(g.points[0].y), x2: fmt(g.points[1].x), y2: fmt(g.points[1].y) };
      case 'path': {
        const pts = g.points;
        let d = pts.length ? `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}` : '';
        for (let i = 1; i < pts.length; i++) d += ` L ${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
        if (g.closed) d += ' Z';
        return { d };
      }
      default:
        return {};
    }
  }

  #syncShape(group, shape, vp, isSelected, preview, resizePreview) {
    let entry = this.nodes.get(shape.id);
    if (!entry || entry.kindTag !== shape.kind) {
      const tag = shape.kind === 'path' ? 'path' : shape.kind;
      const node = el(tag, { 'data-id': shape.id });
      entry = { node, kindTag: shape.kind, sig: '' };
      this.nodes.set(shape.id, entry);
      group.append(node);
    } else if (entry.node.parentNode !== group) {
      group.append(entry.node); // moved between layers
    }

    // Build a signature; skip setAttribute work when nothing changed.
    this.#syncGradient(shape);
    const geo = this.#geometryAttrs(shape);
    const paint = this.#paintAttrs(shape);
    const dx = preview && preview.ids.includes(shape.id) ? preview.dx / vp.scale : 0;
    const dy = preview && preview.ids.includes(shape.id) ? preview.dy / vp.scale : 0;
    let liveTransform = '';
    if (resizePreview && resizePreview.ids.includes(shape.id)) {
      const a = resizePreview.startBox;
      const b = resizePreview.endBox;
      const sx = a.width === 0 ? 1 : b.width / a.width;
      const sy = a.height === 0 ? 1 : b.height / a.height;
      const tx = b.x - sx * a.x;
      const ty = b.y - sy * a.y;
      liveTransform = `translate(${fmt(tx)},${fmt(ty)}) scale(${fmt(sx, 6)},${fmt(sy, 6)})`;
    } else if (dx || dy) {
      liveTransform = `translate(${fmt(dx)},${fmt(dy)})`;
    }
    const sig = JSON.stringify([geo, paint, shape.visible, liveTransform]);
    if (sig !== entry.sig) {
      entry.sig = sig;
      for (const [k, v] of Object.entries(paint)) entry.node.setAttribute(k, v);
      if (liveTransform) entry.node.setAttribute('transform', liveTransform);
      else entry.node.removeAttribute('transform');
      for (const [k, v] of Object.entries(geo)) entry.node.setAttribute(k, v);
      if (!shape.visible) entry.node.setAttribute('display', 'none');
      else entry.node.removeAttribute('display');
    }
    void isSelected; // selection styling lives in the overlay, not per-node
  }

  #pruneNodes(liveIds) {
    for (const [id, gradient] of this.gradientNodes) {
      if (!liveIds.has(id)) { gradient.remove(); this.gradientNodes.delete(id); }
    }
    for (const [id, entry] of this.nodes) {
      if (!liveIds.has(id)) {
        entry.node.remove();
        this.nodes.delete(id);
      }
    }
  }

  #renderOverlay(doc, vp, selected, offset, resizePreview) {
    const ids = [...selected];
    const shapes = ids.map((id) => findShape(doc, id)?.shape).filter(Boolean);

    if (shapes.length > 0) {
      let box = shapes.reduce((acc, s) => {
        const b = shapeBounds(s);
        if (!acc) return { ...b };
        return {
          x: Math.min(acc.x, b.x), y: Math.min(acc.y, b.y),
          width: Math.max(acc.x + acc.width, b.x + b.width) - Math.min(acc.x, b.x),
          height: Math.max(acc.y + acc.height, b.y + b.height) - Math.min(acc.y, b.y),
        };
      }, null);
      if (resizePreview && resizePreview.ids.some((id) => selected.has(id))) {
        box = resizePreview.endBox;
      }
      if (box) {
        const ox = offset ? offset.x : 0;
        const oy = offset ? offset.y : 0;
        const tl = worldToScreen(vp, { x: box.x, y: box.y });
        const br = worldToScreen(vp, { x: box.x + box.width, y: box.y + box.height });
        const o = this.overlay.outline;
        o.setAttribute('x', fmt(tl.x + ox)); o.setAttribute('y', fmt(tl.y + oy));
        o.setAttribute('width', fmt(br.x - tl.x)); o.setAttribute('height', fmt(br.y - tl.y));
        o.setAttribute('visibility', 'visible');
        const anchors = worldHandleAnchors(box);
        for (const [name, node] of Object.entries(this.overlay.handles)) {
          const p = worldToScreen(vp, anchors[name]);
          node.setAttribute('x', fmt(p.x + ox - HANDLE_SIZE / 2));
          node.setAttribute('y', fmt(p.y + oy - HANDLE_SIZE / 2));
        }
        this.handleGroup.removeAttribute('display');
      }
    } else {
      this.overlay.outline.setAttribute('visibility', 'hidden');
      this.handleGroup.setAttribute('display', 'none');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Imperative overlays driven by tools (no reactive state touched)   */
  /* ---------------------------------------------------------------- */

  /** Show a shape-accurate outline while dragging out a new object. */
  showGhost(worldBox, kind = 'rect') {
    const vp = this.store.viewport.peek();
    const tl = worldToScreen(vp, { x: worldBox.x, y: worldBox.y });
    const br = worldToScreen(vp, { x: worldBox.x + worldBox.width, y: worldBox.y + worldBox.height });
    const width = Math.max(br.x - tl.x, 0);
    const height = Math.max(br.y - tl.y, 0);
    const rect = this.overlay.ghost;
    const ellipse = this.overlay.ghostEllipse;
    const line = this.overlay.ghostLine;
    line.setAttribute('visibility', 'hidden');
    if (kind === 'ellipse') {
      rect.setAttribute('visibility', 'hidden');
      ellipse.setAttribute('cx', fmt(tl.x + width / 2));
      ellipse.setAttribute('cy', fmt(tl.y + height / 2));
      ellipse.setAttribute('rx', fmt(width / 2));
      ellipse.setAttribute('ry', fmt(height / 2));
      ellipse.setAttribute('visibility', 'visible');
    } else {
      ellipse.setAttribute('visibility', 'hidden');
      rect.setAttribute('x', fmt(tl.x)); rect.setAttribute('y', fmt(tl.y));
      rect.setAttribute('width', fmt(width)); rect.setAttribute('height', fmt(height));
      rect.setAttribute('visibility', 'visible');
    }
  }

  /** Draw a true line preview between the drag start and current pointer. */
  showLineGhost(startWorld, endWorld) {
    this.overlay.ghost.setAttribute('visibility', 'hidden');
    this.overlay.ghostEllipse.setAttribute('visibility', 'hidden');
    const vp = this.store.viewport.peek();
    const start = worldToScreen(vp, startWorld);
    const end = worldToScreen(vp, endWorld);
    const line = this.overlay.ghostLine;
    line.setAttribute('x1', fmt(start.x));
    line.setAttribute('y1', fmt(start.y));
    line.setAttribute('x2', fmt(end.x));
    line.setAttribute('y2', fmt(end.y));
    line.setAttribute('visibility', 'visible');
  }

  hideGhost() {
    this.overlay.ghost.setAttribute('visibility', 'hidden');
    this.overlay.ghostEllipse.setAttribute('visibility', 'hidden');
    this.overlay.ghostLine.setAttribute('visibility', 'hidden');
  }

  /** Marquee selection rectangle in world coords. */
  showMarquee(worldBox) {
    const vp = this.store.viewport.peek();
    const tl = worldToScreen(vp, { x: worldBox.x, y: worldBox.y });
    const br = worldToScreen(vp, { x: worldBox.x + worldBox.width, y: worldBox.y + worldBox.height });
    const m = this.overlay.marquee;
    m.setAttribute('x', fmt(tl.x)); m.setAttribute('y', fmt(tl.y));
    m.setAttribute('width', fmt(Math.max(br.x - tl.x, 0)));
    m.setAttribute('height', fmt(Math.max(br.y - tl.y, 0)));
    m.setAttribute('visibility', 'visible');
  }

  hideMarquee() {
    this.overlay.marquee.setAttribute('visibility', 'hidden');
  }

  /** Live path, fixed anchor markers, and cursor marker for the Pen tool. */
  showPenPreview(pointsWorld, cursorWorld) {
    const vp = this.store.viewport.peek();
    const toScreen = (p) => worldToScreen(vp, p);
    const pts = [...pointsWorld, cursorWorld].map((p) => {
      const s = toScreen(p);
      return `${fmt(s.x)},${fmt(s.y)}`;
    }).join(' ');
    this.overlay.penPath.setAttribute('points', pts);
    this.overlay.penPath.setAttribute('visibility', pointsWorld.length ? 'visible' : 'hidden');

    // Rebuild the small anchor markers; these are only present during a pen gesture.
    this.overlay.penAnchors.replaceChildren();
    for (const point of pointsWorld) {
      const p = toScreen(point);
      this.overlay.penAnchors.append(el('circle', {
        class: 'pen-anchor', cx: fmt(p.x), cy: fmt(p.y), r: 3.5,
      }));
    }
    const cursor = toScreen(cursorWorld);
    this.overlay.penCursor.setAttribute('cx', fmt(cursor.x));
    this.overlay.penCursor.setAttribute('cy', fmt(cursor.y));
    this.overlay.penCursor.setAttribute('visibility', pointsWorld.length ? 'visible' : 'hidden');
  }

  hidePenPreview() {
    this.overlay.penPath.setAttribute('visibility', 'hidden');
    this.overlay.penAnchors.replaceChildren();
    this.overlay.penCursor.setAttribute('visibility', 'hidden');
  }

  /** Screen point -> world point convenience for tools. */
  toWorld(clientPoint) {
    return screenToWorld(this.store.viewport.peek(), clientPoint);
  }
}
