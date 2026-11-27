# Vectorize — Automated Tool Testing Plan

> Status: **PLANNED**
> Scope: a dedicated, repeatable test system for verifying individual tools, combinations of tools, geometry results, rendered output, and end-to-end editing workflows.
> Guiding principle: tests must verify the resulting document and artwork, not merely that a command was invoked without throwing.

## 1. Goals

Build a test foundation that makes regressions visible as Vectorize grows. The system must:

- Verify every implemented tool in isolation.
- Verify interactions between tools and commands (for example create → select → fill → transform → export).
- Verify geometric correctness for vector operations, including Boolean operations.
- Verify undo/redo, selection, layer membership, ordering, and document invariants.
- Verify SVG/PNG output and catch visual regressions.
- Provide reproducible scenarios with explicit inputs and expected outcomes.
- Distinguish **PASS**, **FAIL**, **BLOCKED**, and **NOT IMPLEMENTED**. A missing feature or missing test must never be reported as passing.

## 2. Testing principles

1. **Assert outcomes, not implementation details.** Prefer document state, geometry, exported SVG, and rendered pixels over private function call counts.
2. **Use deterministic fixtures.** Fixed coordinates, dimensions, colors, IDs where practical, and no random/time-dependent inputs.
3. **Test both normal and adversarial geometry.** Include overlap, containment, touching edges, disjoint objects, negative coordinates, zero/near-zero dimensions, open paths, self-intersections, and multiple selected objects as applicable.
4. **Test history.** Mutating commands should be checked for one coherent undo step and correct redo behavior.
5. **Test serialization boundaries.** Validate imported/exported documents and ensure unsupported or unsafe input is rejected or handled explicitly.
6. **Separate layers of testing.** Pure geometry/store tests should not require a browser; DOM/render and interaction tests may use a browser.
7. **No false green.** A skipped, unsupported, or unimplemented capability is not PASS.
8. **Keep scenarios human-readable.** A developer should be able to understand the artwork being constructed from the test name and steps.

## 3. Test architecture and proposed layout

Proposed structure (adapt to existing source organization; avoid duplicating helpers or fixtures):

```text
tests/
├── fixtures/
│   ├── basic-shapes.js
│   ├── overlapping-shapes.js
│   ├── nested-shapes.js
│   ├── open-and-closed-paths.js
│   └── complex-document.js
├── unit/
│   ├── tools/
│   │   ├── selection.test.js
│   │   ├── rectangle.test.js
│   │   ├── ellipse.test.js
│   │   ├── pen-pencil.test.js
│   │   ├── fill-stroke.test.js
│   │   ├── eyedropper.test.js
│   │   ├── eraser.test.js
│   │   └── transform.test.js
│   ├── geometry/
│   │   ├── bounds.test.js
│   │   ├── hit-test.test.js
│   │   ├── intersections.test.js
│   │   └── path-operations.test.js
│   └── store/
│       ├── history.test.js
│       ├── layers.test.js
│       └── selection.test.js
├── integration/
│   ├── fill-workflow.test.js
│   ├── cut-copy-paste.test.js
│   ├── transform-workflow.test.js
│   ├── boolean-operations.test.js
│   ├── path-editing.test.js
│   └── import-export.test.js
├── scenarios/
│   ├── subtract-circle-from-rectangle.test.js
│   ├── compound-shape.test.js
│   ├── create-logo.test.js
│   ├── create-icon.test.js
│   └── export-roundtrip.test.js
├── visual/
│   ├── svg-snapshots/
│   └── browser-screenshots/
└── helpers/
    ├── editorTestContext.js
    ├── shapeFactory.js
    ├── geometryAssertions.js
    ├── documentAssertions.js
    ├── svgAssertions.js
    └── visualAssertions.js
```

The existing `src/store/editorStore.test.js` and Node.js built-in test runner are the starting point. Before introducing a new framework, assess whether the built-in `node:test` runner can cover the pure-JavaScript layers. Add a browser automation dependency only when DOM interaction or screenshot verification requires it.

## 4. Test layers

### 4.1 Unit tests

Test one function/tool behavior with controlled input.

Examples:
- Rectangle creation preserves requested x/y/width/height and style.
- Ellipse creation produces expected center/radii or equivalent geometry.
- Fill and stroke update only the intended selected objects.
- Eyedropper samples the intended source properties.
- Rotate/scale/reflect preserve expected bounds and geometry.
- Selection and hit-testing respect visibility, stacking order, and tolerance.
- Undo/redo restores the exact before/after document snapshots.

### 4.2 Integration tests

