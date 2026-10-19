# Architecture and contracts

**M0 decision record, 2026-10-19 (Asia/Singapore).** Product scope remains governed by [MASTER_SPEC.md](MASTER_SPEC.md). Implemented M0 boundaries are in `src/core/contracts.ts`, `coordinates.ts`, `registry.ts`, and `project.ts`. The command engine, registry ingestion, renderer and storage are planned; interfaces do not establish those implementations.

## ADR-001 — local-first application and dependencies

Use React + TypeScript + Vite, npm with an exact dependency manifest and generated package-lock. This amends the Next.js preference, not the product requirements: the initial editor has no server rendering/account requirement, and its core must run without AI credentials. A future authorized server adapter can be added separately. No Next.js/Tailwind/shadcn/Three.js dependency is needed to prove M0. Add R3F/Three.js in M2 and IndexedDB/Dexie in M7 after their boundaries are tested.

Node >=22.12, strict TypeScript, ESLint, Vitest. Commands: `npm ci`, `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; `npm run check` aggregates the gates. Selected package versions reflect locally available packages, not a claim to be the latest. Do not expose the development server publicly. Recheck dependency security before deployment.

## ADR-002 — canonical coordinate system

- One block is one unit. Integer position identifies the cell minimum corner; occupied extent is [x,x+1) × [y,y+1) × [z,z+1).
- Project origin is a user-independent local reference at cell (0,0,0), not an implicit world spawn. +X east/right, +Y up, +Z south/depth; north = −Z, east = +X, south = +Z, west = −X.
- Plan view has north at top and east at right. Cell center is xyz + 0.5; point-to-containing-cell uses floor, including negative numbers.
- Runtime constructor requires finite safe signed integers and an editor resource/precision bound of ±30,000,000 on each axis. This bound is NOT a Minecraft world/dimension validity claim. World placement offset, dimension height and border checks remain separate validations.
- Clockwise 90° on a north-up XZ plan maps (x,y,z) to (−z,y,x), rotating around the origin cell center. Around pivot p: p + R(v−p). Directional state remapping is a separate M4 registry-backed operation; coordinate rotation alone is not enough.
- Initial render-space axes equal canonical axes; rendering uses cell centers. M2 face-aware picking must use the instance→cell mapping or tested face-normal bias, not naive floor on a boundary.
- Exploded/ghost/cutaway views affect projections only. Never write mesh positions back into canonical state.

## ADR-003 — stable model and evidence

`BlockRecord` contains uid, versioned Minecraft ID, integer position, complete normalized property dictionary, independent evidence and edit provenance, optional design category/component/logical structure/construction phase. Air is absence, never a stored material. Both coordinate and UID uniqueness are required.

`Evidence.origin` is observed/inferred/ai_estimated/user_created. Confidence, when present, is finite 0–1. Editing an estimated roof preserves its evidence and updates `edits`; it does not turn the origin into observed. Move/setState preserve UID; replacement with a different block identity gets a new UID. Snapshot restores preserve the saved identities, with a fresh design revision.

Sparse storage will use private `Map<coordinateKey, BlockRecord>` plus a UID index. Published snapshots must be deep immutable or defensive copies; a TypeScript ReadonlyMap alone is insufficient. No feature owns a second authoritative grid. M0 only creates an immutable empty model.

Schema 1 canonical envelope: exact `schemaVersion: 1`, `minecraftVersion: "1.20.1"`, `coordinateConvention: "x-east-y-up-z-south"`, project id/title, designRevision, blocks and logicalStructures. This is not yet a full backup/import implementation. M7 must version the full project envelope with references, original AI snapshot, revision history, custom components, build progress, prepared items and view preferences; migrations reject unsupported versions rather than silently dropping fields.

## ADR-004 — versioned registry and item mappings

Source selected and inspected through GitHub:
- `minecraft-data@3.117.0` wrapper commit `94b717a14e167afdbcdfe708f40f7eed8917fe08`.
- Data submodule commit `15411f050f040e4c5df09352a75a9912ad8c3eeb`.
- Pinned [dataPaths.json](https://github.com/PrismarineJS/minecraft-data/blob/15411f050f040e4c5df09352a75a9912ad8c3eeb/data/dataPaths.json) maps Java 1.20.1 blocks/items to `data/pc/1.20`; version metadata to `data/pc/1.20.1`.
- Inspected source: 1,003 blocks and 1,255 items. Blocks blob `f265dc1be54a0b7d6ee60a541c5c5df2c075a51d`; items blob `d00049aa169472e75bc3a953ba5e960995f397d1`.
- [Wrapper metadata](https://github.com/PrismarineJS/node-minecraft-data/blob/94b717a14e167afdbcdfe708f40f7eed8917fe08/package.json) and [data README](https://github.com/PrismarineJS/minecraft-data/blob/15411f050f040e4c5df09352a75a9912ad8c3eeb/README.md#license) declare MIT. Retain upstream source-rights caveat concerning wiki.vg/minecraft.gamepedia-derived data. This does not license Minecraft textures. No game assets are included.

M1 will ingest a pinned, reproducible projection of IDs, ordered property domains, defaults and item stack limits, with source hashes and attribution. Missing data must fail closed. M0's `normalizeState` applies defaults, rejects extra properties and rejects illegal values against an explicit entry. Its tests use **synthetic fixtures**, not an imported production registry. Namespace syntax alone does not validate a real block ID.

Inventory rules are explicit: per-cell mapped item quantity; slabs one item for top/bottom and two for double; valid linked doors/beds/tall plants count once per logical structure. Validate membership, anchor, adjacency and related states before counting. Never use mining drops as placement requirements (stone drops cobblestone; bed drops may be empty in this source).

Item stack maxima come from items, not always 64 (red bed=1). Output separates occupiedCells, known item requirements and unresolved block UIDs/reasons; totalInventoryItems is null while anything is unresolved. Unknown/non-obtainable/special rules must not silently contribute zero. Placement items and survival obtainability are distinct. Per-category presentation must allocate each logical structure once. Physics/support/neighbor stability are rule adapters, not guaranteed by syntactically legal states.

## ADR-005 — atomic edit state machine

Intent → bounded candidate diff → default normalization → preflight → preview → commit (recheck preconditions) → new immutable snapshot + inverse history. Cancel never publishes. Manual command preview uses the same engine as 2D/3D/import; AI additionally requires explicit human approval of the exact bounded proposal.

`EditTransaction` carries id, baseRevision, cause, collisionPolicy, cell before/after changes and logical-structure before/after changes. M1 must enforce:
1. Bounded batch size, unique positions and UIDs; change.pos equals both non-null records' positions; no before=null/after=null no-ops.
2. Exact current base revision and before-images; a preview is not a reservation.
3. Collision cancel/replace/skip resolved into an explicit accepted diff. A skipped half of a structure may not leave an invalid pair.
4. Validate the full prospective state, including pair membership and required neighbor updates, before swapping authority. On error publish nothing, including no history/index changes.
5. Commit stores exact inverse and accepted normalized diff. Undo/redo replay accepted data, not AI/intent or newly randomized rules. Every undo/redo creates a fresh revision, so stale previews stay stale. New edits clear redo.
6. Typed and separately versioned construction progress keeps approvedDesignRevision. Reconcile added/removed/changed content against that design; UID alone does not imply completed construction remains valid.

The engine interface is frozen for M1 implementation; M0 does not claim CRUD/rollback/undo behavior is implemented.

## Modules and dependency boundaries

| Module | Responsibility | Must not own |
| --- | --- | --- |
| core/blocks | Private sparse store, UID index, bounds and serialization | Renderer transforms |
| core/registry | Java 1.20.1 domains/defaults, item mappings, rule metadata | AI-guessed IDs |
| core/commands | Atomic preflight/commit/undo/redo | Independent model |
| core/validation | Syntax, pairing, support, stability diagnostics | Cosmetic approximations |
| core/geometry | State-aware shapes | Invented blocks or licensed textures |
| features/viewer | R3F cameras, picking, view masks | Material counts |
| features/blueprint | XZ-per-Y selectors and engine commands | Separate grid |
| features/materials | Inventory projections/checklists | Hand-entered design totals |
| features/build | Dependency order and revision reconciliation | Direct edits |
| features/projects | IndexedDB, snapshots/migrations/backups | API credentials |
| integrations/ai | Capability-tested structured proposals | Unchecked canonical mutation |

Render state starts with a cell/mesh-instance lookup, later chunk-local invalidation and batching. Geometry, transparent handling and picking require M2 actual browser tests. Performance targets remain unmeasured. Deterministic fixtures grow from negative coordinates/empty model in M0 to paired doors, beds, double slabs and transactional walls in M1, then a two-floor house in M2.

## Providers, persistence and security

Separate AiVisionProvider, ImageToMeshReferenceProvider, BlockPlanProvider and AiEditProposalProvider. `MeshReference` and `VoxelProposal` are distinct tagged contracts; GLB is never a block plan. Runtime schema, version, scope/count, registry, structure and conflict validation remain mandatory even after a successful provider response.

No live provider is wired into this app. ChatGPT connector access does not establish production credentials/permissions. No paid generation without explicit cost approval; no secrets or private photos in Git/browser bundles. Limit all imports/proposals before allocating large data. IndexedDB saves must expose saving/saved/unsaved/failed and migration errors; JSON/CSV must derive from the same snapshot. NBT/Litematic require independent format and eventual in-game checks.

## M0 verification scope

Coordinate tests exercise negative flooring, key uniqueness, axes, quarter-turns, boundary precision and immutable outputs. Contract tests exercise empty schema/version defaults, evidence confidence and synthetic state normalization; a type-level negative test prevents treating a mesh reference as a voxel proposal. These do not establish game registry coverage, renderer picking, inventory computation, atomic transactions, persistence or live AI. See [progress/M0.md](progress/M0.md) for executed command evidence and gate.
