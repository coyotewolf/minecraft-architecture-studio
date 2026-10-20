import type { BlockRecord } from '../../core/contracts.ts';
export type CampusPreset = 'reference' | 'iso' | 'top' | 'front' | 'side';
export interface CampusCamera { projection:'perspective'|'orthographic'; yaw:number; pitch:number; fov:number; distance:number; span:number; target:[number,number,number] }
export interface CampusLandmark { id:string; label:string; world:readonly[number,number,number]; reference:readonly[number,number] }
export interface ProjectedCampusLandmark extends CampusLandmark {pixel:number[];errorPixels:number;inFrame:boolean}
export function validCampusCamera(c:unknown):c is CampusCamera;
export function projectCampusLandmarks(c:CampusCamera,landmarks:readonly CampusLandmark[]):ProjectedCampusLandmark[];
export function calibrateCampusCamera(landmarks:readonly CampusLandmark[],initial:CampusCamera):{camera:CampusCamera;rmsePixels:number;landmarks:ProjectedCampusLandmark[]};
export interface CampusViewer { camera():CampusCamera;setCamera(c:CampusCamera):void;project(landmarks:readonly CampusLandmark[]):ProjectedCampusLandmark[]; dispose():void; preset(p:CampusPreset):void; select(uid:string|null):void }
export interface CampusGeometry {
 readonly children: readonly { readonly userData:{ readonly uids:readonly string[] }; readonly geometry:{addEventListener(type:'dispose',listener:()=>void):void}; readonly material:{addEventListener(type:'dispose',listener:()=>void):void} }[];
 readonly userData:{readonly visibleCells:number;readonly triangles:number};
}
export function buildCampusGeometry(blocks:readonly BlockRecord[],origin?:readonly[number,number,number]):CampusGeometry;
export function pickCampus(group:CampusGeometry,origin:readonly[number,number,number],direction:readonly[number,number,number]):string|null;
export function disposeCampusGeometry(group:CampusGeometry):void;
export function createCampusViewer(host:HTMLElement,blocks:readonly BlockRecord[],onSelect:(uid:string|null)=>void,onCamera?:(camera:CampusCamera)=>void,options?:{background?:number;ocean?:boolean;label?:string}):CampusViewer;
