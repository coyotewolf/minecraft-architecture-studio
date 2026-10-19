import { describe, expect, it } from 'vitest';
import { VoxelEngine } from './engine.ts';
import { createEmptyProject } from './project.ts';
import { exportProject, importProject, MAX_IMPORT_BYTES, MAX_TRANSACTION_CHANGES, parseProject } from './model.ts';
import { normalizeBlockState } from './versioned-registry.ts';
import type { BlockRecord, EditTransaction, LogicalStructure, Project } from './contracts.ts';

function block(uid: string, x = 0, id: BlockRecord['id'] = 'minecraft:stone', state: Record<string, string> = {}, y = 0, z = 0): BlockRecord {
  return { uid, id, pos: { x, y, z }, state: normalizeBlockState(id, state),
    source: { origin: 'user_created' }, edits: { createdByTransactionId: 'fixture', lastModifiedByTransactionId: 'fixture', userModified: false } };
}
function project(blocks: BlockRecord[] = [], logicalStructures: LogicalStructure[] = []): Project {
  return { ...createEmptyProject('test', 'Test'), blocks, logicalStructures };
}
function tx(engine: VoxelEngine, after: BlockRecord[], before: BlockRecord[] = [], id: string = crypto.randomUUID()): EditTransaction {
  const positions = new Map([...before, ...after].map(b => [JSON.stringify(b.pos), b.pos]));
  return { id, baseRevision: engine.snapshot().designRevision, cause: 'user', collisionPolicy: 'cancel',
    changes: [...positions].map(([key, pos]) => ({ pos, before: before.find(b => JSON.stringify(b.pos) === key) ?? null, after: after.find(b => JSON.stringify(b.pos) === key) ?? null })), structures: [] };
}
function door(): { blocks: BlockRecord[]; structure: LogicalStructure } {
  const blocks = ['lower', 'upper'].map((half, y) => ({ ...block(half, -1, 'minecraft:oak_door', { half }, y, -2), logicalStructureId: 'door-1' }));
  return { blocks, structure: { uid: 'door-1', kind: 'door', anchorUid: 'lower', memberUids: ['lower', 'upper'] } };
}
describe('M1 canonical engine', () => {
  it('VXL-001 prevents duplicate coordinates and UIDs at construction', () => {
    expect(() => new VoxelEngine(project([block('a'), block('b')]))).toThrow('Duplicate coordinate');
    expect(() => new VoxelEngine(project([block('a'), block('a', 1)]))).toThrow('Duplicate block UID');
  });
  it('VXL-003 wall batch applies, undoes and redoes as one command with fresh revisions', () => {
    const engine = new VoxelEngine(project());
    const initial = engine.snapshot();
    const command = tx(engine, [block('a', -1), block('b'), block('c', 1)]);
    expect(engine.preview(command).ok).toBe(true);
    expect(engine.snapshot()).toBe(initial);
    const placed = engine.commit(command);
    expect(placed.blocks).toHaveLength(3);
    expect(engine.getAt({ x: -1, y: 0, z: 0 })?.uid).toBe('a');
    const undone = engine.undo();
    expect(undone.blocks).toHaveLength(0);
    expect(engine.canUndo).toBe(false);
    const redone = engine.redo();
    expect(redone.blocks).toEqual(placed.blocks);
    expect(new Set([initial, placed, undone, redone].map(p => p.designRevision)).size).toBe(4);
    expect(engine.getByUid('c')?.pos.x).toBe(1);
    expect(engine.canRedo).toBe(false);
  });
  it('VXL-004 invalid later change rolls back every index, history and revision', () => {
    const engine = new VoxelEngine(project());
    const initial = engine.snapshot();
    const bad = { ...block('bad', 1), state: { impossible: 'value' } };
    expect(() => engine.commit(tx(engine, [block('good'), bad]))).toThrow();
    expect(engine.snapshot()).toBe(initial);
    expect(engine.getByUid('good')).toBeNull();
    expect(engine.getAt({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(engine.canUndo).toBe(false);
  });
  it('rejects stale previews and conflicting before-images', () => {
    const engine = new VoxelEngine(project([block('a')]));
    const stale = tx(engine, [block('b', 1)]);
    engine.commit(tx(engine, [block('c', 2)]));
    expect(engine.preview(stale).ok).toBe(false);
    expect(() => engine.commit(stale)).toThrow('Stale');
    const wrong = { ...block('a'), source: { origin: 'inferred' as const } };
    expect(() => engine.commit(tx(engine, [], [wrong]))).toThrow('Before-image');
  });
  it('resolves cancel / replace / skip explicitly and undo restores replaced data', () => {
    const engine = new VoxelEngine(project([block('old')]));
    const cancel = tx(engine, [block('new')]);
    expect(() => engine.commit(cancel)).toThrow('Occupied');
    const replace = { ...cancel, collisionPolicy: 'replace' as const };
    const preview = engine.preview(replace);
    expect(preview.ok && preview.normalized.changes[0]?.before?.uid).toBe('old');
    engine.commit(replace);
    expect(engine.getByUid('old')).toBeNull();
    engine.undo();
    expect(engine.getByUid('old')?.uid).toBe('old');
    const skip = { ...tx(engine, [block('skip'), block('add', 1)]), collisionPolicy: 'skip' as const };
    engine.commit(skip);
    expect(engine.snapshot().blocks.map(b => b.uid).sort()).toEqual(['add', 'old']);
    expect(() => engine.commit({ ...tx(engine, [block('noop')]), collisionPolicy: 'skip' })).toThrow('no accepted');
  });
  it('move preserves identity and evidence; mutation and undo preserve exact snapshots', () => {
    const estimated = { ...block('roof'), source: { origin: 'ai_estimated' as const, confidence: 0.3 } };
    const engine = new VoxelEngine(project([estimated]));
    const original = engine.snapshot();
    const before = engine.getByUid('roof')!;
    engine.commit(tx(engine, [{ ...before, pos: { x: -5, y: 3, z: 2 } }], [before], 'move-1'));
    const moved = engine.getByUid('roof')!;
    expect(moved.source).toEqual(estimated.source);
    expect(moved.edits).toEqual({ createdByTransactionId: 'fixture', lastModifiedByTransactionId: 'move-1', userModified: true });
    expect(Object.isFrozen(moved.source)).toBe(true);
    expect(Object.isFrozen(engine.snapshot().blocks)).toBe(true);
    expect(() => { (moved.pos as { x: number }).x = 99; }).toThrow();
    engine.undo();
    expect(engine.snapshot().blocks).toEqual(original.blocks);
    expect(() => engine.commit(tx(engine, [{ ...before, source: { origin: 'observed' } }], [before]))).toThrow('identity and evidence');
    expect(() => engine.commit(tx(engine, [{ ...before, id: 'minecraft:dirt' }], [before]))).toThrow('identity and evidence');
  });
  it('new edit clears redo; no-history operations fail without changes', () => {
    const engine = new VoxelEngine(project());
    expect(() => engine.undo()).toThrow('Nothing');
    expect(() => engine.redo()).toThrow('Nothing');
    engine.commit(tx(engine, [block('a')]));
    engine.undo();
    engine.commit(tx(engine, [block('b', 1)]));
    expect(engine.canRedo).toBe(false);
    expect(() => engine.redo()).toThrow();
  });
  it('rejects repeated positions, position mismatch, reused IDs and reserved causes', () => {
    const engine = new VoxelEngine(project());
    const command = tx(engine, [block('a')], [], 'first');
    expect(() => engine.commit({ ...command, changes: [...command.changes, ...command.changes] })).toThrow('Repeated');
    expect(() => engine.commit({ ...command, changes: [{ pos: { x: 3, y: 0, z: 0 }, before: null, after: block('a') }] })).toThrow('position mismatch');
    expect(() => engine.commit({ ...command, cause: 'undo' })).toThrow('history methods');
    engine.commit(command);
    expect(() => engine.commit({ ...tx(engine, [block('b', 1)]), id: 'first' })).toThrow('already committed');
  });
  it('rejects malformed and oversized transaction envelopes', () => {
    const engine = new VoxelEngine(project());
    const command = tx(engine, [block('a')]);
    expect(() => engine.commit({ ...command, changes: Array(MAX_TRANSACTION_CHANGES + 1).fill(command.changes[0]) })).toThrow('oversized');
    expect(() => engine.commit({ ...command, changes: [{ pos: block('a').pos, before: null, after: null }] })).toThrow('Empty');
    expect(() => engine.commit({ ...command, collisionPolicy: 'silent' } as unknown as EditTransaction)).toThrow('collision');
    expect(() => engine.commit({ ...command, cause: 'provider' } as unknown as EditTransaction)).toThrow('cause');
    expect(() => engine.commit({ ...command, cause: ['user'] } as unknown as EditTransaction)).toThrow('cause');
  });
  it('VXL-005 door insertion/deletion and undo are atomic', () => {
    const engine = new VoxelEngine(project());
    const pair = door();
    const partial = tx(engine, [pair.blocks[0]!]);
    expect(() => engine.commit(partial)).toThrow('Unpaired');
    const command = { ...tx(engine, pair.blocks), structures: [{ uid: pair.structure.uid, before: null, after: pair.structure }] };
    engine.commit(command);
    const placed = engine.snapshot();
    expect(placed.blocks).toHaveLength(2);
    expect(() => engine.commit(tx(engine, [], [engine.getByUid('upper')!]))).toThrow('member');
    expect(engine.snapshot()).toBe(placed);
    engine.undo();
    expect(engine.snapshot().logicalStructures).toHaveLength(0);
    engine.redo();
    const both = [...engine.snapshot().blocks];
    engine.commit({ ...tx(engine, [], both), structures: [{ uid: pair.structure.uid, before: pair.structure, after: null }] });
    expect(engine.snapshot().blocks).toHaveLength(0);
  });
  it('rejects malformed pairs, orphan groups, duplicate memberships and conflicting state', () => {
    const pair = door();
    expect(() => parseProject(project(pair.blocks, []))).toThrow('Unpaired');
    expect(() => parseProject(project(pair.blocks, [pair.structure, pair.structure]))).toThrow('Duplicate structure');
    expect(() => parseProject(project(pair.blocks, [{ ...pair.structure, memberUids: ['lower', 'lower'] }]))).toThrow('Duplicate structure member');
    expect(() => parseProject(project(pair.blocks, [{ ...pair.structure, anchorUid: 'missing' }]))).toThrow('anchor');
    expect(() => parseProject(project([pair.blocks[0]!, { ...pair.blocks[1]!, pos: { x: -1, y: 2, z: -2 } }], [pair.structure]))).toThrow('Nonadjacent');
    expect(() => parseProject(project([pair.blocks[0]!, { ...pair.blocks[1]!, state: { ...pair.blocks[1]!.state, open: 'true' } }], [pair.structure]))).toThrow('Inconsistent');
  });
  it('validates bed facing adjacency and tall-plant parts', () => {
    const foot = { ...block('foot', 0, 'minecraft:red_bed', { part: 'foot', facing: 'east' }), logicalStructureId: 'bed' };
    const head = { ...block('head', 1, 'minecraft:red_bed', { part: 'head', facing: 'east' }), logicalStructureId: 'bed' };
    const group: LogicalStructure = { uid: 'bed', kind: 'bed', anchorUid: 'foot', memberUids: ['foot', 'head'] };
    expect(parseProject(project([foot, head], [group])).blocks).toHaveLength(2);
    expect(() => parseProject(project([foot, { ...head, pos: { x: -1, y: 0, z: 0 } }], [group]))).toThrow('Nonadjacent');
    const plants = ['lower', 'upper'].map((half, y) => ({ ...block(half, 0, 'minecraft:sunflower', { half }, y), logicalStructureId: 'plant' }));
    expect(parseProject(project(plants, [{ uid: 'plant', kind: 'tall_plant', anchorUid: 'lower', memberUids: ['lower', 'upper'] }])).blocks).toHaveLength(2);
  });
  it('VXL-013 deterministic canonical JSON roundtrip preserves state/provenance/structures', () => {
    const pair = door();
    const p = parseProject(project([...pair.blocks, block('slab', 2, 'minecraft:oak_slab', { type: 'double' })], [pair.structure]));
    const json = exportProject(p);
    expect(exportProject(importProject(json))).toBe(json);
    expect(importProject(json).logicalStructures).toEqual(p.logicalStructures);
    expect(importProject(json).blocks.find(b => b.uid === 'slab')?.state.type).toBe('double');
  });
  it('updates normalized states and deletes a single cell with exact undo', () => {
    const engine = new VoxelEngine(project([block('log', -2, 'minecraft:oak_log', { axis: 'y' })]));
    const original = engine.getByUid('log')!;
    engine.commit(tx(engine, [{ ...original, state: { axis: 'x' } }], [original]));
    const changed = engine.getByUid('log')!;
    expect(changed.state.axis).toBe('x');
    expect(changed.uid).toBe(original.uid);
    engine.commit(tx(engine, [], [changed]));
    expect(engine.getAt(original.pos)).toBeNull();
    expect(engine.getByUid('log')).toBeNull();
    engine.undo();
    expect(engine.getByUid('log')).toEqual(changed);
    engine.undo();
    expect(engine.getByUid('log')).toEqual(original);
  });
  it('collision skip cannot publish a partial logical structure', () => {
    const pair = door();
    const occupied = { ...block('occupied'), pos: pair.blocks[0]!.pos };
    const engine = new VoxelEngine(project([occupied]));
    const initial = engine.snapshot();
    const command = { ...tx(engine, pair.blocks), collisionPolicy: 'skip' as const,
      structures: [{ uid: pair.structure.uid, before: null, after: pair.structure }] };
    expect(engine.preview(command).ok).toBe(false);
    expect(() => engine.commit(command)).toThrow('member');
    expect(engine.snapshot()).toBe(initial);
    expect(engine.canUndo).toBe(false);
  });
  it('horizontal beds at the editor Y limit do not require a vertical neighbor', () => {
    const blocks = ['foot', 'head'].map((part, x) => ({
      ...block(part, x, 'minecraft:red_bed', { part, facing: 'east' }, 30_000_000), logicalStructureId: 'bed',
    }));
    expect(parseProject(project(blocks, [{ uid: 'bed', kind: 'bed', anchorUid: 'foot', memberUids: ['foot', 'head'] }])).blocks).toHaveLength(2);
  });
  it('serializes equivalent coordinate and property orders consistently', () => {
    const a = block('a', 1, 'minecraft:oak_stairs', { facing: 'west', half: 'top' });
    const b = block('b', -1);
    const p = project([a, b]);
    expect(exportProject(p)).toBe(exportProject({ ...p, blocks: [b, { ...a, state: Object.fromEntries(Object.entries(a.state).reverse()) }] }));
  });
  it('rejects corrupt, oversized, wrong-version and malformed imports', () => {
    const p = project([block('a')]);
    expect(() => importProject('{broken')).toThrow();
    expect(() => importProject(' '.repeat(MAX_IMPORT_BYTES + 1))).toThrow('byte limit');
    for (const bad of [
      { ...p, schemaVersion: 2 }, { ...p, minecraftVersion: '1.21' }, { ...p, coordinateConvention: 'other' },
      { ...p, blocks: [{ ...block('a'), id: 'minecraft:no_such_block' }] },
      { ...p, blocks: [{ ...block('a'), id: 'minecraft:air' }] },
      { ...p, blocks: [{ ...block('a'), pos: { x: 0.2, y: 0, z: 0 } }] },
      { ...p, blocks: [{ ...block('a'), source: { origin: 'inferred', confidence: 2 } }] },
      { ...p, blocks: [{ ...block('a'), edits: { createdByTransactionId: 'x', lastModifiedByTransactionId: 'x', userModified: 'yes' } }] },
      { ...p, unexpected: true },
    ]) expect(() => parseProject(bad)).toThrow();
  });
});
