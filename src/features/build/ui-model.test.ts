import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../fixtures/two-floor-house.ts';
import { inventory } from './model.ts';
import { layerMembers, materialCategories, toggleLayerCompletion } from './ui-model.ts';

describe('construction UI projections',()=>{
  it('marks and unmarks a whole door from its upper layer while preserving other completion',()=>{
    const project=createDemoProject(),door=project.logicalStructures.find(g=>g.kind==='door')!;
    const upper=project.blocks.find(b=>door.memberUids.includes(b.uid)&&b.state.half==='upper')!;
    const unrelated=project.blocks.find(b=>b.pos.y===8&&!door.memberUids.includes(b.uid))!;
    const before=JSON.stringify(project),members=layerMembers(project,upper.pos.y);
    expect(members).toEqual(expect.arrayContaining([...door.memberUids]));
    const completed=toggleLayerCompletion(project,upper.pos.y,[unrelated.uid]);
    expect(completed).toEqual(expect.arrayContaining([...door.memberUids,unrelated.uid]));
    expect(toggleLayerCompletion(project,upper.pos.y,completed)).toEqual([unrelated.uid]);
    expect(JSON.stringify(project)).toBe(before);
  });
  it('counts cross-category door/bed pairs once under canonical anchor and all slabs with their real item quantities',()=>{
    const source=createDemoProject();
    const members=new Map(source.logicalStructures.flatMap(g=>g.memberUids.map(uid=>[uid,uid===g.anchorUid?'anchor-category':'other-category'] as const)));
    const project={...source,blocks:source.blocks.map(b=>({...b,category:members.get(b.uid)??b.category??'未分類'}))};
    const categories=materialCategories(project),summary=inventory(project);
    for(const item of summary.items)expect(categories.get(item.itemId)!.reduce((sum,c)=>sum+c.count,0)).toBe(item.required);
    expect(categories.get('minecraft:oak_door')).toEqual([{category:'anchor-category',count:1}]);
    expect(categories.get('minecraft:red_bed')).toEqual([{category:'anchor-category',count:1}]);
    expect(categories.get('minecraft:oak_slab')!.reduce((sum,c)=>sum+c.count,0)).toBe(4);
  });
  it('keeps shared material contributions separate, independent of block array order',()=>{
    const source=createDemoProject();
    const project={...source,blocks:source.blocks.map((b,i)=>({...b,category:i%2?'roof':'floor'}))};
    expect(materialCategories({...project,blocks:[...project.blocks].reverse()})).toEqual(materialCategories(project));
    expect(materialCategories(project).get('minecraft:oak_planks')!.length).toBe(2);
  });
  it('an empty layer preserves existing completion',()=>{
    expect(layerMembers(createDemoProject(),100)).toEqual([]);
    expect(toggleLayerCompletion(createDemoProject(),100,['existing'])).toEqual(['existing']);
  });
});
