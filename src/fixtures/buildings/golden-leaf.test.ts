import {describe,expect,it} from 'vitest';
import {createGoldenLeafProject,GOLDEN_LEAF_DESIGN} from './golden-leaf.ts';
import {parseProject} from '../../core/model.ts';
import {shapeForBlock} from '../../features/viewer/geometry.ts';
const project=createGoldenLeafProject(),blocks=project.blocks;
const cells=new Map(blocks.map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
const category=(name:string)=>blocks.filter(b=>b.category===name);
describe('100-block golden leaf reconstruction',()=>{
 it('caps the entire building including base, trees and tips at 100 blocks and uses a new identity',()=>{
  const ys=blocks.map(b=>b.pos.y);expect(Math.min(...ys)).toBe(0);expect(Math.max(...ys)).toBe(99);expect(Math.max(...ys)-Math.min(...ys)+1).toBeLessThanOrEqual(100);
  expect(project.id).toBe('golden-leaf-100-complete-v10');expect(project.designRevision).toBe('golden-leaf-100-v10');
  expect(blocks.some(b=>b.category==='Tall leaf tip'&&b.pos.y===99)).toBe(true);expect(blocks.some(b=>b.category==='Short leaf tip'&&b.pos.y===90)).toBe(true);
 });
 it('retains 26 internal floors with thirteen exposed rear bands and raises the saddle',()=>{
  expect([...new Set(category('Rear slab ledge').map(b=>b.pos.y))].sort((a,b)=>a-b)).toEqual(Array.from({length:13},(_,i)=>38+i*4));
  expect(category('Upper saddle glazing')).toHaveLength(4);expect(category('Upper saddle glazing').every(b=>b.pos.z===0&&[2,3].includes(b.pos.x))).toBe(true);expect([...new Set(category('Upper saddle white return').map(b=>b.pos.y))].sort((a,b)=>a-b)).toEqual([91,92]);expect(category('Upper saddle gold return').some(b=>b.pos.z===-2)).toBe(true);expect(category('Upper saddle gold return').some(b=>b.pos.z===2)).toBe(true);
  const rearLights=category('Facade ledge light').filter(b=>b.pos.z>0);
  expect([...new Set(rearLights.map(b=>b.pos.y-1))].sort((a,b)=>a-b)).toEqual(Array.from({length:13},(_,i)=>38+i*4));
  for(const lamp of rearLights)expect(cells.get([lamp.pos.x,lamp.pos.y-1,lamp.pos.z].join(','))?.id).toBe('minecraft:smooth_quartz_slab');
  expect(category('Rear slab ledge').some(b=>!GOLDEN_LEAF_DESIGN.floorLevels.includes(b.pos.y))).toBe(true);
  expect(GOLDEN_LEAF_DESIGN.floorLevels).toHaveLength(26);
 });
 it('uses a 71 by 47 stadium with straight sides and circular end caps',()=>{
  const foundation=category('Foundation'),distance=(x:number,z:number)=>Math.hypot(Math.max(Math.abs(x)-12,0),z);
  expect(Math.max(...foundation.map(b=>b.pos.x))-Math.min(...foundation.map(b=>b.pos.x))+1).toBe(71);expect(Math.max(...foundation.map(b=>b.pos.z))-Math.min(...foundation.map(b=>b.pos.z))+1).toBe(47);
  for(let x=-12;x<=12;x++)for(const z of [-23,23])expect(cells.has([x,0,z].join(','))).toBe(true);
  for(let x=-36;x<=36;x++)for(let z=-24;z<=24;z++)expect(cells.has([x,0,z].join(',')),[x,z].join(',')).toBe(distance(x,z)<=23);
  for(const z of [-20,20])for(let x=-12;x<=12;x++)expect(cells.has([x,9,z].join(','))).toBe(true);
 });
 it('makes both roof decks connected inward-facing crescents with supported planting',()=>{
  for(const side of [-1,1]){
   const roof=category('Annex roof').filter(b=>Math.sign(b.pos.x)===side),set=new Set(roof.map(b=>[b.pos.x,b.pos.z].join(',')));
   expect(roof.length).toBeGreaterThan(100);
   expect(cells.get([side*27,15,0].join(','))?.category).toBe('Annex inner parapet');expect(cells.get([side*27,15,0].join(','))?.state.type).toBe('bottom');expect(cells.get([side*28,16,0].join(','))?.id).toBe('minecraft:oak_leaves');
   for(const xx of [30,31])for(const y of [15,16])expect(cells.has([side*xx,y,3].join(',')),'two-block roof path').toBe(false);expect(set.has([side*20,0].join(','))).toBe(false);expect(set.has([side*33,0].join(','))).toBe(true);
   expect(roof.every(b=>Math.hypot((b.pos.x-side*20)/14,b.pos.z/20)<=1&&Math.hypot((b.pos.x-side*13)/13.5,b.pos.z/18.5)>1)).toBe(true);
   const q=[roof[0]!.pos],seen=new Set([roof[0]!.pos.x+','+roof[0]!.pos.z]);for(let i=0;i<q.length;i++){const p=q[i]!;for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx!,z=p.z+dz!,key=x+','+z;if(set.has(key)&&!seen.has(key)){seen.add(key);q.push({x,y:14,z});}}}expect(seen.size).toBe(set.size);
  }
  const leaves=blocks.filter(b=>b.id==='minecraft:oak_leaves'),leafCells=new Map(leaves.map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
  const anchored=new Set<string>(),queue=leaves.filter(b=>{const id=cells.get([b.pos.x,b.pos.y-1,b.pos.z].join(','))?.id;return id!==undefined&&id!=='minecraft:oak_leaves'&&id!=='minecraft:pink_tulip';});for(const b of queue)anchored.add(b.uid);
  for(let i=0;i<queue.length;i++){const p=queue[i]!.pos;for(const [dx,dy,dz]of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const b=leafCells.get([p.x+dx!,p.y+dy!,p.z+dz!].join(','));if(b&&!anchored.has(b.uid)){anchored.add(b.uid);queue.push(b);}}}expect(anchored.size).toBe(leaves.length);
  for(const b of blocks.filter(b=>['minecraft:dirt','minecraft:oak_log','minecraft:pink_tulip'].includes(b.id))){const below=cells.get([b.pos.x,b.pos.y-1,b.pos.z].join(','));expect(below,'plant support '+b.uid).toBeDefined();expect(['minecraft:pink_tulip','minecraft:glowstone'].includes(below!.id),'invalid plant support '+b.uid).toBe(false);}
  for(const b of blocks.filter(b=>['minecraft:dirt','minecraft:oak_log','minecraft:oak_leaves','minecraft:pink_tulip'].includes(b.id)))expect(Math.hypot(Math.max(Math.abs(b.pos.x)-12,0),b.pos.z)).toBeLessThanOrEqual(23);
  expect(category('Annex tree trunk')).toHaveLength(8);
  for(let y=4;y<=8;y++){for(const x of [-4,4])expect(cells.get([x,y,-20].join(','))?.id).toBe('minecraft:glowstone');for(const x of [5,10])expect(cells.get([x,y,20].join(','))?.id).toBe('minecraft:glowstone');} 

 });
 it('is one valid canonical model with intact doors, unique cells and honest evidence',()=>{
  expect(parseProject(project).blocks.length).toBe(blocks.length);expect(cells.size).toBe(blocks.length);expect(new Set(blocks.map(b=>b.uid)).size).toBe(blocks.length);
  const ids=new Set(blocks.map(b=>b.uid));expect(project.logicalStructures.length).toBe(4);for(const pair of project.logicalStructures)expect(pair.memberUids.every(uid=>ids.has(uid))).toBe(true);
  expect(blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.confidence!==undefined)).toBe(true);
  const unique=new Map(blocks.map(b=>[b.id+JSON.stringify(b.state),b]));expect([...unique.values()].filter(b=>!shapeForBlock(b).supported).map(b=>b.id)).toEqual([]);
 });
 it('keeps a round tower rather than a flat image extrusion',()=>{
  for(const y of [28,40,56,68]){const row=blocks.filter(b=>b.pos.y===y);const span=(a:'x'|'z')=>Math.max(...row.map(b=>b.pos[a]))-Math.min(...row.map(b=>b.pos[a]))+1;expect(Math.abs(span('x')-span('z'))).toBeLessThanOrEqual(6);expect(span('z')).toBeGreaterThan(30);}
  expect(GOLDEN_LEAF_DESIGN.nominalTowerDiameter).toBe(48);expect(GOLDEN_LEAF_DESIGN.chosenAspect).toBeLessThan(1.9);
 });
 it('places the widest shell in the lower third and narrows the upper shoulder',()=>{
  const width=(y:number)=>{const xs=blocks.filter(b=>b.pos.y===y&&b.id==='minecraft:gold_block').map(b=>b.pos.x);return Math.max(...xs)-Math.min(...xs)+1;};
  expect(width(38)).toBeGreaterThan(width(26));expect(width(38)).toBeGreaterThan(width(51));expect(width(66)/width(38)).toBeGreaterThan(.73);expect(width(66)/width(38)).toBeLessThan(.84);
  expect(GOLDEN_LEAF_DESIGN.floorLevels).toEqual(Array.from({length:26},(_,i)=>11+i*3));
 });
 it('separates gray exterior ribs, deep blue glazing, white returns and real half-height ledges',()=>{
  const ribs=category('Front curved rib').filter(b=>b.pos.y===40),glass=category('Front recessed glazing');expect(ribs.length).toBe(2);
  for(const rib of ribs){expect(rib.id).toBe('minecraft:smooth_stone');const back=glass.find(b=>b.pos.x===rib.pos.x&&b.pos.y===rib.pos.y);expect(back).toBeDefined();expect(back!.pos.z-rib.pos.z).toBeGreaterThanOrEqual(2);const between=cells.get([rib.pos.x,rib.pos.y,rib.pos.z+1].join(','));expect(between).toBeUndefined();}
  expect(glass.every(b=>b.id==='minecraft:blue_stained_glass')).toBe(true);expect(category('Front white leaf reveal').every(b=>b.id==='minecraft:smooth_quartz')).toBe(true);
  const slab=category('Front slab ledge')[0]!;expect(slab.id).toBe('minecraft:smooth_quartz_slab');expect(slab.state.type).toBe('top');expect(shapeForBlock(slab).boxes[0]!.min[1]).toBe(.5);
  expect(category('Front exterior upright')).toHaveLength(0);expect(category('Front lower X brace')).toHaveLength(0);
  const ribX=(y:number)=>category('Front curved rib').filter(b=>b.pos.y===y).map(b=>b.pos.x).sort((a,b)=>a-b);
  expect(ribX(25)).toEqual([0]);expect(ribX(44)).toEqual([-7,7]);expect(ribX(11)).toEqual([-5,6]);
  for(let y=12;y<=80;y++){expect(ribX(y).length,'continuous curve row '+y).toBeGreaterThan(0);expect(ribX(y).length).toBeLessThanOrEqual(2);}
  expect(category('Front curved rib').every(b=>b.id==='minecraft:smooth_stone')).toBe(true);
  expect(category('Front rib half-step').length).toBeGreaterThan(20);expect(category('Front rib half-step').every(b=>b.id==='minecraft:smooth_stone_slab'&&b.state.type==='top')).toBe(true);
  expect(category('Front apex white return')).toHaveLength(9);
  for(const rib of category('Front curved rib').filter(b=>GOLDEN_LEAF_DESIGN.floorLevels.includes(b.pos.y))){const ledges=category('Front slab ledge').filter(b=>b.pos.x===rib.pos.x&&b.pos.y===rib.pos.y);if(ledges.length)expect(Math.min(...ledges.map(b=>b.pos.z))-rib.pos.z,'rib stays forward of ledge '+rib.uid).toBeGreaterThanOrEqual(1);}
  for(let y=80;y<=90;y++)expect(category('Short leaf return').some(b=>b.pos.y===y&&b.id==='minecraft:quartz_stairs'),'short leaf reveal '+y).toBe(true);
  expect(blocks.filter(b=>b.id==='minecraft:iron_bars')).toHaveLength(0);
  expect(category('Floor').every(b=>b.id==='minecraft:smooth_stone_slab')).toBe(true);
  expect(category('Front slab ledge').every(b=>b.id==='minecraft:smooth_quartz_slab')).toBe(true);
  for(const y of [51,66,75])expect(Math.max(...ribX(y))).toBeGreaterThanOrEqual(y===51?7:y===66?6:5);
  const dividers=category('Podium planter divider');expect(dividers.some(b=>b.pos.z<0)).toBe(true);expect(dividers.some(b=>b.pos.z>0)).toBe(true);expect(dividers.every(b=>b.id==='minecraft:smooth_quartz_slab'&&b.state.type==='bottom'&&Math.hypot(Math.max(Math.abs(b.pos.x)-12,0),b.pos.z)<=20)).toBe(true);expect(category('Garden shrub crown').length).toBeGreaterThan(20);
  expect(category('Front curved rib').every(b=>b.pos.z<0&&b.pos.y<=94)).toBe(true);
 });
 it('keeps a shallow continuous facade, ledges behind its edge and ribs two blocks forward',()=>{
  for(const y of [35,50,65]){
   const ledges=category('Front slab ledge').filter(b=>b.pos.y===y);expect(Math.max(...ledges.map(b=>b.pos.z))-Math.min(...ledges.map(b=>b.pos.z))).toBeLessThanOrEqual(3);
   for(const rib of category('Front curved rib').filter(b=>b.pos.y===y)){const row=ledges.filter(b=>b.pos.x===rib.pos.x);expect(row.length).toBeGreaterThan(0);expect(Math.max(...row.map(b=>b.pos.z))-rib.pos.z).toBe(2);}
   const center=ledges.filter(b=>b.pos.x===0),front=Math.min(...center.map(b=>b.pos.z));expect(blocks.filter(b=>b.pos.y===y&&b.pos.x===0&&b.pos.z<front&&b.category==='Floor')).toHaveLength(0);
  }
  for(const y of [36,51,66,79,82,85]){
   const row=category('Front recessed glazing').filter(b=>b.pos.y===y),xs=row.map(b=>b.pos.x),lo=Math.min(...xs),hi=Math.max(...xs);expect(row.length).toBeGreaterThan(2);
   for(let x=lo;x<=hi;x++)expect(row.some(b=>b.pos.x===x),'facade gap '+[x,y]).toBe(true);
   for(const edge of [lo,hi]){const glass=row.find(b=>b.pos.x===edge)!;expect(blocks.some(b=>['minecraft:smooth_quartz','minecraft:quartz_stairs'].includes(b.id)&&b.pos.y===y&&Math.abs(b.pos.x-edge)<=2&&Math.abs(b.pos.z-glass.pos.z)<=1),'white return meets glazing '+[edge,y]).toBe(true);}
   if(y<=66)expect(Math.max(...row.map(b=>b.pos.z))-Math.min(...row.map(b=>b.pos.z))).toBeLessThanOrEqual(2);
  }
  expect(category('Garden curb').every(b=>b.id==='minecraft:smooth_quartz'&&Math.hypot(Math.max(Math.abs(b.pos.x)-12,0),b.pos.z)<=23)).toBe(true);
  for(const soil of category('Ground garden soil'))for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const neighbor=cells.get([soil.pos.x+dx!,2,soil.pos.z+dz!].join(','));
   expect(neighbor,'covered soil side '+soil.uid).toBeDefined();
   expect(['minecraft:dirt','minecraft:smooth_quartz'].includes(neighbor!.id)).toBe(true);
  }
 });
 it('uses a shallow rear window with a close spine and thirteen connected pale ledges',()=>{
  for(const y of [48,60,72]){
   const row=category('Rear recessed glazing').filter(b=>b.pos.y===y),xs=row.map(b=>b.pos.x),lo=Math.min(...xs),hi=Math.max(...xs);
   expect(row.length).toBeGreaterThan(5);expect(Math.max(...row.map(b=>b.pos.z))-Math.min(...row.map(b=>b.pos.z))).toBeLessThanOrEqual(2);
   for(let x=lo;x<=hi;x++)expect(row.some(b=>b.pos.x===x),'rear glass gap '+[x,y]).toBe(true);
   const center=row.find(b=>b.pos.x===0)!,spine=category('Rear central spine').find(b=>b.pos.y===y)!;expect(spine.pos.z-center.pos.z).toBe(1);
   for(const x of [lo,hi]){const edge=row.find(b=>b.pos.x===x)!;expect(blocks.some(b=>b.pos.y===y&&b.id==='minecraft:smooth_quartz'&&Math.abs(b.pos.x-x)<=2&&Math.abs(b.pos.z-edge.pos.z)<=1)).toBe(true);}
  }
  for(const y of [46,58,70]){
   const row=category('Rear slab ledge').filter(b=>b.pos.y===y);expect(row.length).toBeGreaterThan(8);expect(row.every(b=>b.id==='minecraft:smooth_quartz_slab'&&b.state.type==='top')).toBe(true);
   expect(Math.max(...row.map(b=>b.pos.z))-Math.min(...row.map(b=>b.pos.z))).toBeLessThanOrEqual(3);
   for(const ledge of row)expect(['minecraft:blue_stained_glass','minecraft:smooth_quartz']).toContain(cells.get([ledge.pos.x,y,ledge.pos.z-1].join(','))?.id);
   expect(row.filter(ledge=>cells.get([ledge.pos.x,y,ledge.pos.z-1].join(','))?.id==='minecraft:blue_stained_glass').length).toBeGreaterThan(row.length/2);
  }
 });
 it('joins the full-width curved rib cores through real face-connected half-step geometry',()=>{
  const ribs=[...category('Front curved rib'),...category('Front rib half-step')],byCell=new Map(ribs.map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
  const joined=(a:typeof ribs[number],b:typeof ribs[number])=>shapeForBlock(a).boxes.some(aa=>shapeForBlock(b).boxes.some(bb=>{
   const ap=[a.pos.x,a.pos.y,a.pos.z],bp=[b.pos.x,b.pos.y,b.pos.z];
   return [0,1,2].some(axis=>{
    const touches=Math.abs(ap[axis]!+aa.max[axis]!-bp[axis]!-bb.min[axis]!)<1e-6||Math.abs(bp[axis]!+bb.max[axis]!-ap[axis]!-aa.min[axis]!)<1e-6;
    return touches&&[0,1,2].filter(i=>i!==axis).every(i=>Math.min(ap[i]!+aa.max[i]!,bp[i]!+bb.max[i]!)-Math.max(ap[i]!+aa.min[i]!,bp[i]!+bb.min[i]!)>1e-6);
   });
  }));
  const queue=[ribs[0]!],seen=new Set([ribs[0]!.uid]);
  for(let i=0;i<queue.length;i++){const a=queue[i]!;for(const [dx,dy,dz]of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const b=byCell.get([a.pos.x+dx!,a.pos.y+dy!,a.pos.z+dz!].join(','));if(b&&!seen.has(b.uid)&&joined(a,b)){seen.add(b.uid);queue.push(b);}}}
  expect(seen.size).toBe(ribs.length);
 });
 it('preserves a narrow rear leaf window, central spine and a physically raised gold overlap',()=>{
  const front=category('Front recessed glazing'),rear=category('Rear recessed glazing');expect(front.length).toBeGreaterThan(rear.length*1.4);expect(rear.length).toBeGreaterThan(0);expect(rear.every(b=>b.pos.y>=35&&b.pos.z>0)).toBe(true);
  const widestRearBlueRow=Array.from({length:30},(_,i)=>45+i).filter(y=>!GOLDEN_LEAF_DESIGN.floorLevels.includes(y)).map(y=>{const blue=rear.filter(b=>b.pos.y===y),shell=blocks.filter(b=>b.pos.y===y&&b.id==='minecraft:gold_block'),span=(bs:typeof blocks)=>Math.max(...bs.map(b=>b.pos.x))-Math.min(...bs.map(b=>b.pos.x))+1;return {y,blue:span(blue),shell:span(shell)};}).sort((a,b)=>b.blue-a.blue)[0]!;
  expect(widestRearBlueRow.blue/widestRearBlueRow.shell).toBeGreaterThanOrEqual(.36);expect(widestRearBlueRow.blue/widestRearBlueRow.shell).toBeLessThanOrEqual(.46);
  expect(category('Rear central spine').every(b=>b.pos.x===0&&b.pos.z>0)).toBe(true);expect(category('Rear overlapping petal').length).toBeGreaterThan(0);
  expect(category('Rear apex white return')).toHaveLength(9);expect(category('Rear apex white return').every(b=>b.pos.x<=0&&b.pos.y>=90&&b.pos.y<=98&&b.id==='minecraft:quartz_stairs')).toBe(true);
  const seam=category('Rear diagonal petal overlap'),lip=category('Rear overlap lip');expect(seam.every(b=>b.id==='minecraft:gold_block')).toBe(true);expect(new Set(seam.map(b=>b.pos.x)).size).toBeGreaterThan(8);
  for(let y=11;y<=35;y++){const row=lip.filter(b=>b.pos.y===y);expect(row.length).toBeGreaterThan(0);for(const b of row){const ahead=cells.get([b.pos.x,y,b.pos.z+1].join(','));if(y===11&&ahead)expect(ahead.category).toBe('Podium roof');else expect(ahead,'buried gold overlap '+b.uid).toBeUndefined();for(const depth of [1,2])expect(cells.get([b.pos.x,y,b.pos.z-depth].join(','))?.id).toBe('minecraft:gold_block');}if(y<35){const next=lip.filter(b=>b.pos.y===y+1);expect(row.some(a=>next.some(b=>Math.abs(a.pos.x-b.pos.x)<=1&&Math.abs(a.pos.z-b.pos.z)<=2)),'continuous raised overlap '+y).toBe(true);}}
  expect(lip.every(b=>b.id==='minecraft:gold_block')).toBe(true);
  for(const y of [20,28,34]){
   const outer=category('Rear overlapping petal').filter(b=>b.pos.y===y),shellRadius=Math.max(...blocks.filter(b=>b.pos.y===y&&b.id==='minecraft:gold_block').map(b=>Math.abs(b.pos.x)));
   expect(outer.length).toBeGreaterThan(20);
   for(const x of [4,8,12]){
    const surface=Math.max(...outer.filter(b=>b.pos.x===x).map(b=>b.pos.z));
    // A translated circular sheet retains its curvature without radial terrace bands.
    const original=Math.floor(Math.sqrt(Math.max(0,shellRadius**2-x*x)));
    expect(surface-original).toBeGreaterThanOrEqual(2);expect(surface-original).toBeLessThanOrEqual(4);
    expect(cells.get([x,y,surface+1].join(','))).toBeUndefined();
   }
  }
 });
 it('fits 26 usable floors with clear stairs and a complete warm-lit base',()=>{
  expect(GOLDEN_LEAF_DESIGN.floorLevels).toHaveLength(26);
  for(const y of GOLDEN_LEAF_DESIGN.floorLevels){expect(cells.get([0,y,0].join(','))?.category).toBe('Floor');expect(category('Front slab ledge').some(b=>b.pos.y===y)).toBe(true);for(const h of [1,2])expect(cells.has([0,y+h,0].join(','))).toBe(false);}
  for(const b of category('Circulation'))for(const h of [1,2])expect(cells.has([b.pos.x,b.pos.y+h,b.pos.z].join(',')),b.uid+' headroom '+h).toBe(false);
  for(const x of [-31,31])expect(cells.get([x,14,4].join(','))?.category).toBe('Annex roof');
  for(const name of ['Entrance light pier','Annex eave light','Facade ledge light','Front interior window light','Front ground garden lamp','Rear ground garden lamp','Podium roof garden lamp','Annex roof garden lamp']){const lights=category(name);expect(lights.length).toBeGreaterThan(0);expect(lights.every(b=>b.id==='minecraft:glowstone')).toBe(true);}
  for(const b of blocks.filter(b=>b.id==='minecraft:pink_tulip'))expect(cells.get([b.pos.x,b.pos.y-1,b.pos.z].join(','))?.id).toBe('minecraft:dirt');
 });
});

