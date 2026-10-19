import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../core/project.ts';
import { createDemoProject } from '../../fixtures/two-floor-house.ts';
import { createWorkspace, deserializeWorkspace, MAX_WORKSPACE_BYTES, parseWorkspace, serializeWorkspace } from './storage.ts';

const instant = '2026-10-19T12:00:00.000Z';
function fixture() { return { ...createWorkspace(createDemoProject()), updatedAt: instant }; }

describe('workspace backup validation', () => {
  it('roundtrips all snapshots, history, checklist and view without losing provenance', () => {
    const base = fixture();
    const record = parseWorkspace({ ...base, milestones: [{ id: 'milestone-1', title: '屋頂完成', createdAt: instant, project: base.project }],
      prepared: { 'minecraft:oak_door': 4, 'minecraft:red_bed': 1 }, completed: [base.project.blocks[0]!.uid],
      view: { layer: -4, mode: 'ghost', progress: 42.5 }, revisionLog: [{ id: 'revision-1', label: '修改窗戶', at: instant }] });
    const json = serializeWorkspace(record);
    const restored = deserializeWorkspace(json);
    expect(restored).toEqual(record);
    expect(serializeWorkspace(restored)).toBe(json);
    expect(restored.project.blocks[0]!.source).toEqual(record.project.blocks[0]!.source);
    expect(Object.isFrozen(restored.prepared)).toBe(true);
    expect(Object.isFrozen(restored.milestones[0]!.project.blocks)).toBe(true);
  });
  it('keeps approved completed blocks that were removed from current design', () => {
    const base = fixture();
    const project = createEmptyProject(base.project.id, 'Changed');
    expect(parseWorkspace({ ...base, project, completed: [base.approvedDesign.blocks[0]!.uid] }).completed).toHaveLength(1);
  });
  it('detaches inputs and supports an empty project', () => {
    const input = { ...createWorkspace(createEmptyProject('empty', '')), prepared: { 'minecraft:stone': 2 } };
    const result = parseWorkspace(input);
    input.prepared['minecraft:stone'] = 99;
    expect(result.prepared['minecraft:stone']).toBe(2);
    expect(result.project.blocks).toEqual([]);
  });
  it.each([
    { schemaVersion: 2 }, { extra: true }, { updatedAt: '2026-02-30T00:00:00.000Z' },
    { updatedAt: 'yesterday' }, { completed: ['missing'] }, { prepared: { 'minecraft:not_real': 3 } },
    { prepared: { 'minecraft:stone': -1 } }, { prepared: { 'minecraft:stone': 0.5 } },
    { prepared: { 'minecraft:stone': Infinity } }, { prepared: { 'minecraft:stone': Number.MAX_SAFE_INTEGER + 1 } },
    { view: { layer: 0, mode: 'anything', progress: 0 } }, { view: { layer: 0.5, mode: 'all', progress: 0 } },
    { view: { layer: 0, mode: 'all', progress: NaN } }, { view: { layer: 0, mode: 'all', progress: 101 } },
    { view: { layer: 0, mode: 'all', progress: 0, surprise: true } },
  ])('rejects malformed workspace fields: %j', change => {
    expect(() => parseWorkspace({ ...fixture(), ...change })).toThrow();
  });
  it('rejects corrupt nested projects and mismatched project identity', () => {
    const base = fixture();
    for (const field of ['project', 'original', 'approvedDesign']) {
      expect(() => parseWorkspace({ ...base, [field]: { ...base.project, extra: true } })).toThrow();
    }
    expect(() => parseWorkspace({ ...base, original: { ...base.original, id: 'different' } })).toThrow('mismatch');
    expect(() => parseWorkspace({ ...base, project: { ...base.project, id: '__proto__' } })).toThrow('Unsafe');
    expect(() => parseWorkspace({ ...base, project: { ...base.project, blocks: [base.project.blocks[0], base.project.blocks[0]] } })).toThrow('Duplicate');
  });
  it('rejects duplicate completed UIDs, milestone IDs and revision IDs', () => {
    const base = fixture();
    const uid = base.project.blocks[0]!.uid;
    const milestone = { id: 'm1', title: 'First', createdAt: instant, project: base.project };
    const revision = { id: 'r1', label: 'First', at: instant };
    expect(() => parseWorkspace({ ...base, completed: [uid, uid] })).toThrow('Duplicate');
    expect(() => parseWorkspace({ ...base, milestones: [milestone, milestone] })).toThrow('Duplicate');
    expect(() => parseWorkspace({ ...base, revisionLog: [revision, revision] })).toThrow('Duplicate');
    expect(() => parseWorkspace({ ...base, milestones: [{ ...milestone, extra: 1 }] })).toThrow();
    expect(() => parseWorkspace({ ...base, revisionLog: [{ ...revision, extra: 1 }] })).toThrow();
  });
  it('enforces history counts and total snapshot block budget before normalization', () => {
    const base = fixture();
    expect(() => parseWorkspace({ ...base, milestones: Array(11).fill({}) })).toThrow('oversized');
    expect(() => parseWorkspace({ ...base, revisionLog: Array(501).fill({}) })).toThrow('oversized');
    const large = { ...base.project, blocks: Array(50_000).fill(null) };
    expect(() => parseWorkspace({ ...base, project: large, original: large, approvedDesign: large,
      milestones: [0, 1, 2].map(i => ({ id: `m${i}`, title: 'Snapshot', createdAt: instant, project: large })) })).toThrow('block limit');
  });
  it('rejects malformed JSON and oversized text before parsing', () => {
    expect(() => deserializeWorkspace('{')).toThrow();
    expect(() => deserializeWorkspace(' '.repeat(MAX_WORKSPACE_BYTES + 1))).toThrow('128 MiB');
    // UTF-8 byte bound is independent of UTF-16 string length.
    expect(() => deserializeWorkspace('界'.repeat(Math.floor(MAX_WORKSPACE_BYTES / 3) + 1))).toThrow('128 MiB');
  });
});
