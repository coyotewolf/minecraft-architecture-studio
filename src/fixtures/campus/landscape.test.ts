import { describe, expect, test } from 'vitest';
import { createCampusV2 as createCampus } from './index.ts';
import { createLandmarkDistricts } from './landmarks.ts';
import { createIndustryDistricts } from './industry.ts';
import { createGardenDistricts } from './gardens.ts';
const buildings=[...createLandmarkDistricts(),...createIndustryDistricts(),...createGardenDistricts()];
const campus=createCampus();
const landscape=campus.districts.filter(d=>d.id.startsWith('campus-landscape'));
const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
const architecture=buildings.flatMap(d=>d.project.blocks);
const doorway=(b:typeof architecture[number])=>b.componentId==='teardrop-command'&&b.pos.x>=-1&&b.pos.x<=1&&b.pos.y>=50&&b.pos.y<=54&&b.pos.z>=-16&&b.pos.z<=-10;
const all=campus.blocks;
const cells=new Map(all.map(b=>[key(b.pos.x,b.pos.y,b.pos.z),b]));
const route:{x:number;y:number;z:number}[]=[];
for(let z=-10;z>=-45;z--)route.push({x:0,y:49,z});
for(let x=1;x<=55;x++)route.push({x,y:49+Math.min(7,Math.floor(x/7)),z:-45});
for(let z=-46;z>=-71;z--)route.push({x:55,y:56,z});
describe('command-to-airport elevated glass skywalk',()=>{
 test('joins actual floors through a continuous route with only one-cell supported rises',()=>{
  expect(cells.get(key(0,49,-10))?.category).toBe('Floor');expect(cells.get(key(55,56,-71))?.category).toBe('Floor');
  for(const [i,p] of route.entries()){
   expect(cells.has(key(p.x,p.y,p.z)),`missing floor ${JSON.stringify(p)}`).toBe(true);
   if(i>0){const last=route[i-1]!;expect(Math.abs(p.x-last.x)+Math.abs(p.z-last.z)).toBe(1);expect(p.y-last.y).toBeGreaterThanOrEqual(0);expect(p.y-last.y).toBeLessThanOrEqual(1);if(p.y!==last.y)expect(cells.get(key(p.x,p.y,p.z))?.state.facing).toBe('east');}
  }
 });
 test('center and the three-wide walking channel have two cells of headroom',()=>{
  for(const p of route){const east=p.z===-45;for(let offset=-1;offset<=1;offset++){const x=p.x+(east?0:offset),z=p.z+(east?offset:0);for(const h of [1,2])expect(cells.has(key(x,p.y+h,z)),`blocked ${key(x,p.y+h,z)}`).toBe(false);}}
 });
 test('glass walls, roof and grounded piers distinguish an enclosed supported bridge',()=>{
  expect(cells.get(key(0,55,-30))?.category).toBe('Roof');expect(cells.get(key(2,52,-30))?.id).toBe('minecraft:cyan_stained_glass');
  expect(cells.get(key(57,59,-60))?.id).toBe('minecraft:cyan_stained_glass');expect(cells.get(key(55,62,-60))?.category).toBe('Roof');
  for(const [x,z] of [[0,-31],[21,-45],[42,-45],[55,-58]] as const){const y=49+Math.min(7,Math.floor(x/7));expect(cells.get(key(x,y-1,z))?.category).toBe('Skywalk support');}
 });
 test('landscape never overlaps architecture; required doorway cut is small and has no logical pairs',()=>{
  const existing=new Set(architecture.map(b=>key(b.pos.x,b.pos.y,b.pos.z)));for(const d of landscape)for(const b of d.project.blocks)expect(existing.has(key(b.pos.x,b.pos.y,b.pos.z))).toBe(false);
  const cut=architecture.filter(doorway);expect(cut.length).toBeGreaterThan(0);expect(cut.length).toBeLessThan(106);expect(cut.every(b=>b.logicalStructureId===undefined)).toBe(true);
  expect(cut.every(b=>!all.some(actual=>actual.uid===b.uid))).toBe(true);
 });
});

