/**
 * Editor store — the reactive bridge between the plain-data core and the UI.
 *
 * Design rules (Jetz v1.3.1 patterns):
 *  - `doc` is held in a single stateOf holding PLAIN document snapshots.
 *    Mutations always go through commands that swap in a new snapshot, so
 *    undo/redo stays trivially correct and no low-level pointer events ever
 *    leak into this layer.
 *  - Transient gestures (drag/resize/pan/zoom) update a separate, cheap
 *    "preview" state at most once per animation frame; only the FINAL value
 *    is committed to `doc`/viewport on pointer-up. This keeps per-frame work
 *    out of the reactive graph churn.
 *  - Derived values use computed(); list rendering uses listOf()+loop().
 */

import { stateOf, computed, batch } from '@daevsoft/jetz';
import {
  createDocument,
  cloneDocument,
  findShape,
  shapeBounds,
  boundsOf,
  validateDocument,
} from '../core/document.js';
import { HistoryManager, produceCommand } from '../core/history.js';
import { createViewport, fitViewport, panBy, zoomAt } from '../core/viewport.js';
import { nextId } from '../core/id.js';

/* ------------------------------------------------------------------ */
/* Reactive states                                                     */
/* ------------------------------------------------------------------ */

/**
 * Jetz stateOf(object/array) exposes reactive properties on that object; it
 * does not return a root State with .value/.peek/.setState. The editor treats
 * document, selection and viewport as immutable snapshots, so hold each
 * snapshot inside a State created from a primitive initial value instead.
 */
function snapshotState(initialValue) {
  const state = stateOf(undefined);
  state.setState(initialValue);
  return state;
}

export const doc = snapshotState(createDocument({ name: 'Vectorize Demo' }));
export const selection = snapshotState(/** @type {string[]} */ ([]));
export const activeTool = stateOf('select'); // select | rect | ellipse | line | pen
export const viewport = snapshotState(createViewport());
export const gridSize = stateOf(0); // 0 disables snapping
export const statusText = stateOf('Ready');
export const activeLayerId = stateOf(null);

/** Live preview transform applied during a drag gesture (screen px delta). */
export const dragPreview = stateOf(/** @type {null|{ids:string[],dx:number,dy:number}} */ (null));

/** Live geometry preview for a resize gesture; never enters document history. */
export const resizePreview = stateOf(/** @type {null|{ids:string[],startBox:Object,endBox:Object}} */ (null));

/** True while a pan/zoom gesture is running so panels can skip updates. */
export const isGesturing = stateOf(false);

/** Reactive revision counter so computed history availability observes stack changes. */
const historyRevision = stateOf(0);

const history = new HistoryManager({ limit: 120 });
export { history };

/* ------------------------------------------------------------------ */
/* Derived (computed) views                                            */
/* ------------------------------------------------------------------ */

export const selectedIds = computed(() => selection.value.slice());

/** The currently selected shapes, bottom-to-top, resolved against the doc. */
export function getSelectedShapes() {
  const d = doc.peek();
  return selection.peek()
    .map((id) => findShape(d, id)?.shape)
    .filter(Boolean);
}

/** World-space bbox of the current selection (ignoring live drag preview). */
export function selectionBounds() {
  return boundsOf(getSelectedShapes());
}

export const objectCount = computed(() =>
  doc.value.layers.reduce((n, l) => n + l.shapes.length, 0)
);

export const canUndo = computed(() => historyRevision.value >= 0 && history.canUndo);
export const canRedo = computed(() => historyRevision.value >= 0 && history.canRedo);

/* ------------------------------------------------------------------ */
/* Document mutation API (all history-tracked)                         */
/* ------------------------------------------------------------------ */

/** Install a new document snapshot and bump the reactive state. */
function commitDoc(next) {
  doc.setState(cloneDocument(next));
}

/**
 * Run a named mutation as one undoable step.
 * @param {string} label
 * @param {(draft:Object)=>void} mutate
 */
export function transact(label, mutate) {
  const command = produceCommand(label, doc.peek(), mutate, commitDoc);
  // produceCommand already commits the after-snapshot; record it without
  // executing command.do() a second time.
  history.record(command);
  historyRevision.value += 1;
  return command;
}

