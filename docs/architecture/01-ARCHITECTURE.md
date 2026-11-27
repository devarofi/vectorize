# Vectorize — Architecture Overview

> Repository: `devarofi/vectorize`  
> Branch inspected: `main`  
> Review baseline: 27 November 2026  
> Scope: source currently present in the repository; this is an architecture review, not a runtime test.

## 1. Product direction

Vectorize is intended to become a browser-based vector graphics editor in the class of Adobe Illustrator. The project uses **Jetz** (`@daevsoft/jetz` 1.3.1) as its application/reactivity foundation.

The core product should be treated as a document editor, not as a collection of drawing widgets. The document model, geometry operations, interaction semantics, rendering, history, persistence, and export pipeline need clear contracts so that future features do not become tightly coupled.

## 2. Current repository structure

```text
vectorize/
├── package.json
├── package-lock.json
└── src/
    ├── core/
    │   ├── document.js
    │   ├── history.js
    │   ├── hitTest.js
    │   ├── id.js
    │   └── viewport.js
    ├── engine/
    │   ├── interactions.js
    │   └── renderer.js
    ├── store/
    │   └── editorStore.js
    └── utils/
        ├── format.js
        └── geometry.js
```

No application entry point, HTML shell, stylesheet, UI component tree, exporter, importer, persistence adapter, or test suite was present in the inspected tree.

## 3. Existing architectural layers

### 3.1 Core document model — `src/core/document.js`

Responsibilities:
- Defines document, layer, shape, and style data.
- Creates rectangle, ellipse, line, path, layer, and document objects.
- Queries visible shapes and shape bounds.
- Provides geometry mutations such as translate and resize.
- Clones documents into serializable snapshots.

Important design choice: the document model is plain JavaScript data and does not depend on Jetz or the DOM. Preserve this boundary.

Current primitive kinds:
- `rect`
- `ellipse`
- `line`
- `path`

The model currently stores paths as point arrays and a `closed` flag. This is sufficient for a first drawing MVP, but it is not yet a full vector path model with Bézier segments, handles, subpaths, fill rules, and segment editing.

### 3.2 History — `src/core/history.js`

Responsibilities:
- Command pattern with `do` and `undo`.
- Bounded undo and redo stacks.
- Snapshot-based commands.
- `produceCommand()` creates before/after document snapshots.

The snapshot strategy is a sensible MVP choice because it is simple and deterministic. It may become memory-heavy for large documents; later, introduce operation-level commands or structural sharing after profiling rather than prematurely optimizing.

### 3.3 Geometry and hit testing — `src/utils/geometry.js`, `src/core/hitTest.js`

Responsibilities:
- Point/box/segment math.
- Marquee selection.
- Shape hit testing.
- Selection handles and resize geometry.

These modules are framework-independent and are good candidates for focused unit tests.

Current limitations include approximate path fill hit testing, axis-aligned bounds, and no spatial index. Large documents will eventually need a broad-phase spatial query (for example, an R-tree or uniform grid) before exact hit tests.

### 3.4 Viewport — `src/core/viewport.js`

Responsibilities:
- World-to-screen and screen-to-world transforms.
- Pan and zoom.
- Fit artboard to viewport.
- Zoom around pointer anchor.

The explicit distinction between world coordinates and CSS-pixel viewport coordinates is correct. Keep document geometry independent of device pixel ratio; use CSS pixels for interaction and let SVG handle display scaling.

### 3.5 Jetz editor store — `src/store/editorStore.js`

Responsibilities:
- Holds the document and editor UI state through Jetz `stateOf`.
- Exposes derived values through `computed`.
- Centralizes document mutations.
- Separates transient gesture preview from committed document snapshots.
- Exposes selection, tools, viewport, layers, and history actions.

The store is the bridge between the plain-data core and the Jetz UI. Components should call store commands rather than mutate document objects directly.

State currently includes:
- `doc`
- `selection`
- `activeTool`
- `viewport`
- `gridSize`
- `statusText`
- `dragPreview`
- `isGesturing`

### 3.6 SVG renderer — `src/engine/renderer.js`

Responsibilities:
- Maintains one SVG group per layer.
- Maintains an ID-to-SVG-node map for shapes.
- Reconciles nodes by updating attributes only when signatures change.
- Renders selection overlays and temporary gesture visuals.

This keyed reconciliation approach is preferable to rebuilding the entire SVG tree on every update. Keep renderer code imperative and isolated from UI presentation components.

### 3.7 Interaction controller — `src/engine/interactions.js`

Responsibilities:
- Owns raw pointer, keyboard, and wheel events.
- Converts screen coordinates to world coordinates.
- Implements select, move, resize, marquee, rectangle, ellipse, line, pen, pan, and zoom interactions.
- Coalesces move previews with `requestAnimationFrame`.
- Commits a completed transform as one history entry.

This separation is healthy: raw browser events should not leak into the document model or generic UI components.

## 4. Recommended target architecture

The following is a target direction, not a claim that these modules already exist.

```text
src/
├── app/
│   ├── bootstrap.js
│   ├── routes/
│   └── shell/
├── ui/
│   ├── components/
│   ├── panels/
│   ├── toolbar/
│   └── commands/
├── editor/
│   ├── store/
│   ├── commands/
│   ├── tools/
│   ├── selection/
│   └── shortcuts/
├── document/
│   ├── model/
│   ├── schema/
│   ├── migrations/
│   ├── validation/
│   └── serialization/
├── geometry/
│   ├── primitives/
│   ├── paths/
│   ├── transforms/
│   ├── bounds/
│   └── hit-testing/
├── rendering/
│   ├── svg/
│   ├── overlays/
│   └── scene/
├── history/
├── io/
│   ├── importers/
│   └── exporters/
├── persistence/
├── workers/
└── shared/
```

Do not split into all these directories immediately. Introduce boundaries as features require them; the key requirement is that the boundaries remain explicit.

## 5. Architectural rules to preserve

1. The document model must not import Jetz or browser DOM APIs.
2. Geometry functions should be pure wherever practical and independently testable.
3. UI components must not mutate document snapshots directly.
4. All persistent document changes must pass through a command/transaction boundary.
5. Pointer-move previews must remain transient and must not create undo entries.
6. Rendering must be a projection of document state, never the source of truth.
7. Importers must validate and normalize input before it enters the document model.
8. Exporters must serialize the document model, not scrape the rendered DOM.
9. Viewport state (pan/zoom) must remain separate from artwork state and normal undo history.
10. Every persisted document needs a schema version and migration strategy.