Test a meaningful sequence of multiple editor operations.

Examples:
- Create rectangle → select → change fill → change stroke → undo twice → redo twice.
- Create two shapes → duplicate → move → align → verify ordering and selection.
- Create path → smooth → close path (when supported) → fill → export SVG.
- Create objects on different layers → hide a layer → select all visible → verify hidden content is excluded.
- Cut → paste → move pasted result → undo/redo → verify source and pasted object identities and positions.

### 4.3 Geometry tests

For every geometry operation, assert mathematical properties where possible:

- Bounds and dimensions.
- Area and perimeter within a documented tolerance.
- Point containment and point exclusion.
- Intersection points and segment counts.
- Path closure, winding, fill rule, subpath count, and hole behavior.
- No unexpected self-intersections or degenerate segments.
- Stable results when input order is reversed where the operation should be commutative.
- Correct behavior for disjoint, touching, overlapping, and fully-contained shapes.

Geometry tests are the source of truth for path operations; screenshots alone cannot prove geometric correctness.

### 4.4 Visual regression tests

Compare deterministic SVG output or browser screenshots against approved baselines.

Check:
- Correct visible shape and silhouette.
- Fill, stroke, opacity, gradients, blend modes, and clipping.
- Z-order and layer visibility.
- Selection outline/handles when testing editor UI.
- No missing nodes, rendering artifacts, or unexpected shifts.
- Exported SVG/PNG matches the editor preview within a defined tolerance.

Use pixel tolerance for raster comparisons to avoid fragile failures from insignificant anti-aliasing differences. Keep geometry assertions alongside visual tests.

### 4.5 Workflow/scenario tests

A scenario builds a small piece of artwork through editor operations and verifies the final document and output.

Scenarios should be readable as a recipe:
1. Create named objects with known geometry.
2. Apply tool operations in a realistic sequence.
3. Assert intermediate states where useful.
4. Assert final object count, geometry, appearance, selection, and history.
5. Export and validate the result.

## 5. Tool coverage matrix

Maintain a test entry for every visible/enabled tool. Disabled or not-yet-implemented tools are tracked as NOT IMPLEMENTED, not skipped silently.

| Tool / capability | Minimum expected checks |
|---|---|
| Selection | Click, multi-select, deselect, hidden-layer exclusion, hit-test order |
| Magic Wand | Exact style matching, mixed styles, no-match case |
| Lasso | Inside/outside boundary, center-based selection semantics, empty selection |
| Pen | Anchor sequence, open/closed path, cancel, degenerate input |
| Pencil / Paintbrush | Pointer sample sequence, minimum points, stroke/style, cancellation |
| Smooth | Path point reduction/smoothing, endpoints preserved, history |
| Rectangle / Rounded Rectangle | Dimensions, corner radius, negative drag normalization |
| Ellipse | Bounds, equal width/height circle, negative drag normalization |
| Polygon / Star | Vertex count, center/radius, deterministic orientation |
| Line / Arc / Spiral | Endpoints or sampled geometry, bounds, degeneracy |
| Rectangular / Polar Grid | Expected generated object count and placement |
| Eyedropper | Fill/stroke/opacity sampling and application to selection |
| Eraser | Current whole-object deletion behavior; segment erasing remains separate |
| Hand / Zoom | Viewport pan/zoom and stable document coordinates |
| Fill / Stroke | Color validation, None, opacity, width, cap, join, dash, undo/redo |
| Transform | X/Y/W/H, rotation, scale, reflection, multi-selection, zero-size edge cases |
| Layers | Add, rename, activate, hide/show, delete empty, active visible layer |
| Cut / Copy / Paste | Clipboard payload, identity regeneration, offsets, style, layers, history |
| Pathfinder / Boolean | Topology, area, holes, object count, fill rule, edge cases |
| Divide / Trim / Merge / Crop / Outline | Segment splitting, retained regions, output topology and style rules |
| Import / Export | Supported elements, unsupported element reporting, round-trip validity |
| Undo / Redo | One logical history entry per user operation and exact restoration |

Update this matrix as tools are implemented or behavior changes. Do not mark a tool covered merely because a nearby store function has a test.

## 6. Boolean and path-operation test matrix

For each Boolean/Pathfinder operation (Unite, Subtract/Minus Front, Intersect, Exclude, Divide, Trim, Merge, Crop, Outline), include these geometric arrangements when relevant:

