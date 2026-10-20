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
  expect(project.id).toBe('golden-leaf-100-complete-v5');expect(project.designRevision).toBe('golden-leaf-100-v5');
  expect(blocks.some(b=>b.category==='Tall leaf tip'&&b.pos.y===99)).toBe(true);expect(blocks.some(b=>b.category==='Short leaf tip'&&b.pos.y===90)).toBe(true);
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
 it('separates gray exterior ribs, deep blue glazing, white returns and real half-height ledges',()=>{
  const ribs=category('Front exterior upright').filter(b=>b.pos.y===40),glass=category('Front recessed glazing');expect(ribs.length).toBe(2);
  for(const rib of ribs){expect(rib.id).toBe('minecraft:light_gray_concrete');const back=glass.find(b=>b.pos.x===rib.pos.x&&b.pos.y===rib.pos.y);expect(back).toBeDefined();expect(back!.pos.z-rib.pos.z).toBeGreaterThanOrEqual(2);expect(cells.has([rib.pos.x,rib.pos.y,rib.pos.z+1].join(','))).toBe(false);}
  expect(glass.every(b=>b.id==='minecraft:blue_stained_glass')).toBe(true);expect(category('Front white leaf reveal').every(b=>b.id==='minecraft:smooth_quartz')).toBe(true);
  const slab=category('Front slab ledge')[0]!;expect(slab.id).toBe('minecraft:smooth_stone_slab');expect(slab.state.type).toBe('top');expect(shapeForBlock(slab).boxes[0]!.min[1]).toBe(.5);
  expect(category('Front lower X brace').every(b=>b.pos.z<0&&b.pos.y<=48)).toBe(true);
 });
 it('preserves a narrow rear leaf window, central spine and a physically raised gold overlap',()=>{
  const front=category('Front recessed glazing'),rear=category('Rear recessed glazing');expect(front.length).toBeGreaterThan(rear.length*1.4);expect(rear.length).toBeGreaterThan(0);expect(rear.every(b=>b.pos.y>=39&&b.pos.z>0)).toBe(true);
  expect(category('Rear central spine').every(b=>b.pos.x===0&&b.pos.z>0)).toBe(true);expect(category('Rear overlapping petal').length).toBeGreaterThan(0);
  expect(category('Rear apex white return')).toHaveLength(7);expect(category('Rear apex white return').every(b=>b.pos.x===0&&b.pos.y>=90&&b.pos.y<=96&&b.id==='minecraft:smooth_quartz')).toBe(true);
  const seam=category('Rear diagonal petal overlap');expect(seam.some(b=>b.id==='minecraft:smooth_quartz')).toBe(true);expect(new Set(seam.map(b=>b.pos.x)).size).toBeGreaterThan(8);
 });
 it('fits 23 usable floors with clear stairs and a complete warm-lit base',()=>{
  expect(GOLDEN_LEAF_DESIGN.floorLevels).toHaveLength(23);
  for(const y of GOLDEN_LEAF_DESIGN.floorLevels){expect(cells.get([0,y,0].join(','))?.category).toBe('Floor');expect(category('Front slab ledge').some(b=>b.pos.y===y)).toBe(true);for(const h of [1,2])expect(cells.has([0,y+h,0].join(','))).toBe(false);}
  for(const b of category('Circulation'))for(const h of [1,2])expect(cells.has([b.pos.x,b.pos.y+h,b.pos.z].join(',')),b.uid+' headroom '+h).toBe(false);
  for(const x of [-26,26])expect(cells.get([x,14,-10].join(','))?.category).toBe('Annex roof');
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
 const encode=(x:number,z:number,h:number)=>[x,z,Math.round(h*16)].join(','),queue:[number,number,number][]=[[-1,-53,4]],visited=new Set([encode(-1,-53,4)]);
 for(let i=0;i<queue.length;i++){const [x,z,h]=queue[i]!;for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx!,nz=z+dz!;if(nx< -69||nx>69||nz< -69||nz>69)continue;for(const nh of surfaces(nx/2,nz/2,h)){const key=encode(nx,nz,nh);if(!visited.has(key)){visited.add(key);queue.push([nx,nz,nh]);}}}}
 for(const y of GOLDEN_LEAF_DESIGN.floorLevels)expect(visited.has(encode(1,1,y+1)),'unreachable floor '+y+'; highest reachable feet '+queue.reduce((max,n)=>Math.max(max,n[2]),0)).toBe(true);
 expect(visited.has(encode(15,51,4)),'rear entrance connects to the lobby').toBe(true);
 for(const cx of [-26,26])expect(visited.has(encode((cx+3)*2+1,-19,15)),'annex roof '+cx+' is reachable').toBe(true);
 for(const cx of [-26,26])expect(category('Annex roof garden lamp').filter(b=>Math.abs(b.pos.x-cx)<=8)).toHaveLength(4);
 for(const [x,z]of[[-1,-24],[0,-24],[7,23],[8,23]]as const){const door=cells.get([x,4,z].join(','))!;expect(door.id).toBe('minecraft:iron_door');expect(door.state.hinge).toBe(x===0||x===8?'right':'left');for(const dz of [-1,1])expect(cells.get([x,4,z+dz].join(','))?.id).toBe('minecraft:stone_pressure_plate');}
},30000);

