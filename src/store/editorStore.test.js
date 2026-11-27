import test from 'node:test';
import assert from 'node:assert/strict';

import * as store from './editorStore.js';
import { createRect, createDocument, validateDocument } from '../core/document.js';

test('Properties transform edits preserve multi-selection layout and undo/redo', () => {
  store.newDocument();

  const first = createRect(10, 20, 100, 50);
  const second = createRect(150, 40, 50, 20);
  store.addShape(first);
  store.addShape(second);

  assert.deepEqual(store.selectionBounds(), {
    x: 10, y: 20, width: 190, height: 50,
  });

  store.setSelectionBounds({ x: 20, y: 30, width: 380, height: 100 });

  let document = store.doc.peek();
  let firstShape = document.layers[0].shapes.find((shape) => shape.id === first.id);
  let secondShape = document.layers[0].shapes.find((shape) => shape.id === second.id);

  assert.deepEqual(firstShape.geometry, { x: 20, y: 30, width: 200, height: 100 });
  assert.deepEqual(secondShape.geometry, { x: 300, y: 70, width: 100, height: 40 });

  store.undo();
  document = store.doc.peek();
  firstShape = document.layers[0].shapes.find((shape) => shape.id === first.id);
  secondShape = document.layers[0].shapes.find((shape) => shape.id === second.id);
  assert.deepEqual(firstShape.geometry, { x: 10, y: 20, width: 100, height: 50 });
  assert.deepEqual(secondShape.geometry, { x: 150, y: 40, width: 50, height: 20 });

  store.redo();
  assert.deepEqual(store.selectionBounds(), {
    x: 20, y: 30, width: 380, height: 100,
  });
});

test('Inspector style edits are undoable and redoable', () => {
  store.newDocument();
  const shape = createRect(0, 0, 40, 30);
  store.addShape(shape);

  store.patchSelectedStyle({ fill: '#ff0000', stroke: '#00ff00', opacity: 0.5, strokeWidth: 4 });
  let selected = store.getSelectedShapes()[0];
  assert.equal(selected.style.fill, '#ff0000');
  assert.equal(selected.style.stroke, '#00ff00');
  assert.equal(selected.style.opacity, 0.5);
  assert.equal(selected.style.strokeWidth, 4);

  store.undo();
  selected = store.getSelectedShapes()[0];
  assert.equal(selected.style.fill, '#4f8ef7');
  assert.equal(selected.style.stroke, '#1e3a8a');
  assert.equal(selected.style.opacity, 1);
  assert.equal(selected.style.strokeWidth, 2);

  store.redo();
  selected = store.getSelectedShapes()[0];
  assert.equal(selected.style.fill, '#ff0000');
  assert.equal(selected.style.opacity, 0.5);
});

test('Object commands duplicate, arrange and align without losing selection', () => {
  store.newDocument();
  const left = createRect(0, 0, 20, 20);
  const right = createRect(80, 40, 20, 20);
  store.addShape(left);
  store.addShape(right);

  store.alignSelected('top');
  let shapes = store.getSelectedShapes();
  assert.equal(shapes[0].geometry.y, 0);
  assert.equal(shapes[1].geometry.y, 0);

  store.duplicateSelected();
  assert.equal(store.selection.peek().length, 2);
  assert.equal(store.doc.peek().layers[0].shapes.length, 4);

  store.arrangeSelected('front');
  const ordered = store.doc.peek().layers[0].shapes;
  assert.deepEqual(ordered.slice(-2).map((shape) => shape.id), store.selection.peek());
  store.undo();
  assert.equal(store.doc.peek().layers[0].shapes.length, 4);
});

test('Layer and artboard commands are history tracked', () => {
  store.newDocument();
  const originalLayer = store.activeLayerId.peek();
  store.addLayer('Artwork');
  const addedLayer = store.activeLayerId.peek();
  assert.notEqual(addedLayer, originalLayer);
  store.renameLayer(addedLayer, 'Foreground');
  assert.equal(store.doc.peek().layers.at(-1).name, 'Foreground');
  store.setDocumentSize(1600, 900);
  assert.equal(store.doc.peek().width, 1600);
  assert.equal(store.doc.peek().height, 900);
  store.undo();
  assert.equal(store.doc.peek().width, 1280);
  store.deleteEmptyLayer(addedLayer);
  assert.equal(store.doc.peek().layers.length, 1);
});

test('Equal-gap distribution and fill/stroke swap are undoable', () => {
  store.newDocument();
  const a = createRect(0, 0, 10, 10);
  const b = createRect(30, 0, 10, 10);
  const c = createRect(120, 0, 10, 10);
  store.addShape(a);
  store.addShape(b);
  store.addShape(c);
  store.select([a.id, b.id, c.id]);

  store.distributeSelected('x');
  const ordered = store.getSelectedShapes().slice().sort((x, y) => x.geometry.x - y.geometry.x);
  assert.deepEqual(ordered.map((shape) => shape.geometry.x), [0, 60, 120]);

  store.patchSelectedStyle({ fill: '#ff0000', stroke: '#0000ff' });
  store.swapSelectedFillStroke();
  assert.equal(store.getSelectedShapes()[0].style.fill, '#0000ff');
  assert.equal(store.getSelectedShapes()[0].style.stroke, '#ff0000');
  store.undo();
  assert.equal(store.getSelectedShapes()[0].style.fill, '#ff0000');
});

test('Imported Vectorize documents are validated before replacing editor state', () => {
  const valid = createDocument({ name: 'Imported', width: 640, height: 480 });
  assert.deepEqual(validateDocument(valid), valid);

  const invalid = structuredClone(valid);
  invalid.layers[0].shapes.push({
    id: 'bad-shape', kind: 'rect', name: 'Unsafe', visible: true,
    style: { fill: 'url(javascript:alert(1))', stroke: null, strokeWidth: 1, opacity: 1 },
    geometry: { x: 0, y: 0, width: 20, height: 20 },
  });
  assert.throws(() => validateDocument(invalid), /Invalid shape appearance/);
});
