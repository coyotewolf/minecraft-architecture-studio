import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../core/project.ts';
import type { BlockRecord } from '../../core/contracts.ts';
import { parseAiRequest, parseScope, validateAiResponse, validateProposal } from './proposals.ts';
const project = createEmptyProject('ai-test', 'Test');
const scope = { min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 2, z: 2 } };
function proposal() {
  const after: BlockRecord = { uid: 'ai-1', id: 'minecraft:stone', pos: { x: -1, y: 0, z: 0 }, state: {},
    source: { origin: 'ai_estimated', confidence: 0.6 }, edits: { createdByTransactionId: 'draft', lastModifiedByTransactionId: 'draft', userModified: false } };
  return { kind: 'proposal', minecraftVersion: '1.20.1', baseRevision: 'initial', summary: 'Test-only proposal', uncertainties: ['Not a measurement'],
    transaction: { id: 'ai-tx', baseRevision: 'initial', cause: 'ai_approved', collisionPolicy: 'cancel', changes: [{ pos: after.pos, before: null, after }], structures: [] } };
}
function request() { return { kind: 'edit', project, scope, prompt: 'Test-only request', images: [], dimensions: { x: 3, y: 2, z: 3 }, consent: true }; }
describe('AI request and proposal boundary', () => {
  it('requires explicit consent and strict known request fields', () => {
    expect(parseAiRequest(request()).dimensions).toEqual({ x: 3, y: 2, z: 3 });
    expect(() => parseAiRequest({ ...request(), consent: false })).toThrow();
    expect(() => parseAiRequest({ ...request(), url: 'https://attacker.invalid' })).toThrow();
    expect(() => parseAiRequest({ ...request(), dimensions: { x: 0, y: 2, z: 3 } })).toThrow();
    expect(() => parseAiRequest({ ...request(), kind: 'analyze' })).toThrow();
  });
  it('bounds scope and requires integer ordered coordinates', () => {
    expect(parseScope(scope)).toEqual(scope);
    expect(() => parseScope({ min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } })).toThrow();
    expect(() => parseScope({ ...scope, min: { x: 3, y: 0, z: 0 } })).toThrow();
    expect(() => parseScope({ ...scope, min: { x: 0.1, y: 0, z: 0 } })).toThrow();
  });
  it('validates and normalizes a proposal without mutating the project', () => {
    const result = validateProposal(project, proposal(), scope);
    expect(result.transaction.changes[0]!.after!.source).toEqual({ origin: 'ai_estimated', confidence: 0.6 });
    expect(result.transaction.changes[0]!.after!.edits.createdByTransactionId).toBe('ai-tx');
    expect(project.blocks).toEqual([]);
    expect(validateAiResponse(parseAiRequest(request()), proposal())).toMatchObject({ kind: 'proposal', baseRevision: 'initial' });
  });
  it('rejects stale revisions, oversize transactions and automatic replacement', () => {
    const p = proposal();
    expect(() => validateProposal(project, { ...p, baseRevision: 'stale' }, scope)).toThrow();
    expect(() => validateProposal(project, { ...p, transaction: { ...p.transaction, baseRevision: 'stale' } }, scope)).toThrow();
    expect(() => validateProposal(project, { ...p, transaction: { ...p.transaction, collisionPolicy: 'replace' } }, scope)).toThrow();
    expect(() => validateProposal(project, { ...p, transaction: { ...p.transaction, changes: Array(5001).fill(p.transaction.changes[0]) } }, scope)).toThrow();
  });
  it('rejects duplicate cells, invalid states, out-of-scope edits and incomplete doors', () => {
    const p = proposal(), c = p.transaction.changes[0]!;
    const check = (after: unknown) => validateProposal(project, { ...p, transaction: { ...p.transaction, changes: [{ ...c, after }] } }, scope);
    expect(() => validateProposal(project, { ...p, transaction: { ...p.transaction, changes: [c, c] } }, scope)).toThrow();
    expect(() => check({ ...c.after, state: { impossible: 'yes' } })).toThrow();
    expect(() => check({ ...c.after, id: 'minecraft:oak_door', state: {} })).toThrow();
    expect(() => validateProposal(project, { ...p, transaction: { ...p.transaction, changes: [{ ...c, pos: { x: 3, y: 0, z: 0 } }] } }, scope)).toThrow();
  });
  it.each([{ origin: 'user_created', confidence: 1 }, { origin: 'ai_estimated' }, { origin: 'observed', confidence: NaN }, { origin: 'inferred', confidence: 1.1 }])('rejects missing or dishonest source confidence: %j', source => {
    const p = proposal(), c = p.transaction.changes[0]!;
    expect(() => validateProposal(project, { ...p, transaction: { ...p.transaction, changes: [{ ...c, after: { ...c.after, source } }] } }, scope)).toThrow();
  });
  it('validates uncertain analysis separately from editable block proposals', () => {
    const r = parseAiRequest({ ...request(), kind: 'analyze', images: [{ name: 'test.png', mime: 'image/png', dataUrl: 'data:image/png;base64,AA==' }] });
    const analysis = { kind: 'analysis', summary: 'Estimate only', dimensions: { x: 8, y: 6, z: 9 }, uncertainties: ['Back unseen'] };
    expect(validateAiResponse(r, analysis)).toEqual(analysis);
    expect(() => validateAiResponse(r, proposal())).toThrow();
    expect(() => validateAiResponse(r, { ...analysis, dimensions: { x: 257, y: 6, z: 9 } })).toThrow();
  });
  it('accepts exactly 2 MiB decoded but rejects one extra byte and malformed base64', () => {
    const imageRequest = (base64: string) => ({ ...request(), images: [{ name: 'test.png', mime: 'image/png', dataUrl: 'data:image/png;base64,' + base64 }] });
    const exact = Buffer.alloc(2 * 1024 * 1024).toString('base64');
    expect(parseAiRequest(imageRequest(exact)).images).toHaveLength(1);
    const over = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
    expect(() => parseAiRequest(imageRequest(over))).toThrow();
    for (const bad of ['A', '', 'AA=', 'A===', 'AA==junk', 'AA==\n']) expect(() => parseAiRequest(imageRequest(bad))).toThrow();
  });
  it('rejects oversized or unsupported image envelopes', () => {
    const image = { name: 'x', mime: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,AA==' };
    expect(() => parseAiRequest({ ...request(), images: [image] })).toThrow();
    expect(() => parseAiRequest({ ...request(), images: [{ ...image, mime: 'image/png', dataUrl: 'data:image/png;base64,' + 'A'.repeat(2_800_001) }] })).toThrow();
  });
});

