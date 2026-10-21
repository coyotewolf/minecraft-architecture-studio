import { describe, expect, it, vi } from 'vitest';
import { DistrictBuilder } from '../../fixtures/campus/builder.ts';
import { loadWorkspace, createWorkspace } from '../projects/storage.ts';
vi.mock('../projects/storage.ts',async original=>({...await original<typeof import('../projects/storage.ts')>(),loadWorkspace:vi.fn()}));
import { parseProject } from '../../core/model.ts';
import { createEmptyProject } from '../../core/project.ts';
import { collectionStorageRecords, collectionFromStorage, appendImported, copyEntry, deserializeCollection, parseCollection, resolveCollection, saveCollection, serializeCollection, deserializeBuildingImport, encodeBuilding, decodeBuilding } from './storage.ts';
const block={uid:'stone-1',id:'minecraft:stone',pos:{x:-2,y:0,z:3},state:{},source:{origin:'user_created'},edits:{createdByTransactionId:'test',lastModifiedByTransactionId:'test',userModified:true}};
function fixture(){return parseCollection({schemaVersion:2,name:'建築群',entries:[{id:'tower',name:'金葉',notes:'正背面',reference:'golden-leaf',project:{...createEmptyProject('building-1','完整建築'),blocks:[block]}}]});}
function legacy(){const c=fixture(),e=c.entries[0]!;return {schemaVersion:1,name:c.name,entries:[{id:e.id,name:e.name,notes:e.notes,reference:e.reference,parts:[e.project,{...createEmptyProject('building-2','上部'),blocks:[{...block,uid:'stone-2',pos:{x:-2,y:1,z:3}}]}]}]};}
describe('one building one canonical project',()=>{
 it('round trips state, provenance, coordinates and metadata',()=>{const c=fixture();expect(deserializeCollection(serializeCollection(c))).toEqual(c);expect(Object.isFrozen(c.entries[0]!.project.blocks)).toBe(true);expect(serializeCollection(c)).not.toContain('parts');});
 it('imports a single downloaded canonical building as an independent entry',()=>{const c=fixture(),p=c.entries[0]!.project;expect(deserializeBuildingImport(JSON.stringify(p)).entries[0]!.project).toEqual(p);expect(deserializeBuildingImport(serializeCollection(c))).toEqual(c);});
 it('copies IDs while preserving original records',()=>{const old=fixture(),next=appendImported(old,old,'new');expect(next.entries).toHaveLength(2);expect(next.entries[0]).toEqual(old.entries[0]);expect(next.entries[1]!.project.id).toBe('collection-new-0');expect(next.entries[1]!.project.blocks).toEqual(old.entries[0]!.project.blocks);});
 it('merges legacy parts without moving coordinates or losing logical pairs',()=>{const old=legacy(),builder=new DistrictBuilder({id:'door',title:'門',origin:[0,0,0],references:['test-reference'],features:[],notes:''});builder.door(0,1,0);const door=builder.finish().project;old.entries[0]!.parts.push(door as typeof old.entries[0]['parts'][number]);const c=parseCollection(old);expect(c.entries[0]!.project.blocks).toHaveLength(4);expect(c.entries[0]!.project.logicalStructures).toEqual(door.logicalStructures);expect(c.entries[0]!.project.blocks[0]!.pos).toEqual(block.pos);expect(copyEntry(c.entries[0]!,'copy').project.logicalStructures).toEqual(door.logicalStructures);});
 it('rejects overlapping legacy coordinates instead of discarding edits',()=>{const old=legacy();old.entries[0]!.parts[1]={...old.entries[0]!.parts[1]!,blocks:[block]};expect(()=>parseCollection(old)).toThrow();});
 it('resolves saved legacy edits before migration and retains untouched portions',async()=>{vi.mocked(loadWorkspace).mockReset();const old=parseCollection(legacy()),edited={...legacy().entries[0]!.parts[0]!,designRevision:'edited',blocks:[]};vi.mocked(loadWorkspace).mockImplementation(async id=>id==='building-1'?createWorkspace(edited):undefined);const c=await resolveCollection(old);expect(c.entries[0]!.project.blocks).toHaveLength(1);expect(c.entries[0]!.project.blocks[0]!.uid).toBe('stone-2');expect(old.entries[0]!.project.blocks).toHaveLength(2);});
 it('prefers the saved complete project once migration is edited',async()=>{vi.mocked(loadWorkspace).mockReset();const old=parseCollection(legacy()),edited={...old.entries[0]!.project,designRevision:'new',blocks:[]};vi.mocked(loadWorkspace).mockResolvedValue(createWorkspace(edited));expect((await resolveCollection(old)).entries[0]!.project).toEqual(edited);expect(loadWorkspace).toHaveBeenCalledTimes(1);});
 it('does not mask inaccessible saved data',async()=>{vi.mocked(loadWorkspace).mockRejectedValueOnce(new Error('database unavailable'));await expect(resolveCollection(fixture())).rejects.toThrow('database unavailable');});
 it('validates IDs, canonical state and unknown versions',()=>{const c=fixture();expect(()=>parseCollection({...c,entries:[...c.entries,{...c.entries[0],id:'another'}]})).toThrow(/識別碼/);for(const field of ['state','pos']){const raw=JSON.parse(serializeCollection(c));raw.entries[0].project.blocks[0][field]=field==='state'?{fake:'true'}:{x:.5,y:0,z:0};expect(()=>parseCollection(raw)).toThrow();}expect(()=>parseCollection({...c,schemaVersion:3})).toThrow();});
 it('stores metadata without blocks and reconstructs legacy and current indexes',()=>{const c=fixture(),r=collectionStorageRecords(c);expect(JSON.stringify(r.metadata)).not.toContain('blocks');expect(collectionFromStorage(r.metadata,r.projects)).toEqual(c);expect(()=>collectionFromStorage(r.metadata,[])).toThrow(/缺少/);const old=legacy(),parts=old.entries[0]!.parts;expect(collectionFromStorage({storageVersion:2,collection:{...old,entries:[{...old.entries[0],parts:parts.map(p=>p.id)}]}},parts.map(parseProject))!.entries[0]!.project.blocks).toHaveLength(2);});
 it('compresses a large complete building into one record with exact restoration',async()=>{const p=parseCollection({...fixture(),entries:[{...fixture().entries[0],project:{...fixture().entries[0]!.project,blocks:Array.from({length:60000},(_,i)=>({...block,uid:'block-'+i,pos:{x:i%300,y:Math.floor(i/300),z:0}}))}}]}).entries[0]!.project;const blob=await encodeBuilding(p);expect(blob.size).toBeLessThan(JSON.stringify(p).length/5);expect(await decodeBuilding(blob)).toEqual(p);},30000);
 it('rejects raw oversized collections before attempting to normalize any block',()=>{const c=fixture(),bad={...c.entries[0]!.project,blocks:Array(1000001).fill(null)};expect(()=>parseCollection({...c,entries:[{...c.entries[0],project:bad}]})).toThrow('單棟建築超過 100 萬格');});
 it('preserves many valid buildings when the collection exceeds one million cells',()=>{
  const original=fixture();
  const one=parseCollection({...original,entries:[{...original.entries[0],project:{...original.entries[0]!.project,blocks:Array.from({length:50001},(_,i)=>({...block,uid:'many-'+i,pos:{x:i%300,y:Math.floor(i/300),z:0}}))}}]});
  const entries=Array.from({length:21},(_,i)=>copyEntry({...one.entries[0]!,notes:'保留版本 '+i},'large-'+i));
  const c=parseCollection({...one,entries});
  expect(c.entries.reduce((n,e)=>n+e.project.blocks.length,0)).toBe(1050021);
  expect(c.entries.map(e=>e.notes)).toEqual(entries.map(e=>e.notes));
  for(let i=0;i<entries.length;i++)expect(c.entries[i]!.project.blocks).toBe(entries[i]!.project.blocks);
  const records=collectionStorageRecords(c);
  expect(collectionFromStorage(records.metadata,records.projects)).toEqual(c);
 });
 it('bounds the collection at five million cells before normalizing any records',()=>{
  const c=fixture(),entry=c.entries[0]!,blocks=Array(1000000).fill(null);
  const entries=Array.from({length:6},(_,i)=>({...entry,id:'oversize-'+i,project:{...entry.project,id:'oversize-'+i,blocks}}));
  expect(()=>parseCollection({...c,entries})).toThrow('收藏超過 500 萬格');
 });
 it('bounds the combined legacy parts of a single building before normalization',()=>{
  const c=legacy(),p=c.entries[0]!.parts[0]!;
  c.entries[0]!.parts=[{...p,blocks:Array(500001).fill(null)},{...p,id:'large-second',blocks:Array(500000).fill(null)}];
  expect(()=>parseCollection(c)).toThrow('單棟建築超過 100 萬格');
 });
 it('rejects corrupted gzip and bounded decompression expansion',async()=>{await expect(decodeBuilding(new Blob(['corrupt gzip']))).rejects.toThrow();const packed=await new Response(new Blob([' '.repeat(20000)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();expect(packed.size).toBeLessThan(1000);await expect(decodeBuilding(packed,1000)).rejects.toThrow('解壓縮大小限制');});
 it('validates canonical records before compression',async()=>{const p=fixture().entries[0]!.project;await expect(encodeBuilding({...p,blocks:[{...p.blocks[0]!,state:{invalid:'true'}}]})).rejects.toThrow();});
 it.each(['buildings','collection'])('aborts synchronous %s write failures',async failingStore=>{const failure=new Error('put failure');let aborted=false;const tx={oncomplete:undefined as undefined|(()=>void),onerror:undefined,onabort:undefined,objectStore:(name:string)=>({clear:()=>{},put:()=>{if(name===failingStore)throw failure;}}),abort:vi.fn(()=>{aborted=true;})};const db={transaction:()=>{queueMicrotask(()=>{if(!aborted)tx.oncomplete?.();});return tx;},close:vi.fn()},request:{result:typeof db;onsuccess?:()=>void}={result:db};vi.stubGlobal('indexedDB',{open:()=>{queueMicrotask(()=>request.onsuccess?.());return request;}});try{await expect(saveCollection(fixture())).rejects.toBe(failure);expect(tx.abort).toHaveBeenCalledOnce();}finally{vi.unstubAllGlobals();}});
});
