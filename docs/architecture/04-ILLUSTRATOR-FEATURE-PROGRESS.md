# Vectorize — Illustrator-inspired UI & Feature Progress

> Scope: comprehensive UI inventory for a browser vector editor inspired by professional vector-design applications. This document tracks the intended feature surface and implementation status; it does **not** imply feature parity with Adobe Illustrator.
>
> Current milestone: convert the Illustrator-inspired menu and inspector surface into a practical JavaScript/SVG editor. A visible control is only marked implemented when it performs a real operation; unsupported controls are disabled rather than presented as working.

## Status legend

- [x] UI scaffold present
- [ ] Not implemented
- [~] Partial implementation / existing basic behavior

## 1. Workspace and application chrome

### Menus and document controls
- [x] Application brand and document title
- [x] File, Edit, Object, Select, View, Window and Help menus
- [~] Type and Effect menus are present but disabled until their document models exist
- [x] Undo / Redo and Fit canvas commands
- [x] New document, Open/Save versioned Vectorize JSON, Export SVG and PNG (1×)
- [x] Select all, Deselect, Duplicate, Delete
- [x] Arrange to front/back and align selected objects
- [x] View zoom in/out and fit artboard
- [ ] Save As / Revert / autosave and recovery
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

The visible toolbar is grouped into logical sections. Implemented tools are wired to actual SVG/document operations; tools whose document model is not ready are disabled to avoid fake affordances.

### Selection tools
- [~] Selection tool
- [ ] Direct Selection tool
- [ ] Group Selection tool
- [x] Magic Wand tool (matches fill, stroke, stroke width and opacity)
- [x] Lasso tool (freeform selection by object center)

### Drawing and path tools
- [~] Pen tool (basic polyline path)
- [ ] Curvature tool
- [x] Pencil/freehand tool (polyline path creation)
- [x] Smooth tool (Chaikin smoothing pass on selected polyline paths)
- [ ] Path Eraser tool
- [ ] Join tool
- [ ] Anchor Point tool, Add Anchor Point, Delete Anchor Point, Convert Anchor Point

### Type tools
- [ ] Type tool
- [ ] Area Type tool
- [ ] Type on a Path tool
- [ ] Vertical Type tool
- [ ] Touch Type tool
- [ ] Font browser, paragraph and character controls

### Shape tools
- [~] Rectangle tool
- [x] Rounded Rectangle tool
- [~] Ellipse tool
- [x] Polygon tool (six-sided default)
- [x] Star tool (five-point default)
- [~] Line Segment tool
- [x] Arc tool (sampled semicircle path)
- [x] Spiral tool (sampled three-turn path)
- [x] Rectangular Grid tool (independent line objects)
- [x] Polar Grid tool (ellipse rings and radial lines)
- [ ] Flare tool

