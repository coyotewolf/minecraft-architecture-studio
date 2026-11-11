import { deepStrictEqual } from 'node:assert/strict';
import {REFERENCE_ORIGINS as O} from './reference-layout.ts';
import {beforeAll,describe,it,expect} from 'vitest';
import {HighDetailBuilder} from './high-detail.ts';
import {createLandmarkDistrictsV3} from './landmarks-v3.ts';
const spec={id:'split-test',title:'測試',origin:[10,20,-30] as const,references:['reference-01'],features:[],notes:'推估'};
describe('high detail canonical parts',()=>{
 let parts: ReturnType<typeof createLandmarkDistrictsV3>;
 beforeAll(()=>{ parts=createLandmarkDistrictsV3(); });
 it('recreates exactly the same complete canonical projects',()=>{
  // Strict structural equality avoids matcher overhead over hundreds of thousands of records.
  deepStrictEqual(createLandmarkDistrictsV3().map(p=>p.project),parts.map(p=>p.project));
 });
 it('keeps logical pairs atomic and connects before partitioning',()=>{
  const b=new HighDetailBuilder(spec);b.set(0,0,0,'minecraft:oak_fence');b.set(1,0,0,'minecraft:oak_fence');b.bed(2,0,2);b.door(4,0,0);const parts=b.finishParts(3);
  expect(parts.flatMap(p=>p.project.blocks)).toHaveLength(6);
  expect(parts.flatMap(p=>p.project.blocks).find(c=>c.pos.x===10)?.state.east).toBe('true');
  for(const p of parts){expect(p.project.blocks.length).toBeLessThanOrEqual(3);for(const g of p.project.logicalStructures)expect(g.memberUids.every(uid=>p.project.blocks.some(c=>c.uid===uid))).toBe(true);}
  expect(()=>b.clear(2,0,2)).toThrow();expect(()=>b.set(4,0,0)).toThrow();expect(()=>b.finishParts(50000)).toThrow();
 });
 it('builds four detailed groups with bounded projects and usable stair headroom',()=>{
  const blocks=parts.flatMap(p=>p.project.blocks);const keys=new Set(blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`));
  expect(blocks.length).toBeGreaterThan(120000);expect(blocks.length).toBeLessThan(230000);
  expect(new Set(parts.map(p=>p.parentGroupId)).size).toBe(4);expect(keys.size).toBe(blocks.length);expect(parts.every(p=>p.project.blocks.length<50000)).toBe(true);
  const ring=blocks.filter(b=>b.componentId==='ring-control-spire');
  expect(ring.filter(b=>b.pos.y===O.ring[1]+115).every(b=>b.pos.x<=O.ring[0]-30)).toBe(true);
  const command=blocks.filter(b=>b.componentId==='teardrop-command');
  expect(Math.max(...command.map(b=>b.pos.y))-O.command[1]).toBe(155);expect(command.filter(b=>b.id==='minecraft:quartz_stairs')).toHaveLength(288);
  expect(Math.max(...ring.map(b=>b.pos.x))-Math.min(...ring.map(b=>b.pos.x))).toBe(130);
  const span=(y:number)=>{const row=command.filter(b=>b.pos.y===y+O.command[1]);return Math.max(...row.map(b=>b.pos.x))-Math.min(...row.map(b=>b.pos.x));};
  expect(span(60)).toBeGreaterThan(span(10));expect(span(60)).toBeGreaterThan(span(120));
  expect(blocks.some(b=>b.id==='minecraft:gold_block')).toBe(true);
  expect(blocks.every(b=>b.source.origin==='ai_estimated')).toBe(true);
  for(const b of blocks.filter(b=>b.id==='minecraft:quartz_stairs')){expect(keys.has(`${b.pos.x},${b.pos.y+1},${b.pos.z}`)).toBe(false);expect(keys.has(`${b.pos.x},${b.pos.y+2},${b.pos.z}`)).toBe(false);}
  for(let x=-3;x<=3;x++)for(let z=-22;z<=-12;z++){expect(keys.has([x+O.command[0],117,z+O.command[2]].join(","))).toBe(true);expect(keys.has([x+O.command[0],118,z+O.command[2]].join(","))).toBe(false);expect(keys.has([x+O.command[0],119,z+O.command[2]].join(","))).toBe(false);}
  const twins=blocks.filter(b=>b.componentId==='twin-residential-library'&&b.pos.y>O.twins[1]+80);expect(twins.some(b=>b.id==='minecraft:cyan_stained_glass')).toBe(true);
 });
});







