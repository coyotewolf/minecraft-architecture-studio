import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProject } from '../../core/project.ts';
import { createWorkspace, loadWorkspace } from '../projects/storage.ts';
import { collectionStorageRecords, encodeBuilding, loadCollection, parseCollection } from './storage.ts';
import { createLibraryEntry, loadLibrary, loadLibraryEntry, saveLibrary } from './library.ts';
vi.mock('../projects/storage.ts',async original=>({...await original<typeof import('../projects/storage.ts')>(),loadWorkspace:vi.fn()}));

// Transactional fake: request callbacks run before commit; aborted writes never reach the maps.
function database(){
 const stores:Record<string,Map<string,unknown>>={collection:new Map(),buildings:new Map(),parts:new Map()},reads:string[]=[],writes:string[]=[];let failure='';
 const db={close:vi.fn(),transaction:vi.fn(()=>{
  const pending:Array<()=>void>=[];let aborted=false;
  const tx={oncomplete:undefined as undefined|(()=>void),onerror:undefined,onabort:undefined as undefined|(()=>void),abort:()=>{aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:(name:string)=>({
   get:(key:string)=>{reads.push(name+':'+key);const r={result:stores[name]!.get(key),onsuccess:undefined as undefined|(()=>void)};queueMicrotask(()=>r.onsuccess?.());return r;},
   put:(value:unknown,key:string)=>{if(name===failure)throw new Error('write failed');writes.push(name+':'+key);pending.push(()=>stores[name]!.set(key,value));},
   clear:()=>{throw new Error('must never clear');},getAll:()=>{throw new Error('must never getAll');},
  })};setTimeout(()=>{if(!aborted){pending.forEach(fn=>fn());tx.oncomplete?.();}},0);return tx;
 })};vi.stubGlobal('indexedDB',{open:()=>{const r={result:db,onsuccess:undefined as undefined|(()=>void)};queueMicrotask(()=>r.onsuccess?.());return r;}});
 return {stores,reads,writes,fail:(name:string)=>{failure=name;}};
}
function fixture(){return parseCollection({schemaVersion:2,name:'收藏',entries:['one','two'].map(id=>({id,name:id,notes:'保留',reference:null,project:createEmptyProject(id,id)}))});}
beforeEach(()=>vi.mocked(loadWorkspace).mockReset());afterEach(()=>vi.unstubAllGlobals());
describe('lazy collection library',()=>{
 it('opens an index without reading any building, part or workspace, even when unselected data is corrupt',async()=>{
  const db=database(),c=fixture();db.stores.collection!.set('current',collectionStorageRecords(c).metadata);db.stores.buildings!.set('two',new Blob(['corrupt']));
  const library=await loadLibrary();expect(library?.entries.map(e=>e.projectId)).toEqual(['one','two']);expect(db.reads).toEqual(['collection:current']);expect(loadWorkspace).not.toHaveBeenCalled();expect(JSON.stringify(library)).not.toContain('blocks');
 });
 it('loads only the selected compressed model and its workspace; missing selected data never writes',async()=>{
  const db=database(),c=fixture(),p=c.entries[0]!.project;db.stores.buildings!.set(p.id,await encodeBuilding(p));const edited={...p,title:'編輯後'};vi.mocked(loadWorkspace).mockResolvedValue(createWorkspace(edited));
  expect(await loadLibraryEntry(createLibraryEntry(c.entries[0]!))).toEqual(edited);expect(db.reads).toEqual(['buildings:one']);expect(loadWorkspace).toHaveBeenCalledExactlyOnceWith('one');
  await expect(loadLibraryEntry(createLibraryEntry(c.entries[1]!))).rejects.toThrow('缺少');expect(db.writes).toEqual([]);
 });
 it('saves metadata without rewriting payloads; incremental model writes preserve all unrelated records',async()=>{
  const db=database(),c=fixture(),orphan=new Blob(['backup']);db.stores.buildings!.set('old-orphan',orphan);const library={name:c.name,entries:c.entries.map(createLibraryEntry)};
  await saveLibrary(library,[c.entries[0]!.project]);expect(db.writes).toEqual(['buildings:one','collection:current']);db.writes.length=0;
  await saveLibrary({...library,name:'改名'});expect(db.writes).toEqual(['collection:current']);expect(db.stores.buildings!.get('old-orphan')).toBe(orphan);expect((await loadLibrary())?.name).toBe('改名');
 });
 it('archives inline legacy data atomically and loads only the selected parts after a metadata-only save',async()=>{
  const db=database(),c=fixture(),old={schemaVersion:1,name:'舊收藏',entries:c.entries.map(e=>({id:e.id,name:e.name,notes:e.notes,reference:e.reference,parts:[e.project]}))};db.stores.collection!.set('current',old);
  const library=(await loadLibrary())!;expect(JSON.stringify(library)).not.toContain('blocks');await saveLibrary({...library,name:'新名稱'});expect(db.stores.collection!.get('legacy-inline-v1')).toBe(old);
  expect(await loadLibraryEntry((await loadLibrary())!.entries[0]!)).toEqual(c.entries[0]!.project);expect(loadWorkspace).not.toHaveBeenCalledWith('two');
 });
 it('resolves only selected legacy part edits and keeps the merged project identifier stable',async()=>{
  const db=database(),c=fixture(),parts=c.entries.map(e=>e.project);for(const p of parts)db.stores.parts!.set(p.id,p);
  db.stores.collection!.set('current',{storageVersion:2,collection:{schemaVersion:1,name:'舊收藏',entries:[{id:'combined',name:'合併',notes:'',reference:null,parts:['one','two']},{id:'missing',name:'缺少',notes:'',reference:null,parts:['missing']}]}});
  const library=(await loadLibrary())!,p=await loadLibraryEntry(library.entries[0]!);expect(p.id).toBe(library.entries[0]!.projectId);expect(db.reads).toEqual(['collection:current','parts:one','parts:two']);expect(loadWorkspace).not.toHaveBeenCalledWith('missing');
 });
 it('keeps the prior index and payload on transaction failure',async()=>{
  const db=database(),c=fixture(),old=collectionStorageRecords(c).metadata;db.stores.collection!.set('current',old);db.fail('collection');await expect(saveLibrary({name:c.name,entries:c.entries.map(createLibraryEntry)},[c.entries[0]!.project])).rejects.toThrow('write failed');expect(db.stores.collection!.get('current')).toBe(old);expect(db.stores.buildings!.size).toBe(0);
 });
 it('enforces aggregate and per-building metadata bounds without allocating giant models',async()=>{
  database();const entry=createLibraryEntry(fixture().entries[0]!);await expect(saveLibrary({name:'大收藏',entries:Array.from({length:6},(_,i)=>({...entry,id:'e'+i,projectId:'p'+i,cellCount:1000000}))})).rejects.toThrow('500 萬');await expect(saveLibrary({name:'大收藏',entries:[{...entry,cellCount:1000001}]})).rejects.toThrow('100 萬');
 });
 it('keeps the eager compatibility API readable after a version 4 save',async()=>{
  database();const c=fixture();await saveLibrary({name:c.name,entries:c.entries.map(createLibraryEntry)},c.entries.map(e=>e.project));expect(await loadCollection()).toEqual(c);
 });
});
