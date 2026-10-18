# MASTER SPECIFICATION — AI Minecraft Architecture Studio

**Version:** 1.0 (2026-10-19)  
**Status:** Approved development target; implementation NOT STARTED  
**Execution preference:** Codex Cloud + private GitHub repository, local Minecraft checks when needed  
**Target game:** Minecraft Java Edition 1.20.1 **Vanilla**

## 1. Vision and product acceptance

Create a premium, browser-operated AI Minecraft architecture platform that can transform uploaded building photos into a **valid, editable block arrangement** and provide buildable step-by-step guides. Not merely a Minecraft-looking image, screenshot, GLB model or fake static website. The result must be manipulable in 3D and 2D, saved/reloaded, validated and exported. Core capabilities must work without Higgsfield; AI remains an optional provider-backed pipeline.

**Full user journey:** Create/Import Project → Upload one/many photos or choose blank canvas → Analyze & propose dimensions → Generate validated voxel Block Model → 3D/2D edit → Materials/validation → Build Mode → Save/Export/Restore. Every step allows return to editing.

## 2. Product principles

- **Single source of truth:** authoritative Canonical Block Model. Viewer, blueprint, materials, construction sequence, visibility, exports and dimension statistics are projections; caches are invalidatable, not independent truths.
- **Minecraft-first:** only known valid target-version block IDs, block states and geometries; geometry must reflect actual game shape. Do not represent curving roofs or gridded slanted glass panes that cannot be built. Approximate with real stairs/slabs/trapdoors and state the trade-offs.
- **Editable and reversible:** all placements/replacements/moves/AI edits are transactions supporting preview, validation and undo/redo.
- **Non-destructive:** original AI proposal frozen; working revisions plus snapshots, with separately versioned construction progress.
- **Honest uncertainty:** no assertion of invisible dimensions/rooms. Keep per-region/block `observed`, `inferred`, `ai_estimated` source/confidence and editing provenance.
- **No fake capabilities:** provider integrations, model selection, browser tests, game format exporters and tests must be real; unavailable functions shown as unavailable with a reason.

## 3. Scope and platform

- Web app: desktop, tablet and mobile. Dark, sophisticated architectural portfolio rather than pixel-bordered control clutter.
- Prefer Next.js + React + TypeScript, Tailwind/shadcn for UI, React Three Fiber / Three.js / Drei for 3D, Zustand or equivalent for state, IndexedDB/Dexie for storage, Vitest/Testing Library/Playwright for tests; adapt to existing repo where justified.
- Default local-first projects; cloud sync and multiplayer outside first release.
- Game version registry uses Java 1.20.1 Vanilla; architecture supports other versions, but do not claim support without corresponding data/tests.
- Support multiple projects, project backups, edit history, autosave status, version/schema migrations.

## 4. Photo intake and building analysis

Input one or many uploaded images: real architecture, exterior/interior, plans or Minecraft screenshots. When multiple, reconcile multiple sides and interior angles. When one, state the back/interior is estimated. Analyze:

- Overall silhouette, widths/depths/heights, proportions, direction, stories and roof typology.
- Walls/material textures/colors, entrances, fenestration sizes and spacing, verandas, columns, overhangs, stairs, patios, gardens and landscape.
- Exterior depth relationships and likely floor-by-floor interior layout; separate known, inferred and unknown facts.
- A suggested Minecraft grid size (e.g. 25w × 18d × 14h only as illustrative, not fixed), ground reference, orientation and user-adjustable detail level/scale.
- Prioritize silhouette → proportion → roof → facade features → windows/doors → palette → iconic decorations → minor detail.

Produce a structured analysis with uncertainty, a dimension proposal and evidence references. User may change dimensions before generation. Mark **AI Estimated Area** visibly; do not hallucinate true measurements.

## 5. Canonical voxel / block data model

- Axes: X left/right, Y up, Z front/back; define origin, Minecraft north mapping and 90° transforms unambiguously; coordinates must be signed integers.
- Each occupied cell has one BlockRecord: stable record identifier, `id` (`minecraft:` namespace), `{x,y,z}`, `state` dictionary, functional category, `source` confidence/region/observed-vs-inferred, editing provenance, optional component group, construction metadata.
- Sparse indexed storage recommended; air means absence and is never counted as a material.
- Paired/multicell structures: store occupied cells and logical structure identities; enforce consistency and atomic edits. E.g. door top+bottom two cells but ordinarily one inventory door item. Beds, tall plants, etc. handled via version-aware rules.
- Derived statistics: bounds, building dimensions, levels, material cells and item inventory, visibility groups, geometry, construction phases, export. No manually invented counts.
- Transactions: `place/remove/replace/setState/fill/transform/applyAiProposal` with preflight preview, collision policy, apply and reverse changes; errors leave canonical state unchanged. Every batch edit is one undo command.

