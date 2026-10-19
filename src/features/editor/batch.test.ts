import { describe, expect, it } from 'vitest';
import { VoxelEngine } from '../../core/engine.ts';
import { createEmptyProject } from '../../core/project.ts';
import { parseProject } from '../../core/model.ts';
import type { BlockPos, MinecraftId } from '../../core/contracts.ts';
import type { BatchRequest } from './BatchPanel.tsx';
import { batchEdit, rangeSelection, transformState } from './batch.ts';
import { editAt } from './commands.ts';

const zero = { x: 0, y: 0, z: 0 };
function empty(): VoxelEngine { return new VoxelEngine(createEmptyProject('batch-test', 'Batch tests')); }
function request(overrides: Partial<BatchRequest> = {}): BatchRequest {
  return { operation: 'box', from: zero, to: zero, offset: zero, turns: 1, thickness: 1, ...overrides };
}
function place(engine: VoxelEngine, id: MinecraftId, pos: BlockPos = zero, state: Record<string, string> = {}) {
  engine.commit(editAt(engine.snapshot(), 'place', pos, id, state));
}
function positions(engine: VoxelEngine): string[] {
  return engine.snapshot().blocks.map(b => [b.pos.x, b.pos.y, b.pos.z].join(',')).sort();
}

describe('M4 batch commands against real canonical engine', () => {
  it('creates exact line cells at negative coordinates and undoes the entire command', () => {
    const engine = empty();
    const before = engine.snapshot();
    const command = batchEdit(before, request({ operation: 'line', from: { x: -2, y: 1, z: -1 }, to: { x: 1, y: 1, z: -1 } }), 'minecraft:stone', {}, 'cancel');
    expect(engine.preview(command).ok).toBe(true);
    expect(engine.snapshot()).toBe(before);
    engine.commit(command);
    expect(positions(engine)).toEqual(['-1,1,-1', '-2,1,-1', '0,1,-1', '1,1,-1']);
    engine.undo();
    expect(engine.snapshot().blocks).toHaveLength(0);
    expect(engine.canUndo).toBe(false);
    engine.redo();
    expect(engine.snapshot().blocks).toHaveLength(4);
  });

  it('creates a wall with its exact rectangular cells', () => {
    const engine = empty();
    engine.commit(batchEdit(engine.snapshot(), request({ operation: 'wall', to: { x: 2, y: 2, z: 0 } }), 'minecraft:stone', {}, 'cancel'));
    expect(positions(engine)).toEqual(['0,0,0','0,1,0','0,2,0','1,0,0','1,1,0','1,2,0','2,0,0','2,1,0','2,2,0']);
  });

  it('creates a hollow box with an empty interior and all boundary cells', () => {
    const engine = empty();
    engine.commit(batchEdit(engine.snapshot(), request({ operation: 'hollow_box', to: { x: 2, y: 2, z: 2 } }), 'minecraft:stone', {}, 'cancel'));
    const expected: string[] = [];
    for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) for (let z = 0; z <= 2; z++) {
      if (x !== 1 || y !== 1 || z !== 1) expected.push([x,y,z].join(','));
    }
    expect(positions(engine)).toEqual(expected.sort());
    expect(engine.getAt({ x: 1, y: 1, z: 1 })).toBeNull();
  });

  it('rejects a batch above the 5000-cell bound without publishing', () => {
    const engine = empty();
    const before = engine.snapshot();
    expect(() => batchEdit(before, request({ to: { x: 5000, y: 0, z: 0 } }), 'minecraft:stone', {}, 'cancel')).toThrow();
    expect(engine.snapshot()).toBe(before);
    expect(engine.canUndo).toBe(false);
  });

  it('copies with fresh identities while preserving original evidence', () => {
    const sourceEngine = empty();
    place(sourceEngine, 'minecraft:oak_stairs', zero, { facing: 'north' });
    const fixture = sourceEngine.snapshot();
    const engine = new VoxelEngine(parseProject({ ...fixture, blocks: fixture.blocks.map(b => ({ ...b, source: { origin: 'ai_estimated', confidence: .35 } })) }));
    const original = engine.getAt(zero)!;
    engine.commit(batchEdit(engine.snapshot(), request({ operation: 'copy', offset: { x: 3, y: 0, z: 0 } }), 'minecraft:stone', {}, 'cancel'));
    const copied = engine.getAt({ x: 3, y: 0, z: 0 })!;
    expect(copied.uid).not.toBe(original.uid);
    expect(copied.source).toEqual(original.source);
    expect(copied.state).toEqual(original.state);
    expect(engine.getAt(zero)).toEqual(original);
    engine.undo();
    expect(engine.snapshot().blocks).toEqual([original]);
  });

  it('cancels a partially colliding batch atomically', () => {
    const engine = empty();
    place(engine, 'minecraft:glass', { x: 1, y: 0, z: 0 });
    const before = engine.snapshot();
    expect(() => engine.commit(batchEdit(before, request({ to: { x: 2, y: 0, z: 0 } }), 'minecraft:stone', {}, 'cancel'))).toThrow();
    expect(engine.snapshot()).toBe(before);
    engine.undo();
    expect(engine.snapshot().blocks).toHaveLength(0);
  });

  it.each(['replace', 'skip'] as const)('%s collision resolves cells and remains one undo operation', collision => {
    const engine = empty();
    place(engine, 'minecraft:glass', { x: 1, y: 0, z: 0 });
    const original = engine.getAt({ x: 1, y: 0, z: 0 })!;
    engine.commit(batchEdit(engine.snapshot(), request({ to: { x: 2, y: 0, z: 0 } }), 'minecraft:stone', {}, collision));
    expect(positions(engine)).toEqual(['0,0,0','1,0,0','2,0,0']);
    expect(engine.getAt({ x: 1, y: 0, z: 0 })?.id).toBe(collision === 'skip' ? 'minecraft:glass' : 'minecraft:stone');
    if (collision === 'skip') expect(engine.getAt({ x: 1, y: 0, z: 0 })).toEqual(original);
    engine.undo();
    expect(engine.snapshot().blocks).toEqual([original]);
    engine.undo();
    expect(engine.snapshot().blocks).toHaveLength(0);
  });

  it.each(['minecraft:oak_door', 'minecraft:red_bed'] as const)('expands a partial %s selection and rotates its whole logical pair', id => {
    const engine = empty();
    place(engine, id, zero, { facing: 'north' });
    const before = engine.snapshot();
    engine.commit(batchEdit(before, request({ operation: 'rotate' }), 'minecraft:stone', {}, 'cancel'));
    expect(engine.snapshot().blocks).toHaveLength(2);
    expect(engine.snapshot().logicalStructures).toEqual(before.logicalStructures);
    expect(engine.snapshot().blocks.every(b => b.state.facing === 'east')).toBe(true);
    expect(engine.snapshot().blocks.map(b => b.uid).sort()).toEqual(before.blocks.map(b => b.uid).sort());
    expect(parseProject(engine.snapshot())).toEqual(engine.snapshot());
    if (id === 'minecraft:red_bed') expect(engine.getAt({ x: 1, y: 0, z: 0 })?.state.part).toBe('head');
    else expect(engine.getAt({ x: 0, y: 1, z: 0 })?.state.half).toBe('upper');
    engine.undo();
    expect(new Map(engine.snapshot().blocks.map(b => [b.uid,b]))).toEqual(new Map(before.blocks.map(b => [b.uid,b])));
  });
});


