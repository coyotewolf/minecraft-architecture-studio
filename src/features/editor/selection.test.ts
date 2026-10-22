import { describe, expect, it } from 'vitest';
import { VoxelEngine } from '../../core/engine.ts';
import { createEmptyProject } from '../../core/project.ts';
import { parseProject } from '../../core/model.ts';
import type { MinecraftId } from '../../core/contracts.ts';
import { editAt } from './commands.ts';
import { selectedBlocks, selectionEdit } from './selection.ts';

function fixture(xs = [0, 1, 4]) {
  const engine = new VoxelEngine(createEmptyProject('selection', 'Selection'));
  for (const x of xs) engine.commit(editAt(engine.snapshot(), 'place', { x, y: 0, z: 0 }, 'minecraft:stone'));
  return engine;
}
const records = (engine: VoxelEngine) => new Map(engine.snapshot().blocks.map(block => [block.uid, block]));

describe('arbitrary UID selection transactions', () => {
  it('removes only noncontiguous selected cells, ignoring duplicates and stale UIDs', () => {
    const engine = fixture(), before = records(engine);
    const a = engine.getAt({ x: 0, y: 0, z: 0 })!, b = engine.getAt({ x: 4, y: 0, z: 0 })!;
    expect(selectedBlocks(engine.snapshot(), [a.uid, a.uid, 'stale', b.uid])).toHaveLength(2);
    engine.commit(selectionEdit(engine.snapshot(), [a.uid, b.uid], 'remove'));
    expect(engine.snapshot().blocks.map(block => block.pos.x)).toEqual([1]);
    engine.undo();
    expect(records(engine)).toEqual(before);
    engine.redo();
    expect(engine.snapshot().blocks.map(block => block.pos.x)).toEqual([1]);
  });

  it('moves into another selected source cell with stable identities and exact undo', () => {
    const engine = fixture(), before = records(engine);
    const chosen = engine.snapshot().blocks.filter(block => block.pos.x < 2);
    const tx = selectionEdit(engine.snapshot(), chosen.map(block => block.uid), 'move', { x: 1, y: 0, z: 0 });
    expect(tx.collisionPolicy).toBe('cancel');
    expect(engine.preview(tx).ok).toBe(true);
    engine.commit(tx);
    for (const original of chosen) expect(engine.getByUid(original.uid)).toEqual({ ...original,
      pos: { ...original.pos, x: original.pos.x + 1 },
      edits: { ...original.edits, lastModifiedByTransactionId: tx.id, userModified: true },
    });
    engine.undo();
    expect(records(engine)).toEqual(before);
    engine.redo();
    expect(engine.getAt({ x: 2, y: 0, z: 0 })?.uid).toBe(chosen[1]!.uid);
  });

  it.each(['move', 'copy'] as const)('cancels the entire %s on any unselected collision', operation => {
    const engine = fixture([0, 2, 5]), before = engine.snapshot();
    const chosen = before.blocks.filter(block => block.pos.x < 3).map(block => block.uid);
    expect(() => selectionEdit(before, chosen, operation, { x: 3, y: 0, z: 0 })).toThrow('取消');
    expect(engine.snapshot()).toBe(before);
    expect(engine.getAt({ x: 3, y: 0, z: 0 })).toBeNull();
  });

  it('copy cannot overwrite a selected source position either', () => {
    const engine = fixture([0, 1]);
    expect(() => selectionEdit(engine.snapshot(), engine.snapshot().blocks.map(b => b.uid), 'copy', { x: 1, y: 0, z: 0 })).toThrow('取消');
  });

  it.each(['minecraft:oak_door', 'minecraft:red_bed'] as MinecraftId[])('expands, copies, moves and removes %s as a unit', id => {
    const engine = fixture([]);
    engine.commit(editAt(engine.snapshot(), 'place', { x: 0, y: 0, z: 0 }, id, { facing: 'west' }));
    const initial = engine.snapshot(), member = initial.blocks[1]!;
    expect(selectedBlocks(initial, [member.uid])).toHaveLength(2);
    const copyTx = selectionEdit(initial, [member.uid], 'copy', { x: 4, y: 0, z: 0 });
    engine.commit(copyTx);
    const copied = engine.snapshot().blocks.filter(b => !initial.blocks.some(old => old.uid === b.uid));
    expect(copied).toHaveLength(2);
    const group = engine.snapshot().logicalStructures.find(g => g.uid !== initial.logicalStructures[0]!.uid)!;
    expect(new Set(group.memberUids)).toEqual(new Set(copied.map(b => b.uid)));
    expect(group.memberUids).toContain(group.anchorUid);
    for (const block of copied) {
      const old = initial.blocks.find(b => b.pos.y === block.pos.y && b.pos.x + 4 === block.pos.x)!;
      expect(block.state).toEqual(old.state);
      expect(block.source).toEqual(old.source);
      expect(block.edits).toEqual({ createdByTransactionId: copyTx.id, lastModifiedByTransactionId: copyTx.id, userModified: false });
    }
    expect(parseProject(engine.snapshot())).toEqual(engine.snapshot());
    engine.commit(selectionEdit(engine.snapshot(), [copied[1]!.uid], 'move', { x: 0, y: 1, z: 0 }));
    expect(engine.snapshot().logicalStructures.find(g => g.uid === group.uid)).toEqual(group);
    engine.commit(selectionEdit(engine.snapshot(), [copied[0]!.uid], 'remove'));
    expect(records(engine)).toEqual(new Map(initial.blocks.map(b => [b.uid, b])));
    expect(engine.snapshot().logicalStructures).toEqual(initial.logicalStructures);
    engine.undo();
    expect(engine.snapshot().blocks).toHaveLength(4);
    expect(parseProject(engine.snapshot())).toEqual(engine.snapshot());
  });

  it('preserves estimated evidence and metadata when copying', () => {
    const base = fixture([0]).snapshot(), old = base.blocks[0]!;
    const engine = new VoxelEngine(parseProject({ ...base, blocks: [{ ...old,
      source: { origin: 'ai_estimated', confidence: 0.4, referenceRegionId: 'photo' }, category: 'roof', componentId: 'a', constructionPhaseId: 'b' }] }));
    engine.commit(selectionEdit(engine.snapshot(), [old.uid], 'copy', { x: 2, y: 0, z: 0 }));
    expect(engine.getAt({ x: 2, y: 0, z: 0 })).toMatchObject({ source: { origin: 'ai_estimated', confidence: 0.4, referenceRegionId: 'photo' }, category: 'roof', componentId: 'a', constructionPhaseId: 'b' });
  });

  it('rejects empty, no-op, fractional and out-of-bounds requests', () => {
    const engine = fixture([0]), project = engine.snapshot(), uids = project.blocks.map(b => b.uid);
    expect(() => selectionEdit(project, ['stale'], 'remove')).toThrow();
    for (const operation of ['move', 'copy'] as const) expect(() => selectionEdit(project, uids, operation)).toThrow();
    expect(() => selectionEdit(project, uids, 'move', { x: 0.5, y: 0, z: 0 })).toThrow();
    expect(() => selectionEdit(project, uids, 'remove', { x: NaN, y: 0, z: 0 })).toThrow();
    const edge = fixture([30_000_000]).snapshot();
    expect(() => selectionEdit(edge, edge.blocks.map(b => b.uid), 'move', { x: 1, y: 0, z: 0 })).toThrow();
    expect(engine.snapshot()).toBe(project);
  });

  it('caps expanded selection at 5000 rather than bounding-box volume', () => {
    const base = fixture([0]).snapshot(), block = base.blocks[0]!;
    const project = parseProject({ ...base, blocks: Array.from({ length: 5001 }, (_, x) => ({ ...block, uid: `b${x}`, pos: { x, y: 0, z: 0 } })) });
    expect(() => selectionEdit(project, project.blocks.map(b => b.uid), 'remove')).toThrow('5,000');
    expect(selectionEdit(project, ['b0', 'b5000'], 'remove').changes).toHaveLength(2);
    expect(selectionEdit(project, project.blocks.slice(0, 5000).map(b => b.uid), 'remove').changes).toHaveLength(5000);
  });
});