## 6. Minecraft block registry and genuine rendering

- Versioned registry with valid block IDs, allowed properties/value sets, defaults, inventory item mapping, max stack size, structural support/connection rules, geometry and texture metadata.
- Block Palette: search by English/Chinese/localized name and ID, thumbnail previews, categories, current selection, favorites, recently used. Categories: Structure, Wood, Stone, Concrete, Terracotta, Glass, Doors, Stairs, Slabs, Fences, Walls, Decoration, Lighting, Landscape.
- Facing/shape-specific meshes for stairs (facing/half/shape), slabs (top/bottom/double), doors (facing/half/hinge/open), trapdoors, axis logs, panes/fences/walls with neighbor connections, beds, plants, walls and relevant special shapes. State conversion on move/rotate/mirror must be correct.
- Do not present plain cubes as full fidelity where state-dependent geometry is required. Use appropriately licensed assets; do not redistribute Minecraft textures without verifying licensing.
- Distinguish normal placement, survival obtainability, physics/support and finished-world stability; report restrictions/temporary scaffolding rather than rejecting an otherwise constructible target.

## 7. Homepage and project dashboard

Hero headline: **REAL HOUSE → MINECRAFT BUILD**; subline: *From Architectural Inspiration to Buildable Blocks*. Display original uploaded photo beside a genuine rendered model, optional original-vs-Minecraft slider. Show width/depth/height, stories, occupied block cells, actual inventory items, distinct materials and estimates. Provide Create Project, Upload Photo, Empty World, Import Model, Continue Project. Professional dark architecture portfolio style with whitespace, natural lighting and focused controls; avoid distracting full-grid black outlines and fake numbers.

## 8. 3D Viewer / inspection

- Full orbit, pan, zoom, reset/focus; isometric/top/front/back/left/right presets; keyboard and touch support.
- Click/raycast actual block cell and show correct block name, ID, X/Y/Z, category, state and provenance; hover/selection outline subtle.
- Cutaway by X/Y/Z planes, hide roof, current layer and beneath, full model, interior peek, filter/highlight materials, search block type.
- Ghost not-yet-built cells translucent, finished cells solid; selectable opacity. Exploded View separates logical Foundation/1F/2F/Roof groups visually but never edits true xyz.
- Visuals: actual Minecraft voxel shapes and materials, soft directional/ambient illumination, appropriate shadow and non-intrusive grid.

## 9. Complete 3D building editor

View/Edit/Build modes. In Edit Mode support:

- Place against selected surface normal at adjacent cell, Remove, Replace, Eyedropper, Select, Move, Copy, Duplicate, Delete, Rotate, Mirror, Set Block State. Construction/work plane enables building in blank space.
- Preview transparent ghost of intended placement/operation with valid vs invalid feedback and collision handling.
- High-speed tools: Line, Wall (height/thickness), Rectangle/Hollow Rectangle, Filled Rectangle, Solid/Hollow Box, Paint Brush (size/shape/surface-only), Flood Fill, Replace All, Replace Selected Material, Extrude, Duplicate Layer. Large operations preview first, support cancel and reversible commit.
- Multi-select / 3D Bounding Box, move/rotate by 90-degree increments, mirror X/Z. Coordinate and block state remapping must preserve intended orientation, hinge, connected-neighbor information.
- Reusable components with relative positions and block states: window, balcony, doorway, pillars, roof section, staircase. Paste with an explicit collision policy (cancel / replace / skip occupied).
- Desktop: click action based on tool; configurable right-click remove/context, middle eyedropper, Shift additive selection, Ctrl+Z and Ctrl+Shift+Z redo, Esc cancel. Camera gestures must not conflict with editing.
- Mobile: clear Camera/Place/Remove/Select mode, single-touch action, two-finger zoom/pan, large tool targets, floating tools, Undo/Redo; no mouse-only essential operations.

