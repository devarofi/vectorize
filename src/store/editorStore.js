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
} from '../core/document.js';
import { HistoryManager, produceCommand } from '../core/history.js';
import { createViewport, fitViewport, panBy, zoomAt } from '../core/viewport.js';

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

/** Live preview transform applied during a drag gesture (screen px delta). */
export const dragPreview = stateOf(/** @type {null|{ids:string[],dx:number,dy:number}} */ (null));

/** True while a pan/zoom gesture is running so panels can skip updates. */
export const isGesturing = stateOf(false);

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

export const canUndo = computed(() => history.undoStack.length > 0 && history.undoStack[history.undoStack.length - 1] !== undefined);
export const canRedo = computed(() => history.redoStack.length > 0);

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
  history.execute(command);
  return command;
}

/** Add a shape to a layer (default: top-most visible layer). */
export function addShape(shape, layerId = null) {
  transact(`Add ${shape.name}`, (draft) => {
    const layer = layerId
      ? draft.layers.find((l) => l.id === layerId)
      : draft.layers[draft.layers.length - 1];
    if (!layer) return;
    layer.shapes.push(shape);
  });
  selection.value = [...selection.peek(), shape.id];
  statusText.value = `${shape.name} added`;
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
    case 'rect':
      g.x = box.x; g.y = box.y; g.width = box.width; g.height = box.height;
      break;
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
  transact('Toggle layer visibility', (draft) => {
    const layer = draft.layers.find((l) => l.id === layerId);
    if (layer) layer.visible = !layer.visible;
  });
}

export function toggleShapeVisible(shapeId) {
  transact('Toggle visibility', (draft) => {
    const found = findShape(draft, shapeId);
    if (found) found.shape.visible = !found.shape.visible;
  });
}

export function addLayer(name) {
  transact('Add layer', (draft) => {
    draft.layers.push({
      id: `layer_${Date.now().toString(36)}_${draft.layers.length}`,
      name: name || `Layer ${draft.layers.length + 1}`,
      visible: true,
      shapes: [],
    });
  });
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

/**
 * Commit the finished gesture as ONE history entry. If nothing moved, the
 * gesture is discarded silently.
 */
export function endTransformGesture(mutateFinal) {
  isGesturing.value = false;
  dragPreview.value = null;
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
    statusText.value = cmd ? `Undo: ${cmd.label}` : 'Nothing to undo';
  });
}

export function redo() {
  batch(() => {
    const cmd = history.redo();
    statusText.value = cmd ? `Redo: ${cmd.label}` : 'Nothing to redo';
  });
}

/** Reset the whole editor (used by "New document"). */
export function newDocument() {
  batch(() => {
    doc.value = createDocument({ name: 'Untitled' });
    selection.value = [];
    history.clear();
    resetView();
    statusText.value = 'New document';
  });
}
