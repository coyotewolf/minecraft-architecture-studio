import { describe, expect, it } from 'vitest';
import { parseProject, exportProject } from '../core/model.ts';
import { getRegistryEntry, normalizeBlockState } from '../core/versioned-registry.ts';
import { createDemoProject } from './two-floor-house.ts';

describe('two-floor demonstration fixture', () => {
  it('has deterministic identity, exact cell count, bounds and unique coordinates', () => {
    const project = createDemoProject();
    expect(exportProject(createDemoProject())).toBe(exportProject(project));
    expect(project.blocks).toHaveLength(288);
    expect(new Set(project.blocks.map(b => [b.pos.x, b.pos.y, b.pos.z].join(','))).size).toBe(288);
    expect(new Set(project.blocks.map(b => b.uid)).size).toBe(288);
    for (const [axis, min, max] of [['x', -4, 4], ['y', 0, 8], ['z', -3, 3]] as const) {
      expect(Math.min(...project.blocks.map(b => b.pos[axis]))).toBe(min);
      expect(Math.max(...project.blocks.map(b => b.pos[axis]))).toBe(max);
    }
    expect(parseProject(project)).toEqual(project);
    expect(Object.isFrozen(project.blocks)).toBe(true);
  });

  it('contains only fully normalized real registry states and honest demonstration provenance', () => {
    for (const block of createDemoProject().blocks) {
      expect(Object.keys(block.state).sort()).toEqual(Object.keys(getRegistryEntry(block.id).properties).sort());
      expect(block.state).toEqual(normalizeBlockState(block.id, block.state));
      expect(block.source).toEqual({ origin: 'user_created' });
      expect(block.edits).toEqual({ createdByTransactionId: 'demo-create', lastModifiedByTransactionId: 'demo-create', userModified: false });
    }
  });

  it('exercises log axes, slab types, stair facings and halves, and transparent windows', () => {
    const blocks = createDemoProject().blocks;
    const states = (id: string, property: string) => [...new Set(blocks.filter(b => b.id === id).map(b => b.state[property]))].sort();
    expect(states('minecraft:oak_log', 'axis')).toEqual(['x', 'y', 'z']);
    expect(states('minecraft:oak_slab', 'type')).toEqual(['bottom', 'double', 'top']);
    expect(states('minecraft:oak_stairs', 'facing')).toEqual(['east', 'north', 'south', 'west']);
    expect(states('minecraft:oak_stairs', 'half')).toEqual(['bottom', 'top']);
    expect(states('minecraft:oak_stairs', 'shape')).toEqual(['straight']);
    expect(blocks.filter(b => b.id === 'minecraft:glass')).toHaveLength(14);
  });

  it('contains complete spatially valid door and bed pairs, rejecting a missing member', () => {
    const project = createDemoProject();
    expect(project.logicalStructures).toEqual([
      { uid: 'demo-door', kind: 'door', anchorUid: 'demo:0,1,-3', memberUids: ['demo:0,1,-3', 'demo:0,2,-3'] },
      { uid: 'demo-bed', kind: 'bed', anchorUid: 'demo:-2,5,0', memberUids: ['demo:-2,5,0', 'demo:-2,5,-1'] },
    ]);
    const byUid = new Map(project.blocks.map(block => [block.uid, block]));
    expect(byUid.get('demo:0,1,-3')?.state).toMatchObject({ half: 'lower', facing: 'north', open: 'false' });
    expect(byUid.get('demo:0,2,-3')?.state).toMatchObject({ half: 'upper', facing: 'north', open: 'false' });
    expect(byUid.get('demo:-2,5,0')?.state).toMatchObject({ part: 'foot', facing: 'north' });
    expect(byUid.get('demo:-2,5,-1')?.state).toMatchObject({ part: 'head', facing: 'north' });
    for (const uid of ['demo:0,2,-3', 'demo:-2,5,-1']) {
      expect(() => parseProject({ ...project, blocks: project.blocks.filter(block => block.uid !== uid) })).toThrow('member');
    }
  });

  it('retains open walls for inspection and connects stairs through the upper floor opening', () => {
    const blocks = createDemoProject().blocks;
    const at = (x: number, y: number, z: number) => blocks.find(b => b.pos.x === x && b.pos.y === y && b.pos.z === z);
    expect(at(0, 2, 3)).toBeUndefined();
    expect(at(-4, 6, 0)).toBeUndefined();
    expect(at(-4, 0, -3)?.id).toBe('minecraft:stone_bricks');
    expect(at(0, 4, 0)?.id).toBe('minecraft:oak_planks');
    expect(at(0, 8, 0)?.id).toBe('minecraft:oak_planks');
    for (let step = 0; step < 4; step++) {
      expect(at(2, step + 1, 2 - step)?.state).toMatchObject({ facing: 'north', half: 'bottom', shape: 'straight' });
    }
  });
});