## 10. Directly editable 2D Blueprint

- Top-down per-Y X–Z grid with coordinate labels, materials legend/color coding, empty air cells, zoom/pan and selection highlight.
- Click/drag paint, remove, replace, line/rectangle/fill, box selection, copy/paste and duplicate to Y levels. Block state inspector available for selected cell.
- **Bidirectional binding**: 2D edits instantly update 3D, and 3D edits instantly update 2D using the SAME canonical store. Highlight selected correspondence across views.
- Per-layer summary: layer index, Y, occupied cells, distinct materials, quantities and construction notes.

## 11. AI-assisted editing

- Natural language edits for all or a selected region, e.g. replace white concrete with smooth quartz, raise windows two blocks, add a valid skylight or roof, improve an interior staircase.
- Pipeline **Prompt → scoped structured proposal → schema/version validation → 3D diff preview → user approval → atomic transaction**.
- Proposed actions must be finite typed block additions/removals/replacements/state changes/transforms with size limits. Provider cannot execute arbitrary code or write canonical state directly.
- Keep prompt, scope, provider metadata, accepted diff and timestamp in revision log; fully undoable. Warn on edits impacting previously completed construction.
- No fabricated tool outcomes, no unapproved paid API usage. AI unavailable: manual editor still functions.

## 12. Y Levels and construction progress

- Independent sliders: **Y LEVEL** and **BUILD PROGRESS**. Modes show one layer, all blocks at or below selected Y, ghost layers above, or full model.
- Per-layer grid, block count, material item needs, instructions, completion status; Prev/Next/Jump Y.
- Progress 0–100% freely scrubbable forward/backward, derived from deterministic construction steps (foundation, floor, 1F walls, openings, stairs, upper floors, roof, decor, landscape) adapted to actual building. Not one-time animation or solely Y sort.
- Construction graph considers placement dependencies, support, scaffolding, reachability as far as algorithmically feasible; warnings if placement order might require temporary blocks. User can inspect step orders and progress independently of actual completion status.
- Ghost Completed House and Exploded View operate on projections, never mutate block data.

## 13. Materials / inventory

- Automatically compute **Total Occupied Block Cells** separately from **Total Inventory Items**; validate logical multicell structures and item mapping.
- Every item: ID/name, functional category, required items, max-stack size, full stacks/remainder, prepared quantity, missing quantity, checklist status (not collected/partial/ready). Non-stackable/special items handled correctly; note unavailable survival items.
- Group Structure/Walls/Floor/Roof/Windows/Doors/Decoration/Landscape based on design usage rather than solely ID. Editable user category metadata must not corrupt block identity.
- Materials recalculated after each transaction and design revision; no manual fake statistics.

## 14. Build Mode and saved construction history

- Dedicated build interface with current Y, current phase, blueprint, ghost remaining work, next steps, material checklist, layer completion and partial-region completion.
- Store completed layers/blocks (prefer stable references or version-aware diffs), material prepared status, timestamps, last view/step and overall progress in IndexedDB.
- On design edit, compare last approved build design vs new design. Surface added/changed/deleted construction requirements without silently pretending a previously built wall became a new window.

## 15. Projects, history, offline persistence

- Multi-project dashboard; stable UUID, title, game version, reference image metadata, original AI snapshot, current model, edit history, custom components, inventory, construction status, camera/view prefs, timestamps and schema version.
- IndexedDB/Dexie for large records with autosave states (Saving, Saved, Unsaved, Failed), load/rename/duplicate/delete and confirmation for destructive operations.
- Save milestone snapshots, compare and restore; restore original AI design through explicit confirmation. Include schema migration.
- Do not commit or expose uploaded private photos to a public repo. User-generated project data stays local unless explicitly uploaded.

## 16. Imports and exports

- Download full model JSON and complete XYZ CSV, materials CSV/JSON, full project backup, construction progress backup. Reimport must validate schema, coordinates, duplicate positions, game version, block states and logical structures.
- JSON/CSV must reflect SAME canonical data as viewer and 2D grid; export roundtrips must preserve state/provenance as applicable.
- Optional, later: correct Java Structure NBT `.nbt` and Litematica `.litematic` encoding/reading with external-format validators and in-game test. Renaming a JSON file extension is never adequate. Do not mark these as complete before actual format support.

## 17. Minecraft buildability validation

