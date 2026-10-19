import { describe, expect, it } from 'vitest';
import type { BlockRecord, BlockState, MinecraftId } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { shapeForBlock, type ShapeBox } from './geometry.ts';
import { buildModelGroup, disposeGroup, pickModel } from './runtime.js';
function block(id:MinecraftId,state:BlockState={},x=-2,y=-1,z=-3):BlockRecord{return {uid:'target',id,state:normalizeBlockState(id,state),pos:{x,y,z},source:{origin:'user_created'},edits:{createdByTransactionId:'fixture',lastModifiedByTransactionId:'fixture',userModified:false}};}
function volume(boxes:readonly ShapeBox[]){return boxes.reduce((n,b)=>n+(b.max[0]-b.min[0])*(b.max[1]-b.min[1])*(b.max[2]-b.min[2]),0);}
function solid(boxes:readonly ShapeBox[],x:number,y:number,z:number){return boxes.some(b=>[x,y,z].every((v,i)=>v>b.min[i]!&&v<b.max[i]!));}
describe('state geometry',()=>{
  for(const facing of ['east','south','west','north'])for(const half of ['bottom','top'])for(const shape of ['straight','inner_left','inner_right','outer_left','outer_right'])it(facing+' '+half+' '+shape,()=>{
    const b=block('minecraft:oak_stairs',{facing,half,shape});const json=JSON.stringify(b);const result=shapeForBlock(b);
    expect(volume(result.boxes)).toBe(shape.startsWith('inner')?0.875:shape.startsWith('outer')?0.625:0.75);
    for(const part of result.boxes)for(let i=0;i<3;i++){expect(part.min[i]).toBeGreaterThanOrEqual(0);expect(part.max[i]).toBeLessThanOrEqual(1);expect(part.min[i]).toBeLessThan(part.max[i]!);}
    const turns=['east','south','west','north'].indexOf(facing);
    for(const x of [.25,.75])for(const z of [.25,.75]){
      let rx=x,rz=z;for(let i=0;i<turns;i++){const old=rx;rx=1-rz;rz=old;}
      const forward=x>.5,side=shape.endsWith('left')?z<.5:z>.5;
      const expected=shape.startsWith('inner')?forward||side:shape.startsWith('outer')?forward&&side:forward;
      expect(solid(result.boxes,rx,half==='top'?.25:.75,rz)).toBe(expected);
      expect(solid(result.boxes,rx,half==='top'?.75:.25,rz)).toBe(true);
    }
    expect(JSON.stringify(b)).toBe(json);
  });
  it('slab lower/upper/double bounds',()=>{for(const type of ['bottom','top','double']){const shape=shapeForBlock(block('minecraft:oak_slab',{type}));expect(shape.boxes).toEqual([{min:[0,type==='top'?.5:0,0],max:[1,type==='bottom'?.5:1,1]}]);}});
  it('door facing and both hinges select the actual thin plane',()=>{
    for(const facing of ['east','south','west','north'])for(const hinge of ['left','right'])for(const open of ['false','true'])for(const half of ['lower','upper']){
      const b=block('minecraft:oak_door',{facing,hinge,open,half});const result=shapeForBlock(b);expect(volume(result.boxes)).toBe(3/16);
      const closed = {east:[0,0,0,3/16,1,1],south:[0,0,0,1,1,3/16],west:[13/16,0,0,1,1,1],north:[0,0,13/16,1,1,1]};
      const dirs=['east','south','west','north'] as const;const index=(dirs.indexOf(facing as typeof dirs[number])+(open==='true'?(hinge==='left'?1:3):0))%4;const bounds=closed[dirs[index]!];
      expect([...result.boxes[0]!.min,...result.boxes[0]!.max]).toEqual(bounds);
    }
  });
  it('bed mattress and outer legs rotate with the head/foot state',()=>{for(const facing of ['north','east','south','west'])for(const part of ['head','foot']){const result=shapeForBlock(block('minecraft:red_bed',{facing,part}));expect(result.boxes).toHaveLength(3);expect(result.boxes[0]!.min[1]).toBe(3/16);expect(result.boxes[0]!.max[1]).toBe(9/16);const midpoint=result.boxes.slice(1).map(b=>[(b.min[0]+b.max[0])/2,(b.min[2]+b.max[2])/2]);const axis=facing==='north'||facing==='south'?1:0;const low=(facing==='north'||facing==='west')===(part==='head');expect(midpoint.every(p=>low?p[axis]!<.5:p[axis]!>.5)).toBe(true);}});
  it('logs preserve axis, glass is transparent, unsupported shape is disclosed',()=>{for(const axis of ['x','y','z'])expect(shapeForBlock(block('minecraft:oak_log',{axis})).axis).toBe(axis);expect(shapeForBlock(block('minecraft:glass')).opacity).toBeLessThan(1);expect(shapeForBlock(block('minecraft:dragon_egg')).supported).toBe(false);});
});
describe('actual Three.js geometry raycasting',()=>{
  it('all six exact cell faces map to original negative XYZ via UID',()=>{const b=block('minecraft:stone');const model=buildModelGroup([b],[shapeForBlock(b)]);try{for(const [o,d] of [[[0,-.5,-2.5],[-1,0,0]],[[-4,-.5,-2.5],[1,0,0]],[[-1.5,2,-2.5],[0,-1,0]],[[-1.5,-3,-2.5],[0,1,0]],[[-1.5,-.5,0],[0,0,-1]],[[-1.5,-.5,-5],[0,0,1]]] as const){expect(pickModel(model,o,d)?.uid).toBe('target');}}finally{disposeGroup(model)}});
  it('does not select empty half of a slab or stair',()=>{for(const id of ['minecraft:oak_slab','minecraft:oak_stairs'] as const){const b=block(id,id.endsWith('stairs')?{facing:'east'}:{});const model=buildModelGroup([b],[shapeForBlock(b)]);try{expect(pickModel(model,[-1.75,-.25,-5],[0,0,1])).toBeNull();expect(pickModel(model,[-1.75,-.75,-5],[0,0,1])?.uid).toBe('target');}finally{disposeGroup(model)}}});
  it('thin doors do not fill empty cell volume and glass is selectable',()=>{const door=block('minecraft:oak_door',{facing:'east'});const g=buildModelGroup([door],[shapeForBlock(door)]);try{expect(pickModel(g,[-1.5,-.5,-5],[0,0,1])).toBeNull();expect(pickModel(g,[-1.95,-.5,-5],[0,0,1])?.uid).toBe('target');}finally{disposeGroup(g)}const glass=block('minecraft:glass');const glassGroup=buildModelGroup([glass],[shapeForBlock(glass)]);try{expect(pickModel(glassGroup,[-1.5,-.5,-5],[0,0,1])?.uid).toBe('target');}finally{disposeGroup(glassGroup)}});
  it('origin rebasing preserves UID at the editor coordinate bound',()=>{const b=block('minecraft:stone',{},30000000,-30000000,30000000);const group=buildModelGroup([b],[shapeForBlock(b)],[30000000,-30000000,30000000]);try{expect(pickModel(group,[.5,.5,-2],[0,0,1])?.uid).toBe(b.uid);}finally{disposeGroup(group)}});
});
