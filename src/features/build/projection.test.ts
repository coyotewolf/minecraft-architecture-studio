import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../fixtures/two-floor-house.ts';
import { parseProject, stableJson } from '../../core/model.ts';
import { constructionSteps } from './model.ts';
import { viewProjection, type ViewOptions } from './projection.ts';

const demo = createDemoProject();
const steps = constructionSteps(demo);
const shifted = parseProject({ ...demo, blocks: demo.blocks.map(b => ({ ...b, pos: { ...b.pos, y: b.pos.y - 5 } })) });
const shiftedSteps = constructionSteps(shifted);
const defaults: ViewOptions = { layer: 4, mode: 'all', progress: 0, completed: [], exploded: false, build: false };
function project(options: Partial<ViewOptions> = {}) { return viewProjection(demo, steps, { ...defaults, ...options }); }

describe('Build views remain derived projections of canonical data', () => {
  it('does not modify serialized canonical coordinates, states, identities or provenance', () => {
    const before = stableJson(demo);
    const originalSteps = stableJson(steps);
    for (const mode of ['all', 'layer', 'through', 'ghost'] as const) for (const progress of [0, 50, 100]) {
      project({ mode, progress, build: true, exploded: true, completed: ['demo:0,1,-3'], material: 'minecraft:oak_door', cut: { axis: 'z', value: 0 } });
    }
    expect(stableJson(demo)).toBe(before);
    expect(stableJson(steps)).toBe(originalSteps);
    expect(project().every(entry => entry.offsetY === 0)).toBe(true);
    expect(project().map(entry => entry.uid)).toEqual(demo.blocks.map(block => block.uid));
  });

  it.each(['layer', 'through', 'ghost'] as const)('applies %s semantics at Y 4 including the boundary', mode => {
    const entries = new Map(project({ mode }).map(entry => [entry.uid, entry]));
    for (const block of demo.blocks) {
      const entry = entries.get(block.uid)!;
      expect(entry.visible).toBe(mode === 'layer' ? block.pos.y === 4 : mode === 'through' ? block.pos.y <= 4 : true);
      expect(entry.opacity).toBe(mode === 'ghost' && block.pos.y > 4 ? .16 : 1);
    }
    expect(demo.blocks.some(block => block.pos.y === 4)).toBe(true);
    expect(demo.blocks.some(block => block.pos.y > 4)).toBe(true);
  });

  it('uses signed Y coordinates for negative layer and through views', () => {
    const before = stableJson(shifted);
    for (const mode of ['layer', 'through', 'ghost'] as const) {
      const entries = viewProjection(shifted, shiftedSteps, { ...defaults, layer: -1, mode });
      for (let index = 0; index < shifted.blocks.length; index++) {
        const y = shifted.blocks[index]!.pos.y;
        expect(entries[index]!.visible).toBe(mode === 'layer' ? y === -1 : mode === 'through' ? y <= -1 : true);
        expect(entries[index]!.opacity).toBe(mode === 'ghost' && y > -1 ? .16 : 1);
      }
    }
    expect(stableJson(shifted)).toBe(before);
  });

  it('scrubs progress 0, 50 and 100 independently from selected layer visibility', () => {
    const atZero = project({ build: true, progress: 0, mode: 'layer' });
    const atHalf = project({ build: true, progress: 50, mode: 'layer' });
    const atEnd = project({ build: true, progress: 100, mode: 'layer' });
    const firstHalf = new Set(steps.slice(0, Math.floor(steps.length / 2)).flatMap(step => step.blockUids));
    expect(atZero.every(entry => entry.opacity === .16)).toBe(true);
    expect(atEnd.every(entry => entry.opacity === 1)).toBe(true);
    for (const entry of atHalf) expect(entry.opacity).toBe(firstHalf.has(entry.uid) ? 1 : .16);
    expect(atZero.map(entry => entry.visible)).toEqual(atHalf.map(entry => entry.visible));
    expect(atHalf.map(entry => entry.visible)).toEqual(atEnd.map(entry => entry.visible));
    expect(project({ progress: 0 }).every(entry => entry.opacity === 1)).toBe(true);
  });

  it('completed blocks override future ghosts but remain ghosted above the selected layer', () => {
    const lower = demo.blocks.find(block => block.pos.y === 4)!;
    const upper = demo.blocks.find(block => block.pos.y === 8)!;
    const entries = new Map(project({ mode: 'ghost', build: true, completed: [lower.uid, upper.uid] }).map(entry => [entry.uid, entry]));
    expect(entries.get(lower.uid)?.opacity).toBe(1);
    expect(entries.get(upper.uid)?.opacity).toBe(.16);
    const otherLower = demo.blocks.find(block => block.pos.y === 4 && block.uid !== lower.uid)!;
    expect(entries.get(otherLower.uid)?.opacity).toBe(.16);
  });

  it.each(['door', 'bed'] as const)('explodes each %s as one unit and preserves its member spacing', kind => {
    const group = demo.logicalStructures.find(structure => structure.kind === kind)!;
    const entries = new Map(project({ exploded: true }).map(entry => [entry.uid, entry]));
    const members = group.memberUids.map(uid => demo.blocks.find(block => block.uid === uid)!);
    const [first, second] = members;
    const firstOffset = entries.get(first!.uid)!.offsetY;
    const secondOffset = entries.get(second!.uid)!.offsetY;
    expect(firstOffset).toBe(secondOffset);
    expect(firstOffset).toBeGreaterThan(0);
    expect((second!.pos.y + secondOffset) - (first!.pos.y + firstOffset)).toBe(second!.pos.y - first!.pos.y);
    if (kind === 'door') expect(Math.abs(second!.pos.y - first!.pos.y)).toBe(1);
    else expect(Math.abs(second!.pos.z - first!.pos.z)).toBe(1);
    expect(entries.size).toBe(demo.blocks.length);
  });

  it.each(['x', 'y', 'z'] as const)('combines material and %s cut filters at inclusive boundaries', axis => {
    const cutValue = axis === 'y' ? 2 : 0;
    const entries = project({ material: 'minecraft:oak_log', cut: { axis, value: cutValue } });
    expect(entries.some(entry => entry.visible)).toBe(true);
    expect(entries.some(entry => !entry.visible)).toBe(true);
    for (let index = 0; index < demo.blocks.length; index++) {
      const block = demo.blocks[index]!;
      expect(entries[index]!.visible).toBe(block.id === 'minecraft:oak_log' && block.pos[axis] <= cutValue);
    }
  });
});

