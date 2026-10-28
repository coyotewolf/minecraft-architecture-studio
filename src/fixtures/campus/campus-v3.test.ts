import {REFERENCE_ORIGINS as O} from './reference-layout.ts';
import {beforeAll,describe,expect,it} from 'vitest';
import {parseProject} from '../../core/model.ts';
import {normalizeBlockState} from '../../core/versioned-registry.ts';
import {shapeForBlock} from '../../features/viewer/geometry.ts';
import {inventory} from '../../features/build/model.ts';
import {createCampus,campusToJson,assembleCampus,type Campus} from './index.ts';
let campus:Campus;
beforeAll(()=>{campus=createCampus();},120000);
describe('integrated reference V3 campus',()=>{
 it('preserves twelve building groups, all references and derived totals',()=>{
  const buildings=campus.districts.filter(d=>d.parentGroupId!=='campus-landscape');
  expect(new Set(buildings.map(d=>d.parentGroupId)).size).toBe(12);
  expect(new Set(campus.districts.flatMap(d=>d.references))).toEqual(new Set(Array.from({length:11},(_,i)=>'reference-'+String(i+1).padStart(2,'0'))));
  expect(campus.blocks.length).toBe(campus.districts.reduce((n,d)=>n+d.project.blocks.length,0));
  expect(campus.totalItems).toBe(campus.districts.reduce((n,d)=>n+inventory(d.project).totalInventoryItems!,0));
  expect(campus.totalItems).not.toBeNull();expect(campus.totalItems).toBeLessThan(campus.blocks.length);
  expect(createCampus()).toBe(campus);
 });
 it('validates each bounded project and each distinct canonical placement state',()=>{
  const states=new Map<string,(typeof campus.blocks)[number]>();
  for(const d of campus.districts){expect(d.project.blocks.length).toBeGreaterThan(0);expect(d.project.blocks.length).toBeLessThan(50000);expect(d.project.id).toBe(d.id+'-reference-v3');expect(parseProject(d.project).blocks.length).toBe(d.project.blocks.length);}
  const badSource=campus.blocks.find(b=>b.source.origin!=='ai_estimated'||!b.source.referenceRegionId||b.source.confidence===undefined);
  expect(badSource).toBeUndefined();
  for(const b of campus.blocks)states.set(b.id+JSON.stringify(b.state),b);
  for(const b of states.values())expect(normalizeBlockState(b.id,b.state)).toEqual(b.state);
  expect([...new Set([...states.values()].filter(b=>!shapeForBlock(b).supported).map(b=>b.id))]).toEqual([]);
 },120000);
 it('has a continuous seven-wide skywalk with two clear headroom cells and connected endpoints',()=>{
  const commandY=117,airportY=O.airport[1]+45;
  const route=[[O.command[0],commandY,O.command[2]-12],[O.command[0],commandY,O.command[2]-55],[O.airport[0],airportY,O.airport[2]+77],[O.airport[0],airportY,O.airport[2]+65]] as const;
  const x0=Math.min(...route.map(p=>p[0]))-4,x1=Math.max(...route.map(p=>p[0]))+4,z0=Math.min(...route.map(p=>p[2]))-4,z1=Math.max(...route.map(p=>p[2]))+4;
  const low=Math.min(commandY,airportY),high=Math.max(commandY,airportY);
  // Retain only corridor-height cells, including building-owned cells that could obstruct it.
  const index=new Map(campus.blocks.filter(b=>b.pos.x>=x0&&b.pos.x<=x1&&b.pos.z>=z0&&b.pos.z<=z1&&b.pos.y>=low&&b.pos.y<=high+6).map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
  const points:{x:number;y:number;z:number}[]=[];
  for(let k=0;k<route.length-1;k++){const a=route[k]!,v=route[k+1]!,n=Math.max(Math.abs(v[0]-a[0]),Math.abs(v[2]-a[2]));for(let i=0;i<=n;i++)points.push({x:Math.round(a[0]+(v[0]-a[0])*i/n),y:Math.round(a[1]+(v[1]-a[1])*i/n),z:Math.round(a[2]+(v[2]-a[2])*i/n)});}
  const floorAt=(x:number,z:number,expected:number)=>[expected,expected+1,expected-1].filter(y=>y>=low&&y<=high).find(y=>index.has([x,y,z].join(','))&&!index.has([x,y+1,z].join(','))&&!index.has([x,y+2,z].join(',')));
  let last=commandY;const checked=new Set<string>();
  for(const p of points){const floor=floorAt(p.x,p.z,p.y);expect(floor,'No walkable center floor at '+JSON.stringify(p)).toBeDefined();if(floor===undefined)continue;
   expect(Math.abs(floor-last),'Step exceeds one block at '+JSON.stringify(p)).toBeLessThanOrEqual(1);last=floor;
   // A square seven-cell-wide swept interior guarantees continuous room around diagonal corners.
   for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){const x=p.x+dx,z=p.z+dz,key=x+','+z;if(checked.has(key))continue;checked.add(key);
    // The command hallway starts at -12: do not require widening three cells into its unaltered interior.
    if(z>O.command[2]-12)continue;
    const nearest=points.reduce((best,candidate)=>(candidate.x-x)**2+(candidate.z-z)**2<(best.x-x)**2+(best.z-z)**2?candidate:best,points[0]!);const deck=floorAt(x,z,nearest.y);expect(deck,'Blocked or absent deck '+key+' owners '+[0,1,2].map(h=>index.get([x,floor+h,z].join(','))?.componentId??'air').join('/')).toBeDefined();if(deck!==undefined)expect(Math.abs(deck-nearest.y),'Cross-deck discontinuity '+key).toBeLessThanOrEqual(1);
   }
  }
  expect(index.has([O.command[0],commandY,O.command[2]-22].join(','))).toBe(true);expect(index.has([O.airport[0],airportY,O.airport[2]+65].join(','))).toBe(true);
 }); it('roundtrips one representative editable part without serializing the aggregate campus',()=>{
  const part=campus.districts.find(d=>d.parentGroupId==='sphere-observatory')!;
  const sample=assembleCampus([part]);const decoded=JSON.parse(campusToJson(sample));expect(decoded.districts).toHaveLength(1);expect(parseProject(decoded.districts[0].project)).toEqual(part.project);
 });
});





