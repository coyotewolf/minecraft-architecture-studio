import { describe, expect, it } from 'vitest';
import { VoxelEngine } from '../../core/engine.ts';
import { exportProject, importProject } from '../../core/model.ts';
import { createEmptyProject } from '../../core/project.ts';
import { createPlacement } from '../editor/commands.ts';
import { DEFAULT_BUILDING, generateBuilding, type BuildingRequest } from './core.ts';

const empty = () => createEmptyProject('generator-test', '測試樓閣');
describe('original offline building generator', () => {
  it('previews without mutation, commits once, roundtrips one project and undoes/redoes the whole building', () => {
    const engine = new VoxelEngine(empty());
    const before = engine.snapshot();
    const result = generateBuilding(before, DEFAULT_BUILDING);
    expect(engine.preview(result.transaction).ok).toBe(true);
    expect(engine.snapshot()).toBe(before);
    const placed = engine.commit(result.transaction);
    expect(placed.blocks.length).toBe(result.blockCount);
    expect(result.materials.reduce((sum, row) => sum + row.count, 0)).toBe(result.blockCount);
    expect(placed.blocks.every(block => block.source.origin === 'user_created')).toBe(true);
    expect(result.transaction.cause).toBe('user');
    expect(exportProject(importProject(exportProject(placed)))).toBe(exportProject(placed));
    expect(engine.undo().blocks).toHaveLength(0);
    expect(engine.redo().blocks).toEqual(placed.blocks);
  });
  it.each([4, 5, 8])('provides entry, landings and two air cells over every stair on all floors (rise %i)', floorHeight => {
    const floors = 4, width = floorHeight + 5;
    const engine = new VoxelEngine(empty());
    const result = generateBuilding(engine.snapshot(), { ...DEFAULT_BUILDING, width, floorHeight, floors, depth: 7 });
    engine.commit(result.transaction);
    const at = (x: number, y: number, z: number) => engine.getAt({ x, y, z });
    const entranceX = Math.floor(width / 2);
    expect(at(entranceX, 0, 0)).not.toBeNull();
    expect(at(entranceX, 1, 0)).toBeNull();
    expect(at(entranceX, 2, 0)).toBeNull();
    expect(at(entranceX, 3, 0)).not.toBeNull();
    for (let level = 0; level < floors - 1; level++) {
      const base = level * floorHeight;
      // Lower approach and upper exit are inside the shell with walking clearance.
      for (const [x, y] of [[1, base], [floorHeight + 2, base + floorHeight]]) {
        expect(at(x!, y!, 2)).not.toBeNull();
        expect(at(x!, y! + 1, 2)).toBeNull();
        expect(at(x!, y! + 2, 2)).toBeNull();
      }
      for (let step = 1; step <= floorHeight; step++) {
        const stair = at(step + 1, base + step, 2);
        expect(stair?.id).toBe('minecraft:spruce_stairs');
        expect(stair?.state.facing).toBe('east');
        expect(at(step + 1, base + step + 1, 2)).toBeNull();
        expect(at(step + 1, base + step + 2, 2)).toBeNull();
      }
    }
    for (let level = 0; level < floors; level++) {
      expect(at(width - 2, level * floorHeight, 4)).not.toBeNull();
      expect(at(width - 2, level * floorHeight + 1, 4)).toBeNull();
      expect(at(width - 2, level * floorHeight + 2, 4)).toBeNull();
      expect(at(3, level * floorHeight + 2, 0)?.id).toBe('minecraft:glass');
    }
    for (let x = 0; x < width; x++) for (let z = 0; z < 7; z++) expect(at(x, floors * floorHeight, z)).not.toBeNull();
  });
  it('supports single floor and translated negative origins with all validated palettes', () => {
    for (const palette of ['timber', 'stone', 'modern'] as const) {
      const engine = new VoxelEngine(empty());
      const result = generateBuilding(engine.snapshot(), { ...DEFAULT_BUILDING, floors: 1, palette, origin: { x: -10, y: -5, z: -9 } });
      expect(result.dimensions).toEqual({ width: 13, height: 6, depth: 11 });
      const blocks = engine.commit(result.transaction).blocks;
      expect(blocks.some(block => block.id.endsWith('_stairs'))).toBe(false);
      expect(Math.min(...blocks.map(block => block.pos.x))).toBe(-10);
      expect(Math.max(...blocks.map(block => block.pos.y))).toBe(0);
    }
  });
  it('uses true bottom quartz slabs for the modern roof with exact material quantities', () => {
    const engine = new VoxelEngine(empty());
    const result = generateBuilding(engine.snapshot(), { ...DEFAULT_BUILDING, palette: 'modern' });
    const blocks = engine.commit(result.transaction).blocks;
    const roof = blocks.filter(block => block.pos.y === result.dimensions.height - 1);
    expect(roof).toHaveLength(DEFAULT_BUILDING.width * DEFAULT_BUILDING.depth);
    expect(roof.every(block => block.id === 'minecraft:smooth_quartz_slab' && block.state.type === 'bottom' && block.state.waterlogged === 'false')).toBe(true);
    expect(result.materials.find(row => row.id === 'minecraft:smooth_quartz_slab')?.count).toBe(roof.length);
    expect(result.materials.find(row => row.id === 'minecraft:quartz_stairs')?.count).toBe(DEFAULT_BUILDING.floorHeight);
    expect(result.materials.reduce((sum, row) => sum + row.count, 0)).toBe(blocks.length);
  });
  it.each([{ width: NaN }, { floors: 1.5 }, { depth: Infinity }, { floors: 20, floorHeight: 8 }, { width: 8, floorHeight: 8 }, { width: 100000000 }, { palette: 'invalid' }, { origin: { x: 30000000, y: 0, z: 0 } }])('rejects invalid dimensions before generation: %j', patch => {
    expect(() => generateBuilding(empty(), { ...DEFAULT_BUILDING, ...patch } as BuildingRequest)).toThrow();
  });
  it('rejects over-limit complete buildings instead of truncating, and caps successful additions', () => {
    expect(() => generateBuilding(empty(), { ...DEFAULT_BUILDING, width: 31, depth: 31, floors: 5 })).toThrow('5,000');
    expect(generateBuilding(empty(), DEFAULT_BUILDING).transaction.changes.length).toBeLessThanOrEqual(5000);
  });
  it('rejects occupied shell and interior while preserving existing blocks outside the reserved volume', () => {
    for (const pos of [{ x: 0, y: 0, z: 0 }, { x: 6, y: 1, z: 0 }, { x: 5, y: 2, z: 5 }]) {
      const project = { ...empty(), blocks: createPlacement(pos, 'minecraft:stone', {}, 'fixture').blocks };
      expect(() => generateBuilding(project, DEFAULT_BUILDING)).toThrow('已有方塊');
      expect(project.blocks).toHaveLength(1);
    }
    const project = { ...empty(), blocks: createPlacement({ x: -1, y: 0, z: 0 }, 'minecraft:stone', {}, 'fixture').blocks };
    const engine = new VoxelEngine(project);
    const result = generateBuilding(engine.snapshot(), DEFAULT_BUILDING);
    expect(result.transaction.changes.every(change => change.before === null)).toBe(true);
    engine.commit(result.transaction);
    expect(engine.undo().blocks).toEqual(project.blocks);
  });
});
