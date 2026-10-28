import { describe, expect, it } from 'vitest';
import { createGardenDistrictsV3 } from './gardens-v3.ts';
import { REFERENCE_ORIGINS } from './reference-layout.ts';
import { parseProject } from '../../core/model.ts';
const districts=createGardenDistrictsV3();
const group=(id:string)=>districts.filter(d=>d.project.blocks.some(b=>b.componentId===id)).flatMap(d=>d.project.blocks);
const map=(id:string)=>new Map(group(id).map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
const cell=(m:ReturnType<typeof map>,o:readonly[number,number,number],x:number,y:number,z:number)=>m.get([x+o[0],y+o[1],z+o[2]].join(','));
describe('V3 finer garden buildings',()=>{
 it('translates each unchanged local envelope exactly to its fitted reference origin',()=>{
  const specs=[['greenhouses',[-48,0,-54],[48,28,54]],['apartments',[-37,0,-31],[37,75,33]],['pavilions',[-58,0,-58],[58,16,58]],['temples',[-28,0,-16],[28,30,16]]] as const;
  for(const [key,min,max]of specs){const id='garden-'+key+'-v3',o=REFERENCE_ORIGINS[key],bs=group(id);
   for(const d of districts.filter(d=>d.parentGroupId===id))expect(d.origin).toEqual(o);
   for(const [i,axis]of (['x','y','z'] as const).entries()){
    expect(Math.min(...bs.map(b=>b.pos[axis]))).toBe(o[i]!+min[i]!);
    expect(Math.max(...bs.map(b=>b.pos[axis]))).toBe(o[i]!+max[i]!);
   }
  }
 });
 it('splits canonical parts without duplicate world positions or broken logical structures',()=>{
  const positions=new Set<string>();
  for(const d of districts){expect(d.project.blocks.length).toBeLessThan(50000);expect(parseProject(d.project)).toEqual(d.project);
   for(const b of d.project.blocks){const key=JSON.stringify(b.pos);expect(positions.has(key)).toBe(false);positions.add(key);expect(b.source.origin).toBe('ai_estimated');}
   for(const pair of d.project.logicalStructures)expect(pair.memberUids.every(uid=>d.project.blocks.some(b=>b.uid===uid))).toBe(true);
  }
 });
 it('uses dense white arch ribs and narrow gold longitudinal frames rather than oversized old blocks',()=>{
  const id='garden-greenhouses-v3',m=map(id),o=REFERENCE_ORIGINS.greenhouses;
  for(const cx of [-22,22])for(let z=-50;z<=50;z+=5)expect(cell(m,o,cx,28,z)?.id).toBe('minecraft:white_concrete');
  expect(cell(m,o,-22,28,1)?.id).toBe('minecraft:gold_block');
  expect(group(id).filter(b=>b.id==='minecraft:wheat').length).toBeGreaterThan(300);
  expect(group(id).some(b=>b.id==='minecraft:oak_fence_gate')).toBe(true);
  expect(group(id).filter(b=>b.category==='Planters').length).toBeGreaterThan(1000);
  for(const b of group(id).filter(b=>b.category==='Circulation'))for(const h of [1,2])expect(m.has([b.pos.x,b.pos.y+h,b.pos.z].join(','))).toBe(false);
  for(let z=-40;z<=24;z++)for(const y of [2,3,4])expect(cell(m,o,22,y,z)).toBeUndefined();
 });
 it('provides unequal 10/12/8 floors, 30 bed pairs, narrow balconies and substantial terrace planting',()=>{
  const id='garden-apartments-v3',m=map(id),o=REFERENCE_ORIGINS.apartments;
  const parts=districts.filter(d=>d.project.blocks.some(b=>b.componentId===id));
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.flatMap(d=>d.project.logicalStructures).filter(g=>g.kind==='bed')).toHaveLength(30);
  for(const [cx,floors]of [[-24,10],[0,12],[24,8]] as const)for(let level=0;level<floors;level++){
   expect(cell(m,o,cx+3,1+level*6,0)?.id).toBe('minecraft:smooth_quartz');
   for(const y of [2+level*6,3+level*6])expect(cell(m,o,cx+2,y,0)).toBeUndefined();
  }
  for(const [cx,roof]of [[-24,61],[0,73],[24,49]] as const)expect(cell(m,o,cx+3,roof,0)?.id).toBe('minecraft:smooth_quartz');
  expect(group(id).filter(b=>b.id==='minecraft:oak_leaves').length).toBeGreaterThan(500);
  for(const b of group(id).filter(b=>b.category==='Circulation'))for(const h of [1,2])expect(m.has([b.pos.x,b.pos.y+h,b.pos.z].join(','))).toBe(false);
 });
 it('has six low domes around a large white/gold circular plaza',()=>{
  const id='garden-pavilions-v3',m=map(id),o=REFERENCE_ORIGINS.pavilions;
  expect(group(id).filter(b=>b.id==='minecraft:cartography_table')).toHaveLength(6);
  expect(cell(m,o,0,1,30)?.id).toBe('minecraft:gold_block');
  expect(cell(m,o,8,1,15)?.id).toBe('minecraft:smooth_quartz');
  expect(Math.max(...group(id).map(b=>b.pos.y))-o[1]).toBe(16);
  for(const [cx,cz]of [[-46,0],[-24,-40],[24,-40],[46,0],[24,40],[-24,40]] as const)for(let z=7;z<=11;z++)for(const y of [2,3,4])expect(cell(m,o,cx,y,cz+z)).toBeUndefined();
 });
 it('places 16-high pyramid roofs on 14-high glazed bases with clear temple approaches',()=>{
  const id='garden-temples-v3',m=map(id),o=REFERENCE_ORIGINS.temples;
  expect(group(id).filter(b=>b.category==='Roof').every(b=>b.id==='minecraft:gold_block')).toBe(true);
  for(const cx of [-15,15]){
   expect(cell(m,o,cx,30,0)?.id).toBe('minecraft:gold_block');
   expect(cell(m,o,cx-11,10,0)?.id).toBe('minecraft:white_concrete');
   expect(cell(m,o,cx-11,10,1)?.id).toBe('minecraft:light_blue_stained_glass');
   for(let z=6;z<=15;z++)for(const y of [2,3])expect(cell(m,o,cx,y,z)).toBeUndefined();
  }
 });
});
