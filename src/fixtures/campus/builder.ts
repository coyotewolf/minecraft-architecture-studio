import { connectCampusBlocks } from './connections.ts';
import type { BlockRecord, BlockState, MinecraftId, Project, LogicalStructure } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { createEmptyProject } from '../../core/project.ts';
import { parseProject } from '../../core/model.ts';

export interface DistrictSpec { id:string; title:string; origin:readonly[number,number,number]; references:readonly string[]; features:readonly string[]; notes:string }
export interface District extends DistrictSpec { project:Project }
/** Integer local design coordinates become immutable world coordinates at this boundary. */
export class DistrictBuilder {
  private cells=new Map<string,BlockRecord>();
  private structures:LogicalStructure[]=[];
  constructor(readonly spec:DistrictSpec){}
  set(x:number,y:number,z:number,id:MinecraftId='minecraft:white_concrete',category='Structure',state:BlockState={}) {
    if(![x,y,z].every(Number.isInteger))throw new Error('Noninteger campus cell');
    const pos={x:x+this.spec.origin[0],y:y+this.spec.origin[1],z:z+this.spec.origin[2]};
    const key=`${pos.x},${pos.y},${pos.z}`;
    this.cells.set(key,{uid:`${this.spec.id}:${key}`,id,pos,state:normalizeBlockState(id,state),category,componentId:this.spec.id,constructionPhaseId:category,
      source:{origin:'ai_estimated',confidence:.35,referenceRegionId:this.spec.references.join(',')},edits:{createdByTransactionId:'campus-design-v1',lastModifiedByTransactionId:'campus-design-v1',userModified:false}});
  }
  clear(x:number,y:number,z:number){this.cells.delete(`${x+this.spec.origin[0]},${y+this.spec.origin[1]},${z+this.spec.origin[2]}`);}
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
  finishRegions():District[] {
    if(this.structures.length)throw new Error('Regional split only supports nonlogical landscape cells');
    const groups=new Map<string,BlockRecord[]>();
    for(const cell of this.cells.values()){const region=cell.pos.z < -30?'north':cell.pos.z < 50?'center':'south';const id=this.spec.id+'-'+region;const cells=groups.get(id)??[];cells.push({...cell,componentId:id});groups.set(id,cells);}
    return [...groups].map(([id,blocks])=>({...this.spec,id,title:this.spec.title+' / '+({'north':'北區','center':'中區','south':'南區'}[id.split('-').at(-1)! as 'north'|'center'|'south']),project:parseProject({...createEmptyProject(id,this.spec.title),designRevision:id+'-v1',blocks,logicalStructures:[]})}));
  }
  finish():District {return {...this.spec,project:parseProject({...createEmptyProject(this.spec.id,this.spec.title),designRevision:`${this.spec.id}-v1`,blocks:connectCampusBlocks([...this.cells.values()]),logicalStructures:this.structures})};}
}
