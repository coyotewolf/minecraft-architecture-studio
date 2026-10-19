import { describe, expect, test } from 'vitest';
import { createIndustryDistricts } from './industry.ts';
import { parseProject } from '../../core/model.ts';
const districts=createIndustryDistricts();
const limits=[[40,24,30],[56,34,55],[44,27,15],[20,23,43]] as const;
const at=(index:number,x:number,y:number,z:number)=>{const d=districts[index]!;return d.project.blocks.find(b=>b.pos.x===d.origin[0]+x&&b.pos.y===d.origin[1]+y&&b.pos.z===d.origin[2]+z);};
describe('reference-shaped industrial districts',()=>{
 test('canonical blocks stay within reservations at the four elevated origins',()=>{
  expect(districts.map(d=>d.origin)).toEqual([[-100,38,-100],[55,36,-105],[105,8,145],[132,12,40]]);
  expect(districts.map(d=>d.references[0])).toEqual(['reference-10','reference-02','reference-03','reference-07']);
  for(const [i,d] of districts.entries()){
   const [x,z,y]=limits[i]!;expect(d.project.blocks.length).toBeLessThan(50000);expect(parseProject(d.project).blocks.length).toBe(d.project.blocks.length);
   expect(new Set(d.project.blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`)).size).toBe(d.project.blocks.length);
   for(const block of d.project.blocks){expect(Math.abs(block.pos.x-d.origin[0])).toBeLessThanOrEqual(x);expect(Math.abs(block.pos.z-d.origin[2])).toBeLessThanOrEqual(z);expect(block.pos.y-d.origin[1]).toBeGreaterThanOrEqual(0);expect(block.pos.y-d.origin[1]).toBeLessThanOrEqual(y);expect(block.source.origin).toBe('ai_estimated');}
  }
 });
 test('factory silhouette is tiered horizontal halls with inclined solar arrays and outside viaduct',()=>{
  expect(at(0,0,24,-15)?.category).toBe('Roof');expect(at(0,-29,25,-21)?.category).toBe('Solar panels');expect(at(0,-29,29,-13)?.category).toBe('Solar panels');
  expect(at(0,0,9,13)?.id).toBe('minecraft:rail');expect(at(0,0,12,13)?.category).toBe('Train');
  expect(districts[0]!.project.blocks.filter(b=>b.pos.y-districts[0]!.origin[1]>24).every(b=>b.category?.startsWith('Solar'))).toBe(true);
 });
 test('spaceport has tall enclosed gold-framed cube on legs, underhung ship and southern glass bridge',()=>{
  expect(at(1,0,55,15)?.category).toBe('Roof');expect(at(1,0,54,28)?.id).toBe('minecraft:gold_block');expect(at(1,-23,10,6)?.id).toBe('minecraft:white_concrete');
  expect(at(1,0,10,16)?.category).toBe('Suspended spacecraft');expect(at(1,0,20,16)).toBeUndefined();
  expect(at(1,4,23,33)?.id).toBe('minecraft:cyan_stained_glass');for(const y of [21,22,23,24])expect(at(1,0,y,28)).toBeUndefined();
  expect(at(1,-33,2,-7)?.category).toBe('Parked aircraft');
 });
 test('six rounded white-gray hangars remain behind the three outdoor dragons',()=>{
  for(const x of [-35,-21,-7,7,21,35]){expect(at(2,x,12,-25)?.category).toBe('Roof');for(const y of [2,3,4,5])expect(at(2,x,y,-8)).toBeUndefined();}
  const roofs=districts[2]!.project.blocks.filter(b=>b.category==='Roof');expect(roofs.every(b=>b.id==='minecraft:white_concrete'||b.id==='minecraft:deepslate_tiles')).toBe(true);
  for(const [x,id] of [[-28,'minecraft:red_concrete'],[0,'minecraft:black_concrete'],[28,'minecraft:white_concrete']] as const){expect(at(2,x,6,8)?.id).toBe(id);expect(at(2,x+2,10,16)?.id).toBe('minecraft:sea_lantern');}
  expect(districts[2]!.project.blocks.filter(b=>b.category==='Dragon sculpture').every(b=>b.pos.z>=districts[2]!.origin[2]-2)).toBe(true);
 });
 test('workshop narrows in upper tiers with diagonal exterior ribs and real workstations',()=>{
  expect(at(3,14,10,0)?.id).toBe('minecraft:cyan_stained_glass');expect(at(3,11,26,0)?.id).toBe('minecraft:cyan_stained_glass');expect(at(3,8,38,0)?.id).toBe('minecraft:cyan_stained_glass');
  expect(at(3,-14,2,16)?.id).toBe('minecraft:white_concrete');expect(at(3,8,41,16)?.id).toBe('minecraft:white_concrete');expect(at(3,2,34,3)?.id).toBe('minecraft:enchanting_table');
 });
 test('every stair tread retains two clear headroom cells',()=>{
  for(const d of districts){const cells=new Set(d.project.blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`));for(const b of d.project.blocks.filter(b=>b.category==='Stairs'&&b.id==='minecraft:quartz_stairs'))for(const h of [1,2])expect(cells.has(`${b.pos.x},${b.pos.y+h},${b.pos.z}`),`${d.id} ${JSON.stringify(b.pos)} head ${h}`).toBe(false);}
 });
});