/** Add a shape to a layer (default: top-most visible layer). */
export function addShape(shape, layerId = null) {
  transact(`Add ${shape.name}`, (draft) => {
    const requested = layerId || activeLayerId.peek();
    const layer = (requested && draft.layers.find((l) => l.id === requested && l.visible)) ||
      [...draft.layers].reverse().find((l) => l.visible);
    if (!layer) return;
    layer.shapes.push(shape);
  });
  selection.value = [...selection.peek(), shape.id];
  statusText.value = `${shape.name} added`;
}


/** Add multiple related primitives as one undoable creation operation. */
export function addShapes(shapes, layerId = null) {
  if (!shapes?.length) return;
  const requested = layerId || activeLayerId.peek();
  const ids = shapes.map((shape) => shape.id);
  transact(shapes.length > 1 ? `Add ${shapes.length} objects` : `Add ${shapes[0].name}`, (draft) => {
    const layer = (requested && draft.layers.find((item) => item.id === requested && item.visible)) ||
      [...draft.layers].reverse().find((item) => item.visible);
    if (!layer) return;
    for (const shape of shapes) layer.shapes.push(cloneDocument(shape));
  });
  selection.value = ids;
}

/** Delete the current selection (single undo step even for many shapes). */
export function deleteSelected() {
  const ids = selection.peek();
  if (!ids.length) return;
  transact(ids.length > 1 ? `Delete ${ids.length} objects` : 'Delete object', (draft) => {
    for (const layer of draft.layers) {
      layer.shapes = layer.shapes.filter((s) => !ids.includes(s.id));
    }
  });
  selection.value = [];
  statusText.value = 'Deleted';
}

/** Patch the style of every selected shape (one undo step). */
export function patchSelectedStyle(patch) {
  const ids = selection.peek();
  if (!ids.length) return;
  transact('Update style', (draft) => {
    for (const id of ids) {
      const found = findShape(draft, id);
      if (found) Object.assign(found.shape.style, patch);
    }
  });
}



/** Distribute selected objects with equal gaps along one axis. */
export function distributeSelected(axis = 'x') {
  const shapes = getSelectedShapes();
  if (shapes.length < 3) return;
  const ids = selection.peek();
  const sorted = shapes.map((shape) => ({ id: shape.id, box: shapeBounds(shape) }))
    .sort((a, b) => axis === 'x' ? a.box.x - b.box.x : a.box.y - b.box.y);
  const start = axis === 'x' ? sorted[0].box.x : sorted[0].box.y;
  const last = sorted[sorted.length - 1].box;
  const end = axis === 'x' ? last.x + last.width : last.y + last.height;
  const total = sorted.reduce((sum, item) => sum + (axis === 'x' ? item.box.width : item.box.height), 0);
  const gap = (end - start - total) / (sorted.length - 1);
  let cursor = start;
  transact(axis === 'x' ? 'Distribute horizontal spacing' : 'Distribute vertical spacing', (draft) => {
    for (const item of sorted) {
      const shape = findShape(draft, item.id)?.shape;
      if (!shape) continue;
      const box = shapeBounds(shape);
      const next = { ...box };
      if (axis === 'x') { next.x = cursor; cursor += box.width + gap; }
      else { next.y = cursor; cursor += box.height + gap; }
      applyBoxToShape(shape, next);
    }
  });
}



function shapePointsForTransform(shape) {
  const g = shape.geometry;
  if (shape.kind === 'rect') {
    return [
      { x: g.x, y: g.y }, { x: g.x + g.width, y: g.y },
      { x: g.x + g.width, y: g.y + g.height }, { x: g.x, y: g.y + g.height },
    ];
  }
  if (shape.kind === 'ellipse') {
    return Array.from({ length: 64 }, (_, index) => {
      const angle = index * Math.PI * 2 / 64;
      return { x: g.cx + Math.cos(angle) * g.rx, y: g.cy + Math.sin(angle) * g.ry };
    });
  }
  return g.points.map((point) => ({ ...point }));
}
function transformShapePoints(shape, transformPoint) {
  const closed = shape.kind === 'rect' || shape.kind === 'ellipse' || !!shape.geometry.closed;
  shape.geometry = { points: shapePointsForTransform(shape).map(transformPoint), closed };
  shape.kind = 'path';
}


