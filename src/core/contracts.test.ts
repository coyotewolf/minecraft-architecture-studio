import { describe, expect, it } from 'vitest';
import { createEmptyProject, validateEvidence } from './project.ts';
import { normalizeState } from './registry.ts';
import type { RegistryEntry, VoxelProposal, MeshReference } from './contracts.ts';

// Synthetic contract fixture, NOT a claim that minecraft:contract_fixture exists.
const fixture: RegistryEntry = {
  id: 'minecraft:contract_fixture',
  properties: { facing: ['north', 'east', 'south', 'west'], half: ['lower', 'upper'] },
  defaults: { facing: 'north', half: 'lower' },
  inventory: { kind: 'unresolved', reason: 'Synthetic test fixture' },
};

describe('M0 contract boundary', () => {
  it('creates an empty exact-version model with no fabricated blocks', () => {
    const p = createEmptyProject('p1', 'Empty');
    expect(p).toMatchObject({ schemaVersion: 1, minecraftVersion: '1.20.1', coordinateConvention: 'x-east-y-up-z-south', blocks: [], logicalStructures: [] });
    expect(Object.isFrozen(p.blocks)).toBe(true);
    expect(() => createEmptyProject(' ', 'Empty')).toThrow();
  });
  it.each([-0.1, 1.1, NaN, Infinity])('rejects confidence %s', confidence => {
    expect(() => validateEvidence({ origin: 'inferred', confidence })).toThrow();
  });
  it('keeps uncertainty separate from later edit history', () => {
    const source = { origin: 'ai_estimated', confidence: 0.4 } as const;
    validateEvidence(source);
    expect({ source, edits: { userModified: true } }.source).toEqual(source);
    expect(() => validateEvidence({ origin: 'observed', confidence: 0 })).not.toThrow();
    expect(() => validateEvidence({ origin: 'user_created' })).not.toThrow();
  });
  it('normalizes explicit registry defaults without mutating input', () => {
    const input = { facing: 'east' };
    expect(normalizeState(fixture, input)).toEqual({ facing: 'east', half: 'lower' });
    expect(input).toEqual({ facing: 'east' });
  });
  it('rejects unknown properties, illegal values and invalid defaults', () => {
    expect(() => normalizeState(fixture, { colour: 'red' })).toThrow();
    expect(() => normalizeState(fixture, { facing: 'up' })).toThrow();
    expect(() => normalizeState(fixture, { constructor: 'north' })).toThrow();
    expect(() => normalizeState({ ...fixture, defaults: {} }, {})).toThrow();
  });
  it('keeps a GLB reference outside the voxel proposal contract', () => {
    const mesh: MeshReference = { kind: 'mesh_reference', format: 'glb', url: 'https://example.invalid/reference.glb', provider: 'test-only' };
    // @ts-expect-error A mesh cannot become canonical blocks by casting its label.
    const proposal: VoxelProposal = mesh;
    expect(proposal.kind).toBe('mesh_reference');
    // This is a compile-time boundary assertion, not a live provider output test.
  });
});
