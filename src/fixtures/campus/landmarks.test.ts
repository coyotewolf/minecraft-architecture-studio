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
    expect(districts.map(d=>d.project.blocks.length)).toEqual([10399,11791,14597,4137]);
  });
  it('retains furnished control, library, home and gallery spaces with atomic doors and beds', () => {
    expect(districts[0]!.project.blocks.filter(b=>b.category==='Console').length).toBeGreaterThan(50);
    expect(districts[1]!.project.blocks.filter(b=>b.category==='Server')).toHaveLength(36);
    expect(districts[2]!.project.logicalStructures.filter(s=>s.kind==='bed')).toHaveLength(12);
    expect(districts[2]!.project.blocks.filter(b=>b.id==='minecraft:bookshelf').length).toBeGreaterThan(100);
    expect(districts[3]!.project.blocks.filter(b=>b.category==='PlanetWall').length).toBeGreaterThan(30);
    for (const d of districts) for (const s of d.project.logicalStructures) {
      expect(s.memberUids).toHaveLength(2);
      expect(s.memberUids.every(uid=>d.project.blocks.some(b=>b.uid===uid && b.logicalStructureId===s.uid))).toBe(true);
    }
  });
  it('connects occupied floors through a continuous two-high walking route', () => {
    const cases = [[0,0,49], [1,0,49], [2,-12,37], [2,12,31], [3,-4,25]] as const;
    for (const [index,cx,top] of cases) {
      const d=districts[index]!;
      const key=(x:number,y:number,z:number)=>[x,y,z].join(',');
      const cells=new Set(d.project.blocks.filter(b=>b.id!=='minecraft:oak_door').map(b=>key(b.pos.x-d.origin[0],b.pos.y,b.pos.z-d.origin[2])));
      const walkable=(x:number,y:number,z:number)=>cells.has(key(x,y-1,z))&&!cells.has(key(x,y,z))&&!cells.has(key(x,y+1,z));
      const queue:number[][]=[[cx,2,-6]];
      const seen=new Set([key(cx,2,-6)]);
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
    for (let z=-12;z<=0;z++) for (const y of [2,3]) expect(gallery.project.blocks.some(b=>b.pos.x===-24 && b.pos.y===y && b.pos.z===z+34 && b.id!=='minecraft:oak_door')).toBe(false);
  });
});