/** Rotate selection by a relative angle around the aggregate center. */
export function rotateSelectedBy(degrees) {
  const shapes = getSelectedShapes();
  const amount = Number(degrees);
  if (!shapes.length || !Number.isFinite(amount) || Math.abs(amount) < 1e-9) return;
  const rotation = shapes[0].rotation || 0;
  setSelectedRotation(rotation + amount);
}

/** Set an absolute rotation angle for selected objects around selection center. */
export function setSelectedRotation(degrees) {
  const target = Number(degrees);
  const shapes = getSelectedShapes();
  if (!shapes.length || !Number.isFinite(target)) return;
  const bounds = boundsOf(shapes);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const ids = selection.peek();
  transact('Rotate selection', (draft) => {
    for (const id of ids) {
      const shape = findShape(draft, id)?.shape;
      if (!shape) continue;
      const delta = (target - (shape.rotation || 0)) * Math.PI / 180;
      if (Math.abs(delta) < 1e-9) continue;
      const cos = Math.cos(delta), sin = Math.sin(delta);
      transformShapePoints(shape, (point) => {
        const x = point.x - center.x, y = point.y - center.y;
        return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
      });
      shape.rotation = target;
    }
  });
}

/** Reflect selected objects around the selection center on one axis. */
export function reflectSelected(axis = 'horizontal') {
  const shapes = getSelectedShapes();
  if (!shapes.length) return;
  const bounds = boundsOf(shapes);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const ids = selection.peek();
  transact(axis === 'horizontal' ? 'Reflect horizontally' : 'Reflect vertically', (draft) => {
    for (const id of ids) {
      const shape = findShape(draft, id)?.shape;
      if (!shape) continue;
      transformShapePoints(shape, (point) => ({
        x: axis === 'horizontal' ? center.x * 2 - point.x : point.x,
        y: axis === 'vertical' ? center.y * 2 - point.y : point.y,
      }));
    }
  });
}

/** Set a uniform corner radius on selected rectangle primitives. */
export function setSelectedCornerRadius(radius) {
  const ids = selection.peek();
  const value = Math.max(0, Number(radius) || 0);
  if (!ids.some((id) => findShape(doc.peek(), id)?.shape.kind === 'rect')) return;
  transact('Set corner radius', (draft) => {
    for (const id of ids) {
      const shape = findShape(draft, id)?.shape;
      if (shape?.kind !== 'rect') continue;
      const max = Math.min(shape.geometry.width, shape.geometry.height) / 2;
      shape.geometry.rx = Math.min(value, max);
      shape.geometry.ry = Math.min(value, max);
    }
  });
}

/** Swap fill and stroke independently for every selected shape. */
export function swapSelectedFillStroke() {
  const ids = selection.peek();
  if (!ids.length) return;
  transact('Swap fill and stroke', (draft) => {
    for (const id of ids) {
      const shape = findShape(draft, id)?.shape;
      if (!shape) continue;
      const fill = shape.style.fill;
      shape.style.fill = shape.style.stroke;
      shape.style.stroke = fill;
    }
  });
}

/** Move/resize selected shapes by setting an absolute world box (per shape). */
export function setShapeBox(id, box) {
  transact('Transform', (draft) => {
    const found = findShape(draft, id);
    if (!found) return;
    applyBoxToShape(found.shape, box);
  });
}

/** Apply a world-box onto a shape's geometry (kind-aware). */
export function applyBoxToShape(shape, box) {
  const g = shape.geometry;
  switch (shape.kind) {
    case 'rect': {
      const sx = g.width === 0 ? 1 : box.width / g.width;
      const sy = g.height === 0 ? 1 : box.height / g.height;
      g.x = box.x; g.y = box.y; g.width = box.width; g.height = box.height;
      if (Number.isFinite(g.rx)) g.rx *= Math.abs(sx);
      if (Number.isFinite(g.ry)) g.ry *= Math.abs(sy);
      break;
    }
    case 'ellipse':
      g.cx = box.x + box.width / 2; g.cy = box.y + box.height / 2;
      g.rx = box.width / 2; g.ry = box.height / 2;
      break;
    case 'line': {
      const src = shapeBounds(shape);
      const sx = src.width === 0 ? 1 : box.width / src.width;
      const sy = src.height === 0 ? 1 : box.height / src.height;
      g.points = g.points.map((p) => ({
        x: box.x + (p.x - src.x) * sx,
        y: box.y + (p.y - src.y) * sy,
      }));
      break;
    }
    case 'path': {
      const src = shapeBounds(shape);
      const sx = src.width === 0 ? 1 : box.width / src.width;
      const sy = src.height === 0 ? 1 : box.height / src.height;
      g.points = g.points.map((p) => ({
        x: box.x + (p.x - src.x) * sx,
        y: box.y + (p.y - src.y) * sy,
      }));
      break;
    }
  }
}

