# Vectorize — Architecture Audit & Findings

> Baseline: `main` branch, 27 November 2026. Findings are based on static inspection of the source currently present; no browser execution or automated test run was possible from the repository contents.

## 1. Executive summary

The repository contains a promising editor foundation:
- Plain-data document model.
- Framework-independent geometry and viewport helpers.
- Jetz reactive store.
- Snapshot-based undo/redo.
- SVG keyed renderer.
- Pointer/keyboard interaction controller.

The initial web application shell is now present (`index.html`, `/` and `/editor` routes, Vite scripts, editor bootstrap, and base stylesheet). It is runnable after dependency installation, but remains a minimal shell rather than a complete editor product. Import/export, persistence, a full panel system, and meaningful automated tests are still absent.

**Recommendation:** stabilize and test the existing foundation before adding advanced Illustrator-like features.

## 2. Findings

### P0 — Correctness and foundation

#### A. Document transaction appears to commit twice
Files: `src/store/editorStore.js`, `src/core/history.js`

`transact()` calls `produceCommand()`. `produceCommand()` already invokes `commit(after)`. `transact()` then calls `history.execute(command)`, which invokes the command's `do()` and commits `after` again.

Impact:
- Duplicate document state replacement for one logical transaction.
- Unnecessary reactive invalidation and renderer work.
- Makes transaction semantics harder to reason about.

Recommended fix:
- Make `produceCommand()` build and return a command without committing, then let `history.execute()` apply it exactly once; or
- Add a dedicated history `record()` path for already-applied commands.
- Choose one ownership model and test it.

#### B. `canUndo` and `canRedo` are derived from non-reactive arrays
File: `src/store/editorStore.js`

The computed values read `history.undoStack` and `history.redoStack` directly. These arrays are ordinary JavaScript arrays, not Jetz reactive state.

Impact:
- A computed subscriber may not be invalidated when history changes.
- Undo/redo toolbar enabled state can become stale.

Recommended fix:
- Publish a reactive history revision/state after execute, undo, redo, and clear; derive availability from that reactive value.
- Keep stack internals private to the history service.

#### C. No automated test suite exists
File: `package.json`

The `test` script is a placeholder that prints an error and exits with code 1.

Recommended minimum test coverage:
- Document factories, cloning, and serialization.
- Geometry and transforms.
- Hit tests for every shape kind.
- History execute/undo/redo and transaction atomicity.
- Viewport coordinate round trips and zoom anchoring.
- Selection and pointer gesture lifecycle.
- Renderer reconciliation and layer order.

### P1 — Interaction and document correctness

#### D. Shift-click selection can start a move after toggling the clicked item off
File: `src/engine/interactions.js`

When Shift is held, clicking an already-selected shape removes it from `ids`, but the code can still start a move gesture for the remaining selection.

Impact:
- The gesture may move other selected shapes when the user's intent was only to toggle selection.

Recommended fix:
- Separate selection toggling from move initiation.
- If the clicked shape was removed from selection, do not begin moving the remaining selection unless that behavior is explicitly designed.

#### E. Z-order movement does not consistently honor visible-layer semantics
File: `src/store/editorStore.js`

The `moveShapeZ()` comment describes swapping with the neighboring visible shape, but its flattened list includes shapes from hidden layers too.

Impact:
- Bring-forward/send-backward can interact with hidden-layer contents unexpectedly.

Recommended fix:
- Define whether z-order is global document order or layer-local order.
- If global, define hidden-layer behavior explicitly.
- If layer-local, restrict the operation to the owning layer.
- Align code, UI wording, and tests.

#### F. Pointer cancellation is not handled
File: `src/engine/interactions.js`

The controller binds `pointerdown`, `pointermove`, and `pointerup`, but not `pointercancel`.

Impact:
- Interrupted touch/stylus gestures may leave transient gesture state or overlays active.

Recommended fix:
- Add a cancellation path that clears previews and overlays and restores the pre-gesture document state.
- Test touch interruption, browser gesture takeover, and window focus loss.

#### G. Gesture state should be resilient to tool changes and lost focus
File: `src/engine/interactions.js`

Keyboard Escape clears the active gesture descriptor and overlays, but transform gesture cleanup is not explicitly routed through a single cancellation function.

Recommended fix:
- Implement `cancelGesture(reason)` as the single cleanup path.
- Call it for pointercancel, Escape, blur, disposal, and relevant tool switches.
- Ensure history is unchanged after cancellation.

