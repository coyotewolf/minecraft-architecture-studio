import type { Project } from '../../core/contracts.ts';
import type { ConstructionStep } from './model.ts';
export interface ViewOptions {layer:number;mode:'all'|'layer'|'through'|'ghost';progress:number;completed:readonly string[];exploded:boolean;build:boolean;material?:string;cut?:{axis:'x'|'y'|'z';value:number}}
export interface ViewEntry {uid:string;visible:boolean;opacity:number;offsetY:number}
/** A projection only. Never modifies or clones canonical positions into a second design. */
export function viewProjection(project:Project,steps:readonly ConstructionStep[],options:ViewOptions):readonly ViewEntry[]{
  const completed=new Set(options.completed),preview=new Set(steps.slice(0,Math.floor(Math.max(0,Math.min(100,options.progress))/100*steps.length)).flatMap(s=>s.blockUids));
  const anchors=new Map(project.blocks.map(b=>[b.uid,b.pos.y]));
  const groupY=new Map(project.logicalStructures.map(g=>[g.uid,anchors.get(g.anchorUid)!]));
  const layers=[...new Set(project.blocks.map(b=>b.logicalStructureId?groupY.get(b.logicalStructureId)!:b.pos.y))].sort((a,b)=>a-b);
  const offsets=new Map(layers.map((y,i)=>[y,i*2]));
  return project.blocks.map(b=>{
    const visible=(options.mode==='layer'?b.pos.y===options.layer:options.mode==='through'?b.pos.y<=options.layer:true)
      &&(!options.material||b.id===options.material)&&(!options.cut||b.pos[options.cut.axis]<=options.cut.value);
    const above=options.mode==='ghost'&&b.pos.y>options.layer;
    const future=options.build&&!completed.has(b.uid)&&!preview.has(b.uid);
    const y=b.logicalStructureId?groupY.get(b.logicalStructureId)!:b.pos.y;
    return {uid:b.uid,visible,opacity:above||future?0.16:1,offsetY:options.exploded?offsets.get(y)??0:0};
  });
}

