/**
 * Interaction controller — the ONLY place that touches raw pointer events.
 *
 * Responsibilities:
 *  - translate pointer/keyboard/wheel events into tool gestures,
 *  - keep per-frame work OUT of the reactive store (rAF-coalesced preview),
 *  - commit final results to the store exactly once per gesture.
 *
 * Tools implemented: select/move/resize/marquee, rect, ellipse, line,
 * pen (click-to-add, double-click/Enter to finish), space/middle pan, wheel
 * zoom. The store never sees PointerEvent objects.
 */

import { allShapes } from '../core/document.js';
import { createRect, createEllipse, createLine, createPath, rectFromDrag } from '../core/document.js';
import { boxFromCorners, resizeBox, snapToGrid } from '../utils/geometry.js';
import { hitTest, shapesInMarquee, pickHandle, HANDLE_CURSORS } from '../core/hitTest.js';
import { screenToWorld, wheelZoomFactor } from '../core/viewport.js';
import * as store from '../store/editorStore.js';

const MIN_CREATE_SIZE = 2; // world units — ignore accidental micro-drags

export class InteractionController {
  /**
   * @param {{ svg: SVGSVGElement, renderer: import('./renderer.js').SvgRenderer, requestFrame?: Function }} opts
   */
  constructor({ svg, renderer, requestFrame }) {
    this.svg = svg;
    this.renderer = renderer;
    this.raf = requestFrame || ((cb) => requestAnimationFrame(cb));

    /** @type {null|Object} active gesture descriptor */
    this.gesture = null;
    this.spaceDown = false;
    this.lastScreen = { x: 0, y: 0 };
    this.penPoints = [];
    this._frameQueued = false;
    this._pendingPreview = null;
    this._disposers = [];

    this.#bind();
  }

  /* ---------------------------------------------------------------- */
  /* Wiring                                                            */
  /* ---------------------------------------------------------------- */

