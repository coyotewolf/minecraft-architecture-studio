import { describe, expect, it } from 'vitest';
import type { EditTransaction } from '../../core/contracts.ts';
import { createEmptyProject } from '../../core/project.ts';
import { createWorkspace, deserializeWorkspace, parseWorkspace, serializeWorkspace } from '../projects/storage.ts';
const at = '2026-10-19T12:00:00.000Z';
function transaction(count = 1): EditTransaction {
  return { id: 'accepted-ai', baseRevision: 'initial', cause: 'ai_approved', collisionPolicy: 'cancel', structures: [], changes: Array.from({ length: count }, (_, x) => {
    const pos = { x, y: 0, z: 0 };
    return { pos, before: null, after: { uid: `ai-${x}`, id: 'minecraft:stone', pos, state: {}, source: { origin: 'ai_estimated', confidence: 0.75 },
      edits: { createdByTransactionId: 'accepted-ai', lastModifiedByTransactionId: 'accepted-ai', userModified: false } } };
  }) };
}
function workspace() { return createWorkspace(createEmptyProject('history-test', 'History')); }
describe('persisted AI audit history', () => {
  it('roundtrips full prompt, scope, provider and accepted transaction without truncation', () => {
    const detail = `${at} | generate | test-only-model | {"min":{"x":0,"y":0,"z":0},"max":{"x":3,"y":3,"z":3}} | ${'完整需求'.repeat(800)}`;
    const record = parseWorkspace({ ...workspace(), revisionLog: [{ id: 'event-1', label: '接受 AI 提案', at, detail, transaction: transaction() }] });
    const restored = deserializeWorkspace(serializeWorkspace(record));
    expect(restored.revisionLog[0]!.detail).toBe(detail); expect(detail.length).toBeGreaterThan(512);
    expect(restored.revisionLog[0]!.transaction).toEqual(transaction());
    expect(Object.isFrozen(restored.revisionLog[0]!.transaction!.changes[0]!.after!.source)).toBe(true);
  });
  it('retains the durable original AI marker after history pruning and migrates older AI logs', () => {
    const pruned = parseWorkspace({ ...workspace(), originalAi: true, revisionLog: [] });
    expect(deserializeWorkspace(serializeWorkspace(pruned)).originalAi).toBe(true);
    const old = { ...workspace(), revisionLog: [{ id: 'legacy-ai', label: 'AI', at, transaction: transaction() }] };
    delete (old as { originalAi?: boolean }).originalAi;
    expect(parseWorkspace(old).originalAi).toBe(true);
    expect(() => parseWorkspace({ ...workspace(), originalAi: 'yes' })).toThrow();
  });
  it('continues to read original v1 history entries without new optional fields', () => {
    const old = { ...workspace(), revisionLog: [{ id: 'old', label: '編輯', at }] };
    expect(deserializeWorkspace(JSON.stringify(old)).revisionLog).toEqual(old.revisionLog);
  });
  it('rejects invalid transaction state, extra fields and oversized audit text', () => {
    const tx = transaction(); const entry = { id: 'entry', label: 'AI', at, transaction: tx };
    expect(() => parseWorkspace({ ...workspace(), revisionLog: [{ ...entry, detail: 'x'.repeat(8193) }] })).toThrow('audit');
    expect(() => parseWorkspace({ ...workspace(), revisionLog: [{ ...entry, transaction: { ...tx, injected: true } }] })).toThrow();
    const c = tx.changes[0]!;
    expect(() => parseWorkspace({ ...workspace(), revisionLog: [{ ...entry, transaction: { ...tx, changes: [{ ...c, after: { ...c.after, state: { invalid: 'true' } } }] } }] })).toThrow();
  });
  it('enforces aggregate 100000 history cell changes independently of per-transaction limit', () => {
    const tx = transaction(5000);
    const entries = Array.from({ length: 20 }, (_, i) => ({ id: `event-${i}`, label: 'AI', at, transaction: tx }));
    expect(parseWorkspace({ ...workspace(), revisionLog: entries }).revisionLog).toHaveLength(20);
    expect(() => parseWorkspace({ ...workspace(), revisionLog: [...entries, { ...entries[0], id: 'over' }] })).toThrow('History cell limit');
  });
});

