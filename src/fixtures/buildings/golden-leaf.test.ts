import {createWorkspace,serializeWorkspace,parseWorkspace} from '../../features/projects/storage.ts';
import {describe,expect,it} from 'vitest';
import {createGoldenLeafParts,GOLDEN_LEAF_DESIGN} from './golden-leaf.ts';
import {parseProject} from '../../core/model.ts';
import {shapeForBlock} from '../../features/viewer/geometry.ts';
const parts=createGoldenLeafParts(),blocks=parts.flatMap(p=>p.project.blocks);
const cells=new Map(blocks.map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
describe('standalone golden leaf tower',()=>{
 it('keeps bounded canonical parts, atomic pairs, unique world cells and estimated provenance',()=>{
  expect(cells.size).toBe(blocks.length);expect(new Set(blocks.map(b=>b.uid)).size).toBe(blocks.length);
  expect(parts.every(p=>p.parentGroupId==='golden-leaf-tower'&&p.project.blocks.length<=45000)).toBe(true);
  for(const p of parts){expect(parseProject(p.project).blocks.length).toBe(p.project.blocks.length);for(const pair of p.project.logicalStructures)expect(pair.memberUids.every(uid=>p.project.blocks.some(b=>b.uid===uid))).toBe(true);}
  expect(blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.confidence!==undefined)).toBe(true);
  const unique=new Map(blocks.map(b=>[b.id+JSON.stringify(b.state),b]));expect([...unique.values()].filter(b=>!shapeForBlock(b).supported).map(b=>b.id)).toEqual([]);
 });
 it('has round occupied tower sections and a deliberate taller proportion, not a thin lens',()=>{
  for(const y of [50,80,110,140]){const row=blocks.filter(b=>b.pos.y===y);const span=(a:'x'|'z')=>Math.max(...row.map(b=>b.pos[a]))-Math.min(...row.map(b=>b.pos[a]))+1;expect(Math.abs(span('x')-span('z'))).toBeLessThanOrEqual(8);expect(span('z')).toBeGreaterThan(30);}
  expect(blocks.reduce((max,b)=>Math.max(max,b.pos.y),-Infinity)).toBe(202);expect(GOLDEN_LEAF_DESIGN.nominalTowerDiameter).toBe(90);expect(GOLDEN_LEAF_DESIGN.chosenAspect/GOLDEN_LEAF_DESIGN.referenceInspiredAspect).toBeGreaterThan(1.1);expect(GOLDEN_LEAF_DESIGN.chosenAspect/GOLDEN_LEAF_DESIGN.referenceInspiredAspect).toBeLessThan(1.25);
  const mid=blocks.filter(b=>b.pos.y===80);expect(Math.max(...mid.map(b=>b.pos.x))-Math.min(...mid.map(b=>b.pos.x))).toBeGreaterThanOrEqual(88);
  expect(blocks.reduce((max,b)=>Math.max(max,b.pos.x),-Infinity)-blocks.reduce((min,b)=>Math.min(min,b.pos.x),Infinity)+1).toBe(129);
 });
 it('differentiates wide front glazing and lower X braces from narrow gold-wrapped rear',()=>{
  const middle=blocks.filter(b=>b.pos.y>=65&&b.pos.y<=110);
  const front=middle.filter(b=>b.category==='Front glazing'&&b.id==='minecraft:cyan_stained_glass').length,rear=middle.filter(b=>b.category==='Rear opening'&&b.id==='minecraft:cyan_stained_glass').length;
  expect(front).toBeGreaterThan(rear*2);expect(rear).toBeGreaterThan(0);
  expect(blocks.filter(b=>b.category==='Front lower X brace').every(b=>b.pos.z<0&&b.pos.y<=82)).toBe(true);
  expect(middle.filter(b=>b.pos.z>0&&b.id==='minecraft:gold_block').length).toBeGreaterThan(rear*2);
  expect(blocks.filter(b=>b.category==='Rear central spine').every(b=>b.pos.x===0&&b.pos.z>0)).toBe(true);
  expect(blocks.some(b=>b.category==='Tall leaf tip'&&b.pos.y===202)).toBe(true);expect(blocks.some(b=>b.category==='Short leaf tip'&&b.pos.y===184)).toBe(true);
 });
 it('provides all 28 tower floors, unobstructed stairs and soil-supported gardens',()=>{
  for(let y=13;y<=175;y+=6)expect(cells.get([4,y,4].join(','))?.category).toBe('Floor');
  for(const b of blocks.filter(b=>b.category==='Circulation'))for(const h of [1,2])expect(cells.has([b.pos.x,b.pos.y+h,b.pos.z].join(',')),b.uid+' headroom '+h).toBe(false);
  for(const b of blocks.filter(b=>b.id==='minecraft:pink_tulip'))expect(cells.get([b.pos.x,b.pos.y-1,b.pos.z].join(','))?.id).toBe('minecraft:dirt');
  for(const x of [-48,48])expect(cells.get([x,17,-20].join(','))?.category).toBe('Annex roof');
 });
});


it('uses a smooth positive-X short petal, a visible rear overlap, dense gardens and four entrance rises',()=>{
 const cap=blocks.filter(b=>b.pos.y>145&&b.pos.x>0&&['Golden petal shell','Front leaf edge'].includes(b.category??''));
 expect(cap.reduce((max,b)=>Math.max(max,b.pos.y),0)).toBeLessThanOrEqual(184);
 const widthAt=(y:number)=>cap.filter(b=>b.pos.y===y).reduce((max,b)=>Math.max(max,b.pos.x),0);
 expect(widthAt(150)).toBeGreaterThan(widthAt(180));expect(widthAt(180)).toBeGreaterThanOrEqual(widthAt(184));
 expect(blocks.filter(b=>b.category==='Tall leaf tip').every(b=>b.pos.x<=0)).toBe(true);
 const overlap=blocks.filter(b=>b.category==='Rear diagonal petal overlap');expect(overlap.length).toBeGreaterThan(100);expect(overlap.every(b=>b.pos.z>0)).toBe(true);expect(new Set(overlap.map(b=>b.pos.x)).size).toBeGreaterThan(10);
 expect(blocks.filter(b=>b.category==='Dense groundcover').length).toBeGreaterThan(200);expect(blocks.filter(b=>b.category==='Warm garden lamp'||b.category==='Warm roof lamp').length).toBeGreaterThanOrEqual(12);
 for(let step=0;step<4;step++)expect(cells.get([0,step+1,-68+step].join(','))?.id).toBe('minecraft:quartz_stairs');
 const row=blocks.filter(b=>b.pos.y===90&&b.category==='Front glazing');expect(row.reduce((max,b)=>Math.max(max,Math.abs(b.pos.x)),0)).toBeLessThanOrEqual(34);
});




it('opens every part as an editable workspace and roundtrips its full backup',()=>{
 for(const part of parts){
  const workspace=createWorkspace(part.project);const parsed=parseWorkspace(JSON.parse(serializeWorkspace(workspace)));
  expect(parsed.project).toEqual(part.project);expect(parsed.original).toEqual(part.project);expect(parsed.approvedDesign).toEqual(part.project);
  expect(parsed.project.blocks.every(b=>/^golden-leaf:[a-z0-9-]+$/.test(b.constructionPhaseId??''))).toBe(true);
  expect(parsed.project.blocks.some(b=>b.category?.includes(' '))).toBe(true);
 }
},120000);
