import test from 'node:test';
import assert from 'node:assert/strict';

import * as store from './editorStore.js';
import { createRect } from '../core/document.js';

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
