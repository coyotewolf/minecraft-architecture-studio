import { describe, expect, it } from 'vitest';
import { VoxelEngine } from '../../core/engine.ts';
import { createEmptyProject } from '../../core/project.ts';
import { parseProject } from '../../core/model.ts';
import type { BlockPos, MinecraftId } from '../../core/contracts.ts';
import { changeSelectedState, editAt } from './commands.ts';

const origin = { x: -2, y: 1, z: -3 };
function empty(): VoxelEngine { return new VoxelEngine(createEmptyProject('editor-test', 'Editor command test')); }
function place(engine: VoxelEngine, id: MinecraftId, pos = origin, state: Record<string, string> = {}) {
  engine.commit(editAt(engine.snapshot(), 'place', pos, id, state));
}

describe('M3 editor commands against real canonical engine', () => {
  it('previews ordinary placement without publishing any data, then commits normalized state', () => {
    const engine = empty();
    const before = engine.snapshot();
    const command = editAt(before, 'place', origin, 'minecraft:oak_stairs', { facing: 'west' });
    expect(engine.preview(command).ok).toBe(true);
    expect(engine.snapshot()).toBe(before);
    expect(engine.getAt(origin)).toBeNull();
    expect(engine.canUndo).toBe(false);
    engine.commit(command);
    expect(engine.getAt(origin)).toMatchObject({ id: 'minecraft:oak_stairs', pos: origin,
      state: { facing: 'west', half: 'bottom', shape: 'straight', waterlogged: 'false' }, source: { origin: 'user_created' } });
    expect(engine.snapshot().blocks).toHaveLength(1);
    expect(engine.snapshot().logicalStructures).toHaveLength(0);
  });

  it.each(['cancel', 'skip'] as const)('%s collision leaves cells, revision and history unchanged', policy => {
    const engine = empty();
    place(engine, 'minecraft:stone');
    const before = engine.snapshot();
    expect(() => editAt(before, 'place', origin, 'minecraft:glass', {}, policy)).toThrow();
    expect(engine.snapshot()).toBe(before);
    engine.undo();
    expect(engine.snapshot().blocks).toHaveLength(0);
    expect(engine.canUndo).toBe(false);
  });

  it('replace collision produces explicit before-images and restores old identity on undo', () => {
    const engine = empty();
    place(engine, 'minecraft:stone');
    const old = engine.getAt(origin)!;
    const command = editAt(engine.snapshot(), 'place', origin, 'minecraft:glass', {}, 'replace');
    expect(command.changes[0]?.before).toEqual(old);
    engine.commit(command);
    expect(engine.getAt(origin)?.id).toBe('minecraft:glass');
    expect(engine.getAt(origin)?.uid).not.toBe(old.uid);
    engine.undo();
    expect(engine.getAt(origin)).toEqual(old);
  });

  it('placing a door from an upper-state palette creates a lower anchor and upper partner', () => {
    const engine = empty();
    place(engine, 'minecraft:oak_door', origin, { half: 'upper', facing: 'west', hinge: 'right', open: 'true' });
    const lower = engine.getAt(origin)!;
    const upper = engine.getAt({ ...origin, y: 2 })!;
    expect(lower.state).toMatchObject({ half: 'lower', facing: 'west', hinge: 'right', open: 'true' });
    expect(upper.state).toEqual({ ...lower.state, half: 'upper' });
    expect(engine.snapshot().logicalStructures).toEqual([{ uid: lower.logicalStructureId, kind: 'door', anchorUid: lower.uid, memberUids: [lower.uid, upper.uid] }]);
    expect(parseProject(engine.snapshot())).toEqual(engine.snapshot());
  });

  it('removing the upper door removes its entire logical pair and undo/redo is atomic', () => {
    const engine = empty();
    place(engine, 'minecraft:oak_door');
    const before = engine.snapshot();
    const command = editAt(before, 'remove', { ...origin, y: 2 }, 'minecraft:stone');
    expect(command.changes).toHaveLength(2);
    expect(command.structures).toHaveLength(1);
    expect(engine.preview(command).ok).toBe(true);
    expect(engine.snapshot()).toBe(before);
    engine.commit(command);
    expect(engine.snapshot().blocks).toHaveLength(0);
    expect(engine.snapshot().logicalStructures).toHaveLength(0);
    engine.undo();
    expect(new Map(engine.snapshot().blocks.map(b => [b.uid, b]))).toEqual(new Map(before.blocks.map(b => [b.uid, b])));
    expect(engine.snapshot().logicalStructures).toEqual(before.logicalStructures);
    engine.redo();
    expect(engine.snapshot().blocks).toHaveLength(0);
    expect(engine.snapshot().logicalStructures).toHaveLength(0);
  });

  it.each([
    ['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0],
  ] as const)('creates a complete %s-facing bed at negative coordinates', (facing, dx, dz) => {
    const engine = empty();
    place(engine, 'minecraft:red_bed', origin, { facing, part: 'head' });
    const foot = engine.getAt(origin)!;
    const head = engine.getAt({ x: origin.x + dx, y: origin.y, z: origin.z + dz })!;
    expect(foot.state).toMatchObject({ part: 'foot', facing });
    expect(head.state).toEqual({ ...foot.state, part: 'head' });
    expect(engine.snapshot().blocks).toHaveLength(2);
    expect(engine.snapshot().logicalStructures).toEqual([{ uid: foot.logicalStructureId, kind: 'bed', anchorUid: foot.uid, memberUids: [foot.uid, head.uid] }]);
    expect(parseProject(engine.snapshot())).toEqual(engine.snapshot());
  });

  it('replacing one member removes the old structure and unselected partner', () => {
    const engine = empty();
    place(engine, 'minecraft:red_bed', origin, { facing: 'north' });
    const before = engine.snapshot();
    const headPos = { ...origin, z: origin.z - 1 };
    engine.commit(editAt(before, 'replace', headPos, 'minecraft:stone'));
    expect(engine.getAt(origin)).toBeNull();
    expect(engine.getAt(headPos)?.id).toBe('minecraft:stone');
    expect(engine.snapshot().logicalStructures).toHaveLength(0);
    expect(engine.snapshot().blocks).toHaveLength(1);
    engine.undo();
    expect(new Map(engine.snapshot().blocks.map(b => [b.uid, b]))).toEqual(new Map(before.blocks.map(b => [b.uid, b])));
    expect(engine.snapshot().logicalStructures).toEqual(before.logicalStructures);
  });

  it('a collision on the second incoming cell skips the entire pair or replaces the old pair', () => {
    const engine = empty();
    place(engine, 'minecraft:red_bed', { x: -2, y: 2, z: -3 }, { facing: 'east' });
    const before = engine.snapshot();
    expect(() => editAt(before, 'place', origin, 'minecraft:oak_door', {}, 'skip')).toThrow();
    expect(engine.snapshot()).toBe(before);
    expect(() => editAt(before, 'place', origin, 'minecraft:oak_door', {}, 'cancel')).toThrow();
    engine.commit(editAt(before, 'place', origin, 'minecraft:oak_door', {}, 'replace'));
    expect(engine.snapshot().blocks).toHaveLength(2);
    expect(engine.snapshot().blocks.every(b => b.id === 'minecraft:oak_door')).toBe(true);
    expect(engine.snapshot().logicalStructures.map(s => s.kind)).toEqual(['door']);
    expect(engine.getAt({ x: -1, y: 2, z: -3 })).toBeNull();
    engine.undo();
    expect(new Map(engine.snapshot().blocks.map(b => [b.uid, b]))).toEqual(new Map(before.blocks.map(b => [b.uid, b])));
  });

  it.each([
    ['minecraft:oak_door', { x: 0, y: 30_000_000, z: 0 }, {}],
    ['minecraft:red_bed', { x: 30_000_000, y: 0, z: 0 }, { facing: 'east' }],
    ['minecraft:red_bed', { x: 0, y: 0, z: -30_000_000 }, { facing: 'north' }],
  ] as [MinecraftId, BlockPos, Record<string, string>][])('rejects %s boundary overflow without any publication', (id, pos, state) => {
    const engine = empty();
    const before = engine.snapshot();
    expect(() => editAt(before, 'place', pos, id, state)).toThrow();
    expect(engine.snapshot()).toBe(before);
    expect(engine.canUndo).toBe(false);
    expect(engine.canRedo).toBe(false);
  });

  it('changes paired door state together while preserving parts, identity and original evidence', () => {
    const engine = empty();
    place(engine, 'minecraft:oak_door');
    const before = engine.snapshot();
    const upper = engine.getAt({ ...origin, y: 2 })!;
    const command = changeSelectedState(before, upper.uid, { ...upper.state, open: 'true', hinge: 'right' });
    expect(engine.preview(command).ok).toBe(true);
    expect(engine.snapshot()).toBe(before);
    engine.commit(command);
    for (const old of before.blocks) {
      expect(engine.getByUid(old.uid)).toMatchObject({ source: old.source, state: { ...old.state, open: 'true', hinge: 'right' }, edits: { userModified: true } });
    }
    expect(engine.snapshot().logicalStructures).toEqual(before.logicalStructures);
    engine.undo();
    expect(new Map(engine.snapshot().blocks.map(b => [b.uid, b]))).toEqual(new Map(before.blocks.map(b => [b.uid, b])));
  });

  it('rejects an illegal property and a bed-facing change that would break adjacency', () => {
    const engine = empty();
    place(engine, 'minecraft:red_bed', origin, { facing: 'north' });
    const before = engine.snapshot();
    const foot = engine.getAt(origin)!;
    expect(() => changeSelectedState(before, foot.uid, { ...foot.state, facing: 'up' })).toThrow();
    expect(engine.snapshot()).toBe(before);
    const invalidPair = changeSelectedState(before, foot.uid, { ...foot.state, facing: 'south' });
    expect(engine.preview(invalidPair).ok).toBe(false);
    expect(() => engine.commit(invalidPair)).toThrow('Nonadjacent');
    expect(engine.snapshot()).toBe(before);
  });
});