it('connects both controlled entrances to every floor by standing-surface steps, without jumping',()=>{
 // Static geometry traversal: 0.6-wide, 1.8-high avatar; max step 0.6, sampled every half block.
 // Doors are evaluated in their opened state after operating the verified adjacent pressure plates.
 const geometry=new Map(blocks.map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),{b,boxes:shapeForBlock(b.id==='minecraft:iron_door'?{...b,state:{...b.state,open:'true',powered:'true'}}:b).boxes}]));
 const overlap=(a:number,b:number,c:number,d:number)=>a<d-1e-6&&b>c+1e-6;
 function surfaces(x:number,z:number,feet:number){
  const heights=new Set<number>();
  for(let xx=Math.floor(x-.3);xx<=Math.floor(x+.3);xx++)for(let zz=Math.floor(z-.3);zz<=Math.floor(z+.3);zz++)for(let yy=Math.floor(feet-.6)-1;yy<=Math.ceil(feet+.6);yy++){
   const cell=geometry.get([xx,yy,zz].join(','));if(!cell)continue;
   for(const box of cell.boxes){const top=yy+box.max[1];if(Math.abs(top-feet)>.600001)continue;if(overlap(x-.3,x+.3,xx+box.min[0],xx+box.max[0])&&overlap(z-.3,z+.3,zz+box.min[2],zz+box.max[2]))heights.add(top);}
  }
  return [...heights].filter(height=>{
   for(let xx=Math.floor(x-.3);xx<=Math.floor(x+.3);xx++)for(let zz=Math.floor(z-.3);zz<=Math.floor(z+.3);zz++)for(let yy=Math.floor(height);yy<=Math.floor(height+1.8);yy++){
    const cell=geometry.get([xx,yy,zz].join(','));if(!cell)continue;
    for(const box of cell.boxes)if(overlap(x-.3,x+.3,xx+box.min[0],xx+box.max[0])&&overlap(z-.3,z+.3,zz+box.min[2],zz+box.max[2])&&overlap(height+1e-5,height+1.8,yy+box.min[1],yy+box.max[1]))return false;
   }
   return true;
  });
 }
 const minX=Math.min(...blocks.map(b=>b.pos.x))*2-1,maxX=(Math.max(...blocks.map(b=>b.pos.x))+1)*2+1,minZ=Math.min(...blocks.map(b=>b.pos.z))*2-1,maxZ=(Math.max(...blocks.map(b=>b.pos.z))+1)*2+1;
 expect(surfaces(-.5,-23,1.5)).toContain(1.5);
 expect(surfaces(7.5,24,1.5)).toContain(1.5);
 const encode=(x:number,z:number,h:number)=>[x,z,Math.round(h*16)].join(','),queue:[number,number,number][]=[[-1,-46,1.5]],visited=new Set([encode(-1,-46,1.5)]);
 for(let i=0;i<queue.length;i++){const [x,z,h]=queue[i]!;for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx!,nz=z+dz!;if(nx<minX||nx>maxX||nz<minZ||nz>maxZ)continue;for(const nh of surfaces(nx/2,nz/2,h)){const key=encode(nx,nz,nh);if(!visited.has(key)){visited.add(key);queue.push([nx,nz,nh]);}}}}
 for(const y of GOLDEN_LEAF_DESIGN.floorLevels)expect(visited.has(encode(1,1,y+1)),'unreachable floor '+y+'; highest reachable feet '+queue.reduce((max,n)=>Math.max(max,n[2]),0)).toBe(true);
 expect(visited.has(encode(15,48,1.5)),'rear entrance connects to the lobby').toBe(true);
 for(const side of [-1,1])expect(visited.has(encode(side*31*2+1,-7,15)),'crescent roof '+side+' is reachable').toBe(true);
 for(const cx of [-20,20])expect(category('Annex roof garden lamp').filter(b=>Math.abs(b.pos.x-cx)<=14)).toHaveLength(4);
 for(const [x,z]of[[-1,-19],[0,-19],[7,19],[8,19]]as const){const door=cells.get([x,4,z].join(','))!;expect(door.id).toBe('minecraft:iron_door');expect(door.state.hinge).toBe(x===0||x===8?'right':'left');for(const dz of [-1,1])expect(cells.get([x,4,z+dz].join(','))?.id).toBe('minecraft:stone_pressure_plate');}
},30000);