### Paint and color tools
- [~] Paintbrush tool (freehand path with constant stroke width)
- [ ] Blob Brush tool
- [ ] Mesh tool
- [ ] Gradient tool
- [x] Eyedropper tool (samples selected object's appearance)
- [ ] Live Paint Bucket tool
- [ ] Live Paint Selection tool

### Transform and edit tools
- [~] Eraser tool (click-to-delete whole object; path-segment erase deferred)
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
- [~] Artboard dimensions editable in Document properties
- [ ] Slice and Slice Selection tools
- [ ] Measure tool
- [ ] Perspective Grid and Perspective Selection tools
- [x] Hand/pan tool
- [x] Zoom tool (click zoom; Shift-click zoom out)

### Toolbar utilities
- [x] Fill/stroke swatch visual
- [ ] Swap fill/stroke
- [ ] Default fill/stroke
- [ ] None / color / gradient swatch controls
- [ ] Toolbar customization and tear-off tool groups
- [ ] Tool flyouts and alternate-tool selection

## 3. Right Properties panel — contextual inspector

### Panel shell
- [x] Functional Properties / Layers / Assets tabs
- [x] Selection summary and object-kind context label
- [x] Document properties empty-selection state
- [ ] Functional panel switching, collapse/expand and panel docking

### Transform
- [x] X, Y, Width, Height fields reflect selected-object bounds
- [x] Numeric X/Y/Width/Height editing (single and multi-selection)
- [x] Proportions and transform-options affordances
- [ ] Rotation, shear, reflection and scale
- [ ] Reference point selector
- [ ] Transform each / copy transform
- [ ] Transform origin and units support

### Appearance
- [~] Fill color control (selection-aware, undoable)
- [x] Stroke color control (selection-aware, undoable)
- [x] Opacity editing (0–100%, undoable)
- [x] Stroke weight editing (undoable)
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
- [x] Stroke weight control (editable and undoable)
- [x] Cap, join and profile controls (visual only)
- [ ] Stroke alignment: inside, center, outside
- [ ] Dash arrays and dash offset
- [ ] Arrowheads and endpoint markers
- [ ] Variable-width profiles and width editing
- [ ] Expand stroke

### Alignment and distribution
- [x] Functional align action grid
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

## 3A. Complete Properties-panel inventory

The right panel combines functional selection-aware Transform and Appearance controls with visual-only placeholders. The checklist below tracks both implemented behavior and the remaining professional inspector surface.

### Panel navigation and context
- [x] Properties tab visual
- [x] Functional Layers tab (active layer, visibility, rename, add, delete empty layer)
- [x] Functional Assets tab (primitive presets)
- [x] Selection summary and selected-object kind label
- [x] Empty-selection / document-properties state
- [ ] Functional tab switching and active-tab persistence
- [ ] Collapse/expand sections and panel resizing
- [ ] Panel docking, undocking and workspace presets
- [~] Multi-selection summary and mixed-value display (selection count, aggregate bounds and mixed appearance labels)
- [ ] Context-sensitive sections per object type
- [ ] Reset section values and restore defaults

### Transform properties
- [x] X position field visual
- [x] Y position field visual
- [x] Width field visual
- [x] Height field visual
- [x] Constrain-proportions affordance
- [x] More-transform-options affordance
- [x] Read selected geometry and update values on selection
- [x] Edit X/Y/W/H numerically and commit through history
- [ ] Rotation angle
- [ ] Horizontal/vertical scale
- [ ] Horizontal/vertical shear
- [ ] Flip horizontal and vertical
- [ ] Reference-point / transform-origin selector
- [ ] Transform each selected object independently
- [ ] Copy and repeat last transform
- [ ] Units, precision and unit conversion
- [ ] Reset bounding box and transform values
- [ ] Pixel alignment and align-to-pixel options

### Appearance properties
- [x] Fill row and color-input visual
- [x] Stroke row and no-color visual
- [x] Opacity field visual
- [x] Blend-mode label visual
- [x] Color spectrum preview
- [x] Gradient preview
- [ ] Fill color picker with HEX, RGB, HSL and alpha
- [ ] Fill type: solid, linear gradient, radial gradient, freeform gradient, pattern
- [ ] Stroke color picker and stroke enable/disable
- [ ] Multiple fills and multiple strokes
- [ ] Appearance stack: add, remove, reorder and duplicate appearance entries
- [ ] Per-appearance opacity and blend mode
- [ ] Graphic styles: apply, create, update and manage
- [ ] Revert appearance and clear appearance
- [ ] Swatches, global colors and spot colors

### Stroke properties
- [x] Editable stroke weight
- [x] Cap choices: Butt, Round, Projecting
- [x] Join choices: Miter, Round, Bevel
- [~] Stroke profile selector (Uniform only)
- [x] Cap and join behavior
- [ ] Miter limit
- [x] Dashed line pattern (numeric dash sequence; offset deferred)
- [ ] Stroke alignment: center, inside, outside
- [ ] Arrowheads and endpoint markers
- [ ] Variable-width profile editor
- [ ] Width points and width handles
- [ ] Expand stroke to editable outlines

### Align and distribute properties
- [x] Align left, horizontal center, align right (functional)
- [x] Align top, vertical center, align bottom (functional)
- [x] Align-to selector visual
- [x] Equal-gap horizontal and vertical distribution
- [x] Align to selection bounds
- [ ] Align to key object
- [ ] Align to artboard
- [ ] Align to canvas
- [x] Distribute object spacing with equal gaps
- [ ] Distribute object centers with selectable reference
- [ ] Smart distribute and spacing preview
- [ ] Align to pixel grid

### Pathfinder and geometry operations
- [x] Unite, Minus Front, Intersect and Exclude button visuals
- [ ] Unite (requires robust closed-path Boolean engine)
- [ ] Minus Front / subtract (requires robust closed-path Boolean engine)
- [ ] Intersect (requires robust closed-path Boolean engine)
- [ ] Exclude (requires robust closed-path Boolean engine)
- [ ] Divide
- [ ] Trim
- [ ] Merge
- [ ] Crop
- [ ] Outline
- [ ] Expand and expand appearance
- [ ] Offset Path
- [ ] Simplify Path
- [ ] Shape Builder integration and live region preview

### Color properties
- [x] Color spectrum visual
- [x] RGB mode selector visual
- [ ] RGB, HSL, HSV, CMYK and grayscale modes
- [ ] Numeric channel inputs and alpha
- [ ] HEX input and validation
- [ ] Color picker / eyedropper integration
- [ ] Swatches panel, groups and global swatches
- [ ] Recent colors and document colors
- [ ] Color harmony and color conversion
- [ ] Color profile management and document color settings

### Gradient properties
- [x] Gradient preview visual
- [x] Linear type selector visual
- [x] Angle field visual
- [ ] Linear and radial gradient editing
- [ ] Freeform gradient points and lines
- [ ] Gradient stops, midpoint and stop opacity
- [ ] Stop color editing and stop positioning
- [ ] Gradient angle, aspect ratio and origin
- [ ] Reverse gradient and reset gradient
- [ ] Save gradient as swatch
- [ ] Gradient annotator on canvas

### Transparency properties
- [x] Opacity editing
- [x] Blend mode selector (Normal, Multiply, Screen, Overlay, Darken, Lighten, Dodge, Burn, Difference, Exclusion)
- [x] Isolate blending state visual
- [ ] Editable opacity
- [x] Blend modes (Normal, Multiply, Screen, Overlay, Darken, Lighten, Dodge, Burn, Difference, Exclusion)
- [ ] Opacity mask creation and editing
- [ ] Clip mask / invert mask / release mask
- [ ] Knockout groups and isolation
- [ ] Per-fill and per-stroke transparency

### Character and paragraph properties
- [x] Character & Paragraph section visual
- [x] Font-family selector visual
- [x] Size and leading field visuals
- [x] Tracking and kerning field visuals
- [x] Paragraph alignment button visuals
- [ ] Font family search and font loading
- [ ] Font style, weight, width and variable axes
- [ ] Font size, leading, tracking, kerning and baseline shift
- [ ] Horizontal/vertical scale and character rotation
- [ ] Underline, strikethrough and capitalization
- [ ] OpenType features and ligatures
- [ ] Paragraph alignment, indentation and spacing
- [ ] Columns, text inset and area-type options
- [ ] Overflow detection and text threading
- [ ] Text on path options and type orientation

### Contextual geometry properties
- [ ] Rectangle: X/Y/W/H, corner radii and independent corners
- [ ] Rounded rectangle: per-corner radius
- [ ] Ellipse: center, radius X/Y, start/end angle and closure
- [ ] Polygon: sides, radius and rotation
- [ ] Star: points, inner radius and outer radius
- [ ] Line: endpoints, length, angle and direction
- [ ] Arc: start/end, radius and sweep
- [ ] Spiral: turns, decay and direction
- [ ] Grid: rows, columns, cell sizes and dividers
- [ ] Path: anchor count, closure, segment type and handle mode
- [ ] Image: dimensions, crop, fit, embed/link and resolution
- [ ] Group: dimensions, isolation and child count
- [ ] Compound path: release and reverse path direction
- [ ] Clipping mask: edit contents, release and opacity
- [ ] Symbol instance: source, overrides and break link
- [ ] Graph: data, type, axes, labels, legend and styling

### Document and artboard properties
- [x] Editable document width and height
- [x] Units selector visual (pixels only)
- [x] Artboard label visual
- [x] Editable document width and height
- [ ] Units: px, pt, mm, cm, inches
- [ ] Artboard list, selection and navigation
- [ ] Artboard dimensions, orientation and presets
- [ ] Artboard background and transparency
- [ ] Bleed, margins and safe area
- [ ] Document color mode and color profile
- [ ] Raster effects resolution
- [ ] Export settings and export presets

### Quick Actions and object management
- [x] Duplicate, Arrange and Delete quick actions
- [x] Layers list with visibility, active-layer, rename and empty-layer delete controls
- [ ] Group and ungroup
- [x] Duplicate selected objects
- [x] Bring to front / send to back
- [ ] Lock/unlock and show/hide
- [ ] Rename selected object
- [ ] Create clipping mask and release clipping mask
- [ ] Create compound path and release compound path
- [ ] Expand, outline and rasterize
- [ ] Delete and clean up unused objects
- [ ] Add to assets/library and create reusable style

## 2A. Complete toolbar checklist

This is the per-button inventory for the current left toolbar. A visible button is not considered implemented until it has a real interaction, document operation, keyboard behavior where appropriate, and tests.

### Selection group
- [x] Selection (V) — select, move and resize objects
- [ ] Direct Selection — select/edit individual anchors and path segments (Bézier milestone)
- [ ] Group Selection — select nested objects inside groups (group model pending)
- [x] Magic Wand — select objects by matching fill, stroke, width and opacity
- [x] Lasso — freeform object selection by center point

### Drawing and path group
- [~] Pen (P) — click-to-add polyline points
- [ ] Curvature — create/edit smooth curved paths (Bézier milestone)
- [x] Pencil — freehand polyline path creation
- [x] Smooth — Chaikin smoothing pass on selected paths
- [ ] Path Eraser — erase portions of paths
- [ ] Join — join open path endpoints
- [ ] Anchor Point — edit anchor handles and corner/smooth behavior
- [ ] Add Anchor Point — insert anchors on segments
- [ ] Delete Anchor Point — remove anchors while preserving path continuity
- [ ] Convert Anchor Point — convert corner and smooth points

### Type group
- [ ] Type — create point text
- [ ] Area Type — flow text inside a shape
- [ ] Type on a Path — attach text to a path
- [ ] Vertical Type — vertical text layout
- [ ] Touch Type — manipulate individual glyphs
- [ ] Font family and font browser
- [ ] Font style/weight and variable-font axes
- [ ] Font size, leading, tracking, kerning and baseline shift
- [ ] Paragraph alignment, indentation, spacing and hyphenation
- [ ] Text frame inset, columns and overflow handling
- [ ] Text-to-outlines conversion and font fallback

### Shape group
- [x] Rectangle (R)
- [x] Rounded Rectangle — uniform corner radius
- [x] Ellipse (O)
- [x] Polygon — six-sided default
- [x] Star — five-point default
- [x] Line Segment (L)
- [x] Arc — sampled semicircle path
- [x] Spiral — sampled three-turn path
- [x] Rectangular Grid — independent line objects
- [x] Polar Grid — ellipse rings and radial lines
- [ ] Interactive tool options for sides, points, radii and grid divisions
- [ ] Flare — rays, rings and flare parameters

### Paint and color group
- [~] Paintbrush (B) — freehand paths with constant width
- [ ] Blob Brush (Shift+B) — merge painted regions
- [ ] Mesh (U) — gradient mesh points and color patches
- [ ] Gradient (G) — interactive gradient annotator
- [x] Eyedropper (I) — sample and apply appearance
- [ ] Live Paint Bucket (K) — fill detected regions
- [ ] Live Paint Selection (Shift+L) — select live-paint regions
- [ ] Brush library, brush presets and brush options
- [ ] Pattern creation and pattern editing

### Transform and edit group
- [~] Eraser (Shift+E) — click to delete an entire object; path-aware erase deferred
- [ ] Scissors (C) — cut paths at selected points
- [ ] Knife — split shapes and paths
- [ ] Width (Shift+W) — edit variable stroke width
- [ ] Shape Builder (Shift+M) — merge/remove regions interactively
- [ ] Free Transform (E) — scale, rotate, distort and perspective transform
- [ ] Rotate — rotate around a chosen reference point
- [ ] Reflect — mirror around an axis
- [ ] Scale — uniform and non-uniform scaling
- [ ] Shear — shear around an origin
- [ ] Reshape — modify selected path portions
- [ ] Warp — push/pull path geometry
- [ ] Twirl — rotate geometry around a brush center
- [ ] Pucker — pull geometry toward brush center
- [ ] Bloat — push geometry away from brush center
- [ ] Scallop — create inward/outward edge distortions
- [ ] Crystallize — create pointed edge distortions
- [ ] Wrinkle — create wrinkle-like edge distortions

### Symbol and graph group
- [ ] Symbol Sprayer — place symbol instances
- [ ] Symbol Shifter — reposition instances
- [ ] Symbol Scruncher — adjust instance spacing
- [ ] Symbol Sizer — resize instances
- [ ] Symbol Spinner — rotate instances
- [ ] Symbol Stainer — adjust instance tint
- [ ] Symbol Screener — adjust instance opacity
- [ ] Symbol Styler — apply graphic styles to instances
- [ ] Column Graph
- [ ] Stacked Column Graph
- [ ] Bar Graph
- [ ] Stacked Bar Graph
- [ ] Line Graph
- [ ] Area Graph
- [ ] Scatter Graph
- [ ] Pie Graph
- [ ] Radar Graph
- [ ] Graph data editor, labels, axes, legends and style controls

### Artboard, navigation and utility group
- [ ] Artboard — create, resize, rename, reorder and export artboards
- [x] Hand — pan canvas
- [x] Zoom — click zoom in, Shift-click zoom out
- [ ] Slice — define export regions
- [ ] Slice Selection — select and edit slices
- [ ] Measure — measure distance, angle and dimensions
- [ ] Perspective Grid — configure perspective planes and grid
- [ ] Perspective Selection — draw/edit objects in perspective
- [ ] Fill/stroke swatch selector
- [ ] Swap Fill and Stroke
- [ ] Set default Fill and Stroke
- [ ] Set Fill/Stroke to None
- [ ] Color, gradient and pattern swatch shortcuts
- [ ] Tool flyouts and alternate tools
- [ ] Toolbar customization, single/double-column layout and reset
- [ ] Tool options and contextual options bar

## 4. Layers, assets and object management

- [x] Single-layer visual preview
- [ ] Layer tree with nesting and drag reorder
- [x] Create and rename layers
- [x] Show/hide layers and select active drawing layer
- [~] Delete empty layers only (non-empty layer deletion is guarded)
- [ ] Duplicate and reorder layers
- [ ] Lock/unlock layers
- [ ] Object tree with thumbnails and selection sync
- [ ] Object rename, reorder, group and ungroup
- [ ] Isolation mode
- [ ] Assets library and reusable symbols
- [ ] Swatches, gradients, patterns and graphic styles
- [ ] Libraries and linked assets

## 5. Core vector capabilities

- [x] Rectangle, rounded rectangle, ellipse, line, polygon, star and polyline path geometry
- [x] Selection, move, resize (live object preview while dragging), delete
- [x] Fill, stroke, opacity, stroke width, cap, join, dash and blend mode properties
- [x] Multi-selection align, arrange and duplicate
- [x] Undo/redo with snapshot-based history
- [x] Editable artboard dimensions
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

- [x] Versioned Vectorize JSON document save/open (manual download/upload)
- [ ] Autosave/recovery and document tabs
- [ ] SVG import with sanitization
- [x] SVG export (current supported primitive geometry)
- [x] PNG export at 1× with canvas size safeguards
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

- Unsupported toolbar entries are disabled and do not pretend to be functional.
- File/Edit/Object/View menus now expose working document, selection, arrange, align and viewport commands.
- The Layers tab supports creating, renaming, activating, hiding/showing and deleting empty layers; the Assets tab inserts reusable primitive presets.
- The drawing tool set includes rounded rectangle, polygon, star, arc, spiral, rectangular/polar grid, pencil/freehand, constant-width paintbrush, smooth, magic wand, lasso, eyedropper, click-to-delete eraser, hand and zoom.
- Native save/open uses a versioned JSON envelope with import validation; SVG and PNG export serialize currently supported primitive geometry.
- The Properties panel supports editable stroke cap/join/dash and blend mode; document width/height are editable when no object is selected.
- Some advanced items remain intentionally deferred because the current document model does not yet represent them (text objects, symbol instances, graph data, live-paint regions, variable-width strokes, mesh patches, and path Boolean topology).
- Resize previews apply a live SVG transform to selected objects and update selection handles during pointer movement; pointer-up commits one history entry.
- Fill, stroke color, opacity, stroke weight and selection bounds are now data-driven inspector controls; each edit is committed as a single undoable operation.
- Controls are grouped by user intent, not by a promise of exact Adobe Illustrator behavior.
- Feature parity is not a goal by itself; each item must be justified by a useful vector-design workflow and a maintainable document model.
