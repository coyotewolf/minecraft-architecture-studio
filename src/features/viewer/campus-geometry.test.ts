import { describe, expect, it } from 'vitest';
import type { BlockRecord, BlockState, MinecraftId } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { shapeForBlock } from './geometry.ts';
import { createIndustryDistricts } from '../../fixtures/campus/industry.ts';
function block(id:MinecraftId,state:BlockState={}):BlockRecord{return {uid:'geometry-campus',id,state:normalizeBlockState(id,state),pos:{x:0,y:0,z:0},source:{origin:'ai_estimated',confidence:.35},edits:{createdByTransactionId:'test',lastModifiedByTransactionId:'test',userModified:false}};}
const partials: readonly MinecraftId[]=['minecraft:anvil','minecraft:wheat','minecraft:farmland','minecraft:oak_fence','minecraft:iron_bars','minecraft:oak_fence_gate','minecraft:oak_pressure_plate','minecraft:ladder','minecraft:lantern','minecraft:brewing_stand','minecraft:enchanting_table','minecraft:chest','minecraft:oak_trapdoor','minecraft:lever','minecraft:rail','minecraft:hopper','minecraft:cauldron','minecraft:stonecutter'];
describe('campus block geometry',()=>{
 for(const id of partials)it(`${id} has bounded partial geometry without mutation`,()=>{
  const b=block(id),before=JSON.stringify(b),shape=shapeForBlock(b);expect(shape.supported).toBe(true);expect(shape.boxes.length).toBeGreaterThan(0);
  for(const box of shape.boxes)for(let i=0;i<3;i++){expect(box.min[i]).toBeGreaterThanOrEqual(0);expect(box.max[i]).toBeLessThanOrEqual(1);expect(box.min[i]).toBeLessThan(box.max[i]!);}
  expect(shape.boxes.some(box=>box.min.every(v=>v===0)&&box.max.every(v=>v===1))).toBe(false);expect(JSON.stringify(b)).toBe(before);
 });
 it('full cubes retain opaque colors while all stained glass colors are transparent',()=>{
  for(const color of ['red','blue','cyan','pink','purple','white']){
   const concrete=shapeForBlock(block(`minecraft:${color}_concrete`));expect(concrete.supported).toBe(true);expect(concrete.opacity).toBe(1);
   const glass=shapeForBlock(block(`minecraft:${color}_stained_glass`));expect(glass.supported).toBe(true);expect(glass.opacity).toBeLessThan(1);
  }
  for(const id of ['minecraft:bookshelf','minecraft:furnace','minecraft:blast_furnace','minecraft:crafting_table','minecraft:bone_block','minecraft:hay_block'] as const)expect(shapeForBlock(block(id)).boxes).toEqual([{min:[0,0,0],max:[1,1,1]}]);
 });
 it('connections are state-driven and gate opening clears its center',()=>{
  const isolated=shapeForBlock(block('minecraft:oak_fence')),connected=shapeForBlock(block('minecraft:oak_fence',{east:'true',north:'true'}));expect(isolated.boxes).toHaveLength(1);expect(connected.boxes).toHaveLength(5);
  expect(connected.boxes.some(b=>b.max[0]===1)).toBe(true);expect(connected.boxes.some(b=>b.min[2]===0)).toBe(true);
  const bars=shapeForBlock(block('minecraft:iron_bars',{west:'true'}));expect(bars.boxes).toHaveLength(2);expect(bars.boxes[1]!.min[0]).toBe(0);
  const open=shapeForBlock(block('minecraft:oak_fence_gate',{open:'true'}));expect(open.boxes.every(b=>b.max[0]<=2/16||b.min[0]>=14/16)).toBe(true);
 });
 it('trapdoors, ladders and chest latches rotate with facing',()=>{
  for(const facing of ['north','east','south','west']){
   const north=shapeForBlock(block('minecraft:oak_trapdoor',{open:'true',facing})).boxes[0]!;
   const axis=facing==='north'||facing==='south'?2:0;expect(north.max[axis]!-north.min[axis]!).toBe(3/16);expect(north.max[1]).toBe(1);
   const ladder=shapeForBlock(block('minecraft:ladder',{facing}));expect(ladder.boxes.every(b=>(b.max[axis]! - b.min[axis]!) === 2/16)).toBe(true);
   const chest=shapeForBlock(block('minecraft:chest',{facing}));expect(chest.boxes[1]!.max[axis]!-chest.boxes[1]!.min[axis]!).toBe(1/16);
  }
  expect(shapeForBlock(block('minecraft:oak_trapdoor',{half:'top'})).boxes[0]!.min[1]).toBe(13/16);
 });
 it('straight rail axes, crop growth and pressure state change physical bounds',()=>{
  const ns=shapeForBlock(block('minecraft:rail',{shape:'north_south'})).boxes[0]!,ew=shapeForBlock(block('minecraft:rail',{shape:'east_west'})).boxes[0]!;
  expect(ns.max[2]-ns.min[2]).toBe(1);expect(ew.max[0]-ew.min[0]).toBe(1);
  expect(shapeForBlock(block('minecraft:wheat',{age:'7'})).boxes[0]!.max[1]).toBeGreaterThan(shapeForBlock(block('minecraft:wheat',{age:'0'})).boxes[0]!.max[1]);
  expect(shapeForBlock(block('minecraft:oak_pressure_plate',{powered:'true'})).boxes[0]!.max[1]).toBe(1/32);
  expect(shapeForBlock(block('minecraft:rail',{shape:'ascending_north'})).supported).toBe(false);
 });
 it('floor wall and ceiling lever mounts remain bounded and powered handle differs',()=>{
  for(const face of ['floor','wall','ceiling'])for(const facing of ['north','east','south','west']){
   const off=shapeForBlock(block('minecraft:lever',{face,facing,powered:'false'})),on=shapeForBlock(block('minecraft:lever',{face,facing,powered:'true'}));expect(on.boxes).not.toEqual(off.boxes);
   for(const box of on.boxes)for(let i=0;i<3;i++){expect(box.min[i]).toBeGreaterThanOrEqual(0);expect(box.max[i]).toBeLessThanOrEqual(1);}
  }
 });
 it('anvil top rotates its long axis and preserves narrowed waist',()=>{
  for(const facing of ['north','south','east','west']){const shape=shapeForBlock(block('minecraft:anvil',{facing}));expect(shape.supported).toBe(true);const top=shape.boxes[3]!,axis=facing==='north'||facing==='south'?2:0;expect(top.max[axis]!-top.min[axis]!).toBe(1);expect(top.max[axis===2?0:2]!-top.min[axis===2?0:2]!).toBe(10/16);expect(shape.boxes[2]!.max[1]).toBe(10/16);}
 });
 it('industrial fixtures have no unsupported marker blocks',()=>{
  const unsupported=new Set(createIndustryDistricts().flatMap(d=>d.project.blocks).filter(b=>!shapeForBlock(b).supported).map(b=>b.id));expect([...unsupported]).toEqual([]);
 });
});

