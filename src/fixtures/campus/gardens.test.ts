import { describe, expect, it } from 'vitest';
import { createGardenDistricts } from './gardens.ts';
import { parseProject } from '../../core/model.ts';
const districts=createGardenDistricts();
function local(d:typeof districts[number],x:number,y:number,z:number){return d.project.blocks.find(b=>b.pos.x===x+d.origin[0]&&b.pos.y===y+d.origin[1]&&b.pos.z===z+d.origin[2]);}
describe('Furnished garden reference districts',()=>{
  it.each(districts)('$id is canonical and unique with estimated reference provenance',d=>{
    expect(parseProject(d.project)).toEqual(d.project);
    expect(new Set(d.project.blocks.map(b=>JSON.stringify(b.pos))).size).toBe(d.project.blocks.length);
    expect(d.project.blocks.length).toBeLessThan(50000);
    expect(d.project.blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.confidence===.35)).toBe(true);
    expect(d.features.length).toBeGreaterThanOrEqual(4);
  });
  it('has actual crop beds, livestock pens and a supported loft stair',()=>{
    const d=districts[0]!;
    for(const id of ['minecraft:wheat','minecraft:farmland','minecraft:oak_fence_gate','minecraft:hay_block'])expect(d.project.blocks.some(b=>b.id===id)).toBe(true);
    for(let z=-20;z<=7;z++)for(let y=2;y<=4;y++)expect(local(d,16,y,z)).toBeUndefined();
    for(let step=0;step<7;step++)expect(local(d,15,2+step,8+step)?.id).toBe('minecraft:oak_stairs');
  });
  it('has twelve bedrooms and twelve paired doors with continuous upper-floor stairs',()=>{
    const d=districts[1]!;
    expect(d.project.logicalStructures.filter(g=>g.kind==='bed')).toHaveLength(12);
    expect(d.project.logicalStructures.filter(g=>g.kind==='door')).toHaveLength(12);
    for(const cx of [-12,12])for(let level=0;level<5;level++)for(let step=0;step<6;step++) {
      const y=2+level*6+step,z=5+step;
      expect(local(d,cx,y,z)?.id).toBe('minecraft:quartz_stairs');
      expect(local(d,cx,y+1,z)).toBeUndefined();expect(local(d,cx,y+2,z)).toBeUndefined();
    }
    for(const id of ['minecraft:furnace','minecraft:barrel','minecraft:oak_pressure_plate'])expect(d.project.blocks.some(b=>b.id===id)).toBe(true);
  });
  it('provides five map pavilions with seats and open entrances',()=>{
    const d=districts[2]!;expect(d.project.blocks.filter(b=>b.id==='minecraft:cartography_table')).toHaveLength(5);
    for(const [x,z] of [[-22,0],[-11,-9],[11,-9],[22,0],[0,9]])for(let y=2;y<=4;y++)expect(local(d,x!,y,z!+6)).toBeUndefined();
  });
  it('provides separate enchanting and brewing furnishings with two-block passages',()=>{
    const d=districts[3]!;
    expect(local(d,-12,2,-1)?.id).toBe('minecraft:enchanting_table');expect(local(d,12,2,-1)?.id).toBe('minecraft:brewing_stand');
    for(const x of [-12,12])for(let z=4;z<=9;z++)for(let y=2;y<=3;y++)expect(local(d,x,y,z)).toBeUndefined();
  });
});