describe('M4 directional states and logical selection', () => {
  it('rotates stairs facing while preserving their shape and half', () => {
    expect(transformState('minecraft:oak_stairs', { facing: 'north', half: 'top', shape: 'inner_left', waterlogged: 'false' }, 'rotate', 1))
      .toMatchObject({ facing: 'east', half: 'top', shape: 'inner_left' });
    expect(transformState('minecraft:oak_stairs', { facing: 'east', half: 'bottom', shape: 'outer_right', waterlogged: 'false' }, 'rotate', 3))
      .toMatchObject({ facing: 'north', half: 'bottom', shape: 'outer_right' });
  });

  it.each(['inner_left', 'outer_left'] as const)('mirrors stair %s chirality and east-facing direction across X', shape => {
    expect(transformState('minecraft:oak_stairs', { facing: 'east', half: 'bottom', shape, waterlogged: 'false' }, 'mirror_x'))
      .toMatchObject({ facing: 'west', shape: shape.replace('left', 'right') });
  });

  it('mirrors door hinge and north-facing direction across Z', () => {
    expect(transformState('minecraft:oak_door', { facing: 'north', half: 'lower', hinge: 'left', open: 'true', powered: 'false' }, 'mirror_z'))
      .toMatchObject({ facing: 'south', hinge: 'right', half: 'lower', open: 'true' });
  });

  it('rotates horizontal log axes but preserves vertical axes', () => {
    expect(transformState('minecraft:oak_log', { axis: 'x' }, 'rotate', 1)).toEqual({ axis: 'z' });
    expect(transformState('minecraft:oak_log', { axis: 'z' }, 'rotate', 1)).toEqual({ axis: 'x' });
    expect(transformState('minecraft:oak_log', { axis: 'y' }, 'rotate', 1)).toEqual({ axis: 'y' });
    expect(transformState('minecraft:oak_log', { axis: 'x' }, 'rotate', 2)).toEqual({ axis: 'x' });
  });

  it.each(['minecraft:oak_door', 'minecraft:red_bed'] as const)('range selection expands %s pairs without unrelated cells', id => {
    const engine = empty();
    place(engine, id, zero, { facing: 'north' });
    place(engine, 'minecraft:stone', { x: 5, y: 0, z: 0 });
    const before = engine.snapshot();
    const selected = rangeSelection(before, zero, zero);
    expect(selected).toHaveLength(2);
    expect(selected.every(b => b.id === id)).toBe(true);
    expect(new Set(selected.map(b => b.uid)).size).toBe(2);
    expect(engine.snapshot()).toBe(before);
  });
});