1. Two partially overlapping shapes.
2. Two disjoint shapes.
3. One shape fully inside another.
4. Shapes sharing an edge.
5. Shapes touching at one point.
6. Identical/coincident shapes.
7. More than two input shapes.
8. Mixed shape kinds (rectangles, ellipses, polygons, paths).
9. Open paths versus closed paths (explicitly define supported behavior).
10. Compound paths with holes and different winding directions.
11. Reversed input/stacking order.
12. Degenerate or near-zero geometry.

For each case assert:
- Number and kind of output objects.
- Output path validity and closure.
- Expected containment/exclusion points.
- Area relation where mathematically meaningful.
- Fill rule and hole behavior.
- Style inheritance policy.
- Input preservation or destructive replacement policy.
- Selection after operation.
- Undo and redo restore exact states.
- SVG export remains valid and visually consistent.

Document operation-specific semantics before implementing tests. For example, Divide must define how resulting regions are split and styled; Crop must define which object supplies the clipping boundary and how the result is represented.

## 7. Example scenario specification

### Scenario: subtract a centered circle from a rectangle

**Setup**
- Rectangle: x=0, y=0, width=200, height=200.
- Circle: x=50, y=50, width=100, height=100.
- Circle is centered inside the rectangle.
- Both shapes are closed paths or are converted to a supported closed-path representation.

**Actions**
1. Create the rectangle.
2. Create the circle.
3. Select both objects.
4. Run Subtract with the documented front/back operand semantics.
5. Export the result as SVG.

**Assertions**
- Exactly one resulting compound/path object remains (according to the chosen data model).
- The point (25, 25) is inside the result.
- The point (100, 100) is outside the filled result (the hole).
- The result area is approximately rectangle area minus circle area, within a documented curve approximation tolerance.
- The hole remains transparent in SVG rendering.
- Undo restores the two original objects.
- Redo restores the subtraction result.
- Exported SVG parses and renders equivalently.

This is a specification example. Test helper APIs must match the actual Vectorize implementation; do not add tests against imaginary editor APIs.

## 8. Scenario library ideas

Build a growing library of realistic artwork workflows:

- **Basic styled shapes:** rectangle → fill → stroke → opacity.
- **Compound cutout:** rectangle + circle → subtract → verify hole.
- **Intersected badge:** overlapping circles → intersect → color and stroke.
- **Divided regions:** overlapping shapes → divide → select/delete a region → recolor.
- **Logo construction:** primitive shapes → align → Boolean operations → gradients → export SVG.
- **Icon construction:** rounded rectangles + circles → align/distribute → union/subtract → export SVG.
- **Cut/paste workflow:** create → select → cut → paste → transform → undo/redo.
- **Layer workflow:** create layers → draw on active layer → hide/show → reorder → export.
- **Path workflow:** pen/pencil → smooth → transform → fill/stroke → export.
- **Round-trip workflow:** create document → export Vectorize JSON/SVG → import → compare normalized document/appearance.
- **Stress workflow:** many shapes, repeated transforms, selection changes, undo/redo, and export.

Each scenario should specify the exact expected result rather than only checking that the final operation did not throw.

## 9. Test runner and reporting

The runner should produce:
- Test ID and human-readable title.
- Test category (unit, integration, geometry, visual, scenario).
- Preconditions/fixture.
- Ordered actions.
- Expected result and actual result.
- PASS / FAIL / BLOCKED / NOT IMPLEMENTED status.
- Failure detail (assertion, geometry delta, or screenshot diff).
- Optional SVG/PNG artifact for visual diagnosis.

Initial implementation should use Node's `node:test` for pure logic and store tests. Browser-based interaction and screenshot tests can be added in a later phase with a browser automation tool (for example Playwright), after choosing and pinning a compatible dependency.

## 10. Implementation phases

### Phase 0 — Audit and test contract
- [ ] Inventory current tools, store commands, geometry helpers, renderer behavior, and existing tests.
- [ ] Map each enabled UI tool to its actual implementation entry point.
- [ ] Define document invariants and expected semantics for each operation.
- [ ] Identify browser-only behavior versus pure logic.
- [ ] Establish stable fixture conventions and floating-point tolerances.

**Exit criteria:** no enabled tool is unaccounted for; every planned capability has a documented status and test target.

### Phase 1 — Testing foundation
- [ ] Create shared editor test context around the real store/document APIs.
- [ ] Create shape/document fixtures and deterministic factories.
- [ ] Add document, geometry, selection, history, and SVG assertion helpers.
- [ ] Add test categorization and consistent naming conventions.
- [ ] Ensure test isolation: every test starts with a fresh document/state.
- [ ] Keep the runner compatible with the existing `node --test` command unless a justified change is approved.

