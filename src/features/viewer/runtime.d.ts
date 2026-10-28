import type { BlockRecord, BlockPos } from '../../core/contracts.ts';
import type { BlockShape, Vec3 } from './geometry.ts';
import type { CameraPreset } from './ViewerPanels.tsx';
export interface ViewerPick { uid: string | null; pos: BlockPos; normal: BlockPos; additive?: boolean; context?: boolean }
export interface ProjectionEntry { readonly uid: string; readonly visible: boolean; readonly opacity: number; readonly offsetY: number }
export interface ViewerHandle {
  workPlane(y: number): void;
  updateModel(blocks: readonly BlockRecord[], shapes: readonly BlockShape[]): void;
  setProjection(entries: readonly ProjectionEntry[]): void;
  preview(blocks: readonly BlockRecord[], shapes: readonly BlockShape[], valid: boolean): void;
  preset(p: CameraPreset): void;
  reset(): void;
  framePreview(): void;
  focus(uid: string): void;
  select(uid: string | null): void;
  selectMany(uids: readonly string[]): void;
  setEditingEnabled(enabled: boolean): void;
  setDragMode(enabled: boolean): void;
  cancelDrag(): boolean;
  dispose(): void;
}
export function createViewer(host: HTMLElement, blocks: readonly BlockRecord[], shapes: readonly BlockShape[], onSelect: (uid: string | null, pick: ViewerPick | null) => void, onError?: (message: string) => void, onDrag?: (delta: BlockPos, phase: 'preview' | 'commit' | 'cancel') => void, onBoxSelection?: (uids: readonly string[], additive: boolean) => void): ViewerHandle;
export interface RendererResource { addEventListener(type: 'dispose', listener: () => void): void }
export interface InstanceMaterial extends RendererResource {
  readonly opacity: number;
  readonly wireframe: boolean;
  readonly color: { getHex(): number };
}
export interface ModelInstance extends RendererResource {
  readonly isInstancedMesh: boolean;
  readonly count: number;
  readonly userData: { readonly uids: readonly string[] };
  readonly geometry: RendererResource;
  readonly material: InstanceMaterial | readonly InstanceMaterial[];
}
export interface ModelGroup { readonly children: readonly ModelInstance[] }
export function buildModelGroup(blocks: readonly BlockRecord[], shapes: readonly BlockShape[], origin?: Vec3, projection?: readonly ProjectionEntry[]): ModelGroup;
export function updateModelGroup(group: ModelGroup, blocks: readonly BlockRecord[], shapes: readonly BlockShape[], projection?: readonly ProjectionEntry[]): ModelGroup;
export function pickModel(group: ModelGroup, origin: Vec3, direction: Vec3): { uid: string; point: number[]; normal: number[] } | null;
export function disposeGroup(group: ModelGroup | ModelInstance): void;
