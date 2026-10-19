import type { BlockRecord } from '../../core/contracts.ts';
import type { BlockShape, Vec3 } from './geometry.ts';
import type { CameraPreset } from './ViewerPanels.tsx';
export interface ViewerHandle {preset(p: CameraPreset): void;reset():void;focus(uid:string):void;select(uid:string|null):void;dispose():void}
export function createViewer(host:HTMLElement,blocks:readonly BlockRecord[],shapes:readonly BlockShape[],onSelect:(uid:string|null)=>void,onError?:(message:string)=>void):ViewerHandle;
export interface ModelGroup { readonly children: readonly {readonly userData:{readonly uid:string}}[] }
export function buildModelGroup(blocks:readonly BlockRecord[],shapes:readonly BlockShape[],origin?:Vec3):ModelGroup;
export function pickModel(group:ModelGroup,origin:Vec3,direction:Vec3):{uid:string;point:number[];normal:number[]}|null;
export function disposeGroup(group:ModelGroup):void;
