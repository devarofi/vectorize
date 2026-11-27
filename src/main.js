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

const toolButton = (glyph, label, shortcut = '', tool = '', extraClass = '') => {
  const active = tool === 'select' ? ' active' : '';
  const data = tool ? `data-tool="${tool}"` : 'data-feature-tool';
  return `<button class="tool-button${active} ${extraClass}" ${data} type="button" title="${label}${shortcut ? ` (${shortcut})` : ''}" aria-label="${label}"><span class="tool-glyph">${glyph}</span>${shortcut ? `<small>${shortcut}</small>` : ''}</button>`;
};

function renderEditor() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/editor" aria-label="Vectorize home"><span class="brand-mark">V</span><span>Vectorize</span></a>
        <div class="document-name">Untitled document <span class="unsaved-dot" title="Unsaved changes"></span></div>
        <nav class="main-menu" aria-label="Main menu">
          <button type="button">File</button><button type="button">Edit</button><button type="button">Object</button>
          <button type="button">Type</button><button type="button">Select</button><button type="button">Effect</button>
          <button type="button">View</button><button type="button">Window</button><button type="button">Help</button>
        </nav>
        <div class="top-actions">
          <button class="ui-button" id="undo" title="Undo (Ctrl+Z)">↶ <span>Undo</span></button>
          <button class="ui-button" id="redo" title="Redo (Ctrl+Y)">↷ <span>Redo</span></button>
          <button class="ui-button primary" id="fit">Fit canvas</button>
        </div>
      </header>
      <main class="workspace">
        <aside class="tool-rail" aria-label="Illustration tools">
          <div class="tool-group" aria-label="Selection tools">
            ${toolButton('↖', 'Selection Tool', 'V', 'select')}
            ${toolButton('⌖', 'Direct Selection Tool', 'A')}
            ${toolButton('▱', 'Group Selection Tool')}
            ${toolButton('✳', 'Magic Wand Tool')}
            ${toolButton('⌁', 'Lasso Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Drawing and path tools">
            ${toolButton('✒', 'Pen Tool', 'P', 'pen')}
            ${toolButton('⌁', 'Curvature Tool')}
            ${toolButton('✎', 'Pencil Tool', 'N')}
            ${toolButton('〰', 'Smooth Tool')}
            ${toolButton('⌫', 'Path Eraser Tool')}
            ${toolButton('⊣', 'Join Tool')}
            ${toolButton('⌃', 'Anchor Point Tool', 'Shift+C')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Type tools">
            ${toolButton('T', 'Type Tool', 'T')}
            ${toolButton('▤', 'Area Type Tool')}
            ${toolButton('T↝', 'Type on a Path Tool')}
            ${toolButton('T↕', 'Vertical Type Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Shape tools">
            ${toolButton('▭', 'Rectangle Tool', 'M', 'rect')}
            ${toolButton('▢', 'Rounded Rectangle Tool')}
            ${toolButton('◯', 'Ellipse Tool', 'L', 'ellipse')}
            ${toolButton('⬡', 'Polygon Tool')}
            ${toolButton('☆', 'Star Tool')}
            ${toolButton('／', 'Line Segment Tool', '\\', 'line')}
            ${toolButton('⌒', 'Arc Tool')}
            ${toolButton('◎', 'Spiral Tool')}
            ${toolButton('▦', 'Rectangular Grid Tool')}
            ${toolButton('▧', 'Polar Grid Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Paint and color tools">
            ${toolButton('🖉', 'Paintbrush Tool', 'B')}
            ${toolButton('◩', 'Blob Brush Tool', 'Shift+B')}
            ${toolButton('▨', 'Mesh Tool', 'U')}
            ${toolButton('◒', 'Gradient Tool', 'G')}
            ${toolButton('⌾', 'Eyedropper Tool', 'I')}
            ${toolButton('▣', 'Live Paint Bucket Tool', 'K')}
            ${toolButton('▧', 'Live Paint Selection Tool', 'Shift+L')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Transform and edit tools">
            ${toolButton('⌧', 'Eraser Tool', 'Shift+E')}
            ${toolButton('✂', 'Scissors Tool', 'C')}
            ${toolButton('◢', 'Knife Tool')}
            ${toolButton('↔', 'Width Tool', 'Shift+W')}
            ${toolButton('⬡', 'Shape Builder Tool', 'Shift+M')}
            ${toolButton('⤢', 'Free Transform Tool', 'E')}
            ${toolButton('⟳', 'Rotate Tool', 'R')}
            ${toolButton('⇱', 'Reflect Tool', 'O')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Symbol and graph tools">
            ${toolButton('✺', 'Symbol Sprayer Tool', 'Shift+S')}
            ${toolButton('▥', 'Column Graph Tool', 'J')}
            ${toolButton('▤', 'Bar Graph Tool')}
            ${toolButton('◔', 'Pie Graph Tool')}
            ${toolButton('⌖', 'Artboard Tool', 'Shift+O')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Navigation tools">
            ${toolButton('✋', 'Hand Tool', 'H')}
            ${toolButton('⌕', 'Zoom Tool', 'Z')}
          </div>
          <div class="tool-footer">
            <button type="button" class="color-swatch-button" title="Fill and stroke swatches"><span class="swatch-fill"></span><span class="swatch-stroke"></span></button>
            <button type="button" class="tool-button tool-footer-button" title="Default fill and stroke">↺</button>
            <button type="button" class="tool-button tool-footer-button" title="Swap fill and stroke">⇄</button>
          </div>
        </aside>
        <section class="canvas-area" aria-label="Drawing canvas">
          <div class="canvas-meta"><span>ARTBOARD · 1280 × 800</span><span id="zoom-label">100%</span></div>
          <div class="canvas-wrap"><svg id="editor-canvas" role="img" aria-label="Vector artwork canvas"></svg></div>
          <footer class="statusbar"><span id="status-text">Ready</span><span id="object-count">0 objects</span></footer>
        </section>
        <aside class="inspector" aria-label="Properties and document panels">
          <div class="inspector-tabs" role="tablist" aria-label="Right panels">
            <button type="button" class="inspector-tab active" role="tab" aria-selected="true">Properties</button>
            <button type="button" class="inspector-tab" role="tab" aria-selected="false">Layers</button>
            <button type="button" class="inspector-tab" role="tab" aria-selected="false">Assets</button>
          </div>
          <div class="inspector-scroll">
            <section class="panel-section selection-summary">
              <div class="section-heading"><h2>Properties</h2><span class="context-pill" id="selection-kind">Document</span></div>
              <p class="muted" id="selection-hint">No selection. Select an object to inspect its properties.</p>
            </section>

            <section class="panel-section selection-properties" id="object-properties">
              <div class="section-heading"><h3>Transform</h3><button class="panel-more" type="button" title="More transform options">···</button></div>
              <div class="transform-grid">
                <label class="property-field"><span>X</span><input type="text" value="—" disabled /></label>
                <label class="property-field"><span>Y</span><input type="text" value="—" disabled /></label>
                <label class="property-field"><span>W</span><input type="text" value="—" disabled /></label>
                <label class="property-field"><span>H</span><input type="text" value="—" disabled /></label>
              </div>
              <div class="property-inline-row"><button type="button" class="mini-icon-button" title="Constrain proportions">↔</button><span class="muted">Constrain proportions</span><button type="button" class="mini-icon-button" title="More transform options">⌗</button></div>
            </section>

            <section class="panel-section selection-properties" id="appearance-properties">
              <div class="section-heading"><h3>Appearance</h3><button class="panel-more" type="button" title="More appearance options">···</button></div>
              <div class="appearance-row">
                <label class="appearance-label" for="fill-color"><span class="appearance-chip fill-chip">F</span>Fill</label>
                <div class="appearance-control color-field"><input id="fill-color" type="color" value="#4f8ef7" /><span id="fill-value">#4F8EF7</span></div>
              </div>
              <div class="appearance-row">
                <label class="appearance-label"><span class="appearance-chip stroke-chip">S</span>Stroke</label>
                <div class="appearance-control"><span class="color-preview no-color"></span><span class="muted">None</span><button type="button" class="mini-icon-button" title="Stroke color">⌄</button></div>
              </div>
              <div class="appearance-row">
                <label class="appearance-label">Opacity</label>
                <div class="appearance-control"><input class="compact-number" type="text" value="100%" disabled /><span class="muted">Normal</span></div>
              </div>
            </section>

            <section class="panel-section selection-properties" id="stroke-properties">
              <div class="section-heading"><h3>Stroke</h3><button class="panel-more" type="button" title="More stroke options">···</button></div>
              <div class="property-row"><span>Weight</span><input class="compact-number" type="text" value="1 pt" disabled /></div>
              <div class="property-row"><span>Cap</span><div class="segmented-static"><span class="selected">Butt</span><span>Round</span><span>Project</span></div></div>
              <div class="property-row"><span>Join</span><div class="segmented-static"><span class="selected">Miter</span><span>Round</span><span>Bevel</span></div></div>
              <div class="property-row"><span>Profile</span><div class="fake-select">Uniform <span>⌄</span></div></div>
            </section>

            <section class="panel-section selection-properties" id="align-properties">
              <div class="section-heading"><h3>Align</h3><button class="panel-more" type="button" title="More alignment options">···</button></div>
              <div class="icon-action-grid">
                <button type="button" title="Align left">⇤</button><button type="button" title="Horizontal center">↔</button><button type="button" title="Align right">⇥</button>
                <button type="button" title="Align top">⇡</button><button type="button" title="Vertical center">↕</button><button type="button" title="Align bottom">⇣</button>
              </div>
              <div class="property-row"><span>Align to</span><div class="fake-select">Selection <span>⌄</span></div></div>
              <div class="icon-action-grid distribute-grid">
                <button type="button" title="Distribute horizontal spacing">⇹</button><button type="button" title="Distribute vertical spacing">⇳</button><button type="button" title="Horizontal distribute centers">☷</button>
              </div>
            </section>

            <section class="panel-section selection-properties" id="pathfinder-properties">
              <div class="section-heading"><h3>Pathfinder</h3><button class="panel-more" type="button" title="More pathfinder options">···</button></div>
              <div class="icon-action-grid pathfinder-grid">
                <button type="button" title="Unite">◧</button><button type="button" title="Minus front">◩</button><button type="button" title="Intersect">◪</button><button type="button" title="Exclude">▧</button>
              </div>
            </section>

            <section class="panel-section document-properties" id="document-properties">
              <div class="section-heading"><h3>Document</h3><span class="muted">Artboard 1</span></div>
              <div class="property-row"><span>Width</span><input class="compact-number" type="text" value="1280 px" disabled /></div>
              <div class="property-row"><span>Height</span><input class="compact-number" type="text" value="800 px" disabled /></div>
              <div class="property-row"><span>Units</span><div class="fake-select">Pixels <span>⌄</span></div></div>
            </section>

            <section class="panel-section">
              <div class="section-heading"><h3>Quick Actions</h3></div>
              <div class="quick-action-grid">
                <button type="button">Group</button><button type="button">Arrange</button>
                <button type="button">Duplicate</button><button type="button">Lock</button>
              </div>
            </section>
            <section class="panel-section layers-preview">
              <div class="section-heading"><h3>Layers</h3><button type="button" class="panel-more" title="Layer options">···</button></div>
              <div class="layer-row"><span class="layer-eye">◉</span><span class="layer-dot"></span><span>Layer 1</span><span class="layer-visible">●</span></div>
            </section>
          </div>
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
  const shapes = store.getSelectedShapes();
  const count = store.objectCount.value;
  document.querySelector('#object-count').textContent = `${count} ${count === 1 ? 'object' : 'objects'}`;
  document.querySelector('#status-text').textContent = store.statusText.peek();
  document.querySelector('#zoom-label').textContent = `${Math.round(store.viewport.peek().scale * 100)}%`;
  document.querySelector('#undo').disabled = !store.canUndo.value;
  document.querySelector('#redo').disabled = !store.canRedo.value;
  document.querySelector('#selection-hint').textContent = selected.length
    ? `${selected.length} object(s) selected.`
    : 'No selection. Select an object to inspect its properties.';
  document.querySelector('#selection-kind').textContent = selected.length
    ? (selected.length > 1 ? 'Multiple' : (shapes[0]?.kind || 'Object'))
    : 'Document';
  document.querySelector('#object-properties').hidden = selected.length === 0;
  document.querySelector('#appearance-properties').hidden = selected.length === 0;
  document.querySelector('#stroke-properties').hidden = selected.length === 0;
  document.querySelector('#align-properties').hidden = selected.length === 0;
  document.querySelector('#pathfinder-properties').hidden = selected.length === 0;
  document.querySelector('#document-properties').hidden = selected.length > 0;
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
