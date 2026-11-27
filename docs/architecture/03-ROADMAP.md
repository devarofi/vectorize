# Vectorize — Engineering Roadmap

> Product: browser-based vector editor inspired by Adobe Illustrator  
> Framework: Jetz (`@daevsoft/jetz`)  
> Status: the initial runnable web shell and `/` + `/editor` routes are now present; core correctness stabilization and automated tests remain the next priority.

## Guiding principle

Build a dependable document editor in vertical slices. Every phase should leave the application runnable and testable. Avoid building a large number of disconnected tools before document integrity, selection, history, and persistence are reliable.

## Phase 0 — Stabilize the foundation

**Goal:** make the current core deterministic and testable.

Tasks:
- [ ] Fix the double-commit transaction flow.
- [ ] Make undo/redo availability reactive through Jetz.
- [ ] Define transaction ownership and atomicity.
- [ ] Define global versus layer-local z-order behavior.
- [ ] Correct Shift-click selection/move behavior.
- [ ] Add pointer cancellation and a unified gesture cancellation path.
- [ ] Define behavior for hidden layers and shape insertion.
- [ ] Add unit tests for document, history, geometry, hit testing, viewport.
- [ ] Replace the placeholder npm test script.
- [ ] Add a short developer setup guide.

Acceptance:
- Every document operation creates exactly one history entry.
- Undo and redo restore exact document snapshots.
- Canceled gestures create no history entry and leave no stale preview.
- Selection and z-order semantics are covered by tests.

## Phase 1 — Complete the application shell

**Goal:** make the engine usable as a real web application.

Tasks:
- [x] Add HTML/app bootstrap and a Jetz-driven application root.
- [x] Add initial editor workspace layout: toolbar, canvas, basic layers/properties areas, and status bar.
- [x] Add initial tool selection and keyboard shortcut hints.
- [ ] Complete menu, layers panel, and properties inspector workflows.
- [ ] Add responsive behavior for smaller viewports.
- [ ] Add document title and unsaved-change indicator.
- [ ] Add empty state and sample document.
- [ ] Add error boundary/reporting strategy suitable for the app architecture.

Acceptance:
- App starts from documented commands.
- A user can create, select, move, resize, style, and delete basic shapes.
- UI state is derived from the Jetz store; no component mutates document data directly.

## Phase 2 — Document integrity and file workflows

**Goal:** documents can be saved, reopened, and exchanged.

Tasks:
- [ ] Define a versioned native document JSON schema.
- [ ] Add validation and normalization for loaded documents.
- [ ] Add schema migration functions.
- [ ] Add native project save/open.
- [ ] Add browser autosave and crash recovery.
- [ ] Add SVG export from the document model.
- [ ] Add SVG import with sanitization and unsupported-feature handling.
- [ ] Add PNG export through a controlled rendering pipeline.

Acceptance:
- Save/open round trips preserve supported document data.
- Invalid files fail safely with actionable errors.
- Exported SVG is independent of editor overlay UI.
- Autosave does not block pointer interactions.

## Phase 3 — Core vector editing

**Goal:** move from primitive drawing to meaningful vector editing.

Tasks:
- [ ] Add Bézier path segment model.
- [ ] Add Pen tool anchors and handles.
- [ ] Add direct-selection tool for individual anchors/segments.
- [ ] Add multi-select, group, ungroup.
- [ ] Add align and distribute.
- [ ] Add robust object ordering and layer operations.
- [ ] Add stroke caps, joins, dash arrays, fill rules.
- [ ] Add transform controls and modifier-key behavior.
- [ ] Add snapping to grid, guides, artboard, and object geometry.

Acceptance:
- Paths can be created and edited without converting to raster.
- Group and multi-object operations are undoable.
- Transform behavior is consistent for all supported object types.

## Phase 4 — Professional document features

**Goal:** support common design workflows.

Tasks:
- [ ] Multiple artboards.
- [ ] Rulers, guides, grids, and smart guides.
- [ ] Text objects and font handling strategy.
- [ ] Gradients and gradient stops.
- [ ] Opacity and blend modes.
- [ ] Clipping paths and masks.
- [ ] Symbols/assets library.
- [ ] Color swatches and reusable styles.
- [ ] Lock/hide layer and object controls.
- [ ] Clipboard copy/paste and duplicate.

Acceptance:
- Common logo, icon, illustration, and layout tasks are achievable.
- Document model and serialization support every feature added.

## Phase 5 — Performance and reliability

**Goal:** keep the editor responsive on larger documents.

Tasks:
- [ ] Benchmark SVG reconciliation with realistic document sizes.
- [ ] Add spatial indexing for hit testing if profiling shows need.
- [ ] Add worker-based import/export and expensive geometry operations.
- [ ] Reduce snapshot history memory through measured optimization.
- [ ] Add render scheduling and dirty-region strategy where useful.
- [ ] Add memory/resource cleanup for renderer and event listeners.
- [ ] Add stress tests for thousands of shapes and long undo histories.

Acceptance:
- Performance targets are measured and documented.
- Large documents remain interactive on agreed reference hardware.
- No unbounded event listeners, DOM nodes, or history memory growth.

## Phase 6 — Quality, accessibility, and release

**Goal:** ship a coherent and maintainable product.

Tasks:
- [ ] Keyboard accessibility for menus, panels, and dialogs.
- [ ] Screen-reader labels for controls and tool state.
- [ ] High-contrast and light/dark themes.
- [ ] Localization infrastructure.
- [ ] End-to-end tests for critical workflows.
- [ ] Cross-browser testing.
- [ ] Security review for SVG import and file handling.
- [ ] User documentation and shortcut reference.
- [ ] Release packaging and versioning.

Acceptance:
- Critical workflows pass end-to-end tests.
- Imported SVG cannot execute active content in the editor context.
- Release notes, known limitations, and supported browser matrix are documented.

## Recommended immediate execution order

1. Phase 0 correctness fixes and tests.
2. Phase 1 minimal application shell.
3. Phase 2 native document format and SVG export/import.
4. Phase 3 Bézier path model and direct selection.
5. Then expand toward professional Illustrator-like workflows.

## Explicit non-goals for the first MVP

Do not begin with:
- Cloud collaboration or real-time multiplayer.
- Complex account/billing infrastructure.
- AI image generation or AI vectorization.
- Dozens of export formats.
- Plugin marketplace.
- Full parity with Adobe Illustrator.

First prove that the browser editor can reliably create, edit, save, reopen, and export vector documents.