describe('Architectural inspection controls', () => {
  it('hides exact roof categories and selected materials without mutating model or item counts', () => {
    const before=stableJson(demo);
    const entries=project({hideRoof:true,hiddenMaterials:['minecraft:glass']});
    demo.blocks.forEach((b,i)=>expect(entries[i]!.visible).toBe(b.category!=='屋頂'&&b.id!=='minecraft:glass'));
    expect(entries.some(e=>!e.visible)).toBe(true);expect(stableJson(demo)).toBe(before);
  });
  it('highlights search matches and estimated evidence without hiding canonical cells', () => {
    const entries=project({materialFocus:'OAK_DOOR'});
    demo.blocks.forEach((b,i)=>{expect(entries[i]!.visible).toBe(true);expect(entries[i]!.opacity).toBe(b.id==='minecraft:oak_door'?1:.16);});
    expect(project({estimatedOnly:true}).every(e=>e.opacity===.16)).toBe(true);
    const mixed=parseProject({...demo,blocks:demo.blocks.map((b,i)=>i===0?{...b,source:{origin:'ai_estimated',confidence:.35}}:b)});
    const selected=viewProjection(mixed,constructionSteps(mixed),{...defaults,estimatedOnly:true});
    expect(selected[0]!.opacity).toBe(1);expect(selected.slice(1).every(e=>e.opacity===.16)).toBe(true);
  });
  it('can hide unfinished construction and scrub backward without losing completion', () => {
    const completed=[demo.blocks[0]!.uid];
    expect(project({build:true,ghostFuture:false,progress:0,completed}).filter(e=>e.visible).map(e=>e.uid)).toEqual(completed);
    expect(project({build:true,ghostFuture:false,progress:100}).every(e=>e.visible)).toBe(true);
    expect(project({build:true,ghostFuture:false,progress:0}).every(e=>!e.visible)).toBe(true);
    expect(project({build:true,ghostFuture:true,progress:0}).every(e=>e.visible&&e.opacity===.16)).toBe(true);
  });
});