#### H. Hidden-layer default target for new shapes is ambiguous
File: `src/store/editorStore.js`

`addShape()` defaults to the final layer, even if that layer is hidden.

Recommended fix:
- Choose the topmost visible unlocked layer, or create/activate a visible layer.
- Add layer lock state before exposing professional layer controls.

### P1 — Geometry and rendering limitations

#### I. Path model is currently a polyline, not a professional vector path
Files: `src/core/document.js`, `src/engine/renderer.js`, `src/core/hitTest.js`

Path geometry is a list of points plus a closed flag. The renderer emits straight `L` segments only.

Impact:
- No cubic/quadratic Bézier editing.
- No anchor handles, tangent continuity, compound subpaths, or robust fill rules.

Recommended evolution:
- Introduce explicit path commands/segments (`M`, `L`, `C`, `Q`, `Z`) and subpaths.
- Add anchor and handle editing as a separate tool layer.
- Keep a migration path from the current points-based path.

#### J. Hit testing and bounds are approximate
File: `src/core/hitTest.js`

Closed filled path hit testing uses polygon containment, which is reasonable for current straight-line paths but not sufficient for future Bézier paths, holes, clipping, and compound paths.

`shapeBounds()` also ignores stroke extents.

Recommended fix:
- Define geometric bounds and visual bounds separately.
- Add exact path hit tests after Bézier support.
- Add broad-phase spatial indexing only when document size justifies it.

#### K. Group resize and degenerate geometry need explicit behavior
Files: `src/utils/geometry.js`, `src/store/editorStore.js`, `src/engine/interactions.js`

Resize logic uses axis-aligned boxes. Zero-width/zero-height objects and crossing resize handles need explicit expected behavior and tests. Aspect-ratio locking currently applies only to corner handles.

Recommended fix:
- Define behavior for line-only selections, zero-size bounds, negative transforms, and modifier keys.
- Add regression tests for all eight handles and multi-selection resize.

### P2 — Product readiness and maintainability

#### L. Initial application shell exists; full editor UI remains incomplete
The repository now has an HTML entry point, `/` and `/editor` routes, a Vite development server, a toolbar, canvas workspace, basic properties area, and initial layer display. This is enough to launch the current engine, but it is not yet a complete or polished editor shell.

Recommended next step:
- Expand the initial shell into complete, accessible menu, layers, and inspector workflows.
- Keep UI components thin and bind them to Jetz state/commands.

#### M. Import/export and persistence are absent
There is no inspected SVG importer/exporter, native project serializer, autosave, or recovery mechanism.

Recommended order:
1. Native project JSON format with schema version.
2. SVG export.
3. SVG import with sanitization and normalization.
4. Browser autosave/recovery.
5. Additional formats (PNG/PDF) after the document model stabilizes.

#### N. Package workflow is only partially established
`package.json` now has product metadata, ESM mode, Vite start/dev/build/preview scripts, a Node test-runner command, and a Node 20+ requirement. A pnpm lockfile and actual automated tests still need to be generated/added; lint and format scripts are also not configured.

Recommended fix:
- Run `pnpm install` and commit the generated `pnpm-lock.yaml`.
- Add meaningful tests and lint/format scripts as Phase 0 stabilizes the core.
- Keep local setup instructions current in README.

## 3. Positive design decisions

- Framework-independent document and geometry modules.
- Explicit world/screen coordinate conversion.
- Separate viewport state from document content.
- Transient drag preview rather than committing every pointer frame.
- Keyed SVG node reconciliation rather than wholesale `innerHTML` replacement.
- Bounded history stack.
- A central store API for document mutations.

These are worth preserving.

## 4. Risk ranking

| Priority | Finding | Risk |
|---|---|---|
| P0 | Duplicate transaction commit | Reactive correctness/performance |
| P0 | Non-reactive history availability | UI correctness |
| P0 | Missing tests | Regression risk |
| P1 | Shift-click move behavior | Selection UX |
| P1 | Z-order semantics | Layer correctness |
| P1 | Missing pointer cancellation | Gesture state corruption |
| P1 | Polyline-only paths | Product capability ceiling |
| P1 | Approximate bounds/hit tests | Selection accuracy |
| P2 | No application shell | Product incompleteness |
| P2 | No import/export/persistence | Product incompleteness |
| P2 | Incomplete package workflow | Developer experience |

## 5. Verification status

This review is static. The repository does not currently provide a usable test script, and no claim is made that the findings have been reproduced in a running browser. Convert each correctness finding into a regression test before changing behavior.