Rules per game version: block ID and legal states, one occupant per coordinate, multicell pairing, support/attachment, neighbor connectivity, gravity/fluid constraints, survival attainability, construction dependencies, logical impossibilities. Severity `ERROR`, `WARNING`, `INFO` and actionable diagnostics by XYZ. Distinguish unsupported asset, placement-order limitation and world-stability limitation. Validation cannot infer that a mesh is buildable simply because it visually looks like Minecraft.

## 18. UX and responsive layout

Desktop: top project/mode/save/undo/export; left palette/tools; center large 3D viewer with optional 2D split; right inspector/states/materials/validation; bottom Y Level/progress. Resizable/collapsible panels.

Mobile: large touch viewer, bottom sheets/tabs/floating toolbars; camera versus editing mode separation; single-finger tap vs two-finger navigation; accessible sliders/buttons; blueprint/material list individually expandable; no horizontal overflow/overlapping controls. Light/dark accessibility contrast, keyboard focus, reduced-motion where appropriate.

## 19. Rendering/performance

Handle sparse models from thousands toward tens of thousands of blocks. Chunk-based data/mesh updates, instancing or greedy/merged meshes where appropriate, hidden-face culling, transparent-block separation, frustum culling, material batching, spatial indexes and optimized picking. Modify impacted chunks/neighbors rather than rebuilding everything. For expensive validation or edits use cancellable worker tasks and bounded memory. Record measured FPS/picking/edit latency on tested hardware rather than asserting guaranteed performance.

## 20. Higgsfield / multimodel integration boundaries

- At M0 discover actual Codex Cloud connectors, permissions, available GPT model tiers, subagent/worktree features, network and secret management. ChatGPT-connected Higgsfield tools **do not prove** same access in Codex Cloud or production browser runtime.
- ChatGPT Higgsfield catalog check (2026-10-19) exposed `sam_3_3d`, `image_to_3d`, `multi_image_to_3d` as 3D **GLB mesh** models, not Minecraft XYZ/Block State exporters. May be used as optional visual/geometry reference after authorization; never substitute GLB for block records.
- Architecture should support `AiVisionProvider`, `ImageToMeshReferenceProvider`, `BlockPlanProvider`, `AiEditProposalProvider`, each capability-tested with validated outputs and feature flags. A provider may be disabled while core editor works.
- End-user website must have independently authorized server-side API integrations and usage billing. Never expose personal plugin tokens in client code, assume users can use the owner's ChatGPT plugin credentials, or trigger paid provider calls without informed user action.

## 21. Agent strategy and delivery policy

- High reasoning/Lead owns core contracts, transformation math, validation design, structured proposals, architecture decisions, complex integration, critical PR reviews. Medium owns isolated UI/features within frozen contracts. Low owns small style/docs/fixtures. Actual tier selection and spawning must be confirmed; otherwise use available tooling and report limits, not pretend to have delegated.
- Parallelize independent modules only after typed interfaces and file ownership are frozen. Each subtask returns touched files, tests, results and risks; Lead reviews and runs integrated regression.
- Milestone gates M0–M10 are defined in `ROADMAP.md`; specific tests in `TEST_PLAN.md`. Every gate needs reproducible executed evidence and committed recovery point.

## 22. Minimum full-product acceptance

Real uploaded image → honest visual/structure analysis → generated **legal** voxel model → rendered 3D with inspectable exact XYZ → edit in 3D and 2D with consistent states → batch tools/undo/redo → accurate inventory vs cells → layered, scrub-friendly construction → saved/reloaded project and progress → exported/reimported data → tested desktop/mobile flows. Missing, mocked or external-service-blocked steps must be disclosed accurately.

## 23. Non-goals / deferred

Minecraft Bedrock, multiplayer collab, cloud account sync, generic modded block assets, arbitrary modded physics, automatic full interior inference accuracy, guaranteed survival-cost bill of materials for every edge case, native `.litematic` before compatibility validation, claims of pixel-perfect image-to-world reconstruction. Implement as future extensions only after core correctness.

## 24. Definition of done

For each milestone: working code, tests executed, failures fixed, README/docs updated, Git commit(s), exact report with PASS/FAIL/BLOCKED. Do not write 'complete' for design-only work. M10 requires successful critical unit/integration/E2E and model-export consistency tests, feature capability audit, full workflow demo and known limitations report.