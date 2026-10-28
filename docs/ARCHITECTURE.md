# Architecture and contracts

**M0 decision record, 2026-10-19 (Asia/Singapore).** Product scope remains governed by [MASTER_SPEC.md](MASTER_SPEC.md). Implemented M0 boundaries are in `src/core/contracts.ts`, `coordinates.ts`, `registry.ts`, and `project.ts`. M1 adds the canonical engine and pinned registry described in ADR-006 below. M2 adds the tested viewer in ADR-007; persistent storage remains planned. Interfaces alone do not establish implementation.

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

M1 sparse storage uses private `Map<coordinateKey, BlockRecord>` plus a UID index. Published snapshots must be deep immutable or defensive copies; a TypeScript ReadonlyMap alone is insufficient. No feature owns a second authoritative grid. M0 only creates an immutable empty model.

Schema 1 canonical envelope: exact `schemaVersion: 1`, `minecraftVersion: "1.20.1"`, `coordinateConvention: "x-east-y-up-z-south"`, project id/title, designRevision, blocks and logicalStructures. This is not yet a full backup/import implementation. M7 must version the full project envelope with references, original AI snapshot, revision history, custom components, build progress, prepared items and view preferences; migrations reject unsupported versions rather than silently dropping fields.

## ADR-004 — versioned registry and item mappings

