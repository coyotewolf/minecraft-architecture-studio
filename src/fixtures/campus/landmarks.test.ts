import { describe, expect, it } from 'vitest';
import { parseProject } from '../../core/model.ts';
import { createLandmarkDistricts } from './landmarks.ts';

const districts = createLandmarkDistricts();
describe('reference landmark districts', () => {
  it('recreates stable canonical snapshots', () => {
    expect(createLandmarkDistricts().map(d=>d.project)).toEqual(districts.map(d=>d.project));
  });
  it('creates four independently valid referenced districts without shared coordinates', () => {
    const all = new Set<string>();
    for (const d of districts) {
      expect(d.project.blocks.length).toBeGreaterThan(3000);
      expect(d.project.blocks.length).toBeLessThan(50000);
      expect(parseProject(d.project)).toEqual(d.project);
      expect(d.features).toHaveLength(4);
      for (const b of d.project.blocks) {
        const key = [b.pos.x, b.pos.y, b.pos.z].join(',');
        expect(all.has(key), key).toBe(false); all.add(key);
        expect(b.source.origin).toBe('ai_estimated');
        expect(b.source.referenceRegionId).toBe(d.references[0]);
      }
    }
    expect(districts.reduce((sum,d)=>sum+d.project.blocks.length,0)).toBeGreaterThanOrEqual(35000);
    expect(districts.every(d=>d.project.blocks.length<50000)).toBe(true);
  });
  it('retains distinct reference silhouettes rather than cylindrical towers',()=>{
    expect(districts.map(d=>d.origin)).toEqual([[-105,12,0],[0,12,0],[58,12,12],[-56,8,105]]);
    const command=districts[1]!, width=(y:number)=>{const row=command.project.blocks.filter(b=>b.pos.y===y+12);return Math.max(...row.map(b=>b.pos.x))-Math.min(...row.map(b=>b.pos.x))+1;};
    expect(width(40)).toBeGreaterThan(width(1)*2);expect(width(85)).toBeLessThan(width(40)/3);
    expect(Math.max(...command.project.blocks.map(b=>b.pos.y))).toBe(102);
    const blade=districts[0]!.project.blocks.filter(b=>b.category==='Blade');
    expect(blade.filter(b=>b.id==='minecraft:gray_concrete').length).toBeGreaterThan(blade.filter(b=>b.id==='minecraft:cyan_stained_glass').length*3);
    const rightEdge=(y:number)=>Math.max(...blade.filter(b=>b.pos.y===y+12).map(b=>b.pos.x+105));
    expect(rightEdge(10)).toBeGreaterThan(rightEdge(40));expect(rightEdge(40)).toBeGreaterThan(rightEdge(70));
    expect(rightEdge(80)).toBeLessThan(0);
    const braces=command.project.blocks.filter(b=>b.category==='Brace');expect(braces.some(b=>b.pos.z>0)).toBe(true);expect(braces.some(b=>b.pos.z<0)).toBe(true);
    expect(districts[0]!.project.blocks.filter(b=>b.category==='Ring').every(b=>b.id==='minecraft:white_concrete')).toBe(true);
    const twin=districts[2]!;expect(Math.max(...twin.project.blocks.filter(b=>b.pos.x<58).map(b=>b.pos.y))).toBe(77);expect(Math.max(...twin.project.blocks.filter(b=>b.pos.x>58).map(b=>b.pos.y))).toBe(67);
    const sphere=districts[3]!.project.blocks.filter(b=>b.category==='Envelope');expect(sphere.filter(b=>b.id==='minecraft:white_concrete').length).toBeGreaterThan(sphere.filter(b=>b.id==='minecraft:cyan_stained_glass').length*20);
  });
  it('keeps every voxel attached to its foundation through face-adjacent structure',()=>{
    for(const d of districts){
      const cells=new Set(d.project.blocks.map(b=>[b.pos.x,b.pos.y,b.pos.z].join(',')));
      const first=d.project.blocks.find(b=>b.pos.y===d.origin[1])!;
      const queue=[first.pos],seen=new Set([Object.values(first.pos).join(',')]);
      for(let i=0;i<queue.length;i++){const p=queue[i]!;for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as const){const q={x:p.x+dx,y:p.y+dy,z:p.z+dz},key=[q.x,q.y,q.z].join(',');if(cells.has(key)&&!seen.has(key)){seen.add(key);queue.push(q);}}}
      expect(d.project.blocks.filter(b=>!seen.has([b.pos.x,b.pos.y,b.pos.z].join(','))).map(b=>b.uid).slice(0,10),d.id).toEqual([]);
    }
  });
  it('retains furnished control, library, home and gallery spaces with atomic doors and beds', () => {
    expect(districts[0]!.project.blocks.filter(b=>b.category==='Console').length).toBeGreaterThan(50);
    expect(districts[1]!.project.blocks.filter(b=>b.category==='Server')).toHaveLength(36);
    expect(districts[2]!.project.logicalStructures.filter(s=>s.kind==='bed')).toHaveLength(18);
    expect(districts[2]!.project.blocks.filter(b=>b.id==='minecraft:bookshelf').length).toBeGreaterThan(100);
    expect(districts[3]!.project.blocks.filter(b=>b.category==='PlanetWall').length).toBeGreaterThan(30);
    for (const d of districts) for (const s of d.project.logicalStructures) {
      expect(s.memberUids).toHaveLength(2);
      expect(s.memberUids.every(uid=>d.project.blocks.some(b=>b.uid===uid && b.logicalStructureId===s.uid))).toBe(true);
    }
  });
  it('connects occupied floors through a continuous two-high walking route', () => {
    const cases = [[0,0,49], [1,0,79], [2,-14,55], [2,14,43], [3,-4,25]] as const;
    for (const [index,cx,top] of cases) {
      const d=districts[index]!;
      const key=(x:number,y:number,z:number)=>[x,y,z].join(',');
      const cells=new Set(d.project.blocks.filter(b=>b.id!=='minecraft:oak_door').map(b=>key(b.pos.x-d.origin[0],b.pos.y-d.origin[1],b.pos.z-d.origin[2])));
      const walkable=(x:number,y:number,z:number)=>cells.has(key(x,y-1,z))&&!cells.has(key(x,y,z))&&!cells.has(key(x,y+1,z));
      expect(walkable(cx,2,-4),d.id+' entrance').toBe(true);
      const queue:number[][]=[[cx,2,-4]];
      const seen=new Set([key(cx,2,-4)]);
      let highest=2;
      for(let i=0;i<queue.length;i++) {
        const [x,y,z]=queue[i]! as [number,number,number]; highest=Math.max(highest,y);
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const) for(const dy of [-1,0,1]) {
          const k=key(x+dx,y+dy,z+dz);
          if(!seen.has(k)&&walkable(x+dx,y+dy,z+dz)) {seen.add(k);queue.push([x+dx,y+dy,z+dz]);}
        }
      }
      expect(highest,d.id).toBeGreaterThanOrEqual(top+1);
    }
  });
  it('provides two air cells above every circulation stair and accessible gallery aisle', () => {
    for (const d of districts) {
      const cells = new Set(d.project.blocks.map(b=>[b.pos.x,b.pos.y,b.pos.z].join(',')));
      for (const b of d.project.blocks.filter(b=>b.category==='Circulation')) for (const h of [1,2]) expect(cells.has([b.pos.x,b.pos.y+h,b.pos.z].join(',')), b.uid).toBe(false);
    }
    const gallery = districts[3]!;
    for (let z=-12;z<=0;z++) for (const y of [2,3]) expect(gallery.project.blocks.some(b=>b.pos.x===-41 && b.pos.y===y+8 && b.pos.z===z+105 && b.id!=='minecraft:oak_door')).toBe(false);
  });
});
