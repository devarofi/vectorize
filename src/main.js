import * as store from './store/editorStore.js';
import { SvgRenderer } from './engine/renderer.js';
import { InteractionController } from './engine/interactions.js';
import { createRouter } from './app/router.js';
import { createRect, createEllipse, createLine, createPath } from './core/document.js';
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
  const disabled = tool ? '' : ' disabled aria-disabled="true"';
  const title = tool ? `${label}${shortcut ? ` (${shortcut})` : ''}` : `${label} — not implemented yet`;
  return `<button class="tool-button${active} ${extraClass}" ${data}${disabled} type="button" title="${title}" aria-label="${label}"><span class="tool-glyph">${glyph}</span>${shortcut && tool ? `<small>${shortcut}</small>` : ''}</button>`;
};

function renderEditor() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/editor" aria-label="Vectorize home"><span class="brand-mark">V</span><span>Vectorize</span></a>
        <div class="document-name">Untitled document <span class="unsaved-dot" title="Unsaved changes"></span></div>
        <nav class="main-menu" aria-label="Main menu">
          <button type="button" data-menu="File">File</button><button type="button" data-menu="Edit">Edit</button><button type="button" data-menu="Object">Object</button>
          <button type="button" data-menu="Type">Type</button><button type="button" data-menu="Select">Select</button><button type="button" data-menu="Effect">Effect</button>
          <button type="button" data-menu="View">View</button><button type="button" data-menu="Window">Window</button><button type="button" data-menu="Help">Help</button>
          <div id="menu-popover" class="menu-popover" hidden></div>
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
            ${toolButton('⌖', 'Direct Selection Tool')}
            ${toolButton('▱', 'Group Selection Tool')}
            ${toolButton('✳', 'Magic Wand Tool', '', 'magicWand')}
            ${toolButton('⌁', 'Lasso Tool', '', 'lasso')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Drawing and path tools">
            ${toolButton('✒', 'Pen Tool', 'P', 'pen')}
            ${toolButton('⌁', 'Curvature Tool')}
            ${toolButton('✎', 'Pencil Tool', '', 'pencil')}
            ${toolButton('〰', 'Smooth Tool', '', 'smooth')}
            ${toolButton('⌫', 'Path Eraser Tool')}
            ${toolButton('⊣', 'Join Tool')}
            ${toolButton('⌃', 'Anchor Point Tool')}
            ${toolButton('+', 'Add Anchor Point Tool')}
            ${toolButton('−', 'Delete Anchor Point Tool')}
            ${toolButton('⌜', 'Convert Anchor Point Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Type tools">
            ${toolButton('T', 'Type Tool', 'T')}
            ${toolButton('▤', 'Area Type Tool')}
            ${toolButton('T↝', 'Type on a Path Tool')}
            ${toolButton('T↕', 'Vertical Type Tool')}
            ${toolButton('T✥', 'Touch Type Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Shape tools">
            ${toolButton('▭', 'Rectangle Tool', 'R', 'rect')}
            ${toolButton('▢', 'Rounded Rectangle Tool', '', 'roundRect')}
            ${toolButton('◯', 'Ellipse Tool', 'O', 'ellipse')}
            ${toolButton('⬡', 'Polygon Tool', '', 'polygon')}
            ${toolButton('☆', 'Star Tool', '', 'star')}
            ${toolButton('／', 'Line Segment Tool', 'L', 'line')}
            ${toolButton('⌒', 'Arc Tool', '', 'arc')}
            ${toolButton('◎', 'Spiral Tool', '', 'spiral')}
            ${toolButton('▦', 'Rectangular Grid Tool', '', 'rectGrid')}
            ${toolButton('▧', 'Polar Grid Tool', '', 'polarGrid')}
            ${toolButton('☼', 'Flare Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Paint and color tools">
            ${toolButton('🖉', 'Paintbrush Tool', 'B', 'brush')}
            ${toolButton('◩', 'Blob Brush Tool', 'Shift+B')}
            ${toolButton('▨', 'Mesh Tool', 'U')}
            ${toolButton('◒', 'Gradient Tool', 'G')}
            ${toolButton('⌾', 'Eyedropper Tool', 'I', 'eyedropper')}
            ${toolButton('▣', 'Live Paint Bucket Tool', 'K')}
            ${toolButton('▧', 'Live Paint Selection Tool', 'Shift+L')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Transform and edit tools">
            ${toolButton('⌧', 'Eraser Tool', 'Shift+E', 'eraser')}
            ${toolButton('✂', 'Scissors Tool', 'C')}
            ${toolButton('◢', 'Knife Tool')}
            ${toolButton('↔', 'Width Tool', 'Shift+W')}
            ${toolButton('⬡', 'Shape Builder Tool', 'Shift+M')}
            ${toolButton('⤢', 'Free Transform Tool', 'E')}
            ${toolButton('⟳', 'Rotate Tool', 'R')}
            ${toolButton('⇱', 'Reflect Tool')}
            ${toolButton('⤡', 'Scale Tool')}
            ${toolButton('⤧', 'Shear Tool')}
            ${toolButton('⌁', 'Reshape Tool')}
            ${toolButton('〰', 'Warp Tool')}
            ${toolButton('↝', 'Twirl Tool')}
            ${toolButton('⊙', 'Pucker Tool')}
            ${toolButton('⊚', 'Bloat Tool')}
            ${toolButton('✺', 'Scallop Tool')}
            ${toolButton('✣', 'Crystallize Tool')}
            ${toolButton('≋', 'Wrinkle Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Symbol and graph tools">
            ${toolButton('✺', 'Symbol Sprayer Tool')}
            ${toolButton('⇢', 'Symbol Shifter Tool')}
            ${toolButton('≋', 'Symbol Scruncher Tool')}
            ${toolButton('⊕', 'Symbol Sizer Tool')}
            ${toolButton('⟳', 'Symbol Spinner Tool')}
            ${toolButton('◒', 'Symbol Stainer Tool')}
            ${toolButton('◐', 'Symbol Screener Tool')}
            ${toolButton('✧', 'Symbol Styler Tool')}
            ${toolButton('▥', 'Column Graph Tool')}
            ${toolButton('▤', 'Stacked Column Graph Tool')}
            ${toolButton('▤', 'Bar Graph Tool')}
            ${toolButton('▥', 'Stacked Bar Graph Tool')}
            ${toolButton('⌁', 'Line Graph Tool')}
            ${toolButton('▧', 'Area Graph Tool')}
            ${toolButton('⁙', 'Scatter Graph Tool')}
            ${toolButton('◔', 'Pie Graph Tool')}
            ${toolButton('◎', 'Radar Graph Tool')}
            ${toolButton('⌖', 'Artboard Tool')}
          </div>
          <div class="tool-divider"></div>
          <div class="tool-group" aria-label="Navigation tools">
            ${toolButton('✋', 'Hand Tool', '', 'hand')}
            ${toolButton('⌕', 'Zoom Tool', 'Z', 'zoom')}
            ${toolButton('▤', 'Slice Tool')}
            ${toolButton('▥', 'Slice Selection Tool')}
            ${toolButton('⊹', 'Measure Tool')}
            ${toolButton('▦', 'Perspective Grid Tool')}
            ${toolButton('⌖', 'Perspective Selection Tool')}
          </div>
          <div class="tool-footer">
            <button type="button" class="color-swatch-button" data-action="none-fill" title="Set fill to none"><span class="swatch-fill"></span><span class="swatch-stroke"></span></button>
            <button type="button" class="tool-button tool-footer-button" data-action="default-colors" title="Default fill and stroke">↺</button>
            <button type="button" class="tool-button tool-footer-button" data-action="swap-colors" title="Swap fill and stroke">⇄</button>
          </div>
        </aside>
        <input id="open-document-input" type="file" accept=".json,.vectorize.json,application/json" hidden />
        <section class="canvas-area" aria-label="Drawing canvas">
          <div class="canvas-meta"><span>ARTBOARD · 1280 × 800</span><span id="zoom-label">100%</span></div>
          <div class="canvas-wrap"><svg id="editor-canvas" role="img" aria-label="Vector artwork canvas"></svg></div>
          <footer class="statusbar"><span id="status-text">Ready</span><span id="object-count">0 objects</span></footer>
        </section>
        <aside class="inspector" aria-label="Properties and document panels">
          <div class="inspector-tabs" role="tablist" aria-label="Right panels">
            <button type="button" class="inspector-tab active" role="tab" aria-selected="true" data-panel-tab="properties">Properties</button>
            <button type="button" class="inspector-tab" role="tab" aria-selected="false" data-panel-tab="layers">Layers</button>
            <button type="button" class="inspector-tab" role="tab" aria-selected="false" data-panel-tab="assets">Assets</button>
          </div>
          <div class="inspector-scroll">
            <section class="panel-section selection-summary">
              <div class="section-heading"><h2>Properties</h2><span class="context-pill" id="selection-kind">Document</span></div>
              <p class="muted" id="selection-hint">No selection. Select an object to inspect its properties.</p>
            </section>

            <section class="panel-section selection-properties" id="object-properties">
              <div class="section-heading"><h3>Transform</h3><button class="panel-more" type="button" title="More transform options" disabled>···</button></div>
              <div class="transform-grid">
                <label class="property-field"><span>X</span><input id="prop-x" data-transform="x" type="number" step="any" value="—" disabled /></label>
                <label class="property-field"><span>Y</span><input id="prop-y" data-transform="y" type="number" step="any" value="—" disabled /></label>
                <label class="property-field"><span>W</span><input id="prop-width" data-transform="width" type="number" min="0" step="any" value="—" disabled /></label>
                <label class="property-field"><span>H</span><input id="prop-height" data-transform="height" type="number" min="0" step="any" value="—" disabled /></label>
              </div>
              <div class="property-inline-row"><button type="button" class="mini-icon-button" title="Constrain proportions (not implemented)" disabled>↔</button><span class="muted">Constrain proportions</span><button type="button" class="mini-icon-button" title="More transform options (not implemented)" disabled>⌗</button></div>
            </section>

            <section class="panel-section selection-properties" id="appearance-properties">
              <div class="section-heading"><h3>Appearance</h3><button class="panel-more" type="button" title="More appearance options" disabled>···</button></div>
              <div class="appearance-row">
                <label class="appearance-label" for="fill-color"><span class="appearance-chip fill-chip">F</span>Fill</label>
                <div class="appearance-control color-field"><input id="fill-color" type="color" value="#4f8ef7" /><span id="fill-value">#4F8EF7</span></div>
              </div>
              <div class="appearance-row">
                <label class="appearance-label" for="stroke-color"><span class="appearance-chip stroke-chip">S</span>Stroke</label>
                <div class="appearance-control color-field"><input id="stroke-color" type="color" value="#1e3a8a" /><span id="stroke-value">#1E3A8A</span></div>
              </div>
              <div class="appearance-row">
                <label class="appearance-label" for="prop-opacity">Opacity</label>
                <div class="appearance-control"><input id="prop-opacity" class="compact-number" type="number" min="0" max="100" step="1" value="100" /><span class="muted">%</span></div>
              </div>
            </section>

            <section class="panel-section selection-properties" id="stroke-properties">
              <div class="section-heading"><h3>Stroke</h3><button class="panel-more" type="button" title="More stroke options" disabled>···</button></div>
              <div class="property-row"><label for="prop-stroke-width">Weight</label><input id="prop-stroke-width" class="compact-number" type="number" min="0" step="any" value="2" /></div>
              <div class="property-row"><label for="prop-linecap">Cap</label><select id="prop-linecap" class="compact-select"><option value="butt">Butt</option><option value="round">Round</option><option value="square">Projecting</option></select></div>
              <div class="property-row"><label for="prop-linejoin">Join</label><select id="prop-linejoin" class="compact-select"><option value="miter">Miter</option><option value="round">Round</option><option value="bevel">Bevel</option></select></div>
              <div class="property-row"><label for="prop-dash">Dash</label><input id="prop-dash" class="compact-number" type="text" placeholder="e.g. 8 4" /></div>
              <div class="property-row"><span>Profile</span><span class="muted">Uniform</span></div>
            </section>

            <section class="panel-section selection-properties" id="align-properties">
              <div class="section-heading"><h3>Align</h3><button class="panel-more" type="button" title="More alignment options" disabled>···</button></div>
              <div class="icon-action-grid">
                <button type="button" data-align="left" title="Align left">⇤</button><button type="button" data-align="center-x" title="Horizontal center">↔</button><button type="button" data-align="right" title="Align right">⇥</button>
                <button type="button" data-align="top" title="Align top">⇡</button><button type="button" data-align="center-y" title="Vertical center">↕</button><button type="button" data-align="bottom" title="Align bottom">⇣</button>
              </div>
              <div class="property-row"><span>Align to</span><span class="muted">Selection bounds</span></div>
              <div class="icon-action-grid distribute-grid">
                <button type="button" data-distribute="x" title="Distribute horizontal spacing">⇹</button><button type="button" data-distribute="y" title="Distribute vertical spacing">⇳</button><button type="button" data-distribute="x" title="Distribute horizontal spacing">☷</button>
              </div>
            </section>

            <section class="panel-section selection-properties" id="pathfinder-properties">
              <div class="section-heading"><h3>Pathfinder</h3><button class="panel-more" type="button" title="More pathfinder options" disabled>···</button></div>
              <div class="icon-action-grid pathfinder-grid">
                <button type="button" title="Unite — Boolean path engine pending" disabled>◧</button><button type="button" title="Minus front — Boolean path engine pending" disabled>◩</button><button type="button" title="Intersect — Boolean path engine pending" disabled>◪</button><button type="button" title="Exclude — Boolean path engine pending" disabled>▧</button>
              </div>
            </section>

            <section class="panel-section selection-properties" id="color-properties">
              <div class="section-heading"><h3>Color</h3><button class="panel-more" type="button" title="More color options" disabled>···</button></div>
              <div class="color-spectrum" aria-label="Color spectrum preview"></div>
              <div class="property-row"><span>Color mode</span><span class="muted">RGB · HEX input</span></div>
            </section>

            <section class="panel-section selection-properties" id="gradient-properties">
              <div class="section-heading"><h3>Gradient</h3><button class="panel-more" type="button" title="More gradient options" disabled>···</button></div>
              <div class="gradient-preview"></div>
              <div class="property-row"><span>Type</span><span class="muted">Linear preview only</span></div>
              <div class="property-row"><span>Angle</span><input class="compact-number" type="text" value="0°" disabled /></div>
            </section>

            <section class="panel-section selection-properties" id="transparency-properties">
              <div class="section-heading"><h3>Transparency</h3></div>
              <div class="property-row"><span>Opacity</span><input class="compact-number" type="text" value="100%" disabled /></div>
              <div class="property-row"><label for="prop-blend">Blend mode</label><select id="prop-blend" class="compact-select"><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="darken">Darken</option><option value="lighten">Lighten</option><option value="color-dodge">Color Dodge</option><option value="color-burn">Color Burn</option><option value="difference">Difference</option><option value="exclusion">Exclusion</option></select></div>
              <div class="property-row"><span>Isolate blending</span><span class="muted">Off</span></div>
            </section>

            <section class="panel-section selection-properties" id="type-properties">
              <div class="section-heading"><h3>Character &amp; Paragraph</h3><button class="panel-more" type="button" title="More typography options" disabled>···</button></div>
              <div class="fake-select type-family">Arial <span>⌄</span></div>
              <div class="transform-grid type-controls">
                <label class="property-field"><span>Size</span><input type="text" value="12 pt" disabled /></label>
                <label class="property-field"><span>Leading</span><input type="text" value="Auto" disabled /></label>
                <label class="property-field"><span>Tracking</span><input type="text" value="0" disabled /></label>
                <label class="property-field"><span>Kerning</span><input type="text" value="Auto" disabled /></label>
              </div>
              <div class="icon-action-grid"><button type="button" title="Align left">☰</button><button type="button" title="Align center">≡</button><button type="button" title="Align right">☷</button></div>
            </section>

            <section class="panel-section document-properties" id="document-properties">
              <div class="section-heading"><h3>Document</h3><span class="muted">Artboard 1</span></div>
              <div class="property-row"><label for="document-width">Width</label><input id="document-width" class="compact-number" type="number" min="1" max="100000" step="1" value="1280" /></div>
              <div class="property-row"><label for="document-height">Height</label><input id="document-height" class="compact-number" type="number" min="1" max="100000" step="1" value="800" /></div>
              <div class="property-row"><span>Units</span><span class="muted">Pixels</span></div>
            </section>

            <section class="panel-section">
              <div class="section-heading"><h3>Quick Actions</h3></div>
              <div class="quick-action-grid">
                <button type="button" data-action="duplicate">Duplicate</button><button type="button" data-action="front">Bring front</button>
                <button type="button" data-action="back">Send back</button><button type="button" data-action="delete">Delete</button>
              </div>
            </section>
            <section class="inspector-page" id="panel-layers" hidden>
              <div class="panel-section">
                <div class="section-heading"><h3>Layers</h3><button type="button" class="mini-icon-button" id="add-layer" title="Add layer">＋</button></div>
                <div id="layer-list" class="layer-list"></div>
              </div>
            </section>
            <section class="inspector-page" id="panel-assets" hidden>
              <div class="panel-section">
                <div class="section-heading"><h3>Quick Assets</h3><span class="muted">Click to add</span></div>
                <div class="asset-grid">
                  <button type="button" data-asset="rect"><span class="asset-thumb asset-rect"></span>Rectangle</button>
                  <button type="button" data-asset="ellipse"><span class="asset-thumb asset-ellipse"></span>Ellipse</button>
                  <button type="button" data-asset="line"><span class="asset-thumb asset-line"></span>Line</button>
                  <button type="button" data-asset="star"><span class="asset-thumb asset-star">☆</span>Star</button>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </main>
    </div>`;

  const svg = document.querySelector('#editor-canvas');
  renderer = new SvgRenderer({ svg, store });
  interactions = new InteractionController({ svg, renderer });

  const menuItems = {
    File: [['New', 'new'], ['Open JSON…', 'open'], ['Save JSON', 'save'], ['Export SVG', 'svg'], ['Export PNG (1×)', 'png']],
    Edit: [['Undo', 'undo'], ['Redo', 'redo'], ['Select all', 'select-all'], ['Deselect', 'deselect'], ['Duplicate', 'duplicate'], ['Delete', 'delete']],
    Object: [['Bring to front', 'front'], ['Send to back', 'back'], ['Align left', 'align-left'], ['Center horizontally', 'align-center-x'], ['Align right', 'align-right'], ['Align top', 'align-top'], ['Center vertically', 'align-center-y'], ['Align bottom', 'align-bottom'], ['Distribute horizontally', 'distribute-x'], ['Distribute vertically', 'distribute-y']],
    Type: [['Create text', 'unsupported-type']],
    Select: [['Select all', 'select-all'], ['Deselect', 'deselect']],
    Effect: [['Effects are not available for current geometry model', 'noop']],
    View: [['Fit artboard', 'fit'], ['Zoom in', 'zoom-in'], ['Zoom out', 'zoom-out']],
    Window: [['Properties panel', 'panel-properties'], ['Layers panel', 'panel-layers'], ['Assets panel', 'panel-assets']],
    Help: [['Keyboard shortcuts', 'shortcuts'], ['Feature support', 'support']],
  };
  const menuPopover = document.querySelector('#menu-popover');
  const runCommand = (command) => {
    const doc = store.doc.peek();
    switch (command) {
      case 'new': if (confirm('Create a new document? Unsaved changes will be lost.')) store.newDocument(); break;
      case 'open': document.querySelector('#open-document-input').click(); break;
      case 'save': downloadFile(`${doc.name || 'vectorize'}.vectorize.json`, JSON.stringify({ format: 'vectorize', version: 1, document: doc }, null, 2), 'application/json'); break;
      case 'svg': downloadFile(`${doc.name || 'vectorize'}.svg`, exportSvg(doc), 'image/svg+xml'); break;
      case 'png': exportPng(doc); break;
      case 'undo': store.undo(); break;
      case 'redo': store.redo(); break;
      case 'select-all': store.selectAll(); break;
      case 'deselect': store.clearSelection(); break;
      case 'duplicate': store.duplicateSelected(); break;
      case 'default-colors': store.patchSelectedStyle({ fill: '#4f8ef7', stroke: '#1e3a8a' }); break;
      case 'swap-colors': store.swapSelectedFillStroke(); break;
      case 'none-fill': store.patchSelectedStyle({ fill: null }); break;
      case 'delete': store.deleteSelected(); break;
      case 'front': store.arrangeSelected('front'); break;
      case 'back': store.arrangeSelected('back'); break;
      case 'align-left': store.alignSelected('left'); break;
      case 'align-center-x': store.alignSelected('center-x'); break;
      case 'align-right': store.alignSelected('right'); break;
      case 'align-top': store.alignSelected('top'); break;
      case 'align-center-y': store.alignSelected('center-y'); break;
      case 'align-bottom': store.alignSelected('bottom'); break;
      case 'distribute-x': store.distributeSelected('x'); break;
      case 'distribute-y': store.distributeSelected('y'); break;
      case 'fit': store.resetView(); break;
      case 'zoom-in': store.zoom(1.25); break;
      case 'zoom-out': store.zoom(0.8); break;
      case 'panel-properties': switchPanel('properties'); break;
      case 'panel-layers': switchPanel('layers'); break;
      case 'panel-assets': switchPanel('assets'); break;
      case 'shortcuts': alert('V Select · R Rectangle · O Ellipse · L Line · P Pen · Ctrl/Cmd+Z Undo · Ctrl/Cmd+Y Redo · Delete Remove'); break;
      case 'support': alert('Implemented: selection, primitive drawing, transform, appearance, layer visibility, arrange, alignment and JSON/SVG export. Other tools are marked in the feature progress document.'); break;
      case 'unsupported-type': alert('Text layout is not implemented yet.'); break;
    }
    menuPopover.hidden = true;
    scheduleRender();
  };
  document.querySelectorAll('[data-panel-tab]').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.panelTab)));
  document.querySelectorAll('[data-menu]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.menu;
      const items = menuItems[name] || [];
      menuPopover.innerHTML = items.map(([label, command]) =>
        `<button type="button" class="menu-item" data-command="${command}" ${command === 'noop' || command === 'unsupported-type' ? 'disabled' : ''}>${escapeHtml(label)}</button>`
      ).join('');
      menuPopover.hidden = false;
      menuPopover.style.left = `${button.offsetLeft}px`;
      menuPopover.style.top = `${button.offsetTop + button.offsetHeight}px`;
      menuPopover.querySelectorAll('[data-command]').forEach((item) => item.addEventListener('click', () => runCommand(item.dataset.command)));
    });
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.main-menu')) menuPopover.hidden = true;
  });
  document.querySelector('#open-document-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.format && (parsed.format !== 'vectorize' || parsed.version !== 1)) {
        throw new Error('Unsupported Vectorize document version');
      }
      store.replaceDocument(parsed.document || parsed);
    } catch (error) {
      alert(`Could not open document: ${error.message}`);
    }
    event.target.value = '';
    scheduleRender();
  });
  document.querySelector('#add-layer').addEventListener('click', () => {
    store.addLayer();
    scheduleRender();
  });
  document.querySelectorAll('[data-asset]').forEach((button) => button.addEventListener('click', () => {
    const currentDoc = store.doc.peek();
    const x = currentDoc.width / 2 - 50, y = currentDoc.height / 2 - 35;
    const shape = button.dataset.asset === 'ellipse' ? createEllipse({ x, y, width: 90, height: 70 }) :
      button.dataset.asset === 'line' ? createLine({ x, y }, { x: x + 100, y: y + 60 }) :
      createRect(x, y, 100, 70);
    if (button.dataset.asset === 'star') {
      const points = starPoints(x + 50, y + 40, 38, 17, 5);
      const star = createPath(points, { closed: true }, { fill: '#f5b942', stroke: '#7c4a03', strokeWidth: 2 });
      star.name = 'Star';
      store.addShape(star);
    } else store.addShape(shape);
    switchPanel('properties');
    scheduleRender();
  }));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.action)));
  document.querySelectorAll('[data-align]').forEach((button) => button.addEventListener('click', () => {
    store.alignSelected(button.dataset.align); scheduleRender();
  }));
  document.querySelectorAll('[data-distribute]').forEach((button) => button.addEventListener('click', () => {
    store.distributeSelected(button.dataset.distribute); scheduleRender();
  }));

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
  // Inspector edits are committed on change (not every keystroke), so each
  // edit produces one clean Undo/Redo entry.
  document.querySelector('#fill-color').addEventListener('change', (event) => {
    store.patchSelectedStyle({ fill: event.target.value });
    scheduleRender();
  });
  document.querySelector('#stroke-color').addEventListener('change', (event) => {
    store.patchSelectedStyle({ stroke: event.target.value });
    scheduleRender();
  });
  document.querySelector('#prop-opacity').addEventListener('change', (event) => {
    if (event.target.value.trim() === '') return;
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    store.patchSelectedStyle({ opacity: Math.max(0, Math.min(100, value)) / 100 });
    scheduleRender();
  });
  document.querySelector('#prop-stroke-width').addEventListener('change', (event) => {
    if (event.target.value.trim() === '') return;
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    store.patchSelectedStyle({ strokeWidth: Math.max(0, value) });
    scheduleRender();
  });
  for (const [selector, key] of [['#prop-linecap', 'strokeLinecap'], ['#prop-linejoin', 'strokeLinejoin'], ['#prop-blend', 'blendMode']]) {
    document.querySelector(selector).addEventListener('change', (event) => {
      store.patchSelectedStyle({ [key]: event.target.value });
      scheduleRender();
    });
  }
  document.querySelector('#prop-dash').addEventListener('change', (event) => {
    const value = event.target.value.trim().replace(/[^0-9., ]/g, '').replace(/,/g, ' ');
    store.patchSelectedStyle({ strokeDasharray: value || null });
    scheduleRender();
  });
  const updateDocumentSize = () => {
    const width = Number(document.querySelector('#document-width').value);
    const height = Number(document.querySelector('#document-height').value);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      store.setDocumentSize(width, height);
      scheduleRender();
    }
  };
  document.querySelector('#document-width').addEventListener('change', updateDocumentSize);
  document.querySelector('#document-height').addEventListener('change', updateDocumentSize);
  document.querySelectorAll('[data-transform]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.value.trim() === '') return;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      const bounds = store.selectionBounds();
      if (!bounds) return;
      const next = { ...bounds, [input.dataset.transform]: Math.max(
        input.dataset.transform === 'width' || input.dataset.transform === 'height' ? 0 : -Infinity,
        value
      ) };
      store.setSelectionBounds(next);
      scheduleRender();
    });
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
  document.querySelector('.document-name').firstChild.textContent = store.doc.peek().name || 'Untitled';
  document.querySelector('.canvas-meta span').textContent = `ARTBOARD · ${store.doc.peek().width} × ${store.doc.peek().height}`;
  const layerList = document.querySelector('#layer-list');
  if (layerList) {
    const documentLayers = store.doc.peek().layers;
    const visibleLayerCount = documentLayers.filter((layer) => layer.visible).length;
    layerList.innerHTML = documentLayers.slice().reverse().map((layer) => `
      <div class="layer-list-row ${store.activeLayerId.peek() === layer.id ? 'active' : ''}" data-layer-id="${escapeHtml(layer.id)}">
        <button type="button" class="layer-visibility" data-layer-visible="${escapeHtml(layer.id)}" title="Toggle visibility" ${layer.visible && visibleLayerCount <= 1 ? 'disabled' : ''}>${layer.visible ? '◉' : '○'}</button>
        <button type="button" class="layer-select" data-layer-select="${escapeHtml(layer.id)}" title="Set active layer">${escapeHtml(layer.name)}</button>
        <span class="layer-list-count">${layer.shapes.length}</span>
        <button type="button" class="layer-rename" data-layer-rename="${escapeHtml(layer.id)}" title="Rename layer">✎</button>
        <button type="button" class="layer-delete" data-layer-delete="${escapeHtml(layer.id)}" title="Delete empty layer" ${layer.shapes.length || documentLayers.length <= 1 ? 'disabled' : ''}>×</button>
      </div>`).join('');
    layerList.querySelectorAll('[data-layer-visible]').forEach((button) => button.addEventListener('click', () => {
      store.toggleLayerVisible(button.dataset.layerVisible); scheduleRender();
    }));
    layerList.querySelectorAll('[data-layer-select]').forEach((button) => button.addEventListener('click', () => {
      store.setActiveLayer(button.dataset.layerSelect); scheduleRender();
    }));
    layerList.querySelectorAll('[data-layer-rename]').forEach((button) => button.addEventListener('click', () => {
      const layer = store.doc.peek().layers.find((item) => item.id === button.dataset.layerRename);
      const name = prompt('Layer name', layer?.name || '');
      if (name) store.renameLayer(button.dataset.layerRename, name);
      scheduleRender();
    }));
    layerList.querySelectorAll('[data-layer-delete]').forEach((button) => button.addEventListener('click', () => {
      store.deleteEmptyLayer(button.dataset.layerDelete); scheduleRender();
    }));
  }
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
  document.querySelector('#color-properties').hidden = selected.length === 0;
  document.querySelector('#gradient-properties').hidden = selected.length === 0;
  document.querySelector('#transparency-properties').hidden = selected.length === 0;
  document.querySelector('#type-properties').hidden = selected.length === 0 || shapes[0]?.kind !== 'text';
  document.querySelector('#document-properties').hidden = selected.length > 0;
  const hasSelection = selected.length > 0;
  const bounds = store.selectionBounds();
  const setField = (selector, value) => {
    const input = document.querySelector(selector);
    if (!input) return;
    if (document.activeElement !== input) input.value = value == null ? '' : String(value);
    input.disabled = !hasSelection;
  };
  const numberText = (value) => Number.isFinite(value) ? String(Number(value.toFixed(3))) : '';
  setField('#prop-x', bounds ? numberText(bounds.x) : '');
  setField('#prop-y', bounds ? numberText(bounds.y) : '');
  setField('#prop-width', bounds ? numberText(bounds.width) : '');
  setField('#prop-height', bounds ? numberText(bounds.height) : '');

  const uniform = (key) => {
    if (!shapes.length) return null;
    const values = shapes.map((shape) => shape.style?.[key]);
    return values.every((value) => value === values[0]) ? values[0] : '__mixed__';
  };
  const fill = uniform('fill');
  const stroke = uniform('stroke');
  const opacity = uniform('opacity');
  const strokeWidth = uniform('strokeWidth');
  const fillInput = document.querySelector('#fill-color');
  const strokeInput = document.querySelector('#stroke-color');
  fillInput.disabled = !hasSelection;
  strokeInput.disabled = !hasSelection;
  if (fill !== '__mixed__' && typeof fill === 'string' && /^#[0-9a-f]{6}$/i.test(fill)) fillInput.value = fill;
  if (stroke !== '__mixed__' && typeof stroke === 'string' && /^#[0-9a-f]{6}$/i.test(stroke)) strokeInput.value = stroke;
  document.querySelector('#fill-value').textContent = fill === '__mixed__' ? 'Mixed' : (fill || 'None').toUpperCase();
  document.querySelector('#stroke-value').textContent = stroke === '__mixed__' ? 'Mixed' : (stroke || 'None').toUpperCase();
  setField('#prop-opacity', opacity === '__mixed__' ? '' : opacity == null ? 100 : numberText(opacity * 100));
  setField('#prop-stroke-width', strokeWidth === '__mixed__' ? '' : strokeWidth == null ? 0 : numberText(strokeWidth));
  const setSelect = (selector, key, fallback) => {
    const value = uniform(key);
    const element = document.querySelector(selector);
    if (!element) return;
    element.disabled = !hasSelection;
    if (value !== '__mixed__') element.value = value || fallback;
  };
  setSelect('#prop-linecap', 'strokeLinecap', 'butt');
  setSelect('#prop-linejoin', 'strokeLinejoin', 'miter');
  setSelect('#prop-blend', 'blendMode', 'normal');
  setField('#prop-dash', uniform('strokeDasharray') === '__mixed__' ? '' : uniform('strokeDasharray') || '');
  document.querySelector('#document-width').value = String(store.doc.peek().width);
  document.querySelector('#document-height').value = String(store.doc.peek().height);
  document.querySelectorAll('[data-transform]').forEach((input) => { input.disabled = !hasSelection; });
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === store.activeTool.peek());
  });
}


function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPng(doc) {
  if (doc.width * doc.height > 64000000 || doc.width > 16384 || doc.height > 16384) {
    alert('PNG export is limited to 64 megapixels and 16384 px per side.');
    return;
  }
  const source = new Blob([exportSvg(doc)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(source);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = doc.width;
    canvas.height = doc.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(`${doc.name || 'vectorize'}.png`, blob);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); alert('PNG export failed.'); };
  image.src = url;
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvg(doc) {
  const shapes = doc.layers.filter((layer) => layer.visible).flatMap((layer) => layer.shapes.filter((shape) => shape.visible));
  const nodes = shapes.map((shape) => {
    const s = shape.style || {};
    const paint = `fill="${escapeHtml(s.fill || 'none')}" stroke="${escapeHtml(s.stroke || 'none')}" stroke-width="${Number(s.strokeWidth) || 0}" stroke-linecap="${s.strokeLinecap || 'butt'}" stroke-linejoin="${s.strokeLinejoin || 'miter'}" stroke-dasharray="${s.strokeDasharray || 'none'}" opacity="${Number.isFinite(s.opacity) ? s.opacity : 1}" style="mix-blend-mode:${s.blendMode || 'normal'}"`;
    const g = shape.geometry;
    if (shape.kind === 'rect') return `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="${g.rx || 0}" ry="${g.ry || 0}" ${paint}/>`;
    if (shape.kind === 'ellipse') return `<ellipse cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" ${paint}/>`;
    if (shape.kind === 'line') return `<line x1="${g.points[0].x}" y1="${g.points[0].y}" x2="${g.points[1].x}" y2="${g.points[1].y}" ${paint}/>`;
    if (shape.kind === 'path') {
      const d = g.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ') + (g.closed ? ' Z' : '');
      return `<path d="${d}" ${paint}/>`;
    }
    return '';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">${nodes}</svg>`;
}
function starPoints(cx, cy, outer, inner, count) {
  return Array.from({ length: count * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / count;
    const radius = index % 2 ? inner : outer;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
}
function switchPanel(name) {
  document.querySelectorAll('[data-panel-tab]').forEach((tab) => {
    const active = tab.dataset.panelTab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.inspector-scroll > .panel-section, .inspector-scroll > .inspector-page').forEach((panel) => {
    panel.hidden = name === 'properties' ? panel.id === 'panel-layers' || panel.id === 'panel-assets' : panel.id !== `panel-${name}`;
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
