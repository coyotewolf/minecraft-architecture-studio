import { connectCampusBlocks } from './connections.ts';
import type { BlockRecord, BlockState, MinecraftId, LogicalStructure } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { createEmptyProject } from '../../core/project.ts';
import { parseProject } from '../../core/model.ts';

import type { District, DistrictSpec } from './builder.ts';
/** Integer local design coordinates become immutable world coordinates at this boundary. */
export class HighDetailBuilder {
  private cells=new Map<string,BlockRecord>();
  private structures:LogicalStructure[]=[];
  constructor(readonly spec:DistrictSpec){}
  set(x:number,y:number,z:number,id:MinecraftId='minecraft:white_concrete',category='Structure',state:BlockState={}) {
    if(![x,y,z].every(Number.isInteger))throw new Error('Noninteger campus cell');
    const pos={x:x+this.spec.origin[0],y:y+this.spec.origin[1],z:z+this.spec.origin[2]};
    const key=`${pos.x},${pos.y},${pos.z}`;
    if(this.cells.get(key)?.logicalStructureId)throw new Error('Cannot overwrite logical member');
    this.cells.set(key,{uid:`${this.spec.id}:${key}`,id,pos,state:normalizeBlockState(id,state),category,componentId:this.spec.id,constructionPhaseId:category,
      source:{origin:'ai_estimated',confidence:.35,referenceRegionId:this.spec.references.join(',')},edits:{createdByTransactionId:'campus-design-v3',lastModifiedByTransactionId:'campus-design-v3',userModified:false}});
  }
  clear(x:number,y:number,z:number){const key=`${x+this.spec.origin[0]},${y+this.spec.origin[1]},${z+this.spec.origin[2]}`;if(this.cells.get(key)?.logicalStructureId)throw new Error("Cannot clear logical member");this.cells.delete(key);}
  box(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,id:MinecraftId='minecraft:white_concrete',category='Structure',state:BlockState={}) {
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)this.set(x,y,z,id,category,state);
  }
  floor(x0:number,z0:number,x1:number,z1:number,y=1,id:MinecraftId='minecraft:smooth_quartz'){this.box(x0,y,z0,x1,y,z1,id,'Floor');}
  tree(x:number,y:number,z:number){this.box(x,y,z,x,y+3,z,'minecraft:oak_log','Landscape',{axis:'y'});for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let h=3;h<=5;h++)if(Math.abs(a)+Math.abs(b)+(h===5?1:0)<=3)this.set(x+a,y+h,z+b,'minecraft:oak_leaves','Landscape',{persistent:'true',distance:'1'});}
  door(x:number,y:number,z:number,facing='north'){
    const group=`${this.spec.id}:door:${x},${y},${z}`; const uids:string[]=[];
    for(const half of ['lower','upper']){const h=y+(half==='upper'?1:0);this.set(x,h,z,'minecraft:oak_door','Doors',{facing,half,hinge:'left',open:'false',powered:'false'});const key=`${x+this.spec.origin[0]},${h+this.spec.origin[1]},${z+this.spec.origin[2]}`;const b=this.cells.get(key)!;this.cells.set(key,{...b,logicalStructureId:group});uids.push(b.uid);}
    this.structures.push({uid:group,kind:'door',anchorUid:uids[0]!,memberUids:uids});
  }
  bed(x:number,y:number,z:number){const group=`${this.spec.id}:bed:${x},${y},${z}`;const uids:string[]=[];for(const part of ['foot','head']){const zz=z-(part==='head'?1:0);this.set(x,y,zz,'minecraft:red_bed','Decoration',{facing:'north',part,occupied:'false'});const key=`${x+this.spec.origin[0]},${y+this.spec.origin[1]},${zz+this.spec.origin[2]}`;const b=this.cells.get(key)!;this.cells.set(key,{...b,logicalStructureId:group});uids.push(b.uid);}this.structures.push({uid:group,kind:'bed',anchorUid:uids[0]!,memberUids:uids});}
  finishParts(maxCells=45000):District[] {
    if(!Number.isInteger(maxCells)||maxCells<2||maxCells>=50000)throw new Error('Part cell limit must be 2..49999');
    const blocks=connectCampusBlocks([...this.cells.values()]);
    const byUid=new Map(blocks.map(block=>[block.uid,block]));
    const grouped=new Set<string>();
    const atoms:BlockRecord[][]=[];
    for(const structure of this.structures){
      const members=structure.memberUids.map(uid=>{const block=byUid.get(uid);if(!block||block.logicalStructureId!==structure.uid||grouped.has(uid))throw new Error('Damaged logical structure');grouped.add(uid);return block;});
      if(members.length>maxCells)throw new Error('Logical structure exceeds part size');
      atoms.push(members);
    }
    for(const block of blocks)if(!grouped.has(block.uid))atoms.push([block]);
    const compare=(a:BlockRecord,b:BlockRecord)=>Math.floor(a.pos.z/32)-Math.floor(b.pos.z/32)||Math.floor(a.pos.x/32)-Math.floor(b.pos.x/32)||a.pos.y-b.pos.y||a.pos.z-b.pos.z||a.pos.x-b.pos.x;
    atoms.sort((a,b)=>compare(a[0]!,b[0]!));
    const chunks:BlockRecord[][]=[];let chunk:BlockRecord[]=[];
    for(const atom of atoms){if(chunk.length+atom.length>maxCells){chunks.push(chunk);chunk=[];}chunk.push(...atom);}if(chunk.length)chunks.push(chunk);
    return chunks.map((part,index)=>{
      const id=`${this.spec.id}--part-${index+1}`;const groupIds=new Set(part.map(block=>block.logicalStructureId));
      return {...this.spec,id,parentGroupId:this.spec.id,partLabel:`${index+1}/${chunks.length}`,project:parseProject({...createEmptyProject(id+'-reference-v3',this.spec.title),designRevision:id+'-v3',blocks:part,logicalStructures:this.structures.filter(group=>groupIds.has(group.uid))})};
    });
  }
}