  #bind() {
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    on(this.svg, 'pointerdown', (e) => this.#onPointerDown(e));
    on(window, 'pointermove', (e) => this.#onPointerMove(e));
    on(window, 'pointerup', (e) => this.#onPointerUp(e));
    on(this.svg, 'wheel', (e) => this.#onWheel(e), { passive: false });
    on(this.svg, 'dblclick', () => this.#finishPen());
    on(window, 'keydown', (e) => this.#onKeyDown(e));
    on(window, 'keyup', (e) => this.#onKeyUp(e));
  }

  dispose() {
    this._disposers.forEach((d) => d());
    this._disposers.length = 0;
  }

  /** Client coords -> canvas-local CSS px (accounts for element offset & DPR-free layout). */
  #toCanvasPoint(e) {
    const r = this.svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #world(e) {
    return screenToWorld(store.viewport.peek(), this.#toCanvasPoint(e));
  }

  #snap(p) {
    const g = store.gridSize.peek();
    return { x: snapToGrid(p.x, g), y: snapToGrid(p.y, g) };
  }

  /* ---------------------------------------------------------------- */
  /* Preview scheduling — at most one DOM update per frame             */
  /* ---------------------------------------------------------------- */

  #queuePreview(ids, dx, dy) {
    this._pendingPreview = { ids, dx, dy };
    if (this._frameQueued) return;
    this._frameQueued = true;
    this.raf(() => {
      this._frameQueued = false;
      if (!this._pendingPreview) return;
      const { ids: a, dx: x, dy: y } = this._pendingPreview;
      this._pendingPreview = null;
      store.previewTransform(a, x, y); // cheap state; renderer patches attrs
    });
  }

  /* ---------------------------------------------------------------- */
  /* Pointer down                                                      */
  /* ---------------------------------------------------------------- */

  #onPointerDown(e) {
    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      this.gesture = { mode: 'pan', last: this.#toCanvasPoint(e) };
      this.#setCursor('grabbing');
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    const point = this.#world(e);
    const tool = store.activeTool.peek();

    if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
      this.gesture = { mode: 'create', kind: tool, start: this.#snap(point), current: this.#snap(point) };
      return;
    }
    if (tool === 'pen') {
      const snapped = this.#snap(point);
      // Double-point close on clicking the first anchor again.
      if (this.penPoints.length > 1) {
        const first = this.penPoints[0];
        if (Math.hypot(first.x - snapped.x, first.y - snapped.y) < 8 / store.viewport.peek().scale) {
          this.penPoints.push({ ...first });
          this.#finishPen(true);
          return;
        }
      }
      // A double-click ends the current path. Handle it here (before the
      // browser's dblclick event) so the second click is not stored twice.
      if (e.detail >= 2) {
        this.#finishPen(true);
        return;
      }
      this.penPoints.push(snapped);
      this.renderer.showPenPreview(this.penPoints, snapped);
      store.statusText.value = 'Pen: click to add points · double-click or Enter to finish · Esc to cancel';
      return;
    }

    // --- Select tool -------------------------------------------------
    const doc = store.doc.peek();
    const vp = store.viewport.peek();
    const shapes = allShapes(doc);

    // 1. Bounding-box handles win priority.
    const selIds = store.selection.peek();
    if (selIds.length) {
      const selShapes = selIds.map((id) => shapes.find((s) => s.id === id)).filter(Boolean);
      const box = selShapes.length ? unionBoundsOf(selShapes) : null;
      if (box) {
        const handle = pickHandle(box, point, vp.scale);
        if (handle) {
          store.beginTransformGesture();
          this.gesture = { mode: 'resize', handle, startBox: { ...box }, origin: point, keepAspect: e.shiftKey };
          return;
        }
      }
    }

    // 2. Shape hit?
    const hit = hitTest(shapes, point, 6, vp.scale);
    if (hit) {
      const additive = e.shiftKey;
      let ids = selIds.slice();
      if (additive) {
        ids = ids.includes(hit.id) ? ids.filter((i) => i !== hit.id) : [...ids, hit.id];
        store.select(ids);
      } else if (!ids.includes(hit.id)) {
        ids = [hit.id];
        store.select(ids);
      }
      if (ids.length) {
        store.beginTransformGesture();
        this.gesture = { mode: 'move', ids, origin: point, moved: false };
      }
      return;
    }

    // 3. Empty canvas → marquee selection.
    if (!e.shiftKey) store.clearSelection();
    this.gesture = { mode: 'marquee', start: point, additive: e.shiftKey };
  }

  /* ---------------------------------------------------------------- */
  /* Pointer move                                                      */
  /* ---------------------------------------------------------------- */

  #onPointerMove(e) {
    const g = this.gesture;
    const screen = this.#toCanvasPoint(e);
    this.lastScreen = screen;

    if (!g) {
      this.#updateHoverCursor(e);
      if (store.activeTool.peek() === 'pen' && this.penPoints.length) {
        this.renderer.showPenPreview(this.penPoints, this.#snap(this.#world(e)));
      }
      return;
    }

    switch (g.mode) {
      case 'pan': {
        const dx = screen.x - g.last.x;
        const dy = screen.y - g.last.y;
        g.last = screen;
        // Pan mutates only the viewport transform group — no doc churn.
        store.pan(dx, dy);
        this.renderer.render();
        break;
      }
      case 'move': {
        const p = this.#snap(this.#world(e));
        const dx = p.x - g.origin.x;
        const dy = p.y - g.origin.y;
        if (Math.abs(dx) + Math.abs(dy) > 1e-9) g.moved = true;
        const vp = store.viewport.peek();
        this.#queuePreview(g.ids, dx * vp.scale, dy * vp.scale);
        break;
      }
      case 'resize': {
        const p = this.#snap(this.#world(e));
        const delta = { x: p.x - g.origin.x, y: p.y - g.origin.y };
        const next = resizeBox(g.startBox, g.handle, delta, { keepAspect: e.shiftKey || g.keepAspect });
        g.nextBox = next;
        // Live preview via ghost outline (no store writes per frame).
        this.renderer.showGhost(next);
        break;
      }
      case 'create': {
        g.current = this.#snap(this.#world(e));
        const box = boxFromCorners(g.start, g.current);
        if (g.kind === 'line') {
          this.renderer.showLineGhost(g.start, g.current);
        } else {
          this.renderer.showGhost(box, g.kind);
        }
        break;
      }
      case 'marquee': {
        const p = this.#world(e);
        const box = boxFromCorners(g.start, p);
        this.renderer.showMarquee(box);
        g.box = box;
        break;
      }
    }
  }

  #updateHoverCursor(e) {
    const tool = store.activeTool.peek();
    if (this.spaceDown) { this.#setCursor('grab'); return; }
    if (tool !== 'select') { this.#setCursor('crosshair'); return; }
    const point = this.#world(e);
    const vp = store.viewport.peek();
    const selIds = store.selection.peek();
    if (selIds.length) {
      const shapes = allShapes(store.doc.peek());
      const selShapes = selIds.map((id) => shapes.find((s) => s.id === id)).filter(Boolean);
      const box = selShapes.length ? unionBoundsOf(selShapes) : null;
      if (box) {
        const h = pickHandle(box, point, vp.scale);
        if (h) { this.#setCursor(HANDLE_CURSORS[h]); return; }
      }
    }
    const hit = hitTest(allShapes(store.doc.peek()), point, 6, vp.scale);
    this.#setCursor(hit ? 'move' : 'default');
  }

  #setCursor(c) {
    this.svg.style.cursor = c;
  }

  /* ---------------------------------------------------------------- */
  /* Pointer up                                                        */
  /* ---------------------------------------------------------------- */

  #onPointerUp(e) {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;

    switch (g.mode) {
      case 'pan':
        this.#setCursor(this.spaceDown ? 'grab' : 'default');
        break;

      case 'move': {
        const p = this.#snap(this.#world(e));
        const dx = p.x - g.origin.x;
        const dy = p.y - g.origin.y;
        this._pendingPreview = null; // drop queued frames; commit is final
        store.endTransformGesture((draft, markChanged) => {
          if (!g.moved || (dx === 0 && dy === 0)) return;
          markChanged();
          for (const id of g.ids) {
            const found = findShapeById(draft, id);
            if (found) store.applyBoxToShape(found.shape, shiftBounds(found.shape, dx, dy));
          }
        });
        break;
      }

      case 'resize': {
        this.renderer.hideGhost();
        if (g.nextBox) {
          const box = g.nextBox;
          store.endTransformGesture((draft, markChanged) => {
            markChanged();
            for (const id of store.selection.peek()) {
              const found = findShapeById(draft, id);
              if (found) store.applyBoxToShape(found.shape, scaleFromBox(found.shape, g.startBox, box));
            }
          });
        } else {
          store.endTransformGesture(null);
        }
        break;
      }

      case 'create': {
        this.renderer.hideGhost();
        const b = boxFromCorners(g.start, g.current);
        const shape =
          g.kind === 'rect' && b.width >= MIN_CREATE_SIZE && b.height >= MIN_CREATE_SIZE ? rectFromDrag(g.start, g.current) :
          g.kind === 'ellipse' && b.width >= MIN_CREATE_SIZE && b.height >= MIN_CREATE_SIZE ? createEllipse(b) :
          g.kind === 'line' && Math.hypot(b.width, b.height) >= MIN_CREATE_SIZE ? createLine(g.start, g.current) :
          null;
        if (shape) {
          store.addShape(shape);
          this.renderer.render();
        }
        break;
      }

      case 'marquee': {
        this.renderer.hideMarquee();
        if (g.box && (g.box.width > 2 || g.box.height > 2)) {
          const picked = shapesInMarquee(allShapes(store.doc.peek()), g.box).map((s) => s.id);
          store.select(picked, { additive: g.additive });
        }
        break;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Wheel zoom                                                        */
  /* ---------------------------------------------------------------- */

  #onWheel(e) {
    e.preventDefault();
    const factor = wheelZoomFactor(e.deltaY);
    store.zoom(factor, this.#toCanvasPoint(e));
    this.renderer.render();
  }

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                          */
  /* ---------------------------------------------------------------- */

  #isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  #onKeyDown(e) {
    if (this.#isTypingTarget(e)) return;
    const mod = e.ctrlKey || e.metaKey;

    if (e.code === 'Space' && !this.spaceDown) {
      this.spaceDown = true;
      if (!this.gesture) this.#setCursor('grab');
      e.preventDefault();
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? store.redo() : store.undo();
      this.renderer.render();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      store.redo();
      this.renderer.render();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      store.deleteSelected();
      this.renderer.render();
      return;
    }
    if (e.key === 'Escape') {
      this.#finishPen();
      store.clearSelection();
      this.gesture = null;
      this.renderer.hideGhost();
      this.renderer.hideMarquee();
      return;
    }
    if (e.key === 'Enter' && store.activeTool.peek() === 'pen') {
      this.#finishPen(true);
      return;
    }
    // Tool hotkeys.
    const hotkeys = { v: 'select', r: 'rect', o: 'ellipse', l: 'line', p: 'pen' };
    const tool = hotkeys[e.key.toLowerCase()];
    if (tool && !mod) {
      store.activeTool.value = tool;
      this.#finishPen();
    }
  }

  #onKeyUp(e) {
    if (e.code === 'Space') {
      this.spaceDown = false;
      if (!this.gesture) this.#setCursor('default');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Pen                                                               */
  /* ---------------------------------------------------------------- */

  #finishPen(commit = false) {
    this.renderer.hidePenPreview();
    const pts = this.penPoints;
    this.penPoints = [];
    if (commit && pts.length >= 2) {
      store.addShape(createPath(pts, { closed: false }));
      this.renderer.render();
    } else if (!commit && pts.length) {
      store.statusText.value = 'Pen path cancelled';
    }
  }
}

/* -------------------------------------------------------------------- */
/* Local geometry helpers (kept here so tools stay readable)             */
/* -------------------------------------------------------------------- */

function findShapeById(doc, id) {
  for (const layer of doc.layers) {
    const shape = layer.shapes.find((s) => s.id === id);
    if (shape) return { layer, shape };
  }
  return null;
}

function unionBoundsOf(shapes) {
  let acc = null;
  for (const s of shapes) {
    const b = shapeBoundsLocal(s);
    if (!acc) { acc = { ...b }; continue; }
    const x = Math.min(acc.x, b.x);
    const y = Math.min(acc.y, b.y);
    acc = {
      x, y,
      width: Math.max(acc.x + acc.width, b.x + b.width) - x,
      height: Math.max(acc.y + acc.height, b.y + b.height) - y,
    };
  }
  return acc;
}

// Re-exported lazily to avoid an import cycle in some bundlers.
import { shapeBounds } from '../core/document.js';
function shapeBoundsLocal(s) { return shapeBounds(s); }

/** Shift a shape's bbox by (dx, dy) and return the resulting world box. */
function shiftBounds(shape, dx, dy) {
  const b = shapeBounds(shape);
  return { x: b.x + dx, y: b.y + dy, width: b.width, height: b.height };
}

/** Map a shape's own box through the (startGroupBox -> endBox) affine. */
function scaleFromBox(shape, startBox, endBox) {
  const b = shapeBounds(shape);
  const sx = startBox.width === 0 ? 1 : endBox.width / startBox.width;
  const sy = startBox.height === 0 ? 1 : endBox.height / startBox.height;
  return {
    x: endBox.x + (b.x - startBox.x) * sx,
    y: endBox.y + (b.y - startBox.y) * sy,
    width: b.width * sx,
    height: b.height * sy,
  };
}
