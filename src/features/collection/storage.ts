import type { Project } from '../../core/contracts.ts';
import { deepFreeze, object, parseProject } from '../../core/model.ts';
import { loadWorkspace } from '../projects/storage.ts';

export interface CollectionEntry { readonly id:string; readonly name:string; readonly notes:string; readonly reference:'golden-leaf'|null; readonly project:Project }
export interface BuildingCollection { readonly schemaVersion:2; readonly name:string; readonly entries:readonly CollectionEntry[] }
const trustedCollections=new WeakSet<object>(),trustedProjects=new WeakSet<object>();
const legacyProjects=new WeakMap<object,readonly Project[]>();
export const MAX_COLLECTION_BYTES=512*1024*1024;
function label(value:unknown,max:number):string {if(typeof value!=='string'||value.length>max||!value.trim())throw new Error('名稱不可空白或過長');return value;}
function workspaceIdentifier(value:string){if(!/^[A-Za-z0-9_:.,-]+$/.test(value)||['__proto__','constructor','prototype'].includes(value))throw new Error('建築含不安全的識別碼：'+value);}
function project(input:unknown):Project {
 const p=input&&typeof input==='object'&&trustedProjects.has(input)?input as Project:parseProject(input);
 workspaceIdentifier(p.id);workspaceIdentifier(p.designRevision);
 for(const s of p.logicalStructures)workspaceIdentifier(s.uid);
 for(const b of p.blocks)for(const id of [b.uid,b.edits.createdByTransactionId,b.edits.lastModifiedByTransactionId,b.componentId,b.logicalStructureId,b.constructionPhaseId,b.source.referenceRegionId])if(id!==undefined)workspaceIdentifier(id);
 trustedProjects.add(p);return p;
}
/** Merge canonical records without moving coordinates or splitting logical structures. */
function merge(parts:readonly Project[],name:string):Project {
 if(parts.length===1)return parts[0]!;
 const first=parts[0]!;
 return project({...first,id:first.id+'-complete',title:name,designRevision:first.designRevision+'-merged',blocks:parts.flatMap(p=>p.blocks),logicalStructures:parts.flatMap(p=>p.logicalStructures)});
}
export function parseCollection(input:unknown):BuildingCollection {
 if(input&&typeof input==='object'&&trustedCollections.has(input))return input as BuildingCollection;
 const raw=object(input,['schemaVersion','name','entries']);
 if(![1,2].includes(raw.schemaVersion as number)||!Array.isArray(raw.entries)||raw.entries.length>100)throw new Error('不支援的收藏格式或超過 100 棟');
 // Bound the entire raw payload before any registry normalization or record allocation.
 let total=0;
 for(const value of raw.entries){const e=object(value,['id','name','notes','reference',raw.schemaVersion===1?'parts':'project']);const candidates=raw.schemaVersion===1?e.parts:[e.project];if(!Array.isArray(candidates)||!candidates.length||candidates.length>100)throw new Error('舊建築資料不完整');for(const candidate of candidates){if(!candidate||typeof candidate!=='object'||!('blocks' in candidate)||!Array.isArray(candidate.blocks))throw new Error('建築方塊資料不完整');if((total+=candidate.blocks.length)>1000000)throw new Error('收藏超過 100 萬格');}}
 const ids=new Set<string>(),projects=new Set<string>();
 const entries=raw.entries.map(value=>{
  const e=object(value,['id','name','notes','reference',raw.schemaVersion===1?'parts':'project']),id=label(e.id,200),name=label(e.name,200);
  if(ids.has(id))throw new Error('重複建築識別碼');ids.add(id);
  if(typeof e.notes!=='string'||e.notes.length>10000)throw new Error('筆記格式錯誤');
  if(e.reference!==null&&e.reference!=='golden-leaf')throw new Error('不支援的參考圖');
  let p:Project;
  if(raw.schemaVersion===1){if(!Array.isArray(e.parts)||!e.parts.length||e.parts.length>100)throw new Error('舊建築資料不完整');const parts=e.parts.map(project);p=merge(parts,name);legacyProjects.set(p,parts);}
  else p=project(e.project);
  if(projects.has(p.id))throw new Error('重複建築專案識別碼');projects.add(p.id);
  return {id,name,notes:e.notes,reference:e.reference,project:p} as CollectionEntry;
 });
 const result=deepFreeze({schemaVersion:2 as const,name:label(raw.name,200),entries});trustedCollections.add(result);return result;
}
export function serializeCollection(value:BuildingCollection):string {const text=JSON.stringify(parseCollection(value));if(new TextEncoder().encode(text).length>MAX_COLLECTION_BYTES)throw new Error('收藏備份超過 512 MiB');return text;}
export function deserializeCollection(text:string):BuildingCollection {if(new TextEncoder().encode(text).length>MAX_COLLECTION_BYTES)throw new Error('收藏備份超過 512 MiB');return parseCollection(JSON.parse(text));}
/** Accept either the collection backup or the exact canonical single-building download. */
export function deserializeBuildingImport(text:string):BuildingCollection {
 if(new TextEncoder().encode(text).length>MAX_COLLECTION_BYTES)throw new Error('檔案超過 512 MiB');
 const raw:unknown=JSON.parse(text);
 if(raw&&typeof raw==='object'&&'blocks' in raw){const p=project(raw);return parseCollection({schemaVersion:2,name:'匯入建築',entries:[{id:p.id,name:p.title,notes:'從完整建築 JSON 匯入。',reference:null,project:p}]});}
 return parseCollection(raw);
}
export function copyEntry(entry:CollectionEntry,token:string=crypto.randomUUID()):CollectionEntry {const p=Object.freeze({...entry.project,id:'collection-'+token});if(trustedProjects.has(entry.project))trustedProjects.add(p);return {...entry,id:'collection-'+token,project:p};}
export function appendImported(current:BuildingCollection,incoming:BuildingCollection,token:string=crypto.randomUUID()):BuildingCollection {return parseCollection({...current,entries:[...current.entries,...incoming.entries.map((e,i)=>copyEntry(e,token+'-'+i))]});}
export async function resolveCollection(value:BuildingCollection):Promise<BuildingCollection> {
 const entries:CollectionEntry[]=[];
 for(const e of value.entries){const saved=await loadWorkspace(e.project.id),old=legacyProjects.get(e.project);let p=saved?.project??e.project;
  if(!saved&&old){const latest:Project[]=[];for(const part of old)latest.push((await loadWorkspace(part.id))?.project??part);p=merge(latest,e.name);}
  entries.push({...e,project:p});
 }
 return parseCollection({...value,entries});
}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('minecraft-building-collection',3);r.onupgradeneeded=()=>{for(const name of ['collection','parts','buildings'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('請關閉其他分頁後重試'));});}
export function collectionStorageRecords(value:BuildingCollection){const c=parseCollection(value);return {metadata:{storageVersion:3,collection:{...c,entries:c.entries.map(e=>({...e,project:e.project.id}))}},projects:c.entries.map(e=>e.project)};}
export function collectionFromStorage(metadata:unknown,projects:readonly Project[]):BuildingCollection|undefined {
 if(metadata===undefined)return undefined;
 if(metadata&&typeof metadata==='object'&&'storageVersion' in metadata){const m=object(metadata,['storageVersion','collection']);if(m.storageVersion!==2&&m.storageVersion!==3)throw new Error('不支援的收藏儲存版本');const c=object(m.collection,['schemaVersion','name','entries']);if(!Array.isArray(c.entries))throw new Error('收藏索引損壞');const index=new Map(projects.map(p=>[p.id,p]));const get=(id:unknown)=>{if(typeof id!=='string'||!index.has(id))throw new Error('缺少建築資料：'+String(id)+'；原有收藏與施工專案未被覆寫');return index.get(id);};return parseCollection({...c,entries:c.entries.map(raw=>{const e=object(raw,['id','name','notes','reference',m.storageVersion===2?'parts':'project']);if(m.storageVersion===3)return {...e,project:get(e.project)};if(!Array.isArray(e.parts))throw new Error('舊建築索引損壞');return {...e,parts:e.parts.map(get)};})});}
 return parseCollection(metadata);
}
/** Compression completes BEFORE opening a write transaction; one compressed record per building. */
export async function encodeBuilding(p:Project):Promise<Blob>{const validated=project(p),raw=new Blob([JSON.stringify(validated)]);if(raw.size>MAX_COLLECTION_BYTES)throw new Error('建築資料超過 512 MiB');return new Response(raw.stream().pipeThrough(new CompressionStream('gzip'))).blob();}
export async function decodeBuilding(blob:Blob,maxBytes=MAX_COLLECTION_BYTES):Promise<Project>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_COLLECTION_BYTES)throw new Error('解壓縮大小限制無效');
 if(blob.size>maxBytes)throw new Error('建築資料超過解壓縮大小限制');
 const reader=blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),chunks:string[]=[];let bytes=0;
 try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error('建築資料超過解壓縮大小限制');}chunks.push(decoder.decode(next.value,{stream:true}));}chunks.push(decoder.decode());}
 finally{reader.releaseLock();}
 return project(JSON.parse(chunks.join('')));
}
export async function loadCollection():Promise<BuildingCollection|undefined>{const db=await database();try{const data=await new Promise<{metadata:unknown;parts:Project[];buildings:Blob[]}>((resolve,reject)=>{const tx=db.transaction(['collection','parts','buildings'],'readonly'),r=tx.objectStore('collection').get('current'),p=tx.objectStore('parts').getAll(),b=tx.objectStore('buildings').getAll();tx.oncomplete=()=>resolve({metadata:r.result,parts:p.result as Project[],buildings:b.result as Blob[]});tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});const projects=[...data.parts];for(const blob of data.buildings)projects.push(await decodeBuilding(blob));const value=collectionFromStorage(data.metadata,projects);return value;}finally{db.close();}}
export async function saveCollection(value:BuildingCollection):Promise<void>{const records=collectionStorageRecords(value),encoded:Array<{id:string;blob:Blob}>=[];for(const p of records.projects)encoded.push({id:p.id,blob:await encodeBuilding(p)});const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['collection','buildings'],'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);try{tx.objectStore('buildings').clear();for(const p of encoded)tx.objectStore('buildings').put(p.blob,p.id);tx.objectStore('collection').put(records.metadata,'current');}catch(error){try{tx.abort();}catch{ /* Preserve the enqueue failure. */ }reject(error);}});}finally{db.close();}}
