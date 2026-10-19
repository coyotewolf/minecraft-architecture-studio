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
  it('has thirteen bedrooms and thirteen paired doors with continuous upper-floor stairs',()=>{
    const d=districts[1]!;
    expect(d.project.logicalStructures.filter(g=>g.kind==='bed')).toHaveLength(13);
    expect(d.project.logicalStructures.filter(g=>g.kind==='door')).toHaveLength(13);
    for(const [cx,levels] of [[-16,4],[0,6],[16,3]] as const)for(let level=0;level<levels-1;level++)for(let step=0;step<5;step++) {
      const y=2+level*5+step,z=6+step;
      expect(local(d,cx,y,z)?.id).toBe('minecraft:quartz_stairs');
      expect(local(d,cx,y+1,z)).toBeUndefined();expect(local(d,cx,y+2,z)).toBeUndefined();
    }
    for(const id of ['minecraft:furnace','minecraft:barrel','minecraft:oak_pressure_plate'])expect(d.project.blocks.some(b=>b.id===id)).toBe(true);
  });
  it('provides five map pavilions with seats and open entrances',()=>{
    const d=districts[2]!;expect(d.project.blocks.filter(b=>b.id==='minecraft:cartography_table')).toHaveLength(5);
    for(const [x,z] of [[-25,0],[-13,-13],[13,-13],[25,0],[0,13]])for(let y=2;y<=4;y++)expect(local(d,x!,y,z!+6)).toBeUndefined();
  });
  it('provides separate enchanting and brewing furnishings with two-block passages',()=>{
    const d=districts[3]!;
    expect(local(d,-12,2,-1)?.id).toBe('minecraft:enchanting_table');expect(local(d,12,2,-1)?.id).toBe('minecraft:brewing_stand');
    for(const x of [-12,12])for(let z=4;z<=9;z++)for(let y=2;y<=3;y++)expect(local(d,x,y,z)).toBeUndefined();
  });
});

it('uses lighter broad greenhouse vaults, asymmetric green terraces, low domes and white glazed temple bases',()=>{
  const [greenhouse,homes,domes,temples]=districts;
  expect(greenhouse!.origin).toEqual([-8,8,150]);expect(homes!.origin).toEqual([-112,12,85]);
  expect(domes!.origin).toEqual([-99,8,173]);expect(temples!.origin).toEqual([52,10,83]);
  expect(greenhouse!.project.blocks.some(b=>b.id==='minecraft:cyan_stained_glass')).toBe(false);
  expect(Math.max(...greenhouse!.project.blocks.map(b=>b.pos.y))-greenhouse!.origin[1]).toBe(16);
  expect(homes!.project.blocks.filter(b=>b.id==='minecraft:oak_leaves').length).toBeGreaterThan(500);
  expect(Math.max(...domes!.project.blocks.map(b=>b.pos.y))-domes!.origin[1]).toBeLessThanOrEqual(8);
  expect(local(domes!,0,1,0)?.id).toBe('minecraft:gold_block');
  expect(local(temples!,-21,4,0)?.id).toBe('minecraft:white_concrete');
  expect(local(temples!,-21,4,1)?.id).toBe('minecraft:light_blue_stained_glass');
  expect(Math.max(...temples!.project.blocks.map(b=>b.pos.y))-temples!.origin[1]).toBe(22);
});
