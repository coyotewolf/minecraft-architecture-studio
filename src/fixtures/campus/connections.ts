import type { BlockRecord } from '../../core/contracts.ts';
/** Conservative sturdy full-cube whitelist for this fixture palette, not a general physics engine. */
const solidIds=new Set(['stone','stone_bricks','smooth_stone','cobblestone','mossy_cobblestone','deepslate','polished_deepslate','deepslate_tiles','deepslate_bricks','polished_blackstone','blackstone','smooth_quartz','quartz_block','bricks','dirt','grass_block','iron_block','gold_block','bone_block','hay_block','bookshelf','furnace','blast_furnace','crafting_table','smithing_table','cartography_table','barrel','sea_lantern']);
function solid(block:BlockRecord):boolean{const id=block.id.slice('minecraft:'.length);return solidIds.has(id)||/_(concrete|planks|terracotta|wool|log|wood)$/.test(id);}
const directions=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]] as const;
/** Resolve fixture connection states after all seam overwrites, preserving IDs and provenance. */
export function connectCampusBlocks(blocks:readonly BlockRecord[]):BlockRecord[]{
 const cells=new Map(blocks.map(b=>[`${b.pos.x},${b.pos.y},${b.pos.z}`,b]));
 return blocks.map(block=>{
  if(block.id!=='minecraft:oak_fence'&&block.id!=='minecraft:iron_bars')return block;
  const state={...block.state};
  for(const [direction,dx,dz] of directions){
   const neighbor=cells.get(`${block.pos.x+dx},${block.pos.y},${block.pos.z+dz}`);
   let connected=false;
   if(neighbor){
    connected=neighbor.id===block.id||solid(neighbor);
    // A wooden fence attaches to the gate's posts, perpendicular to its facing axis.
    if(block.id==='minecraft:oak_fence'&&neighbor.id.endsWith('_fence_gate')){
     const gateFacesZ=neighbor.state.facing==='north'||neighbor.state.facing==='south';
     connected=gateFacesZ?(dx!==0):(dz!==0);
    }
   }
   state[direction]=String(connected);
  }
  return {...block,state};
 });
}
