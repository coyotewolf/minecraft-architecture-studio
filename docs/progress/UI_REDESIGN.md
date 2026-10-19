# Professional architecture workbench redesign

Code checkpoint: 48445e828e1c22a619981fa42ed60e1f3b76a740, branch codex/professional-studio-ui, based on the completed M10 branch.

Date: 2026-10-20. This is a follow-up to the bounded M0–M10 release, not a claim that all MASTER_SPEC capabilities or game acceptance are complete.

## Delivered interface

- Graphite, teal and warm-gold architecture workbench with a large lit voxel scene, left construction controls, right materials/inspector and a separate progress dock.
- Mobile layout puts the model first in the workspace; camera controls scroll horizontally, touch targets remain at least 44px, and materials/blueprint expand independently.
- Roof hiding, X/Z cutaway, material visibility/search highlighting, estimated-area highlighting, Ghost Completed House and exploded layers are view projections. Canonical XYZ values remain unchanged.
- Progress can move forward and backward. Y controls show through the chosen level. Layer completion records actual canonical UIDs, including atomic multi-cell members.
- Materials show canonical inventory totals, stacks, categories, preparation counts and checklist state. A layer panel shows that layer's materials and construction guidance.
- Existing editing, undo/redo, snapshots, original AI baseline, saved projects and validated backup import remain available in drawers.
- A readable player construction CSV adds separate block ID/name, XYZ, category, placement-state JSON and estimated-area columns. The existing lossless model CSV remains the import format.

## Reference model and supplied images

The supplied eleven images depict a large futuristic Minecraft concept base. They are not measured photographs. This release uses their glass greenhouse/atrium as a bounded reference interpretation: **33 X × 19 Y × 45 Z**, **6,137 occupied cells**, **6,137 inventory items**, **12 materials**. All cells carry `ai_estimated` provenance and are exposed as **AI Estimated Area**. Dimensions, rear facade and interior arrangement are design choices, not inferred measurements claimed as fact.

The model includes a foundation and floor, white ribbed barrel roof, cyan/light-blue glazing, warm accents, plants, entrance stairs, benches and a clear central aisle. Geometry/state validation is against the project's Java 1.20.1 registry; this does not establish survival placement, physics, lighting or in-game appearance acceptance. The full city, aircraft, dragons, machinery and other concept structures have not been reconstructed.

All eleven original images are available in the local reference gallery. Selection, notes and uploaded image Blobs persist per project in IndexedDB; selecting a different reference does not rebuild the canonical model. The main preview follows the selected reference. Images remain local and are ignored by Git. A fresh checkout without `public/local-references/manifest.json` offers local uploads. Reference images/notes are separate local board data and are not included in workspace JSON backups.

To provide a local gallery, create `public/local-references/manifest.json` with an `images` array of `{id,url,name,title,notes}` records; URL paths must be under `/local-references/`. Alternatively use the in-app upload control. The fixture is still available without these assets. `/?sample=house` opens the original small demonstration fixture in a fresh browser workspace.

## AI and Higgsfield

Actual task delegation used GPT-6 Astra medium for UI/reference integration and tests, and Astra low for styling and the atrium fixture. Higgsfield model discovery was executed; the returned capabilities were mesh generation, not a validated Minecraft block-plan provider. No generation job or paid call was made. Image/GLB results are not treated as coordinate models.

The existing configurable server-side AI adapter remains available. Without provider URL/key/model it is visibly disabled. No live photo-to-block AI quality or specific deployed-provider model execution has been validated. Uploaded reference-board images are not automatically submitted to AI.

## Acceptance evidence

- `npm run check`: PASS, typecheck, lint, **1,259 tests / 21 files**, client build and server build.
- Focused projection/CSV tests: PASS, **26 tests**; covers independent view transformations, reversible construction preview and formula-safe readable export.
- Full browser run: **45 passed / 1 test-harness failure / 46 total**, approximately 4.5 minutes. The readable CSV preserves canonical insertion order while the lossless JSON sorts coordinates; the test incorrectly required identical row order. After comparing all records sorted by numeric XYZ, the corrected desktop case passed separately (1/1, 12.4 seconds including startup). All 46 distinct cases passed across these runs; this is not claimed as one clean 46-case run.
- The original full results.json was overwritten by the targeted run. evidence/redesign-full-run-summary.json transparently records the captured full-run output and targeted statistics; it is not represented as the original full JSON report.
- npm run verify:vendor: PASS, four pinned upstream files.
- Desktop 1600×1050 and mobile 390×844 screenshots were inspected. Touch interaction is Chrome device emulation, not an on-device phone test.

### Production profile, Chrome 155 / SwiftShader

| Cells | Import ms | Pick ms | Orbit p95 ms | Remove ms | Undo ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 728 | 227 | 81.7 | 232 | 132 |
| 10,000 | 1089 | 316 | 146.5 | 682 | 308 |
| 50,000 | 3922 | 1235 | 615.3 | 2447 | 1796 |

All three production profile cases passed unchanged thresholds. **50k remains visibly slow**: approximately 0.6 seconds per orbit input update, with high sampled memory; this is not a smoothness or low-memory guarantee. See evidence/performance.json for raw samples and explicit build mode.

Automated checks cover actual model-derived materials, XYZ picking, layer grids, reversible progress, desktop/mobile interactions, local persistence, reference uploads, explicit estimated provenance and exports. They do not replace Minecraft in-game construction acceptance.

## Known limits

The original advanced-scope limits in RELEASE_SCOPE.md remain. Materials use authored procedural color/grain rather than licensed game textures. Special geometry is bounded by the renderer's supported shapes. Layer explosion separates Y layers rather than semantic building-storey assemblies. There is no comparison wipe or automatic multi-building reconstruction. Browser measurements on Chrome/SwiftShader are not guarantees for other devices; 50k models remain a stress case. No public deployment or merge was performed.

Performance investigation: the first redesigned 50k profile failed the unchanged 5,000 ms removal gate at 5,894 ms (1k/10k passed). The split panels redundantly recomputed construction order and inventory already derived by the root. Shared derived data and requestAnimationFrame coalescing were implemented. Development runs still failed removal at 6,098 ms, then 5,542 ms; a CPU-profiled run measured 5,318 ms. Profiling attributed about 2,039 ms to React development render logging and large-prop inspection. This is a retained development performance limitation, not a passing development gate.

Release performance is now explicitly measured against the compiled client and Node server on an isolated loopback port. Fixtures, public UI interactions and all time thresholds are unchanged. Each evidence record identifies production/development mode and origin. Set STUDIO_PROFILE_DEV=1 to reproduce the development route. Production and earlier development timings must not be compared as equivalent environments. The three profile cases in the final suite exercise production; the remaining functional cases exercise Vite development except the existing production-server smoke test.
