import { describe, expect, test } from 'vitest';
import { createIndustryDistricts } from './industry.ts';
import { parseProject } from '../../core/model.ts';
const districts=createIndustryDistricts();
const limits=[[32,20,30],[52,25,44],[32,22,23],[15,16,32]] as const;
const at=(index:number,x:number,y:number,z:number)=>{const d=districts[index]!;return d.project.blocks.find(b=>b.pos.x===d.origin[0]+x&&b.pos.y===y&&b.pos.z===d.origin[2]+z);};
describe('industrial campus districts',()=>{
 test('four bounded canonical districts use unique cells and explicit estimated provenance',()=>{
  expect(districts.map(d=>d.references[0])).toEqual(['reference-10','reference-02','reference-03','reference-07']);
  let total=0;
  for(const [i,d] of districts.entries()){
   const [x,z,y]=limits[i]!;total+=d.project.blocks.length;
   expect(d.project.blocks.length).toBeLessThan(50000);expect(parseProject(d.project).blocks.length).toBe(d.project.blocks.length);
   expect(new Set(d.project.blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`)).size).toBe(d.project.blocks.length);
   for(const b of d.project.blocks){expect(Math.abs(b.pos.x-d.origin[0])).toBeLessThanOrEqual(x);expect(Math.abs(b.pos.z-d.origin[2])).toBeLessThanOrEqual(z);expect(b.pos.y).toBeGreaterThanOrEqual(0);expect(b.pos.y).toBeLessThanOrEqual(y);expect(b.source.origin).toBe('ai_estimated');}
   expect(d.project.blocks.some(b=>b.category==='Floor')).toBe(true);
  }
  console.info('Industry district cells',districts.map(d=>[d.id,d.project.blocks.length]),'total',total);
  expect(total).toBeGreaterThanOrEqual(40000);expect(total).toBeLessThanOrEqual(60000);
 });
 test('factory, hangars and workshop preserve four-high entry passages above walking floor',()=>{
  const entries=[[0,-12,7],[0,21,5],[1,-38,-2],[1,-14,-2],[1,10,-2],[2,-21,6],[2,0,6],[2,21,6],[3,0,13]];
  for(const [i,x,z] of entries as [number,number,number][]){expect(at(i,x,1,z)?.category).toBe('Floor');for(let y=2;y<=5;y++)expect(at(i,x,y,z)).toBeUndefined();}
 });
 test('all stair treads have two cells of headroom and raised arrivals meet a landing',()=>{
  for(const d of districts){const cells=new Set(d.project.blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`));for(const b of d.project.blocks.filter(b=>b.category==='Stairs'&&b.id==='minecraft:quartz_stairs'))for(const h of [1,2])expect(cells.has(`${b.pos.x},${b.pos.y+h},${b.pos.z}`),`${d.id} stair ${JSON.stringify(b.pos)} head ${h}`).toBe(false);}
  expect(at(0,-27,8,-9)?.category).toBe('Floor');expect(at(0,26,7,9)?.category).toBe('Floor');
  for(const x of [-21,0,21])expect(at(2,x-7,12,-16)?.category).toBe('Floor');
 });
 test('distinct interiors and raised circulation are real canonical blocks',()=>{
  expect(at(0,-24,4,-12)?.id).toBe('minecraft:blast_furnace');expect(at(0,-28,8,-8)?.id).toBe('minecraft:quartz_stairs');
  expect(at(1,40,31,-12)?.category).toBe('Workstations');expect(at(1,16,23,-14)?.id).toBe('minecraft:cyan_stained_glass');
  for(const [x,id] of [[-21,'minecraft:red_concrete'],[0,'minecraft:black_concrete'],[21,'minecraft:white_concrete']] as const){expect(at(2,x,6,-8)?.id).toBe(id);expect(at(2,x+2,10,0)?.id).toBe('minecraft:sea_lantern');expect(at(2,x-5,1,14)?.id).toBe('minecraft:blue_stained_glass');}
  expect(at(3,2,26,2)?.id).toBe('minecraft:enchanting_table');expect(at(3,7,2,4)?.id).toBe('minecraft:smithing_table');
  for(const y of [1,9,17]){const x=y===9?9:-9;expect(at(3,x,y+8,1)?.id).toBe('minecraft:quartz_stairs');expect(at(3,x,y+9,1)).toBeUndefined();expect(at(3,x,y+10,1)).toBeUndefined();}
 });
});
