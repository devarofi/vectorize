# Vectorize — Illustrator-inspired UI & Feature Progress

> Scope: comprehensive UI inventory for a browser vector editor inspired by professional vector-design applications. This document tracks the intended feature surface and implementation status; it does **not** imply feature parity with Adobe Illustrator.
>
> Current milestone: visual tool palette and contextual Properties panel scaffold. Most controls are intentionally UI-only until their underlying document model and operations are implemented.

## Status legend

- [x] UI scaffold present
- [ ] Not implemented
- [~] Partial implementation / existing basic behavior

## 1. Workspace and application chrome

### Menus and document controls
- [x] Application brand and document title
- [x] File, Edit, Object, Type, Select, Effect, View, Window, Help menu placeholders (UI-only)
- [~] Undo / Redo
- [~] Fit canvas
- [ ] New, Open, Save, Save As, Revert
- [ ] Document tabs and multi-document workspace
- [ ] Unsaved state derived from document history
- [ ] Preferences and keyboard shortcut editor
- [ ] Context menus and command search

### Canvas workspace
- [x] Central SVG artboard/canvas
- [x] Zoom indicator and object count
- [~] Pan and wheel zoom
- [ ] Multiple artboards and artboard navigation
- [ ] Rulers, canvas guides, smart guides, grids
- [ ] Canvas outline/bleed/safe-area display
- [ ] Presentation and outline modes
- [ ] Navigator/minimap panel

## 2. Left toolbar — tool inventory

The visible toolbar is grouped into logical sections. Only the already implemented Select, Pen, Rectangle, Ellipse, and Line controls are wired. Other controls are placeholders with labels/tooltips and no action.

### Selection tools
- [~] Selection tool
- [ ] Direct Selection tool
- [ ] Group Selection tool
- [ ] Magic Wand tool
- [ ] Lasso tool

### Drawing and path tools
- [~] Pen tool (basic polyline path)
- [ ] Curvature tool
- [ ] Pencil/freehand tool
- [ ] Smooth tool
- [ ] Path Eraser tool
- [ ] Join tool
- [ ] Anchor Point tool, Add Anchor Point, Delete Anchor Point, Convert Anchor Point

### Type tools
- [ ] Type tool
- [ ] Area Type tool
- [ ] Type on a Path tool
- [ ] Vertical Type tool
- [ ] Touch Type tool
- [ ] Touch Type tool
- [ ] Font browser, paragraph and character controls

### Shape tools
- [~] Rectangle tool
- [ ] Rounded Rectangle tool
- [~] Ellipse tool
- [ ] Polygon tool
- [ ] Star tool
- [~] Line Segment tool
- [ ] Arc tool
- [ ] Spiral tool
- [ ] Rectangular Grid tool
- [ ] Polar Grid tool
- [ ] Flare tool

### Paint and color tools
- [ ] Paintbrush tool
- [ ] Blob Brush tool
- [ ] Mesh tool
- [ ] Gradient tool
- [ ] Eyedropper tool
- [ ] Live Paint Bucket tool
- [ ] Live Paint Selection tool

### Transform and edit tools
- [ ] Eraser tool
- [ ] Scissors tool
- [ ] Knife tool
- [ ] Width tool
- [ ] Shape Builder tool
- [ ] Free Transform tool
- [ ] Rotate tool
- [ ] Reflect tool
- [ ] Scale tool
- [ ] Shear tool
- [ ] Puppet Warp tool
- [ ] Reshape, Twirl, Pucker, Bloat, Scallop, Crystallize and Wrinkle tools

### Symbol, graph and navigation tools
- [ ] Symbol Sprayer, Shifter, Scruncher, Sizer, Spinner, Stainer, Screener and Styler tools
- [ ] Graph tools: column, stacked column, bar, stacked bar, line, area, scatter, pie, radar
- [ ] Artboard tool
- [ ] Slice and Slice Selection tools
- [ ] Measure tool
- [ ] Perspective Grid and Perspective Selection tools
- [ ] Hand/pan tool
- [ ] Zoom tool

### Toolbar utilities
- [x] Fill/stroke swatch visual
- [ ] Swap fill/stroke
- [ ] Default fill/stroke
- [ ] None / color / gradient swatch controls
- [ ] Toolbar customization and tear-off tool groups
- [ ] Tool flyouts and alternate-tool selection

## 3. Right Properties panel — contextual inspector

### Panel shell
- [x] Properties / Layers / Assets tab visuals (tabs are UI-only)
- [x] Selection summary and object-kind context label
- [x] Document properties empty-selection state
- [ ] Functional panel switching, collapse/expand and panel docking

### Transform
- [x] X, Y, Width, Height field visuals
- [x] Proportions and transform-options affordances
- [ ] Numeric position and size editing
- [ ] Rotation, shear, reflection and scale
- [ ] Reference point selector
- [ ] Transform each / copy transform
- [ ] Transform origin and units support

