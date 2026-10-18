# M0–M10 execution roadmap — conditional delegation and gated tests

**Owner:** selected High-reasoning lead agent. Model tier and subagent support must be **probed**, not invented. Every phase: PLAN → DELEGATE (only when supported) → IMPLEMENT → TEST → REVIEW → INTEGRATE → REGRESSION → COMMIT → GATE.

Each milestone produces `docs/progress/M<n>.md`: branch/commit, changed files, implemented work, exact executed commands, results, integration evidence, unresolved defects, gate = **PASS / FAIL / BLOCKED**. Do not mark a gate PASS based on documentation alone. Separate checkpoints enable resuming Codex Cloud tasks without relying on prior conversation history.

## Milestones

| Phase | Lead ownership | Delegatable work (only when interfaces fixed) | Acceptance gate |
| --- | --- | --- | --- |
| **M0: Environment & contracts** | High: inspect repository, tool/agent/MCP capabilities, define architecture and coordinate/registry contracts | Medium: scaffold setup; Low: environment inventory/docs | Runnable skeleton, installed dependencies, reproducible typecheck/lint/test/build commands *actually executed*, architecture and capability audit recorded |
| **M1: Canonical engine** | High: sparse voxel indexing, versioned state registry strategy, logical multi-block, transaction/undo/redo | Medium: fixtures and unit tests | Deterministic CRUD, duplicate prevention, state validation, atomic batch rollback, undo/redo and JSON roundtrip pass |
| **M2: Correct 3D viewer** | High: coordinate-to-mesh mapping, state-aware geometry, raycasting/picking | Medium: camera presets, inspector; Low: toolbar styling | Viewer displays test structure with accurate shapes, camera controls work, picking returns actual XYZ and block state |
| **M3: 3D basic editing** | High: placement/edit command integration, work plane, collision/preview | Medium: block palette and inspector | Place/remove/replace/eyedropper/selection/undo/redo execute against canonical store; camera and edit gestures don't conflict |
| **M4: Advanced editing** | High: batch transactions, rotation and mirror state remapping | Medium: tool UI, components browser | Wall/line/box/fill/copy/rotate/mirror tested; door/bed/stair/slab invariants; undo of batch is atomic |
| **M5: 2D blueprint** | High: synchronized canonical selectors and roundtrip | Medium: interactive grid and layout; Low: legend | 2D edits update 3D immediately; 3D edits update 2D; y-level/XYZ/air consistency validated |
| **M6: Materials & building** | High: item mapping, construction ordering, progress reconciliation | Medium: checklist, progress panels | Distinguish cells/items/stacks; Y slider and progress independent; ghost and exploded are view-only; completion persists correctly |
| **M7: Persistence/exports** | High: schema/import/export integrity review | Medium: IndexedDB, dashboards and export UI | Save, refresh and restore original states; version snapshot; CSV/JSON roundtrip; build checklist retained |
| **M8: AI/Higgsfield** | High: provider capability tests, AI structured schema, bounded diff validation | Medium: upload, AI panel, preview UI | Real image analysis or clearly blocked provider; validated voxel proposals; uncertainty metadata; no paid call without approval; human-confirmed AI edits |
| **M9: Responsive/performance** | High: investigate critical bottlenecks/picking correctness | Medium: phone/tablet UI; Low: static styling | Touch editing and camera tested; 1k/10k/50k block profiling measured, no unbounded freeze; no misleading performance claims |
| **M10: Release E2E** | High: integration audit and final acceptance | Medium: E2E scripts and docs | End-to-end Create → Import/Analyze → Edit 3D/2D → Materials → Save/Reload → Build → Export on real browser; all critical regressions pass |

## Dependency graph

```text
M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10
           │       │         │         │
           ├─ independent component UIs may run in parallel
           └─ AI feasibility spike may run earlier with mock providers
```

The sequence is a conservative default: **parallelize isolated UI and research only when APIs and file ownership are fixed**. M7 persistence can begin earlier once M1 schema is stable. A photo-to-block proof of concept should be investigated during M2–M4 to expose uncertainty/cost before full M8 implementation, but must not block the manual editor.

## Gate requirements for every phase

1. Specify expected inputs/outputs, affected paths, agent owner and acceptance test names.
2. Run `typecheck`, `lint`, relevant unit/integration tests; at appropriate gates use Playwright browser tests and full regression.
3. Show evidence: commands, exit codes, commit SHA and representative assertions/screenshots where possible.
4. Review changes against architectural invariants; fix broken tests without weakening meaningful assertions.
5. If failing, mark **FAIL** and repair; if external service unavailable, mark **BLOCKED** with exact cause. Continue only demonstrably independent tasks.
6. Commit a coherent checkpoint; document next exact task so execution can resume after cloud/session limits.

## Release meaning

Do **not** call the full product completed just because M0 or a mock AI demonstration passes. A prototype may be released in slices only with an explicit list of tested functions, missing functions and environmental limitations. Avoid stating an estimated completion time or background progress where no task has been scheduled.
