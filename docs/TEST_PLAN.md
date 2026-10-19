# Verification and regression plan

**Status:** M0 passed with 26 unit tests and browser-startup evidence. M1 expands the suite to 52 passing tests across four files, with executed typecheck/lint/build and pinned-registry regeneration; see [M0 report](progress/M0.md) and [M1 report](progress/M1.md). M2 adds real viewer/raycast/browser tests (105 unit tests total plus 6 browser tests); see [M2 report](progress/M2.md). M3–M10 criteria remain required and unexecuted.

## Test levels

1. **Unit tests — Vitest:** canonical keying, immutable snapshots, transaction rollback, undo/redo, registry validation, material counts, transforms and inventory item mapping.
2. **Integration tests:** 3D command / 2D selector updates; construction state reconciliation after design changes; save-load-export identity.
3. **Browser E2E — Playwright:** create blank project, build a small structure in 3D, edit same cells in 2D, inspect materials, save/reload, switch build mode, export. Test desktop and mobile viewports, pointer/touch behavior, and resize.
4. **Minecraft compatibility tests:** verify IDs/property values against a reliable Java 1.20.1 registry, directional block geometry, multi-cell logical invariants and physically meaningful placement warnings. Exported NBT/Litematic (only once implemented) must parse back with an independent validator and eventually be checked in Minecraft.
5. **Performance tests:** profile model+renderer under controlled 1,000, 10,000 and 50,000 block fixtures. Record device/browser, FPS/interaction latency and peak memory. Do not promise all fixtures are smooth until measured.
6. **Regression:** rerun relevant suites on every merge; full suite at cross-system gates M5/M7/M10.

## Mandatory invariants

| Test ID | Scenario | Expected |
| --- | --- | --- |
| VXL-001 | Insert same xyz twice | No duplicate occupied cell; explicit collision policy |
| VXL-002 | Place and remove one block | Store, picking and 2D agree |
| VXL-003 | Batch wall command then undo | All cells revert as one transaction |
| VXL-004 | Invalid block ID/state | Rejected with no partial mutation |
| VXL-005 | Door top/bottom / bed parts | Valid paired structures, atomic edits |
| VXL-006 | Rotate stairs/doors/logs | Proper facing, hinge/axis and shape remap |
| VXL-007 | Mirror window & roof module | XYZ and directional states transformed |
| VXL-008 | Material replacement across level | Cells and inventory items updated correctly |
| VXL-009 | Ghost / exploded mode | Canonical coordinates unchanged |
| VXL-010 | 2D edit → 3D / 3D edit → 2D | Same underlying cell and state |
| VXL-011 | Slider at Y=4 | Correct show-only / show-through-4 semantics |
| VXL-012 | Build progress drag forward/back | Deterministic construction order and visibility |
| VXL-013 | Save / reload / JSON+CSV export | Correct cell/states/data version roundtrip |
| VXL-014 | Design edit after build progress | Diff flags newly required/reworked cells |
| VXL-015 | AI proposed diff | Schema, bounded region, registry and conflicts validated before approval |
| VXL-016 | AI provider unavailable | Honest error; manual editor still functional |

## Fixture coverage

- A small **two-floor house** with stairs, right/left orientation, roof and windows; deterministic exact cell counts.
- Doors occupying two cells but one inventory item; slab doubles and nonstackable/special items.
- Negative coordinates, boundary cells, empty world, roof cutaways and combined transformations.
- Transparent panes, fences/walls neighbor variants and log axis rotations.
- AI inferred versus observed provenance, modified estimated area, safe restoration of original snapshot.
- Corrupt/oversized JSON/CSV import must not crash or accept bad states.
- Simulated storage failure and mid-save interruption must show unsaved/error state.

## Coverage and measurement

Target **≥90% branch coverage for critical canonical model and transactional functions**, subject to actual test instrumentation. Do not present this target as a completed measurement. UI coverage relies on reproducible E2E scenarios rather than line percentage.

Every test report records:
- Exact command and working directory
- Timestamp/environment/browser/game version
- Test result (pass/fail/skip, reason)
- Relevant stdout/stderr summary
- Commit SHA
- Which requirements are validated vs mocked only

## Phased gates

- **M0**: running app skeleton, typecheck, lint, unit runner and production build; actual commands executed. Documentation-only does **not** pass M0.
- **M1**: VXL-001,003,004,005,013 canonical serialization subset.
- **M2–M3**: VXL-002 and picking XYZ; real browser click and edit controls.
- **M4**: VXL-006,007 + batch undo tests.
- **M5**: VXL-010/011 cross-module tests.
- **M6**: VXL-008/009/012/014.
- **M7**: VXL-013 full persistence/import/export and corrupted inputs.
- **M8**: VXL-015/016 plus genuine provider contract test when available; **never** bill generation merely for a mock test.
- **M9**: mobile touch E2E, accessibility and measured large-fixture profiles.
- **M10**: all applicable VXL tests, full E2E user journey, manual in-game review of supported Minecraft exporters.

## Defect handling

A failing required gate is **FAIL** until corrected and retested. A missing external service is **BLOCKED**; dependent AI claims remain unavailable. Never weaken assertions, silently skip failing tests, replace real behavior with permanent mocks or mark an unexecuted test green.


## M1 executed scope

`engine.test.ts` covers VXL-001/003/004/005 and the canonical JSON subset of VXL-013, plus immutable snapshots, stale revisions, explicit collision outcomes, evidence/identity preservation, logical-pair bounds and invalid input limits. `versioned-registry.test.ts` checks all 1,000 non-air registry defaults, actual Java state fixtures, stack sizes and conservative item rule metadata. No registry or engine mock is substituted. These tests do not establish renderer picking, materials aggregation, storage, full VXL-013, AI approval or game physics. Branch coverage is still unmeasured; the 90% target remains a target.

## M2 executed scope

Total 105 unit/integration tests in six suites, typecheck/lint/build, plus six Playwright real-browser scenarios passed at code commit ae7e5c653f0237482f159b536627efe0e930ae6a. See progress/M2.md and evidence/m2-e2e-summary.json. Covered: deterministic 288-cell fixture, stair state occupancy, slabs/doors/beds, actual Three.js raycasts including negative boundaries, transparent selection, camera pointer/keyboard/touch, center-reticle keyboard selection, focus across resize, real WebGL loss/restoration, empty/reload and mobile overflow. Screenshots were visually checked.

This satisfies M2 inspection only; VXL-002 placement/removal and editing still require M3. M3–M10 criteria, branch-coverage percentage, large-fixture performance and in-game acceptance remain unexecuted.
