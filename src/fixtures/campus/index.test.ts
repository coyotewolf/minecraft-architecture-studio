import { describe, expect, it } from 'vitest';
import { createCampus, campusToJson, campusToCsv, assembleCampus } from './index.ts';
import { inventory } from '../../features/build/model.ts';
import { shapeForBlock } from '../../features/viewer/geometry.ts';
const campus=createCampus();
describe('whole-campus canonical collection',()=>{
 it('covers every uploaded reference and preserves every district cell without overlap',()=>{
  expect(new Set(campus.districts.flatMap(d=>d.references))).toEqual(new Set(Array.from({length:11},(_,i)=>'reference-'+String(i+1).padStart(2,'0'))));
  expect(campus.districts).toHaveLength(15);expect(campus.blocks.length).toBe(campus.districts.reduce((n,d)=>n+d.project.blocks.length,0));
  expect(new Set(campus.blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`)).size).toBe(campus.blocks.length);
  expect(campus.districts.every(d=>d.project.blocks.length<=50000)).toBe(true);
 });
 it('has resolved inventory, valid complete rendered shapes and explicit estimates for every cell',()=>{
  expect(campus.totalItems).toBe(campus.districts.reduce((n,d)=>n+inventory(d.project).totalInventoryItems!,0));
  expect(campus.totalItems).toBeGreaterThan(180000);expect(campus.totalItems).toBeLessThan(campus.blocks.length);
  expect(campus.blocks.filter(b=>!shapeForBlock(b).supported).map(b=>b.id)).toEqual([]);
  expect(campus.blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.referenceRegionId)).toBe(true);
 });
 it('exports every global coordinate and state without inventing a single aggregate Project',()=>{
  const parsed=JSON.parse(campusToJson(campus));expect(parsed.schema).toBe('minecraft-campus-1');expect(parsed.districts.flatMap((d:{project:{blocks:unknown[]}})=>d.project.blocks)).toEqual(campus.blocks);
  const lines=campusToCsv(campus).split('\r\n');expect(lines).toHaveLength(campus.blocks.length+1);
  expect(lines[1]).toContain('"'+campus.blocks[0]!.uid+'"');
 });
 it('rejects overlapping saved districts before showing an ambiguous model',()=>{expect(()=>assembleCampus([campus.districts[0]!,campus.districts[0]!])).toThrow('重疊');});
 it('keeps the raised airport bridge walking channel clear at both elbows',()=>{
  const occupied=new Map(campus.blocks.map(b=>[`${b.pos.x},${b.pos.y},${b.pos.z}`,b]));
  for(const [x,z] of [[0,-25],[0,-26],[1,-26],[20,-26],[38,-26],[39,-26],[39,-27],[39,-45],[39,-68]] as const){expect(occupied.has(`${x},19,${z}`)).toBe(true);for(const y of [20,21])expect(occupied.has(`${x},${y},${z}`)).toBe(false);}
 });
});
