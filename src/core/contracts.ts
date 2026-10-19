/** Schema 1 contracts. Runtime validation, not this syntax alone, establishes game validity. */
export const MINECRAFT_VERSION = '1.20.1' as const;
export const SCHEMA_VERSION = 1 as const;
export const COORDINATE_CONVENTION = 'x-east-y-up-z-south' as const;
export type MinecraftId = `minecraft:${string}`;
export interface BlockPos { readonly x: number; readonly y: number; readonly z: number }
export type BlockState = Readonly<Record<string, string>>;
export type Facing = 'north' | 'east' | 'south' | 'west';
export interface Evidence {
  readonly origin: 'observed' | 'inferred' | 'ai_estimated' | 'user_created';
  readonly confidence?: number;
  readonly referenceRegionId?: string;
}
export interface EditProvenance {
  readonly createdByTransactionId: string;
  readonly lastModifiedByTransactionId: string;
  readonly userModified: boolean;
}
export interface BlockRecord {
  readonly uid: string;
  readonly id: MinecraftId;
  readonly pos: BlockPos;
  /** Complete normalized state: every registry property present, no extra keys. */
  readonly state: BlockState;
  readonly source: Evidence;
  readonly edits: EditProvenance;
  readonly category?: string;
  readonly componentId?: string;
  readonly logicalStructureId?: string;
  readonly constructionPhaseId?: string;
}
export interface LogicalStructure {
  readonly uid: string;
  readonly kind: 'door' | 'bed' | 'tall_plant';
  readonly anchorUid: string;
  readonly memberUids: readonly string[];
}
export interface DesignSnapshot {
  readonly designRevision: string;
  readonly blocks: readonly BlockRecord[];
  readonly logicalStructures: readonly LogicalStructure[];
}
export interface Project extends DesignSnapshot {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly minecraftVersion: typeof MINECRAFT_VERSION;
  readonly coordinateConvention: typeof COORDINATE_CONVENTION;
  readonly id: string;
  readonly title: string;
}
export interface RegistryEntry {
  readonly id: MinecraftId;
  readonly properties: Readonly<Record<string, readonly string[]>>;
  readonly defaults: BlockState;
  readonly inventory: InventoryRule;
}
export type InventoryRule =
  | { readonly kind: 'per_cell'; readonly itemId: MinecraftId; readonly count: number }
  | { readonly kind: 'slab'; readonly itemId: MinecraftId }
  | { readonly kind: 'logical_structure'; readonly itemId: MinecraftId }
  | { readonly kind: 'unresolved'; readonly reason: string };
export interface ItemRequirement {
  readonly itemId: MinecraftId;
  readonly required: number;
  readonly maxStack: number;
  readonly fullStacks: number;
  readonly remainder: number;
}
export interface InventorySummary {
  readonly designRevision: string;
  readonly occupiedCells: number;
  /** null while ANY occupied structure has an unresolved item mapping. */
  readonly totalInventoryItems: number | null;
  readonly items: readonly ItemRequirement[];
  readonly unresolved: readonly { readonly blockUids: readonly string[]; readonly reason: string }[];
}
export interface VoxelChange {
  readonly pos: BlockPos;
  readonly before: BlockRecord | null;
  readonly after: BlockRecord | null;
}
export interface StructureChange {
  readonly uid: string;
  readonly before: LogicalStructure | null;
  readonly after: LogicalStructure | null;
}
export interface EditTransaction {
  readonly id: string;
  readonly baseRevision: string;
  readonly cause: 'user' | 'ai_approved' | 'import' | 'undo' | 'redo';
  readonly collisionPolicy: 'cancel' | 'replace' | 'skip';
  readonly changes: readonly VoxelChange[];
  readonly structures: readonly StructureChange[];
}
export interface Diagnostic {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly message: string;
  readonly pos?: BlockPos;
}
export type PreflightResult =
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: true; readonly normalized: EditTransaction; readonly warnings: readonly Diagnostic[] };
/** Contract only in M0. No command engine is claimed until M1. */
export interface CommandEngine {
  snapshot(): DesignSnapshot;
  preview(transaction: EditTransaction): PreflightResult;
  commit(transaction: EditTransaction): DesignSnapshot;
  undo(): DesignSnapshot;
  redo(): DesignSnapshot;
}
export interface BuildProgress {
  readonly approvedDesignRevision: string;
  readonly completedBlockUids: readonly string[];
  readonly preparedItems: Readonly<Record<MinecraftId, number>>;
}
export interface MeshReference {
  readonly kind: 'mesh_reference';
  readonly format: 'glb';
  readonly url: string;
  readonly provider: string;
}
export interface VoxelProposal {
  readonly kind: 'voxel_proposal';
  readonly minecraftVersion: typeof MINECRAFT_VERSION;
  readonly baseRevision: string;
  readonly transaction: EditTransaction;
}
/** Reference mesh is intentionally not assignable to a voxel proposal/transaction. */
export type ProviderOutput = MeshReference | VoxelProposal;