### Appearance
- [~] Fill color control (existing basic implementation)
- [x] Stroke row visual
- [x] Opacity and blend-mode visuals
- [x] Color spectrum and gradient preview placeholders
- [x] Character and Paragraph inspector placeholder (shown for text selections)
- [ ] Solid, gradient and pattern fills
- [ ] Color models, swatch groups and color picker workflows
- [ ] Multiple fills and strokes / Appearance stack
- [ ] Opacity masks and transparency controls
- [ ] Blend modes and isolation
- [ ] Graphic styles and reusable appearances

### Stroke
- [x] Weight, cap, join and profile controls (visual only)
- [ ] Stroke alignment: inside, center, outside
- [ ] Dash arrays and dash offset
- [ ] Arrowheads and endpoint markers
- [ ] Variable-width profiles and width editing
- [ ] Expand stroke

### Alignment and distribution
- [x] Align action grid visuals
- [x] Align-to target visual
- [x] Distribution action visuals
- [ ] Align to selection, key object, artboard and canvas
- [ ] Distribute spacing with numeric gap
- [ ] Smart distribute

### Pathfinder and shape operations
- [x] Pathfinder action visuals
- [ ] Unite, Minus Front, Intersect, Exclude
- [ ] Divide, Trim, Merge, Crop, Outline
- [ ] Shape Builder interactive regions

### Contextual object sections
- [ ] Rectangle / rounded rectangle geometry
- [ ] Ellipse geometry
- [ ] Line endpoints and angle
- [ ] Path anchors, handles, segments and closure
- [ ] Text content, font, size, leading, tracking and paragraph
- [ ] Image dimensions, crop, embed/link and resolution
- [ ] Group, compound path and clipping mask controls
- [ ] Symbol instance and graph data properties

## 4. Layers, assets and object management

- [x] Single-layer visual preview
- [ ] Layer tree with nesting and drag reorder
- [ ] Create, rename, duplicate and delete layers
- [ ] Show/hide and lock/unlock layers
- [ ] Object tree with thumbnails and selection sync
- [ ] Object rename, reorder, group and ungroup
- [ ] Isolation mode
- [ ] Assets library and reusable symbols
- [ ] Swatches, gradients, patterns and graphic styles
- [ ] Libraries and linked assets

## 5. Core vector capabilities

- [~] Basic rectangle, ellipse, line and polyline path geometry
- [~] Selection, move, resize (live object preview while dragging), delete
- [~] Basic fill style
- [~] Undo/redo
- [ ] Cubic Bézier path segments and handles
- [ ] Direct anchor/handle editing
- [ ] Boolean path operations
- [ ] Groups, compound paths and clipping paths
- [ ] Stroke model (caps, joins, dash, width profiles)
- [ ] Gradients, patterns, meshes and swatches
- [ ] Text and typography engine
- [ ] Image placement and image tracing
- [ ] Symbols and reusable components
- [ ] Snapping to grid, guides, artboard, anchors and geometry

## 6. File, import/export and interoperability

- [ ] Versioned native Vectorize document format
- [ ] Open/save and autosave/recovery
- [ ] SVG import with sanitization
- [ ] SVG export
- [ ] PNG export at configurable scale/background
- [ ] PDF export
- [ ] EPS import/export investigation
- [ ] Copy/paste vector data and clipboard integration
- [ ] Drag/drop file import
- [ ] Font and linked-image packaging

## 7. Productivity, quality and accessibility

- [ ] Full keyboard shortcut map and customization
- [ ] Command search / quick actions
- [ ] Contextual help and tool options
- [ ] Customizable workspace and panels
- [ ] Light/dark themes
- [ ] Localization
- [ ] Accessible names, focus order and keyboard navigation
- [ ] Screen-reader announcements for selection and tool changes
- [ ] High-DPI and touch/stylus support
- [ ] Responsive layout
- [ ] Unit, integration, visual regression and E2E tests
- [ ] Performance profiling for large documents

## 8. Suggested implementation sequence

1. [x] Establish Illustrator-inspired toolbar and Properties panel visual hierarchy.
2. [ ] Make panel state and selection context fully data-driven.
3. [ ] Complete document model and transaction/history correctness.
4. [ ] Implement Bézier paths, Direct Selection and anchor editing.
5. [ ] Complete transform, stroke, fill and appearance stack.
6. [ ] Implement layers, groups, ordering and pathfinder operations.
7. [ ] Add typography, gradients, patterns, symbols and artboards.
8. [ ] Add native save/open, import/export and autosave.
9. [ ] Add snapping, guides, accessibility and responsive customization.
10. [ ] Stabilize with automated tests and performance benchmarks.

## 9. Current implementation notes

- UI buttons without a backing feature are intentionally inert; they must not mutate document state.
- Existing basic tool buttons remain wired so current drawing workflows continue to work.
- Resize previews update the selected SVG objects and selection handles on every animation-frame pointer update; pointer-up commits one history entry.
- The fill color input is retained as the one existing inspector action.
- Controls are grouped by user intent, not by a promise of exact Adobe Illustrator behavior.
- Feature parity is not a goal by itself; each item must be justified by a useful vector-design workflow and a maintainable document model.
