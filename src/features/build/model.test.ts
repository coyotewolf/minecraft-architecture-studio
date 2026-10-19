import { describe, expect, it } from 'vitest';
import type { BlockRecord, LogicalStructure } from '../../core/contracts.ts';
import { createEmptyProject } from '../../core/project.ts';
import { parseProject } from '../../core/model.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { constructionSteps, inventory, reconcileBuild } from './model.ts';
function block(uid: string, x = 0, y = 0, id: BlockRecord['id'] = 'minecraft:stone', state: Record<string, string> = {}): BlockRecord {
  return { uid, id, pos: { x, y, z: 0 }, state: normalizeBlockState(id, state), source: { origin: 'user_created' },
    edits: { createdByTransactionId: 'test', lastModifiedByTransactionId: 'test', userModified: false } };
}
function project(blocks: BlockRecord[], logicalStructures: LogicalStructure[] = []) {
  return parseProject({ ...createEmptyProject('test', 'Test'), blocks, logicalStructures });
}
function door() {
  const blocks = ['lower', 'upper'].map((half, y) => ({ ...block(half, 0, y, 'minecraft:oak_door', { half }), logicalStructureId: 'door' }));
  const structure: LogicalStructure = { uid: 'door', kind: 'door', anchorUid: 'lower', memberUids: ['lower', 'upper'] };
  return { blocks, structure };
}
describe('inventory', () => {
  it('counts a door once and double slabs twice while retaining occupied cells', () => {
    const d = door();
    const result = inventory(project([...d.blocks, block('slab', 2, 0, 'minecraft:stone_slab', { type: 'double' })], [d.structure]));
    expect(result.occupiedCells).toBe(3); expect(result.totalInventoryItems).toBe(3);
    expect(result.items.find(i => i.itemId === 'minecraft:oak_door')!.required).toBe(1);
    expect(result.items.find(i => i.itemId === 'minecraft:stone_slab')!.required).toBe(2);
  });
  it('uses registry bed stack size rather than 64', () => {
    const blocks = ['foot', 'head'].map((part, x) => ({ ...block(part, x, 0, 'minecraft:red_bed', { part, facing: 'east' }), logicalStructureId: 'bed' }));
    const result = inventory(project(blocks, [{ uid: 'bed', kind: 'bed', anchorUid: 'foot', memberUids: ['foot', 'head'] }]));
    expect(result.items[0]).toMatchObject({ required: 1, maxStack: 1, fullStacks: 1, remainder: 0 });
  });
  it('counts ordinary stacks and preserves unknown item mapping instead of inventing a total', () => {
    const blocks = Array.from({ length: 65 }, (_, x) => block(`b${x}`, x));
    expect(inventory(project(blocks)).items[0]).toMatchObject({ required: 65, fullStacks: 1, remainder: 1 });
    const result = inventory(project([...blocks, block('water', 70, 0, 'minecraft:water')]));
    expect(result.totalInventoryItems).toBeNull(); expect(result.unresolved[0]!.blockUids).toEqual(['water']);
  });
  it('flags state-dependent quantities and rejects broken paired structures', () => {
    expect(inventory(project([block('candles', 0, 0, 'minecraft:candle', { candles: '4' })])).totalInventoryItems).toBeNull();
    const d = door(); expect(() => inventory({ ...createEmptyProject('x', ''), blocks: [d.blocks[0]!], logicalStructures: [d.structure] })).toThrow();
  });
});
describe('construction steps', () => {
  it('orders actual support dependencies before phase preference and keeps pairs atomic', () => {
    const d = door();
    const blocks = [{ ...block('support', 0, -1), category: '屋頂' }, ...d.blocks, { ...block('top', 0, 2), category: '基礎' }];
    const steps = constructionSteps(project(blocks, [d.structure]));
    expect(steps.map(s => s.blockUids)).toEqual([['support'], ['lower', 'upper'], ['top']]);
  });
  it('is deterministic under input reorder and reports gravity/scaffolding/terrain uncertainty', () => {
    const blocks = [block('ground', 0), block('floating', 4, 5, 'minecraft:sand'), block('other', 2)];
    const steps = constructionSteps(project(blocks));
    expect(constructionSteps(project([...blocks].reverse()))).toEqual(steps);
    expect(steps.find(s => s.blockUids.includes('floating'))!.warnings.join(' ')).toContain('鷹架');
    expect(steps.find(s => s.blockUids.includes('floating'))!.warnings.join(' ')).toContain('重力');
    expect(steps[0]!.warnings.join(' ')).toContain('地形');
  });
  it('handles a long vertical dependency chain without recursion or missing cells', () => {
    const blocks = Array.from({ length: 10_000 }, (_, y) => block(`b${y}`, 0, y));
    const steps = constructionSteps(project(blocks));
    expect(steps).toHaveLength(10_000); expect(steps.at(-1)!.blockUids).toEqual(['b9999']);
  });
  it('returns no steps for empty models', () => { expect(constructionSteps(project([]))).toEqual([]); });
});
describe('build reconciliation', () => {
  it('retains only unchanged completed identities and ignores provenance-only differences', () => {
    const before = project([block('same'), block('move', 1), block('removed', 2), block('state', 3, 0, 'minecraft:oak_log')]);
    const current = project([{ ...block('same'), category: '新分類' }, block('move', 1, 1), block('new', 2), block('state', 3, 0, 'minecraft:oak_log', { axis: 'x' })]);
    expect(reconcileBuild(before, current, ['same', 'move', 'removed', 'state', 'unknown', 'same'])).toEqual({
      added: ['new'], changed: ['move', 'state'], removed: ['removed'], retainedCompleted: ['same'],
    });
  });
  it('detects ID changes even if a malformed external design reuses a UID', () => {
    expect(reconcileBuild(project([block('a')]), project([block('a', 0, 0, 'minecraft:dirt')]), ['a']).changed).toEqual(['a']);
  });
});
