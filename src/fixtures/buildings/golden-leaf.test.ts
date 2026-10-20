import {describe,expect,it} from 'vitest';
import {createGoldenLeafProject,GOLDEN_LEAF_DESIGN} from './golden-leaf.ts';
import {parseProject} from '../../core/model.ts';
import {shapeForBlock} from '../../features/viewer/geometry.ts';
const project=createGoldenLeafProject(),blocks=project.blocks;
const cells=new Map(blocks.map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
const category=(name:string)=>blocks.filter(b=>b.category===name);
describe('complete golden leaf tower',()=>{
 it('is one canonical editable building with valid logical pairs and estimated provenance',()=>{
  expect(project.id).not.toContain('--part-');
  expect(cells.size).toBe(blocks.length);expect(new Set(blocks.map(b=>b.uid)).size).toBe(blocks.length);
  expect(parseProject(project).blocks.length).toBe(blocks.length);
  const byId=new Set(blocks.map(b=>b.uid));
  for(const pair of project.logicalStructures)expect(pair.memberUids.every(uid=>byId.has(uid))).toBe(true);
  expect(project.logicalStructures.length).toBeGreaterThan(0);
  expect(blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.confidence!==undefined)).toBe(true);
  expect(blocks.every(b=>/^golden-leaf:[a-z0-9-]+$/.test(b.constructionPhaseId??''))).toBe(true);
  const unique=new Map(blocks.map(b=>[b.id+JSON.stringify(b.state),b]));
  expect([...unique.values()].filter(b=>!shapeForBlock(b).supported).map(b=>b.id)).toEqual([]);
 });
 it('uses round deep tower sections and a modestly taller silhouette',()=>{
  for(const y of [50,80,110,140]){const row=blocks.filter(b=>b.pos.y===y);const span=(a:'x'|'z')=>Math.max(...row.map(b=>b.pos[a]))-Math.min(...row.map(b=>b.pos[a]))+1;expect(Math.abs(span('x')-span('z'))).toBeLessThanOrEqual(9);expect(span('z')).toBeGreaterThan(60);}
  expect(blocks.reduce((max,b)=>Math.max(max,b.pos.y),0)).toBe(GOLDEN_LEAF_DESIGN.highestY);
  expect(GOLDEN_LEAF_DESIGN.chosenAspect/GOLDEN_LEAF_DESIGN.referenceInspiredAspect).toBeGreaterThan(1);
  expect(GOLDEN_LEAF_DESIGN.chosenAspect/GOLDEN_LEAF_DESIGN.referenceInspiredAspect).toBeLessThan(1.2);
  const row=blocks.filter(b=>b.pos.y===180);expect(new Set(row.map(b=>b.pos.z)).size).toBeGreaterThan(20);
 });
 it('separates gray exterior skeleton from white reveals and recessed blue glazing',()=>{
  expect(category('Front exterior upright').every(b=>b.id==='minecraft:light_gray_concrete')).toBe(true);
  expect(category('Front white leaf reveal').every(b=>b.id==='minecraft:smooth_quartz')).toBe(true);
  const glass=category('Front recessed glazing');expect(glass.length).toBeGreaterThan(0);expect(glass.every(b=>b.id==='minecraft:blue_stained_glass')).toBe(true);
  for(const rib of category('Front exterior upright').filter(b=>b.pos.y===101)){
   const behind=glass.find(b=>b.pos.x===rib.pos.x&&b.pos.y===rib.pos.y);
   expect(behind).toBeDefined();expect(behind!.pos.z-rib.pos.z).toBeGreaterThanOrEqual(4);
   for(let gap=1;gap<=3;gap++)expect(cells.has([rib.pos.x,rib.pos.y,rib.pos.z+gap].join(','))).toBe(false);
  }
  const ledges=category('Front slab ledge');expect(ledges.length).toBeGreaterThan(0);
  expect(ledges.every(b=>b.id==='minecraft:smooth_stone_slab'&&b.state.type==='top')).toBe(true);
  const slab=ledges[0]!,shape=shapeForBlock(slab);expect(shape.supported).toBe(true);expect(shape.boxes[0]!.min[1]).toBe(.5);expect(shape.boxes[0]!.max[1]).toBe(1);
  expect(category('Front lower X brace').every(b=>b.pos.z<0&&b.pos.y<=84&&b.id==='minecraft:light_gray_concrete')).toBe(true);
 });
 it('uses a narrower rear window and physical gold overlap with a white diagonal lip',()=>{
  const front=category('Front recessed glazing'),rear=category('Rear recessed glazing');
  expect(front.length).toBeGreaterThan(rear.length*1.5);expect(rear.length).toBeGreaterThan(0);
  expect(rear.every(b=>b.pos.y>=63&&b.pos.z>0)).toBe(true);
  expect(category('Rear central spine').every(b=>b.pos.x===0&&b.pos.z>0)).toBe(true);
  const lap=category('Rear overlapping petal');expect(lap.length).toBeGreaterThan(0);expect(lap.every(b=>b.id==='minecraft:gold_block'&&b.pos.z>0)).toBe(true);
  const lip=category('Rear diagonal petal overlap');expect(lip.some(b=>b.id==='minecraft:smooth_quartz')).toBe(true);
  expect(new Set(lip.map(b=>b.pos.x)).size).toBeGreaterThan(20);
 });
 it('provides every tower floor, clear stair headroom and soil-supported gardens',()=>{
  for(let i=0;i<GOLDEN_LEAF_DESIGN.floorCount;i++){const y=13+i*7;expect(cells.get([0,y,0].join(','))?.category).toBe('Floor');expect(category('Front slab ledge').some(b=>b.pos.y===y)).toBe(true);}
  for(const b of category('Circulation'))for(const h of [1,2])expect(cells.has([b.pos.x,b.pos.y+h,b.pos.z].join(',')),b.uid+' headroom '+h).toBe(false);
  for(const b of blocks.filter(b=>b.id==='minecraft:pink_tulip'))expect(cells.get([b.pos.x,b.pos.y-1,b.pos.z].join(','))?.id).toBe('minecraft:dirt');
  for(const x of [-54,54])expect(cells.get([x,24,-20].join(','))?.category).toBe('Annex roof');
 });
});


