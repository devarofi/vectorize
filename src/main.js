import * as store from './store/editorStore.js';
import { SvgRenderer } from './engine/renderer.js';
import { InteractionController } from './engine/interactions.js';
import { createRouter } from './app/router.js';
import './styles.css';

const app = document.querySelector('#app');
let renderer;
let interactions;
let resizeObserver;
let renderQueued = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (renderer) renderer.render();
    updatePanels();
  });
}

function renderEditor() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/editor" aria-label="Vectorize home"><span class="brand-mark">V</span><span>Vectorize</span></a>
        <div class="document-name">Untitled document</div>
        <div class="top-actions">
          <button class="ui-button" id="undo" title="Undo (Ctrl+Z)">Undo</button>
          <button class="ui-button" id="redo" title="Redo (Ctrl+Y)">Redo</button>
          <button class="ui-button primary" id="fit">Fit canvas</button>
        </div>
      </header>
      <main class="workspace">
        <aside class="tool-rail" aria-label="Tools">
          <button class="tool-button active" data-tool="select" title="Select (V)">↖<small>V</small></button>
          <button class="tool-button" data-tool="rect" title="Rectangle (R)">▭<small>R</small></button>
          <button class="tool-button" data-tool="ellipse" title="Ellipse (O)">◯<small>O</small></button>
          <button class="tool-button" data-tool="line" title="Line (L)">／<small>L</small></button>
          <button class="tool-button" data-tool="pen" title="Pen (P)">⌁<small>P</small></button>
        </aside>
        <section class="canvas-area" aria-label="Drawing canvas">
          <div class="canvas-meta"><span>ARTBOARD · 1280 × 800</span><span id="zoom-label">100%</span></div>
          <div class="canvas-wrap"><svg id="editor-canvas" role="img" aria-label="Vector artwork canvas"></svg></div>
          <footer class="statusbar"><span id="status-text">Ready</span><span id="object-count">0 objects</span></footer>
        </section>
        <aside class="inspector">
          <section class="panel-section">
            <h2>Properties</h2>
            <p class="muted" id="selection-hint">Select an object to edit its appearance.</p>
            <label class="field-label" for="fill-color">Fill</label>
            <div class="color-field"><input id="fill-color" type="color" value="#4f8ef7" /><span id="fill-value">#4f8ef7</span></div>
          </section>
          <section class="panel-section">
            <h2>Layers</h2>
            <div class="layer-row"><span class="layer-dot"></span><span>Layer 1</span><span class="layer-visible">●</span></div>
          </section>
          <section class="panel-section tips">
            <h2>Quick tips</h2>
            <p>Choose a tool, then drag on the artboard to draw.</p>
            <p>Hold <kbd>Space</kbd> and drag to pan. Use the mouse wheel to zoom.</p>
            <p><kbd>Delete</kbd> removes the selection.</p>
          </section>
        </aside>
      </main>
    </div>`;

  const svg = document.querySelector('#editor-canvas');
  renderer = new SvgRenderer({ svg, store });
  interactions = new InteractionController({ svg, renderer });

  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      store.activeTool.value = button.dataset.tool;
      document.querySelectorAll('[data-tool]').forEach((item) => item.classList.toggle('active', item === button));
      scheduleRender();
    });
  });
  document.querySelector('#undo').addEventListener('click', () => { store.undo(); scheduleRender(); });
  document.querySelector('#redo').addEventListener('click', () => { store.redo(); scheduleRender(); });
  document.querySelector('#fit').addEventListener('click', () => { store.resetView(); scheduleRender(); });
  document.querySelector('#fill-color').addEventListener('input', (event) => {
    store.patchSelectedStyle({ fill: event.target.value });
    document.querySelector('#fill-value').textContent = event.target.value.toUpperCase();
    scheduleRender();
  });

  // The controller owns editor gestures; these listeners refresh the SVG and
  // panels after its handlers have updated the Jetz store.
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
    svg.addEventListener(type, scheduleRender, { passive: type === 'wheel' });
  }
  for (const type of ['pointermove', 'pointerup', 'keydown', 'keyup']) {
    window.addEventListener(type, scheduleRender);
  }

  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    store.setViewportSize(Math.max(1, rect.width), Math.max(1, rect.height));
    scheduleRender();
  });
  resizeObserver.observe(document.querySelector('.canvas-wrap'));

  store.resetView();
  renderer.render();
  updatePanels();
}

function updatePanels() {
  if (!document.querySelector('.app-shell')) return;
  const selected = store.selection.peek();
  const count = store.objectCount.value;
  document.querySelector('#object-count').textContent = `${count} ${count === 1 ? 'object' : 'objects'}`;
  document.querySelector('#status-text').textContent = store.statusText.peek();
  document.querySelector('#zoom-label').textContent = `${Math.round(store.viewport.peek().scale * 100)}%`;
  document.querySelector('#undo').disabled = !store.canUndo.value;
  document.querySelector('#redo').disabled = !store.canRedo.value;
  document.querySelector('#selection-hint').textContent = selected.length
    ? `${selected.length} object(s) selected.`
    : 'Select an object to edit its appearance.';
  document.querySelector('#fill-color').disabled = selected.length === 0;
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === store.activeTool.peek());
  });
}

function renderNotFound() {
  app.innerHTML = `<main class="not-found"><div class="brand-mark">V</div><h1>Page not found</h1><p>The page you requested does not exist.</p><a class="ui-button primary" href="/editor">Open editor</a></main>`;
}

const router = createRouter({
  routes: {
    '/': { name: 'home' },
    '/editor': { name: 'editor' },
    '*': { name: 'not-found' },
  },
  outlet: app,
  onRoute(route) {
    if (route.name === 'home') {
      window.history.replaceState({}, '', '/editor');
      renderEditor();
    } else if (route.name === 'editor') {
      renderEditor();
    } else {
      renderNotFound();
    }
  },
});

window.addEventListener('beforeunload', () => {
  router.destroy();
  interactions?.dispose();
  resizeObserver?.disconnect();
});
