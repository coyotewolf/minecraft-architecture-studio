# Architecture and contracts — proposed, not implemented

**Status:** design proposal for M0 review. This document defines constraints; Codex must verify available packages/tools and amend architectural decisions with justification. Product scope is governed by [MASTER_SPEC.md](MASTER_SPEC.md).

## System map

```text
Photo Upload + User Scale/Orientation
    │
    ├── AiVisionProvider (evidence, uncertainty, proposed dimensions)
    ├── Optional HiggsfieldProvider (reference image / general GLB only)
    └── BlockPlanProvider (proposed legal Minecraft cells)
                    │
              Schema Validation
                    │
           Versioned Block Registry
                    │
         Canonical Block Model / Edit Engine
                    │
      ┌─────────────┼──────────────┬──────────────┐
      ▼             ▼              ▼              ▼
  3D Renderer   2D Blueprint    Materials     Construction
  + Picking     + Grid Editor    + Export      + Progress
      └─────────────┼──────────────┴──────────────┘
                    ▼
            IndexedDB / Snapshots
```

No renderer, blueprint, progress slider or AI provider may be a second authority for voxel positions.

## Stable canonical data

Recommended TypeScript sketch (M0 must finalize):

```ts
type BlockPos = { x: number; y: number; z: number }; // signed integers
type SourceKind = "observed" | "inferred" | "ai_estimated" | "user_created";
type BlockProvenance = {
  origin: SourceKind;
  confidence?: number;
  referenceRegionId?: string;
  userModified?: boolean;
};
type BlockRecord = {
  uid: string;
  id: `minecraft:${string}`;
  pos: BlockPos;
  state: Record<string, string>;
  category?: string;
  provenance: BlockProvenance;
  componentId?: string;
  constructionPhaseId?: string;
};
type Project = {
  schemaVersion: number;
  minecraftVersion: string;
  coordinateConvention: "x-right-y-up-z-depth";
  blocks: BlockRecord[];
  logicalStructures: Array<{ id: string; type: string; blockUids: string[] }>;
  revisions: unknown[];
};
```

- Unique coordinate index: `coordKey(x,y,z)`, exactly one occupied record per cell. Air is absence.
- Define the signed X/Y/Z world transform and Minecraft North mapping in one tested module. Avoid mixing render-space and voxel-space axes; add roundtrip tests for picking.
- Structural provenance is separate from edit audit history. User modifying an estimated roof does not erase evidence uncertainty.
- Multi-cell structures (doors, beds, tall plants) are linked and validated atomically.
- Rendering can cache chunk data, but caches must be invalidated by canonical edit transactions; **never** write back mesh transforms into real positions.

## Modules and dependency boundaries

| Module | Responsibility | Must not own |
| --- | --- | --- |
| `core/blocks` | Sparse store, indices, serialization, bounds | Renderer geometry |
| `core/registry` | Java 1.20.1 IDs, state domains, orientation rules, item mapping | Arbitrary AI claims |
| `core/commands` | Atomic transactions, validation, undo/redo, preview diffs | Independent state copy |
| `core/validation` | Syntactic, structural, survival/placement warnings | Cosmetic-only approximations |
| `core/geometry` | Blockstate-aware shape/texture assembly | Invented block types |
| `features/viewer` | Three.js/R3F camera, picking, cutaways | Material quantities |
| `features/blueprint` | XZ per-Y grid and 2D commands | Separate grid truth |
| `features/materials` | Cell vs item counts, 64/16/1 stack limits | Hand-entered fake totals |
| `features/build` | Construction ordering, stage/level progress, reconciled completion | Direct mutation of design |
| `features/projects` | IndexedDB, migrations, snapshots, versioned backups | API credentials |
| `integrations/ai` | Capability-checked structured proposal providers | Unchecked direct edits |

## Transaction rules

Commands must implement `preview / validate / apply / inverse` or equivalent. A proposed batch should atomically change the set of affected cells or leave state unchanged. Capture enough before/after information to undo and redo without rerunning AI. Enforce collision policies and support checks. Recompute neighbor-dependent states when applicable; do not assume Minecraft connections are simply visual.

**Sample change envelope:**

```ts
type VoxelChange = {
  pos: BlockPos;
  before: BlockRecord | null;
  after: BlockRecord | null;
};
type EditTransaction = {
  id: string;
  baseRevision: string;
  changes: VoxelChange[];
  cause: "user" | "ai_approved" | "import";
};
```

Require stale-revision and coordinate-conflict detection. AI proposals are validated, shown as overlay and applied only after user approval.

## Rendering and interaction

- Begin with correct geometry, state orientation, raycast mapping and transparent/opaque layering.
- Later optimize by chunking, instancing and visible-face culling; maintain a stable map from mesh instance / face → voxel XYZ.
- Clip/cutaway/ghost/exploded view operate solely on derived presentation transforms and masks.
- Give users a construction plane and ghost preview for placements into otherwise empty space.
- Mobile camera gestures and editing gestures must be mutually exclusive by explicit mode.

## Counts and construction dependencies

- `occupiedCells` = non-air occupied positions.
- `inventoryItems` = target-version item mapping from *logical* structures / valid states. Never assume occupied cells = items.
- `stacks` uses each item’s real maximum stack size, not always 64.
- The construction planner is a dependency graph where appropriate; level-based visibility and build-order slider are distinct inputs.
- Preserve approved design revision with build-state records. When design changes, generate a reconciliation/diff, not silent completion carryover.

## AI and external services

Three independent interfaces:

1. `AiVisionProvider`: extract photo observations, confidence, dimensional suggestions and unsupported unknowns.
2. `BlockPlanProvider`: turn approved design constraints into bounded JSON voxel proposal, strictly schema/registry validated before insertion.
3. `AiEditProposalProvider`: turn scoped instruction into bounded typed diff for confirmation.

Optional `HiggsfieldProvider` generates visually useful assets or generic meshes **if the target environment actually has access and billing permission**. A GLB is not a Minecraft 1.20.1 build plan. Keep all secret-bearing calls on an authorized server/task side, never the public browser.

## Storage/export and security

- IndexedDB/Dexie, schema version, migration, autosave failure reporting, snapshots and safe restore; project backups carry enough state to load offline.
- JSON/CSV must roundtrip with the current canonical project revision. NBT/Litematic are separate, format-validating features, not extensions changed by name.
- Limit image size, block plan count, batch edit size and JSON import size. Treat uploaded images and model output as untrusted inputs.
- No secrets, private photos or unlicensed Minecraft assets in Git; respect external model cost and licenses.

## Architecture decision checklist — M0

Before M0 passes, record: package manager; registry data source/licensing; precise coordinate/facing convention; block edit state machine; persistent schema; deterministic test fixtures; chosen rendering data structure; provider availability and separate validation/review gate.