/**
 * Resize/reposition the complete selection by editing its aggregate bounds.
 * Every selected shape keeps its relative position and proportions.
 */
export function setSelectionBounds(target) {
  const shapes = getSelectedShapes();
  const source = boundsOf(shapes);
  if (!source || !shapes.length) return;
  const sx = source.width === 0 ? 1 : target.width / source.width;
  const sy = source.height === 0 ? 1 : target.height / source.height;
  const ids = selection.peek();
  transact('Transform selection', (draft) => {
    for (const id of ids) {
      const found = findShape(draft, id);
      if (!found) continue;
      const box = shapeBounds(found.shape);
      applyBoxToShape(found.shape, {
        x: target.x + (box.x - source.x) * sx,
        y: target.y + (box.y - source.y) * sy,
        width: box.width * sx,
        height: box.height * sy,
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export function select(ids, { additive = false } = {}) {
  const next = additive
    ? Array.from(new Set([...selection.peek(), ...ids]))
    : ids;
  selection.value = next;
}

export function clearSelection() {
  if (selection.peek().length) selection.value = [];
}

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

export function toggleLayerVisible(layerId) {
  const current = doc.peek().layers.find((layer) => layer.id === layerId);
  if (!current) return;
  if (current.visible && doc.peek().layers.filter((layer) => layer.visible).length <= 1) return;
  transact('Toggle layer visibility', (draft) => {
    const layer = draft.layers.find((l) => l.id === layerId);
    if (layer) layer.visible = !layer.visible;
  });
  const updatedLayer = doc.peek().layers.find((layer) => layer.id === layerId);
  if (updatedLayer && !updatedLayer.visible) {
    const hiddenIds = new Set(updatedLayer.shapes.map((shape) => shape.id));
    selection.value = selection.peek().filter((id) => !hiddenIds.has(id));
  }
  const active = doc.peek().layers.find((layer) => layer.id === activeLayerId.peek());
  if (!active?.visible) activeLayerId.value = doc.peek().layers.find((layer) => layer.visible)?.id || null;
}

export function toggleShapeVisible(shapeId) {
  transact('Toggle visibility', (draft) => {
    const found = findShape(draft, shapeId);
    if (found) found.shape.visible = !found.shape.visible;
  });
}

export function addLayer(name) {
  const id = nextId('layer');
  transact('Add layer', (draft) => {
    draft.layers.push({ id, name: name || `Layer ${draft.layers.length + 1}`, visible: true, shapes: [] });
  });
  activeLayerId.value = id;
}
export function setActiveLayer(id) {
  if (doc.peek().layers.some((layer) => layer.id === id && layer.visible)) activeLayerId.value = id;
}
export function renameLayer(id, name) {
  const value = String(name || '').trim();
  if (!value) return;
  transact('Rename layer', (draft) => {
    const layer = draft.layers.find((item) => item.id === id);
    if (layer) layer.name = value.slice(0, 80);
  });
}
export function deleteEmptyLayer(id) {
  if (doc.peek().layers.length <= 1) return;
  const layer = doc.peek().layers.find((item) => item.id === id);
  if (!layer || layer.shapes.length) return;
  transact('Delete layer', (draft) => { draft.layers = draft.layers.filter((item) => item.id !== id); });
  if (activeLayerId.peek() === id) activeLayerId.value = doc.peek().layers.find((item) => item.visible)?.id || null;
}
export function setDocumentSize(width, height) {
  const w = Math.max(1, Math.min(100000, Number(width)));
  const h = Math.max(1, Math.min(100000, Number(height)));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return;
  transact('Resize artboard', (draft) => { draft.width = w; draft.height = h; });
  resetView();
}

/**
 * Reorder a shape within the flat z-order. `dir` = +1 brings forward,
 * -1 sends backward. Implemented across layers by swapping with the
 * neighbouring visible shape in document order.
 */
export function moveShapeZ(shapeId, dir) {
  transact(dir > 0 ? 'Bring forward' : 'Send backward', (draft) => {
    const flat = [];
    draft.layers.forEach((layer, li) =>
      layer.shapes.forEach((s, si) => flat.push({ s, li, si }))
    );
    const idx = flat.findIndex((e) => e.s.id === shapeId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= flat.length) return;
    const a = flat[idx];
    const b = flat[swap];
    // Swap positions in their respective layer arrays.
    const tmp = draft.layers[a.li].shapes[a.si];
    draft.layers[a.li].shapes[a.si] = draft.layers[b.li].shapes[b.si];
    draft.layers[b.li].shapes[b.si] = tmp;
  });
}



/** Apply one Chaikin smoothing pass to selected open/closed polyline paths. */
export function smoothSelectedPaths() {
  const ids = selection.peek();
  if (!ids.some((id) => {
    const shape = findShape(doc.peek(), id)?.shape;
    return shape?.kind === 'path' && shape.geometry.points.length >= 3;
  })) return;
  transact('Smooth paths', (draft) => {
    for (const id of ids) {
      const found = findShape(draft, id);
      const shape = found?.shape;
      if (shape?.kind !== 'path' || shape.geometry.points.length < 3) continue;
      const points = shape.geometry.points;
      const next = [];
      if (!shape.geometry.closed) next.push(points[0]);
      const count = shape.geometry.closed ? points.length : points.length - 1;
      for (let i = 0; i < count; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      if (!shape.geometry.closed) next.push(points[points.length - 1]);
      shape.geometry.points = next;
    }
  });
}

/** Select every visible object in the document. */
export function selectAll() {
  selection.value = doc.peek().layers
    .filter((layer) => layer.visible)
    .flatMap((layer) => layer.shapes.filter((shape) => shape.visible).map((shape) => shape.id));
}

/** Duplicate selected objects in their original layers and select the copies. */
export function duplicateSelected() {
  const ids = selection.peek();
  if (!ids.length) return;
  const copies = [];
  transact('Duplicate objects', (draft) => {
    for (const layer of draft.layers) {
      const originals = layer.shapes.filter((shape) => ids.includes(shape.id));
      for (const original of originals) {
        const copy = cloneDocument(original);
        copy.id = nextId('copy');
        copy.name = `${original.name} copy`;
        translateShape(copy, 12, 12);
        layer.shapes.splice(layer.shapes.indexOf(original) + 1, 0, copy);
        copies.push(copy.id);
      }
    }
  });
  selection.value = copies;
}

/** Reorder selected objects within each layer, preserving their relative order. */
export function arrangeSelected(where) {
  const ids = new Set(selection.peek());
  if (!ids.size) return;
  transact(where === 'front' ? 'Bring to front' : 'Send to back', (draft) => {
    for (const layer of draft.layers) {
      const chosen = layer.shapes.filter((shape) => ids.has(shape.id));
      if (!chosen.length) continue;
      const rest = layer.shapes.filter((shape) => !ids.has(shape.id));
      layer.shapes = where === 'front' ? [...rest, ...chosen] : [...chosen, ...rest];
    }
  });
}

/** Align selected objects to the aggregate selection bounds. */
export function alignSelected(mode) {
  const shapes = getSelectedShapes();
  if (shapes.length < 2) return;
  const bounds = boundsOf(shapes);
  if (!bounds) return;
  const ids = selection.peek();
  transact(`Align ${mode}`, (draft) => {
    for (const id of ids) {
      const found = findShape(draft, id);
      if (!found) continue;
      const box = shapeBounds(found.shape);
      const next = { ...box };
      if (mode === 'left') next.x = bounds.x;
      if (mode === 'center-x') next.x = bounds.x + (bounds.width - box.width) / 2;
      if (mode === 'right') next.x = bounds.x + bounds.width - box.width;
      if (mode === 'top') next.y = bounds.y;
      if (mode === 'center-y') next.y = bounds.y + (bounds.height - box.height) / 2;
      if (mode === 'bottom') next.y = bounds.y + bounds.height - box.height;
      applyBoxToShape(found.shape, next);
    }
  });
}

/** Replace the active document after validating a JSON import payload. */
export function replaceDocument(nextDocument) {
  if (!nextDocument || !Array.isArray(nextDocument.layers) ||
      !Number.isFinite(nextDocument.width) || !Number.isFinite(nextDocument.height)) {
    throw new TypeError('Invalid Vectorize document');
  }
  batch(() => {
    doc.setState(validateDocument(nextDocument));
    activeLayerId.value = doc.peek().layers.find((layer) => layer.visible)?.id || null;
    selection.value = [];
    history.clear();
    historyRevision.value += 1;
    resetView();
    statusText.value = 'Document opened';
  });
}

/* ------------------------------------------------------------------ */
/* Viewport helpers (NOT history-tracked — view state, not artwork)    */
/* ------------------------------------------------------------------ */

export function pan(dx, dy) {
  viewport.value = panBy(viewport.peek(), dx, dy);
}

export function zoom(factor, anchorScreen) {
  const vp = viewport.peek();
  viewport.value = zoomAt(vp, anchorScreen ?? { x: vp.width / 2, y: vp.height / 2 }, factor);
}

export function resetView() {
  const d = doc.peek();
  viewport.value = fitViewport(viewport.peek(), { x: 0, y: 0, width: d.width, height: d.height });
  statusText.value = 'View fitted';
}

export function setViewportSize(width, height) {
  const vp = viewport.peek();
  if (Math.abs(vp.width - width) < 1 && Math.abs(vp.height - height) < 1) return;
  viewport.value = { ...vp, width, height };
}

/* ------------------------------------------------------------------ */
/* Gestures: transient preview -> single final commit                  */
/* ------------------------------------------------------------------ */

let gestureBefore = null; // deep snapshot taken when a transform gesture starts

/** Call on pointer-down of a move/resize gesture. */
export function beginTransformGesture() {
  gestureBefore = cloneDocument(doc.peek());
  isGesturing.value = true;
}

/**
 * Live preview during drag — updates ONLY the cheap preview state, never the
 * document, so bound panels stay quiet until the gesture ends.
 */
export function previewTransform(ids, dx, dy) {
  dragPreview.value = ids.length ? { ids: ids.slice(), dx, dy } : null;
}

/** Update selected object geometry visually while a resize gesture is active. */
export function previewResize(ids, startBox, endBox) {
  resizePreview.value = ids.length ? {
    ids: ids.slice(),
    startBox: { ...startBox },
    endBox: { ...endBox },
  } : null;
}

/**
 * Commit the finished gesture as ONE history entry. If nothing moved, the
 * gesture is discarded silently.
 */
export function endTransformGesture(mutateFinal) {
  isGesturing.value = false;
  dragPreview.value = null;
  resizePreview.value = null;
  const before = gestureBefore;
  gestureBefore = null;
  if (!before || !mutateFinal) return;
  const after = cloneDocument(before);
  let changed = false;
  mutateFinal(after, () => { changed = true; });
  if (!changed) return; // pure click, no-op: keep history clean
  history.record(
    makeRestoreCommand('Transform', before, after)
  );
  commitDoc(after);
  historyRevision.value += 1;
}

function makeRestoreCommand(label, before, after) {
  return {
    label,
    do: () => commitDoc(after),
    undo: () => commitDoc(before),
  };
}

/* ------------------------------------------------------------------ */
/* Undo / redo                                                         */
/* ------------------------------------------------------------------ */

export function undo() {
  batch(() => {
    const cmd = history.undo();
    if (cmd) historyRevision.value += 1;
    statusText.value = cmd ? `Undo: ${cmd.label}` : 'Nothing to undo';
  });
}

export function redo() {
  batch(() => {
    const cmd = history.redo();
    if (cmd) historyRevision.value += 1;
    statusText.value = cmd ? `Redo: ${cmd.label}` : 'Nothing to redo';
  });
}

/** Reset the whole editor (used by "New document"). */
export function newDocument() {
  batch(() => {
    doc.value = createDocument({ name: 'Untitled' });
    activeLayerId.value = doc.peek().layers[0]?.id || null;
    selection.value = [];
    history.clear();
    historyRevision.value += 1;
    resetView();
    statusText.value = 'New document';
  });
}
