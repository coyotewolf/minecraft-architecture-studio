import type { Project } from '../../core/contracts.ts';
import { MAX_BLOCKS, object } from '../../core/model.ts';
import { loadWorkspace } from '../projects/storage.ts';
import { decodeBuilding, encodeBuilding, MAX_COLLECTION_BLOCKS, parseCollection, type CollectionEntry } from './storage.ts';

type Source = { readonly kind:'building' } | { readonly kind:'parts'; readonly ids:readonly string[] } | { readonly kind:'inline'; readonly key:string; readonly index:number };
export interface LibraryEntry {
 readonly id:string; readonly name:string; readonly notes:string; readonly reference:'golden-leaf'|null;
 readonly projectId:string; readonly cellCount:number|null; readonly revision?:string; readonly source?:Source;
}
export interface Library { readonly name:string; readonly entries:readonly LibraryEntry[] }
const inlineArchive='legacy-inline-v1';
function label(v:unknown,max=200):string {if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error('名稱不可空白或過長');return v;}
function identifier(v:unknown):string {const s=label(v);if(!/^[A-Za-z0-9_:.,-]+$/.test(s)||['__proto__','constructor','prototype'].includes(s))throw new Error('不安全的建築識別碼');return s;}
function validate(value:Library):Library {
 label(value.name);if(!Array.isArray(value.entries)||value.entries.length>100)throw new Error('收藏超過 100 棟');
 const ids=new Set<string>(),projects=new Set<string>();let count=0;
 for(const e of value.entries){label(e.id);label(e.name);identifier(e.projectId);if(ids.has(e.id)||projects.has(e.projectId))throw new Error('重複建築識別碼');ids.add(e.id);projects.add(e.projectId);
  if(typeof e.notes!=='string'||e.notes.length>10000||![null,'golden-leaf'].includes(e.reference))throw new Error('建築索引格式錯誤');
  if(e.cellCount!==null){if(!Number.isSafeInteger(e.cellCount)||e.cellCount<0||e.cellCount>MAX_BLOCKS)throw new Error('單棟建築超過 100 萬格');count+=e.cellCount;}
  if(e.revision!==undefined)identifier(e.revision);
  const s=e.source;if(s){if(s.kind==='parts'){if(!Array.isArray(s.ids)||!s.ids.length||s.ids.length>100)throw new Error('舊建築索引損壞');s.ids.forEach(identifier);}else if(s.kind==='inline'){if(s.key!==inlineArchive||!Number.isSafeInteger(s.index)||s.index<0||s.index>=100)throw new Error('舊建築索引損壞');}else if(s.kind!=='building')throw new Error('建築索引損壞');}
 }
 if(count>MAX_COLLECTION_BLOCKS)throw new Error('收藏超過 500 萬格');return value;
}
export function createLibraryEntry(entry:CollectionEntry):LibraryEntry {return {id:entry.id,name:entry.name,notes:entry.notes,reference:entry.reference,projectId:entry.project.id,cellCount:entry.project.blocks.length,revision:entry.project.designRevision,source:{kind:'building'}};}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('minecraft-building-collection',3);let blocked=false;r.onupgradeneeded=()=>{for(const name of ['collection','parts','buildings'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>{blocked=true;reject(new Error('請關閉其他分頁後重試'));};});}
async function get(store:string,key:string):Promise<unknown>{const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
function metadata(raw:unknown):Library|undefined {
 if(raw===undefined)return undefined;
 const outer=raw as Record<string,unknown>,version=outer.storageVersion;
 if(version===4){const m=object(raw,['storageVersion','library']);return validate(m.library as Library);}
 if(version!==undefined&&version!==2&&version!==3)throw new Error('不支援的收藏儲存版本');
 const c=object(version===undefined?raw:outer.collection,['schemaVersion','name','entries']);
 if(![1,2].includes(c.schemaVersion as number)||!Array.isArray(c.entries)||c.entries.length>100)throw new Error('收藏索引損壞');
 const entries=c.entries.map((raw,index):LibraryEntry=>{
  const e=object(raw,['id','name','notes','reference',c.schemaVersion===1?'parts':'project']);
  let projectId:string,cellCount:number|null=null,source:Source,revision:string|undefined;
  if(version===3){projectId=identifier(e.project);source={kind:'building'};}
  else if(version===2){if(!Array.isArray(e.parts)||!e.parts.length)throw new Error('舊建築索引損壞');const ids=e.parts.map(identifier);projectId=ids.length===1?ids[0]!:ids[0]+'-complete';source={kind:'parts',ids};}
  else {const candidates=c.schemaVersion===1?e.parts:[e.project];if(!Array.isArray(candidates)||!candidates.length||candidates.length>100)throw new Error('舊建築資料不完整');let count=0;for(const p of candidates){if(!p||typeof p!=='object'||!Array.isArray(p.blocks))throw new Error('舊建築資料不完整');count+=p.blocks.length;}const first=candidates[0] as Project;projectId=candidates.length===1?identifier(first.id):identifier(first.id)+'-complete';cellCount=count;revision=first.designRevision+(candidates.length===1?'':'-merged');source={kind:'inline',key:inlineArchive,index};}
  return {id:e.id as string,name:e.name as string,notes:e.notes as string,reference:e.reference as LibraryEntry['reference'],projectId,cellCount,source,...(revision===undefined?{}:{revision})};
 });return validate({name:c.name as string,entries});
}
/** Reads only the index. Old inline backups must be cloned by IndexedDB once, but no models are retained. */
export async function loadLibrary():Promise<Library|undefined>{return metadata(await get('collection','current'));}
function canonical(entry:LibraryEntry,p:unknown):Project{return parseCollection({schemaVersion:2,name:'收藏',entries:[{id:entry.id,name:entry.name,notes:entry.notes,reference:entry.reference,project:p}]}).entries[0]!.project;}
export async function loadLibraryEntry(entry:LibraryEntry):Promise<Project>{
 validate({name:'收藏',entries:[entry]});const source=entry.source??{kind:'building'};
 let p:Project;
 if(source.kind==='building'){const blob=await get('buildings',entry.projectId);if(!(blob instanceof Blob))throw new Error('缺少建築資料：'+entry.projectId+'；原有收藏未被覆寫');p=await decodeBuilding(blob);if(p.id!==entry.projectId)throw new Error('建築資料識別碼不符');}
 else {
  let parts:unknown[];
  if(source.kind==='parts'){parts=[];for(const id of source.ids){const part=await get('parts',id);if(!part||typeof part!=='object'||!('id' in part)||part.id!==id)throw new Error('缺少建築資料：'+id+'；原有收藏未被覆寫');parts.push(part);}}
  else {const archived=await get('collection',source.key),raw=archived??await get('collection','current');if(!raw||typeof raw!=='object'||!('entries' in raw)||!Array.isArray(raw.entries))throw new Error('舊建築資料遺失');const old=raw.entries[source.index] as Record<string,unknown>|undefined;if(!old||old.id!==entry.id)throw new Error('舊建築索引不符');parts=Array.isArray(old.parts)?old.parts:[old.project];}
  // Validate the selected legacy building before consulting workspace overrides.
  const old=parseCollection({schemaVersion:1,name:'收藏',entries:[{id:entry.id,name:entry.name,notes:entry.notes,reference:entry.reference,parts}]}).entries[0]!.project;
  if(old.id!==entry.projectId)throw new Error('建築資料識別碼不符');
  const complete=await loadWorkspace(entry.projectId);if(complete)return canonical(entry,complete.project);
  const latest:Project[]=[];for(const part of parts){const valid=canonical(entry,part);latest.push((await loadWorkspace(valid.id))?.project??valid);}
  p=parseCollection({schemaVersion:1,name:'收藏',entries:[{id:entry.id,name:entry.name,notes:entry.notes,reference:entry.reference,parts:latest}]}).entries[0]!.project;
  return p;
 }
 const saved=await loadWorkspace(entry.projectId);return saved?canonical(entry,saved.project):p;
}
/** Compress only supplied changed models, then commit their records and metadata atomically. Never clear old data. */
export async function saveLibrary(value:Library,projects:readonly Project[]=[]):Promise<void>{
 validate(value);const changed=new Map<string,Project>();for(const p of projects){if(changed.has(p.id)||!value.entries.some(e=>e.projectId===p.id))throw new Error('建築更新索引不符');changed.set(p.id,p);}
 const next=validate({...value,entries:value.entries.map(e=>{const p=changed.get(e.projectId);return p?{...e,cellCount:p.blocks.length,revision:p.designRevision,source:{kind:'building' as const}}:e;})});
 const encoded:Array<{id:string;blob:Blob}>=[];for(const p of changed.values())encoded.push({id:p.id,blob:await encodeBuilding(p)});
 const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['collection','buildings'],'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);const fail=(error:unknown)=>{try{tx.abort();}catch{/* Keep the original failure. */}reject(error);};try{const index=tx.objectStore('collection'),r=index.get('current');r.onsuccess=()=>{try{const old=r.result as Record<string,unknown>|undefined;if(old&&old.storageVersion===undefined)index.put(old,inlineArchive);for(const record of encoded)tx.objectStore('buildings').put(record.blob,record.id);index.put({storageVersion:4,library:next},'current');}catch(error){fail(error);}};}catch(error){fail(error);}});}finally{db.close();}
}
