import type { BlockPos, BlockRecord, BlockState, EditTransaction, LogicalStructure, MinecraftId, Project } from '../../core/contracts.ts';
import { coordinateKey } from '../../core/coordinates.ts';
import { parsePosition } from '../../core/model.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { createPlacement, designDiff, expandSelection, type CollisionPolicy } from './commands.ts';
import type { BatchRequest } from './BatchPanel.tsx';

const axes = ['x','y','z'] as const;
const directions = ['north','east','south','west'];
export function rangeSelection(project:Project,from:BlockPos,to:BlockPos):readonly BlockRecord[]{
  parsePosition(from);parsePosition(to);
  return expandSelection(project,project.blocks.filter(b=>axes.every(a=>b.pos[a]>=Math.min(from[a],to[a])&&b.pos[a]<=Math.max(from[a],to[a]))).map(b=>b.uid));
}
type Transform='rotate'|'mirror_x'|'mirror_z';
export function transformState(id:MinecraftId,state:BlockState,kind:Transform,turns=1):BlockState{
  const map=(d:string):string=>{const n=directions.indexOf(d);if(n<0)return d;
    if(kind==='rotate')return directions[(n+turns)%4]!;
    return directions[kind==='mirror_x'?(4-n)%4:(2-n+4)%4]!;};
  const result:Record<string,string>={};
  for(const [key,value] of Object.entries(state)){
    let v=value;
    if(key==='facing')v=map(value);
    if(key==='orientation')v=value.split('_').map(map).join('_');
    if(key==='axis'&&kind==='rotate'&&turns%2&&value!=='y')v=value==='x'?'z':'x';
    if(key==='rotation'){const n=Number(value);v=String((kind==='rotate'?n+4*turns:kind==='mirror_x'?16-n:8-n+16)%16);}
    if(kind!=='rotate'&&(key==='hinge'||key==='type')&&(value==='left'||value==='right'))v=value==='left'?'right':'left';
    if(key==='shape'){
      if(value.startsWith('inner_')||value.startsWith('outer_')){if(kind!=='rotate')v=value.endsWith('left')?value.replace('left','right'):value.replace('right','left');}
      else if(value.startsWith('ascending_'))v='ascending_'+map(value.slice(10));
      else if(value.includes('_')){const parts=value.split('_').map(map);if(parts.every(d=>directions.includes(d))){
        v=['north_south','east_west','south_east','south_west','north_west','north_east'].find(n=>n.split('_').every(d=>parts.includes(d)))??value;}}
    }
    result[map(key)]=v;
  }
  return normalizeBlockState(id,result);
}
function transformPos(p:BlockPos,pivot:BlockPos,kind:Transform,turns:number):BlockPos{
  let x=p.x-pivot.x,z=p.z-pivot.z;
  if(kind==='mirror_x')x=-x;else if(kind==='mirror_z')z=-z;
  else for(let n=0;n<turns;n++){const old=x;x=-z;z=old;}
  return parsePosition({x:x+pivot.x,y:p.y,z:z+pivot.z});
}
function positions(r:BatchRequest):BlockPos[]{
  const lo={x:Math.min(r.from.x,r.to.x),y:Math.min(r.from.y,r.to.y),z:Math.min(r.from.z,r.to.z)};
  const hi={x:Math.max(r.from.x,r.to.x),y:Math.max(r.from.y,r.to.y),z:Math.max(r.from.z,r.to.z)};
  const cells:BlockPos[]=[];
  const add=(p:BlockPos)=>{if(cells.length>=5000)throw new Error('單次批次最多 5,000 個目標格；請縮小範圍。');cells.push(parsePosition(p));};
  if(r.operation==='line'||r.operation==='wall'){
    const length=Math.max(Math.abs(r.to.x-r.from.x),Math.abs(r.to.z-r.from.z),r.operation==='line'?Math.abs(r.to.y-r.from.y):0);
    if(length>5000)throw new Error('線段超過單次限制。');
    for(let n=0;n<=length;n++){
      const f=length?n/length:0,x=Math.round(r.from.x+(r.to.x-r.from.x)*f),z=Math.round(r.from.z+(r.to.z-r.from.z)*f);
      if(r.operation==='line')add({x,y:Math.round(r.from.y+(r.to.y-r.from.y)*f),z});
      else for(let y=lo.y;y<=hi.y;y++)for(let t=0;t<r.thickness;t++)add({x:x+(Math.abs(r.to.z-r.from.z)>Math.abs(r.to.x-r.from.x)?t:0),y,z:z+(Math.abs(r.to.z-r.from.z)>Math.abs(r.to.x-r.from.x)?0:t)});
    }
  }else{
    const volume=(hi.x-lo.x+1)*(hi.y-lo.y+1)*(hi.z-lo.z+1);
    if(volume>5000)throw new Error('範圍體積超過 5,000 格，請分段操作。');
    for(let y=lo.y;y<=hi.y;y++)for(let z=lo.z;z<=hi.z;z++)for(let x=lo.x;x<=hi.x;x++)
      if(r.operation!=='hollow_box'||axes.some(a=>({x,y,z})[a]===lo[a]||({x,y,z})[a]===hi[a]))add({x,y,z});
  }
  return [...new Map(cells.map(p=>[coordinateKey(p),p])).values()];
}
export function batchEdit(project:Project,r:BatchRequest,id:MinecraftId,state:BlockState,collision:CollisionPolicy):EditTransaction{
  parsePosition(r.from);parsePosition(r.to);parsePosition(r.offset);
  if(!Number.isInteger(r.thickness)||r.thickness<1||r.thickness>100||![1,2,3].includes(r.turns))throw new Error('厚度或旋轉角度無效。');
  const selected=rangeSelection(project,r.from,r.operation==='duplicate_layer'?{...r.to,y:r.from.y}:r.to);
  if(selected.length>5000)throw new Error('單次選取最多 5,000 格。');
  const tx=crypto.randomUUID(),removed=new Set<string>(),incoming:BlockRecord[]=[],groups:LogicalStructure[]=[];
  const existing=new Map(project.blocks.map(b=>[coordinateKey(b.pos),b])),byUid=new Map(project.blocks.map(b=>[b.uid,b]));
  const groupMap=new Map(project.logicalStructures.map(g=>[g.uid,g])),incomingPositions=new Set<string>();
  const removeUnit=(b:BlockRecord)=>{const g=b.logicalStructureId?groupMap.get(b.logicalStructureId):undefined;for(const uid of g?.memberUids??[b.uid])removed.add(uid);};
  const addUnit=(bs:readonly BlockRecord[],gs:readonly LogicalStructure[],originals:readonly BlockRecord[]=[])=>{
    const own=new Set(originals.map(b=>b.uid));
    const conflicts=bs.flatMap(b=>{const old=existing.get(coordinateKey(b.pos));return old&&!own.has(old.uid)&&!removed.has(old.uid)?[old]:[];});
    if(bs.some(b=>incomingPositions.has(coordinateKey(b.pos))))throw new Error('批次內的目標互相重疊。');
    if(conflicts.length&&collision==='cancel')throw new Error('批次目標已有方塊；整個操作已取消。');
    if(conflicts.length&&collision==='skip')return;
    conflicts.forEach(removeUnit);originals.forEach(b=>removed.add(b.uid));
    bs.forEach(b=>{incomingPositions.add(coordinateKey(b.pos));incoming.push(b);});groups.push(...gs);
  };
  const units:BlockRecord[][]=[],seen=new Set<string>();
  for(const b of selected){if(seen.has(b.uid))continue;const g=b.logicalStructureId?groupMap.get(b.logicalStructureId):undefined;
    const bs=(g?.memberUids??[b.uid]).map(uid=>byUid.get(uid)!);bs.forEach(v=>seen.add(v.uid));units.push(bs);}
  if(r.operation==='remove')selected.forEach(b=>removed.add(b.uid));
  else if(['copy','move','rotate','mirror_x','mirror_z','extrude','duplicate_layer'].includes(r.operation)){
    const copy=['copy','extrude','duplicate_layer'].includes(r.operation),repeats=r.operation==='extrude'?r.thickness:1;
    if(selected.length*repeats>5000)throw new Error('複製後超過單次 5,000 格限制。');
    if(!copy&&collision!=='skip')selected.forEach(b=>removed.add(b.uid));
    for(let n=1;n<=repeats;n++)for(const unit of units){
      const uidMap=new Map(unit.map(b=>[b.uid,copy?crypto.randomUUID():b.uid]));
      const oldGroup=unit[0]!.logicalStructureId?groupMap.get(unit[0]!.logicalStructureId!):undefined;
      const groupId=oldGroup?(copy?crypto.randomUUID():oldGroup.uid):undefined;
      const transformed=unit.map(b=>{
        const spatial=['rotate','mirror_x','mirror_z'].includes(r.operation);
        const pos=spatial?transformPos(b.pos,r.from,r.operation as Transform,r.turns):parsePosition({x:b.pos.x+r.offset.x*n,y:b.pos.y+r.offset.y*n,z:b.pos.z+r.offset.z*n});
        return {...b,uid:uidMap.get(b.uid)!,pos,state:spatial?transformState(b.id,b.state,r.operation as Transform,r.turns):b.state,
          ...(groupId?{logicalStructureId:groupId}:{}),...(copy?{edits:{createdByTransactionId:tx,lastModifiedByTransactionId:tx,userModified:true}}:{})};
      });
      addUnit(transformed,oldGroup?[{...oldGroup,uid:groupId!,anchorUid:uidMap.get(oldGroup.anchorUid)!,memberUids:oldGroup.memberUids.map(uid=>uidMap.get(uid)!)}]:[],copy?[]:unit);
    }
  }else if(r.operation==='replace'){
    for(const unit of units){const anchor=unit.find(b=>b.state.part==='foot'||b.state.half==='lower')??unit[0]!;
      const placed=createPlacement(anchor.pos,id,state,tx);addUnit(placed.blocks,placed.structures,unit);}
  }else{
    let targets=positions(r);
    if(r.operation==='fill'){
      const start=existing.get(coordinateKey(r.from)),allowed=new Set(targets.map(coordinateKey)),visited=new Set<string>(),queue=[r.from];targets=[];
      for(let i=0;i<queue.length;i++){const p=queue[i]!,k=coordinateKey(p);if(visited.has(k)||!allowed.has(k))continue;visited.add(k);
        if(existing.get(k)?.id!==start?.id)continue;targets.push(p);
        for(const a of axes)for(const delta of [-1,1])queue.push({...p,[a]:p[a]+delta});}
    }
    for(const p of targets){if(incomingPositions.has(coordinateKey(p)))continue;const placed=createPlacement(p,id,state,tx);addUnit(placed.blocks,placed.structures);}
  }
  const result=designDiff(project,[...project.blocks.filter(b=>!removed.has(b.uid)),...incoming],
    [...project.logicalStructures.filter(g=>!g.memberUids.some(uid=>removed.has(uid))),...groups],'user',tx);
  if(!result.changes.length)throw new Error('沒有可套用的變更。');
  if(result.changes.length>10000)throw new Error('變更超過 10,000 格，請分段操作。');
  return result;
}
