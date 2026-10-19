# AI Minecraft Architecture Studio

**Specification-first development repository** — Minecraft Java Edition **1.20.1 Vanilla**  
**Status:** M0–M2 implemented and tested: canonical engine plus an interactive 3D inspection viewer. Editing, persistence, AI and deployment remain unfinished. See [M2 evidence](docs/progress/M2.md).

## Vision

Convert one or multiple architectural photos into an **editable and buildable Minecraft voxel structure**, not merely a generated picture or triangular mesh. A single canonical Block Model drives the 3D viewer, 2D editor, materials, construction progress, validation and exports. Players can modify blocks directly and then follow layer-by-layer building guidance.

## Start in Codex Cloud

1. Connect this **private GitHub repository** to Codex Cloud and select **High** reasoning for initial architecture.
2. Read [AGENTS.md](AGENTS.md) and [the full product specification](docs/MASTER_SPEC.md).
3. Paste [the continuation prompt](docs/WORK_START_PROMPT.md) into your initial Codex task.
4. Resume from **codex/m2-viewer** and [the M2 report](docs/progress/M2.md). M0–M2 have executed gates; next is M3 basic editing. Recheck the environment before relying on prior results.
5. Continue milestones using [ROADMAP](docs/ROADMAP.md) and [TEST_PLAN](docs/TEST_PLAN.md). Each stage must implement, test, review, integrate, regress, commit and record its gate decision.
6. Review any required MCP access, generation cost and environment secrets before use.

## Documentation map

| File | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Binding engineering, delegation, data-integrity and test rules |
| [docs/MASTER_SPEC.md](docs/MASTER_SPEC.md) | Authoritative full product specification |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Proposed modules, invariants, contracts and data flow |
| [docs/ROADMAP.md](docs/ROADMAP.md) | M0–M10 phases, dependencies and gates |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Layered tests and measurable validation |
| [docs/AGENT_TASKS.md](docs/AGENT_TASKS.md) | Agent delegation template and initial backlog |
| [docs/MCP_CAPABILITIES.md](docs/MCP_CAPABILITIES.md) | Verified ChatGPT versus unverified Codex/Higgsfield integrations |
| [docs/WORK_START_PROMPT.md](docs/WORK_START_PROMPT.md) | Ready-to-paste Codex Cloud start command |

## Architecture constraints

- Versioned canonical sparse voxel data store; integer XYZ and validated Minecraft block states.
- Atomic edit commands with undo/redo; **3D, 2D and exports must not diverge**.
- Minecraft multi-block items must not be counted by occupied-cell count.
- User-editable 3D and blueprint editing must work independently from paid AI services.
- Higgsfield-generated GLB/image output is **reference data**, not authoritative Minecraft block coordinates.
- High/Medium/Low delegation is conditional on **actual** per-agent model routing capabilities.
- No fake AI demos, invalid schematic formats, unlicensed texture redistribution or untested completion claims.

## Cloud, local and deployment

Use **Codex Cloud + GitHub** for main development. A separate local Minecraft Java test environment can validate exported structures in-game. GitHub stores source and checkpoints; it is **not** itself the deployed website. Deployment will be configured later in an explicit milestone.

Do **not** commit API keys or user-uploaded private building images. Keep secrets server-side and only enable billed Higgsfield generations after explicit user approval of cost.

## Development status

- [x] Private repository created and engineering documents committed
- [x] M0 environment and runnable app validation (see evidence report)
- [x] M1 canonical engine and pinned Java 1.20.1 registry (see evidence report)
- [x] M2 state-aware 3D inspection, camera controls, exact picking and real browser tests
- [ ] M3–M10 implementation and acceptance

Resume from `codex/m2-viewer` and the M2 report. Next: connect the tested engine APIs to M3 placement, removal, replacement and undo/redo controls.

## Run the inspection viewer

Node >=22.12 and npm are required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Inspect a 288-cell two-floor demonstration model, select blocks and navigate by pointer, keyboard or touch. The empty project and demonstration live only in memory.

```sh
npm run typecheck
npm run lint
npm test
npm run build
# Or run all four checks:
npm run check
```

The lockfile pins dependencies. The M0 environment installed from an existing offline npm cache; normal clean environments can use npm ci with registry access. Do not commit node_modules, caches, builds, personal photos or credentials.


## Browser validation and rendering scope

Run npm run verify:vendor to check the pinned Three.js source, npm run check for 105 tests/typecheck/lint/build, and npm run test:e2e for six real-browser scenarios. Install a Playwright Chromium browser first (npx playwright install chromium), or set BROWSER_EXECUTABLE_PATH to an available Chrome executable. The runner starts its own local test server.

Rendering uses schematic colors and a bounded state-aware cube/log/stair/slab/door/bed/glass set. Unknown shapes are wireframe markers with a warning. This is not full Minecraft texture/geometry coverage or a deployed website. Three.js r180 is included as an MIT-licensed, hash-verified runtime subset because direct npm access was unavailable during development; see vendor/three/PROVENANCE.md and ADR-007.
