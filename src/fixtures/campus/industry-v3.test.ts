import { describe, expect, it } from 'vitest';
import { createIndustryDistrictsV3 } from './industry-v3.ts';
import { REFERENCE_ORIGINS } from './reference-layout.ts';
import { parseProject } from '../../core/model.ts';
const parts=createIndustryDistrictsV3();
const blocks=(id:string)=>parts.filter(d=>d.parentGroupId===id).flatMap(d=>d.project.blocks);
const byCell=(id:string)=>new Map(blocks(id).map(b=>[[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
const local=(id:string,x:number,y:number,z:number)=>{const d=parts.find(p=>p.parentGroupId===id)!;return byCell(id).get([x+d.origin[0],y+d.origin[1],z+d.origin[2]].join(','));};
describe('V3 industrial detail and circulation',()=>{
 it('splits valid canonical models and keeps atomic pairs and distinct world positions',()=>{
  const seen=new Set<string>();for(const d of parts){expect(d.project.blocks.length).toBeLessThan(50000);expect(parseProject(d.project)).toEqual(d.project);
   for(const b of d.project.blocks){const k=JSON.stringify(b.pos);expect(seen.has(k)).toBe(false);seen.add(k);}
   for(const s of d.project.logicalStructures)expect(s.memberUids.every(uid=>d.project.blocks.some(b=>b.uid===uid))).toBe(true);
  }
 });
 it('provides six distinct dragon hangars with roof frames, maintenance lofts and open front bays',()=>{
  const id='campus-dragons';for(const x of [-60,-36,-12,12,36,60]){
   expect(local(id,x,7,-37)?.id).toBe('minecraft:smooth_quartz');
   expect(local(id,x,19,-40)?.id).toBe('minecraft:white_concrete');
   expect(local(id,x,19,-39)?.id).toBe('minecraft:deepslate_tiles');
   expect(local(id,x,4,-10)).toBeUndefined();
  }
 });
 it('keeps actual roof and window subdivisions plus asymmetric aircraft nose, wings and tail',()=>{
  const id='campus-airport';expect(blocks(id).some(b=>b.category==='Window frames')).toBe(true);
  for(const x of [-20,20])expect(local(id,x,31,65)?.category).toBe('Aircraft wings');
  expect(local(id,0,31,34)?.category).toBe('Aircraft');
  expect(local(id,0,37,67)?.category).toBe('Aircraft tail');
  expect(local(id,7,31,73)?.category).toBe('Engine glow');
  const factory=blocks('campus-industry');expect(factory.filter(b=>b.category==='Solar panels'&&b.id==='minecraft:light_gray_concrete').length).toBeGreaterThan(100);
  expect(factory.filter(b=>b.category==='Walls'&&b.id==='minecraft:cyan_stained_glass').length).toBeGreaterThan(200);
 });
 it('retains twelve furnished workshop floors and two air cells above every industrial stair',()=>{
  const id='campus-workshop',o=parts.find(d=>d.parentGroupId===id)!.origin;
  const machineLevels=new Set(blocks(id).filter(b=>b.category==='Machinery').map(b=>b.pos.y-o[1]).filter(y=>y%7===2));
  expect(machineLevels.size).toBe(12);
  for(const group of ['campus-industry','campus-airport','campus-dragons','campus-workshop']){
   const m=byCell(group);for(const b of blocks(group).filter(b=>b.category==='Circulation'))for(const dy of [1,2])expect(m.has([b.pos.x,b.pos.y+dy,b.pos.z].join(',')),b.uid+' headroom '+dy).toBe(false);
  }
 });
 it('connects airport stair landings to side walks and separates workshop return flights',()=>{
  for(const y of [45,57,69,81])for(const z of [12,28,42,46])expect(local('campus-airport',-26,y,z)).toBeDefined();
  for(const y of [57,69,81])for(const z of [42,43,44,45,46])expect(local('campus-airport',-24,y,z)).toBeDefined();
  for(let y=1;y<85;y+=7){const z=y%14===1?3:-4;for(const x of [5,6])expect(local('campus-workshop',x,y+7,z)).toBeDefined();}
 });
 it('keeps declared cardinal extents bounded for later whole-campus assembly',()=>{
  const bounds={ 'campus-industry':[-70,100,0,42,-36,36], 'campus-airport':[-88,70,0,97,-60,73], 'campus-dragons':[-74,74,0,21,-42,56], 'campus-workshop':[-25,25,0,90,-27,27] } as const;
  for(const [id,range]of Object.entries(bounds)){
   const d=parts.find(p=>p.parentGroupId===id)!,bs=blocks(id);expect(d.origin).toEqual(REFERENCE_ORIGINS[id.replace('campus-','') as 'industry'|'airport'|'dragons'|'workshop']);for(const [i,a]of (['x','y','z'] as const).entries()){
    let min=Infinity,max=-Infinity;for(const b of bs){const value=b.pos[a]-d.origin[i]!;min=Math.min(min,value);max=Math.max(max,value);}
    expect(min,id+' '+a+' minimum').toBe(range[i*2]!);expect(max,id+' '+a+' maximum').toBe(range[i*2+1]!);
   }
  }
 });
});

it('authors rounded factory shoulders and projecting airport ribs while preserving the skywalk opening',()=>{
 const factory=byCell('campus-industry'),fo=REFERENCE_ORIGINS.industry,atFactory=(x:number,y:number,z:number)=>factory.get([x+fo[0],y+fo[1],z+fo[2]].join(','));
 expect(atFactory(-52,15,-16)?.category).toBe('Rounded roof');expect(atFactory(-52,15,-31)).toBeUndefined();expect(atFactory(-55,17,-16)?.category).toBe('Projecting rounded frame');expect(atFactory(-55,8,0)?.id).toBe('minecraft:white_concrete');expect(atFactory(-52,7,-1)?.id).toBe('minecraft:gold_block');
 const airport=byCell('campus-airport'),ao=REFERENCE_ORIGINS.airport,atAirport=(x:number,y:number,z:number)=>airport.get([x+ao[0],y+ao[1],z+ao[2]].join(','));
 expect(atAirport(27,70,55)?.category).toBe('Mechanical facade rib');expect(atAirport(26,52,55)?.id).toBe('minecraft:gold_block');expect(atAirport(-18,2,-17)?.category).toBe('Apron tractor');
 for(let x=-3;x<=3;x++)for(let z=53;z<=65;z++){expect(atAirport(x,45,z)).toBeDefined();for(let y=46;y<=50;y++)expect(atAirport(x,y,z),'Entrance '+[x,y,z]).toBeUndefined();}
});
