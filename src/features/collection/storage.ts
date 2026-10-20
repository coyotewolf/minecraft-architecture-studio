import type { Project } from '../../core/contracts.ts';
import { deepFreeze, object, parseProject } from '../../core/model.ts';
import { loadWorkspace } from '../projects/storage.ts';

export interface CollectionEntry { readonly id:string; readonly name:string; readonly notes:string; readonly reference:'golden-leaf'|null; readonly parts:readonly Project[] }
export interface BuildingCollection { readonly schemaVersion:1; readonly name:string; readonly entries:readonly CollectionEntry[] }
const trustedCollections=new WeakSet<object>();
const trustedProjects=new WeakSet<object>();
export const MAX_COLLECTION_BYTES=256*1024*1024;
function label(value:unknown,max:number):string { if(typeof value!=='string'||value.length>max||!value.trim())throw new Error('名稱不可空白或過長');return value; }
function workspaceIdentifier(value:string){if(!/^[A-Za-z0-9_:.,-]+$/.test(value)||['__proto__','constructor','prototype'].includes(value))throw new Error('施工分檔含不安全的識別碼：'+value);}
/** Validate each independent building; coordinates may overlap between different entries. */
export function parseCollection(input:unknown):BuildingCollection {
 if(input&&typeof input==='object'&&trustedCollections.has(input))return input as BuildingCollection;
 const raw=object(input,['schemaVersion','name','entries']);
 if(raw.schemaVersion!==1||!Array.isArray(raw.entries)||raw.entries.length>100)throw new Error('不支援的收藏格式或超過 100 棟');
 let total=0; const ids=new Set<string>(),projects=new Set<string>();
 const entries=raw.entries.map(value=>{
  const e=object(value,['id','name','notes','reference','parts']);const id=label(e.id,200);
  if(ids.has(id))throw new Error('重複建築識別碼');ids.add(id);
  if(typeof e.notes!=='string'||e.notes.length>10000)throw new Error('筆記格式錯誤');
  if(e.reference!==null&&e.reference!=='golden-leaf')throw new Error('不支援的參考圖');
  if(!Array.isArray(e.parts)||e.parts.length<1||e.parts.length>100)throw new Error('建築需要 1 至 100 個分檔');
  const coords=new Set<string>(),uids=new Set<string>();
  const parts=e.parts.map(value=>{
   const rawPart=object(value,['schemaVersion','minecraftVersion','coordinateConvention','id','title','designRevision','blocks','logicalStructures']);
   if(!Array.isArray(rawPart.blocks)||(total+=rawPart.blocks.length)>1000000)throw new Error('收藏超過 100 萬格');
   const p=trustedProjects.has(rawPart)?rawPart as unknown as Project:parseProject(rawPart);trustedProjects.add(p);workspaceIdentifier(p.id);workspaceIdentifier(p.designRevision);for(const s of p.logicalStructures)workspaceIdentifier(s.uid);for(const b of p.blocks)for(const id of [b.uid,b.edits.createdByTransactionId,b.edits.lastModifiedByTransactionId,b.componentId,b.logicalStructureId,b.constructionPhaseId,b.source.referenceRegionId])if(id!==undefined)workspaceIdentifier(id);if(projects.has(p.id))throw new Error('重複施工分檔識別碼');projects.add(p.id);
   for(const b of p.blocks){const key=[b.pos.x,b.pos.y,b.pos.z].join(',');if(coords.has(key)||uids.has(b.uid))throw new Error('同棟分檔的座標或 UID 重疊');coords.add(key);uids.add(b.uid);}
   return p;
  });return {id,name:label(e.name,200),notes:e.notes,reference:e.reference,parts} as CollectionEntry;
 });const result=deepFreeze({schemaVersion:1 as const,name:label(raw.name,200),entries});trustedCollections.add(result);return result;
}
export function serializeCollection(value:BuildingCollection):string {const text=JSON.stringify(parseCollection(value));if(new TextEncoder().encode(text).length>MAX_COLLECTION_BYTES)throw new Error('收藏備份超過 256 MiB');return text;}
export function deserializeCollection(text:string):BuildingCollection {if(new TextEncoder().encode(text).length>MAX_COLLECTION_BYTES)throw new Error('收藏備份超過 256 MiB');return parseCollection(JSON.parse(text));}
/** Copies get fresh workspace IDs. This module never writes to the workspace database. */
export function copyEntry(entry:CollectionEntry,token:string=crypto.randomUUID()):CollectionEntry {
 return {...entry,id:'collection-'+token,parts:entry.parts.map((p,i)=>{const copy=Object.freeze({...p,id:'collection-'+token+'-'+i});if(trustedProjects.has(p))trustedProjects.add(copy);return copy;})};
}
export function appendImported(current:BuildingCollection,incoming:BuildingCollection,token:string=crypto.randomUUID()):BuildingCollection {
 return parseCollection({...current,entries:[...current.entries,...incoming.entries.map((e,i)=>copyEntry(e,token+'-'+i))]});
}
export async function resolveCollection(value:BuildingCollection):Promise<BuildingCollection> {
 const entries=await Promise.all(value.entries.map(async e=>({...e,parts:await Promise.all(e.parts.map(async p=>(await loadWorkspace(p.id))?.project??p))})));
 return parseCollection({...value,entries});
}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('minecraft-building-collection',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('collection'))r.result.createObjectStore('collection');if(!r.result.objectStoreNames.contains('parts'))r.result.createObjectStore('parts');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('請關閉其他分頁後重試'));});}
/** Each Project stays bounded; metadata and all shards commit in the same transaction. */
export function collectionStorageRecords(value:BuildingCollection){const c=parseCollection(value);return {metadata:{storageVersion:2,collection:{...c,entries:c.entries.map(e=>({...e,parts:e.parts.map(p=>p.id)}))}},parts:c.entries.flatMap(e=>e.parts)};}
export function collectionFromStorage(metadata:unknown,parts:readonly Project[]):BuildingCollection|undefined{
 if(metadata===undefined)return undefined;
 if(metadata&&typeof metadata==='object'&&'storageVersion' in metadata){const m=object(metadata,['storageVersion','collection']);if(m.storageVersion!==2)throw new Error('不支援的收藏儲存版本');const c=object(m.collection,['schemaVersion','name','entries']);if(!Array.isArray(c.entries))throw new Error('收藏索引損壞');const index=new Map(parts.map(p=>[p.id,p]));return parseCollection({...c,entries:c.entries.map(raw=>{const e=object(raw,['id','name','notes','reference','parts']);if(!Array.isArray(e.parts))throw new Error('分檔索引損壞');return {...e,parts:e.parts.map(id=>{if(typeof id!=='string'||!index.has(id))throw new Error('缺少施工分檔');return index.get(id);})};})});}
 return parseCollection(metadata);
}
export async function loadCollection():Promise<BuildingCollection|undefined>{const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(['collection','parts'],'readonly');const r=tx.objectStore('collection').get('current'),p=tx.objectStore('parts').getAll();let value:unknown,parts:Project[]=[];r.onsuccess=()=>{value=r.result;};p.onsuccess=()=>{parts=p.result as Project[];};tx.oncomplete=()=>{try{resolve(collectionFromStorage(value,parts));}catch(e){reject(e);}};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function saveCollection(value:BuildingCollection):Promise<void>{const records=collectionStorageRecords(value);const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['collection','parts'],'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);try{tx.objectStore('parts').clear();for(const p of records.parts)tx.objectStore('parts').put(p,p.id);tx.objectStore('collection').put(records.metadata,'current');}catch(error){try{tx.abort();}catch{ /* Preserve the original enqueue failure if the transaction already ended. */ }reject(error);}});}finally{db.close();}}
