import { describe, expect, it } from 'vitest';
import { createCampusV2 as createCampus, campusToJson, campusToCsv, assembleCampus } from './index.ts';
import { inventory } from '../../features/build/model.ts';
import { shapeForBlock } from '../../features/viewer/geometry.ts';
const campus=createCampus();
describe('whole-campus canonical collection',()=>{
 it('covers every uploaded reference and preserves every district cell without overlap',()=>{
  expect(new Set(campus.districts.flatMap(d=>d.references))).toEqual(new Set(Array.from({length:11},(_,i)=>'reference-'+String(i+1).padStart(2,'0'))));
  expect(campus.districts.filter(d=>!d.id.startsWith('campus-landscape'))).toHaveLength(12);expect(campus.districts.filter(d=>d.id.startsWith('campus-landscape')).length).toBeGreaterThanOrEqual(3);expect(campus.blocks.length).toBe(campus.districts.reduce((n,d)=>n+d.project.blocks.length,0));
  expect(new Set(campus.blocks.map(b=>`${b.pos.x},${b.pos.y},${b.pos.z}`)).size).toBe(campus.blocks.length);
  expect(campus.districts.every(d=>d.project.blocks.length<=50000)).toBe(true);
 });
 it('has resolved inventory, valid complete rendered shapes and explicit estimates for every cell',()=>{
  expect(campus.totalItems).toBe(campus.districts.reduce((n,d)=>n+inventory(d.project).totalInventoryItems!,0));
  expect(campus.totalItems).toBeGreaterThan(400000);expect(campus.totalItems).toBeLessThan(campus.blocks.length);
  expect(campus.blocks.filter(b=>!shapeForBlock(b).supported).map(b=>b.id)).toEqual([]);
  expect(campus.blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.referenceRegionId)).toBe(true);
 });
 it('exports every district coordinate and state in the full campus JSON',()=>{
  const parsed=JSON.parse(campusToJson(campus));expect(parsed.schema).toBe('minecraft-campus-1');expect(parsed.districts).toHaveLength(campus.districts.length);for(let i=0;i<campus.districts.length;i++)expect(JSON.stringify(parsed.districts[i].project.blocks)).toBe(JSON.stringify(campus.districts[i]!.project.blocks));
 });
 it('exports every global coordinate in the full campus CSV',()=>{
  const lines=campusToCsv(campus).split('\r\n');expect(lines).toHaveLength(campus.blocks.length+1);
  expect(lines[1]).toContain('"'+campus.blocks[0]!.uid+'"');
 });
 it('rejects overlapping saved districts before showing an ambiguous model',()=>{expect(()=>assembleCampus([campus.districts[0]!,campus.districts[0]!])).toThrow('重疊');});
 it('uses separated elevations, authored forests and rock walls rather than rectangular presentation bases',()=>{
  const buildings=campus.districts.filter(d=>!d.id.startsWith('campus-landscape'));
  expect(new Set(buildings.map(d=>d.origin[1])).size).toBeGreaterThanOrEqual(4);
  const terrain=campus.blocks.filter(b=>b.componentId?.startsWith('campus-landscape'));
  expect(terrain.filter(b=>b.category==='Cliff').length).toBeGreaterThan(10000);
  expect(terrain.filter(b=>b.id==='minecraft:oak_leaves').length).toBeGreaterThan(10000);
  expect(terrain.filter(b=>b.id==='minecraft:oak_leaves').every(b=>b.state.persistent==='true')).toBe(true);
  expect(terrain.some(b=>b.pos.y===-10)).toBe(true);
  expect(campus.districts.every(d=>d.project.id.endsWith('-reference-v2'))).toBe(true);
 });
});
