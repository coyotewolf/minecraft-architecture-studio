import { expect, test } from 'vitest';
import type { BlockRecord, BlockState, MinecraftId } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { connectCampusBlocks } from './connections.ts';
function b(id:MinecraftId,x:number,z:number,state:BlockState={}):BlockRecord{return {uid:`${x},${z}`,id,pos:{x,y:2,z},state:normalizeBlockState(id,state),source:{origin:'ai_estimated',confidence:.35},edits:{createdByTransactionId:'fixture',lastModifiedByTransactionId:'fixture',userModified:false}};}
test('adjacent fences and full solid supports connect reciprocally without mutating source',()=>{
 const input=[b('minecraft:oak_fence',0,0,{south:'true'}),b('minecraft:oak_fence',1,0),b('minecraft:white_concrete',0,-1)];const before=JSON.stringify(input),out=connectCampusBlocks(input);
 expect(out[0]!.state).toMatchObject({east:'true',north:'true',south:'false',west:'false'});expect(out[1]!.state.west).toBe('true');expect(out[2]).toBe(input[2]);
 expect(out[0]!.uid).toBe(input[0]!.uid);expect(out[0]!.source).toBe(input[0]!.source);expect(out[0]!.edits).toBe(input[0]!.edits);expect(JSON.stringify(input)).toBe(before);
});
test('iron bars connect to bars and solids, not wooden fences or empty air',()=>{
 const out=connectCampusBlocks([b('minecraft:iron_bars',0,0),b('minecraft:iron_bars',0,1),b('minecraft:stone_bricks',1,0),b('minecraft:oak_fence',0,-1)]);
 expect(out[0]!.state).toMatchObject({south:'true',east:'true',north:'false',west:'false'});expect(out[1]!.state.north).toBe('true');expect(out[3]!.state.south).toBe('false');
});
test('gate attachment follows gate facing axis including open gates',()=>{
 for(const facing of ['north','south','east','west'])for(const open of ['true','false']){
  const out=connectCampusBlocks([b('minecraft:oak_fence_gate',0,0,{facing,open}),b('minecraft:oak_fence',-1,0),b('minecraft:oak_fence',0,-1)]);
  expect(out[1]!.state.east).toBe(String(facing==='north'||facing==='south'));expect(out[2]!.state.south).toBe(String(facing==='east'||facing==='west'));
 }
});
test('partial blocks and vertically offset supports do not create false full-cube connections',()=>{
 const stair=b('minecraft:quartz_stairs',1,0),raised={...b('minecraft:white_concrete',0,1),pos:{x:0,y:3,z:1}};
 const out=connectCampusBlocks([b('minecraft:oak_fence',0,0),stair,raised]);expect(out[0]!.state).toMatchObject({north:'false',south:'false',east:'false',west:'false'});
 expect(connectCampusBlocks(out)).toEqual(out);
});