Source selected and inspected through GitHub:
- `minecraft-data@3.117.0` wrapper commit `94b717a14e167afdbcdfe708f40f7eed8917fe08`.
- Data submodule commit `15411f050f040e4c5df09352a75a9912ad8c3eeb`.
- Pinned [dataPaths.json](https://github.com/PrismarineJS/minecraft-data/blob/15411f050f040e4c5df09352a75a9912ad8c3eeb/data/dataPaths.json) maps Java 1.20.1 blocks/items to `data/pc/1.20`; version metadata to `data/pc/1.20.1`.
- Inspected source: 1,003 blocks and 1,255 items. Blocks blob `f265dc1be54a0b7d6ee60a541c5c5df2c075a51d`; items blob `d00049aa169472e75bc3a953ba5e960995f397d1`.
- [Wrapper metadata](https://github.com/PrismarineJS/node-minecraft-data/blob/94b717a14e167afdbcdfe708f40f7eed8917fe08/package.json) and [data README](https://github.com/PrismarineJS/minecraft-data/blob/15411f050f040e4c5df09352a75a9912ad8c3eeb/README.md#license) declare MIT. Retain upstream source-rights caveat concerning wiki.vg/minecraft.gamepedia-derived data. This does not license Minecraft textures. No game assets are included.

M1 ingests a pinned, reproducible projection of IDs, ordered property domains, defaults and item stack limits, with source hashes and attribution. Missing data must fail closed. M0's `normalizeState` applies defaults, rejects extra properties and rejects illegal values against an explicit entry. Its tests use **synthetic fixtures**, not an imported production registry. Namespace syntax alone does not validate a real block ID.

Inventory rules are explicit: per-cell mapped item quantity; slabs one item for top/bottom and two for double; valid linked doors/beds/tall plants count once per logical structure. Validate membership, anchor, adjacency and related states before counting. Never use mining drops as placement requirements (stone drops cobblestone; bed drops may be empty in this source).

Item stack maxima come from items, not always 64 (red bed=1). Output separates occupiedCells, known item requirements and unresolved block UIDs/reasons; totalInventoryItems is null while anything is unresolved. Unknown/non-obtainable/special rules must not silently contribute zero. Placement items and survival obtainability are distinct. Per-category presentation must allocate each logical structure once. Physics/support/neighbor stability are rule adapters, not guaranteed by syntactically legal states.

## ADR-005 — atomic edit state machine

Intent → bounded candidate diff → default normalization → preflight → preview → commit (recheck preconditions) → new immutable snapshot + inverse history. Cancel never publishes. Manual command preview uses the same engine as 2D/3D/import; AI additionally requires explicit human approval of the exact bounded proposal.

`EditTransaction` carries id, baseRevision, cause, collisionPolicy, cell before/after changes and logical-structure before/after changes. M1 enforces:
1. Bounded batch size, unique positions and UIDs; change.pos equals both non-null records' positions; no before=null/after=null no-ops.
2. Exact current base revision and before-images; a preview is not a reservation.
3. Collision cancel/replace/skip resolved into an explicit accepted diff. A skipped half of a structure may not leave an invalid pair.
4. Validate the full prospective state, including pair membership, before swapping authority. Game neighbor simulation is deferred and must not be inferred from state-domain validity. On error publish nothing, including no history/index changes.
5. Commit stores exact inverse and accepted normalized diff. Undo/redo replay accepted data, not AI/intent or newly randomized rules. Every undo/redo creates a fresh revision, so stale previews stay stale. New edits clear redo.
6. Typed and separately versioned construction progress keeps approvedDesignRevision. Reconcile added/removed/changed content against that design; UID alone does not imply completed construction remains valid.

The frozen command interface is implemented by `VoxelEngine` in M1. The historical M0 gate does not claim CRUD/rollback/undo behavior.

## Modules and dependency boundaries

| Module | Responsibility | Must not own |
| --- | --- | --- |
| core/blocks | Private sparse store, UID index, bounds and serialization | Renderer transforms |
| core/registry | Java 1.20.1 domains/defaults, item mappings, rule metadata | AI-guessed IDs |
| core/commands | Atomic preflight/commit/undo/redo | Independent model |
| core/validation | Syntax, pairing, support, stability diagnostics | Cosmetic approximations |
| core/geometry | State-aware shapes | Invented blocks or licensed textures |
| features/viewer | Three.js cameras, picking, view masks | Material counts |
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

## ADR-006 — M1 implementation and bounded guarantees

- `core/model.ts` validates unknown input into a detached, deeply frozen canonical snapshot. Exact schema/version/envelope fields, IDs/properties, coordinates, UID uniqueness, provenance and structure links are mandatory. Unknown fields fail closed. Air variants are never stored.
- `core/engine.ts` owns private coordinate/UID maps, immutable snapshots and history. Before-images and base revisions are rechecked at commit. Collision decisions, normalized states and edit provenance are captured in accepted history. Failed validation publishes nothing. New edits clear redo; undo/redo restore exact block and structure records while allocating a fresh design revision.
- Existing UID changes preserve block ID and evidence. Move/state updates stamp edit provenance; a different identity requires a new UID. Newly imported records and whole canonical snapshot restoration preserve saved provenance. Import transactions that merge into an existing UID retain its creation/modification history and stamp the current transaction. The engine API is an in-process boundary, not an authorization service; M8 must supply explicit approval around any AI adapter.
- Door and tall-plant anchors are lower parts, their other member is one cell above. Bed anchors are feet; the head lies one horizontal cell along facing. Members share ID, group link and all non-part state values. Every pair must be complete and referenced exactly once. Support, redstone, fluids, fence/wall neighbors and transient game simulation are not implemented. `minecraft:pitcher_crop` is rejected at model ingress because its conditional height across growth stages needs an additional rule.
- Limits: 50,000 occupied cells, 25,000 logical pairs, 10,000 combined cell/structure changes per transaction, 32 MiB imported canonical JSON text, 512-character identifiers/titles. These are safety bounds, not measured performance targets. Each commit validates the full candidate snapshot (linear in model size); M9 must measure and optimize before claiming interactive 50k support. History remains in-memory and is not persisted or capped in M1.
- Canonical JSON sorts object keys, cell coordinates and group IDs with locale-independent ordering. M1 roundtrip covers the design envelope only; M7 still owns storage, CSV, backup migrations and full project/build state. Construction inventory is only a rule contract and conservative registry mapping in M1; item aggregation and build reconciliation remain M6.
- UI integration remains the runnable M0 shell. M2 consumes the engine snapshot for geometry/picking; M3 owns editing gestures. No separate renderer grid is allowed.

See [REGISTRY_SOURCE.md](REGISTRY_SOURCE.md) for the pinned projection, regeneration procedure, source hashes and explicit unsupported inventory mappings; [progress/M1.md](progress/M1.md) records the executed gate.

## ADR-007 — M2 viewer and reproducible renderer boundary

M2 uses Three.js directly through one resource-owning adapter, rather than adding R3F/Drei before their packages are available. React owns the immutable canonical Project snapshot and selection UID; it passes read-only records and pure state-derived box geometry to the adapter. The adapter owns only meshes, camera, controls and disposal. This amends the renderer integration choice, not the canonical contract. The adapter is JavaScript with a narrow TypeScript declaration; its internals are covered by raycast and browser tests, but are not statically typechecked. Do not mistake the declaration for internal type safety.

- Every shape part carries the canonical UID. A hit maps to that record; it never floors a boundary hit or reconstructs canonical XYZ from camera coordinates. Render positions are rebased at model bounds center for precision; canonical positions remain unchanged.
- A bounded geometry adapter implements cube samples, axis-log appearance, stairs (all facing/half/corner combinations), slabs, doors and bed parts. Unknown shapes render as conspicuous wireframes and are counted in the inspector warning. This is not full registry geometry coverage. Colors are schematic, not Minecraft textures. Pane/fence/wall/plant/trapdoor models, waterlogging visuals, neighbor simulation and cutaways remain future work.
- Stairs/door dimensions and orientation were checked against Java 1.20.1 model/blockstate data at [mcmeta 906b6e4](https://github.com/misode/mcmeta/tree/906b6e49f59f4b07a809632c061f9b334b7eb764/assets/minecraft). Source paths inspected: models/block/stairs.json, inner_stairs.json, outer_stairs.json, door_bottom_left.json, door_bottom_left_open.json, door_bottom_right_open.json; blockstates/oak_stairs.json and oak_door.json. These asset files/textures are not redistributed. Bed rendering is analytic mattress/outer-leg cuboids with schematic coloring, not a textured entity-renderer reproduction.
- OrbitControls handles pointer/touch navigation; displacement and multi-pointer guards prevent navigation from selecting. Keyboard arrows/Shift+arrows/+/−/Home control the camera; Enter/Space selects the center reticle and Escape clears selection. Camera fitting accounts for aspect ratio, retains focused bounds across resize, and uses bounded zoom.
- Rendering is on demand, with explicit ResizeObserver, event, geometry, material, control and renderer cleanup. Context loss is visible, and restoration redraws. Initial WebGL failure is reported; no static image substitutes for a renderer.
- Three.js r180 runtime subset is vendored unmodified from commit 0af9729d0c143a86a1d725d6e2c3ad83301f3f34, MIT license retained. Local package metadata deliberately exposes only the needed renderer and OrbitControls. npm install-links=true packs local files instead of requiring a Windows symlink privilege. scripts/verify-vendor.mjs verifies upstream Git blob hashes. Normal network-enabled hosts still use npm ci for other exact dependencies.
- This milestone renders a deterministic, hand-authored 288-cell fixture and an empty project. No editing, saved storage, AI or deployed service is implied. Per-box meshes and linear raycasting are intentional M2 correctness implementations; chunking/instancing, hidden-face culling and 1k/10k/50k profiling remain M9 work. The roughly 901 kB production JS bundle triggers Vite's size warning; no measured performance claim is made.

## ADR-008 — Integrated M3–M10 release boundary

This section supersedes earlier milestone-specific future tense. React owns the canonical engine and typed commands; editor, batch tools, blueprint, materials, construction and exports consume the same snapshot. Renderer batches shape parts in 16-cube chunks using InstancedMesh, resolves instanceId to stable UID and retains unchanged chunk resources. Projection visibility, opacity and explosion offsets never edit coordinates. Transparent instances are not individually depth sorted. Full validation is still on the main thread; measured 50k operations are slow.

Native IndexedDB stores validated schema-v1 workspaces: current/original/approved designs, snapshots, prepared inventory, completion, partial view state and bounded audit history. Saves are serialized, autosave debounced and errors visible; there is no fallback that silently loses durable data. Rename retains active undo; snapshot restore is a transaction; cross-reload undo stacks are not persisted. The additive optional originalAi flag preserves the first accepted AI design independently of prunable logs and remains compatible with earlier v1 records. Unknown future schema versions are rejected.

A generic HTTP provider adapter is shared between Vite development middleware and the compiled Node server. Server-only environment configuration, consent, request/response/time limits and repeated proposal validation isolate untrusted output from canonical writes. Missing configuration returns disabled capability. The production server serves the built client and API on loopback by default; it was exercised by M10, not deployed publicly. No actual vendor account or successful paid/image-generation call is asserted. See API_PROVIDER.md and progress/M10.md.


## 2026-10-21 decision: one complete project per independent building

The user rejected construction part files. Independent collection schema v2 contains one full canonical Project per entry; the golden leaf model is never split for editing or download. Legacy v1 parts merge with stable XYZ/UID/logical structures, including saved edits. Existing source workspaces are retained. A new fixture is added explicitly rather than overwriting prior personal designs.

Canonical parsing now permits 1,000,000 cells and 384 MiB model/CSV input; transaction changes remain bounded at 10,000. Workspace snapshots share immutable instances, with a 2,000,000 distinct-snapshot-cell safety budget and 384 MiB backup limit. Version2 workspace packages intern shared snapshots and retain all originals, approved designs, history, progress and prepared materials in one JSON file; legacy schema1 JSON still imports. Database workspace records are gzip-compressed complete packages; collection storage uses one compressed full building record per entry. No user-facing shard files are required. Decompression is byte bounded and all decoded data is validated.

Large editor models use exposed-face material batches while preserving canonical UID picking and projection-only offsets/opacity. Limits are safety bounds, not performance guarantees. Whole-building browser evidence is recorded in progress/GOLDEN_LEAF_REBUILD.md.

## 2026-10-22 decision: lazy building library and explicit campus loading

Collection storage v4 separates a metadata-only library index from independently compressed canonical projects. React retains metadata and only the selected Project; selected model loads are serialized and stale completions are ignored. Incremental saves put supplied new/changed records and index atomically without clearing unrelated records. Legacy indexed and inline formats remain readable; legacy inline data is archived before its current index is replaced. Exported building and collection JSON contracts remain unchanged.

Workspace menus read cursor metadata without decompressing snapshots; updated envelopes carry title/updatedAt, with identifier fallback for old compressed records. Root / does not instantiate a model. Full campus loading is explicit and its module caches are released on leaving. These choices supersede eager collection/workspace listing. Unknown legacy cell counts are not an aggregate performance guarantee; each selected building retains canonical validation and byte limits. See progress/COLLECTION_LAZY_LOADING.md for evidence and limitations.


## ADR-010 — Local procedural generation and metadata discovery

The public Creeper workshop workflow suggests explicit dimensions, a reviewable placement preview, and library discovery. Its client download is All Rights Reserved and calls a remote AI service; neither its implementation nor backend algorithms are incorporated. The new generator is original deterministic geometry, not an AI provider or photo reconstruction.

Generator inputs produce bounded canonical block records through createPlacement and designDiff. The reserved interior as well as occupied shell must be collision-free. One complete proposal, one preview approval, one atomic undo; no partial generation is published. Changing parameters invalidates pending previews. Material counts come from generated records; supported palettes have single-item placements including bottom slabs. Existing AI credentials/consent and proposal validation are unchanged.

The viewer can explicitly fit a generated preview without changing canonical coordinates. Collection discovery uses lightweight index metadata only; unknown legacy counts sort last. A currently selected building remains accessible when filtering excludes it. This preserves lazy collection loading and one-building-one-file exports.
