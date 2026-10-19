import { describe,it,expect } from 'vitest';
import type { BlockRecord, MinecraftId } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { buildCampusGeometry,pickCampus,disposeCampusGeometry } from './overview-runtime.js';
function block(x:number,y=0,z=0,id:MinecraftId='minecraft:stone'):BlockRecord {return {uid:[x,y,z].join(','),id,pos:{x,y,z},state:normalizeBlockState(id,{}),source:{origin:'user_created'},edits:{createdByTransactionId:'test',lastModifiedByTransactionId:'test',userModified:false}};}
describe('merged campus surfaces',()=>{
 it('culls interior cube faces while preserving signed canonical picking',()=>{
  const blocks:BlockRecord[]=[];for(let x=-5;x<5;x++)for(let y=0;y<10;y++)for(let z=-5;z<5;z++)blocks.push(block(x,y,z));
  const before=JSON.stringify(blocks),group=buildCampusGeometry(blocks,[100,0,-100]);
  try{expect(group.children).toHaveLength(1);expect(group.userData.triangles).toBe(1200);expect(group.userData.visibleCells).toBe(488);
   expect(pickCampus(group,[-95.5,9.5,110],[0,0,-1])).toBe('4,9,4');expect(pickCampus(group,[-110,.5,95.5],[1,0,0])).toBe('-5,0,-5');expect(JSON.stringify(blocks)).toBe(before);
  }finally{disposeCampusGeometry(group);}
 });
 it('retains transparent and stair faces beside opaque cells',()=>{
  const blocks=[block(-1),block(0,0,0,'minecraft:glass'),block(1,0,0,'minecraft:oak_stairs')],group=buildCampusGeometry(blocks);
  try{expect(group.userData.triangles).toBe(60);expect(pickCampus(group,[.5,.5,-2],[0,0,1])).toBe('0,0,0');expect(pickCampus(group,[1.5,.2,-2],[0,0,1])).toBe('1,0,0');}finally{disposeCampusGeometry(group);}
 });
 it('disposes every owned geometry and material exactly once',()=>{
  const group=buildCampusGeometry([block(0),block(1,0,0,'minecraft:glass')]);let geometries=0,materials=0;
  for(const m of group.children){m.geometry.addEventListener('dispose',()=>geometries++);m.material.addEventListener('dispose',()=>materials++);}
  disposeCampusGeometry(group);expect(geometries).toBe(2);expect(materials).toBe(2);
 });
});