**Exit criteria:** a small sample unit test and a multi-command scenario can run deterministically without a browser.

### Phase 2 — Individual tests for implemented tools
- [ ] Add tests for every currently enabled toolbar tool.
- [ ] Add tests for menu commands and Properties controls.
- [ ] Add edge cases, cancellation behavior, and undo/redo checks.
- [ ] Add a coverage matrix linking each UI affordance to test files.

**Exit criteria:** every enabled tool/command has at least one positive test, one relevant negative/edge case, and history assertions for document mutations.

### Phase 3 — Combination and workflow tests
- [ ] Add multi-tool integration tests.
- [ ] Add cut/copy/paste tests once clipboard semantics are implemented.
- [ ] Add layer/selection/transform/appearance interaction tests.
- [ ] Add realistic logo, icon, compound-shape, and export scenarios.
- [ ] Assert intermediate and final document state.

**Exit criteria:** core workflows are verified end-to-end at the document/store layer.

### Phase 4 — Boolean and advanced geometry tests
- [ ] Specify semantics and operand order for each Boolean/path operation.
- [ ] Implement or integrate a robust closed-path geometry engine.
- [ ] Test Unite, Subtract, Intersect, Exclude, Divide, Trim, Merge, Crop, and Outline.
- [ ] Cover overlap, disjoint, containment, touching, coincident, holes, and multiple operands.
- [ ] Verify area, containment, topology, style, selection, and history.

**Exit criteria:** each implemented geometry operation passes its complete geometry matrix and exports valid SVG.

### Phase 5 — Visual regression and browser workflows
- [ ] Establish deterministic SVG snapshots.
- [ ] Add browser tests for pointer/keyboard interactions and actual rendered output.
- [ ] Add screenshot baselines with controlled viewport/device scale.
- [ ] Define pixel-diff tolerance and artifact retention.
- [ ] Verify canvas preview versus SVG/PNG exports.

**Exit criteria:** critical workflows have both geometry/document assertions and visual evidence.

### Phase 6 — Continuous quality gate
- [ ] Add a documented local command for unit/integration tests.
- [ ] Add optional browser/visual test commands separately.
- [ ] Report blocked/unimplemented features distinctly.
- [ ] Define release gate: no regression in implemented critical workflows.
- [ ] Keep test suite deterministic and reasonably fast.

**Exit criteria:** developers can run the required test suites locally and interpret failures without external services.

## 11. Quality gates

A feature is considered test-complete only when:

- Its normal behavior is tested.
- Important edge cases are tested.
- Resulting document/geometry is asserted.
- Appearance/rendering is tested where relevant.
- Undo/redo is tested for mutations.
- Interactions with adjacent tools are covered.
- Export/serialization is tested when the feature affects document output.
- The feature status in the progress inventory matches its real implementation and test coverage.

A feature must not be marked complete solely because:
- The UI button exists.
- A handler was called.
- No exception was thrown.
- A screenshot looks plausible without structural assertions.
- A test is skipped or marked TODO.

## 12. Current baseline and constraints

- The project currently uses JavaScript ES modules, Jetz, SVG rendering, and Node's built-in `node:test` runner.
- Existing tests are concentrated in `src/store/editorStore.test.js`; they cover several store, history, style, layer, transform, gradient, and document-validation behaviors.
- The current package script is `"test": "node --test"`.
- The current test suite has not been independently executed as part of writing this plan. Do not infer that tests/build pass from source inspection.
- Some visible controls are placeholders or disabled; only actual enabled behavior should be included in the implemented-tool test set.
- Boolean/pathfinder operations, robust path editing, and clipboard workflows may require implementation work before meaningful tests can be written.
- Do not create tests against speculative APIs. Build helpers around the actual store, geometry, renderer, and interaction contracts after auditing them.

## 13. Immediate next steps

1. Audit the current `main` branch and reconcile the feature inventory with actual enabled controls and implementation entry points.
2. Create Phase 1 test helpers using the existing Node test runner.
3. Expand store/document tests into individual tool tests for currently implemented operations.
4. Add the first scenario: rectangle + centered circle → subtract specification. Keep it BLOCKED until a real Boolean engine and API exist.
5. Add a fill/stroke/transform/export scenario that can be exercised with the current capabilities.
6. Update this plan and the feature progress document as each phase is completed.

---

**Definition of done for the testing initiative:** every implemented user-facing tool and command is traceable to meaningful tests; cross-tool workflows verify expected artwork; geometry and visual output are both checked where appropriate; unsupported functionality is explicitly reported rather than silently passing.
