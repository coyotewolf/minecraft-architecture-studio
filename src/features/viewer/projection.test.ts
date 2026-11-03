import { describe, expect, it } from 'vitest';
import type { BlockRecord, MinecraftId } from '../../core/contracts.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';
import { shapeForBlock } from './geometry.ts';
import { buildModelGroup, disposeGroup, pickModel, updateModelGroup, type ModelInstance } from './runtime.js';

function block(uid: string, x: number, y = -1, z = -2, id: MinecraftId = 'minecraft:stone'): BlockRecord {
  return { uid, id, pos: { x, y, z }, state: normalizeBlockState(id, {}), source: { origin: 'user_created' },
    edits: { createdByTransactionId: 'fixture', lastModifiedByTransactionId: 'fixture', userModified: false } };
}
const materials = (mesh: ModelInstance) => 'opacity' in mesh.material ? [mesh.material] : mesh.material;

describe('chunk-instanced renderer and canonical projection', () => {
  it('batches identical parts in signed 16-cell chunks and picks each instance UID', () => {
    const blocks = [block('a', -2), block('b', -1), block('c', 0), block('d', 16)];
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock));
    try {
      expect(group.children).toHaveLength(3);
      expect(group.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
      expect(group.children.find(mesh => mesh.userData.uids.includes('a'))?.count).toBe(2);
      for (const b of blocks) expect(pickModel(group, [b.pos.x + .5, -.5, -4], [0, 0, 1])?.uid).toBe(b.uid);
    } finally { disposeGroup(group); }
  });

  it('places 1,000 identical cells in one instance batch without losing last-cell picking', () => {
    const blocks: BlockRecord[] = [];
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) for (let z = 0; z < 10; z++) blocks.push(block(x + ',' + y + ',' + z, x, y, z));
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock));
    try {
      expect(group.children).toHaveLength(1);
      expect(group.children[0]?.count).toBe(1000);
      expect(pickModel(group, [9.5, 9.5, 12], [0, 0, -1])?.uid).toBe('9,9,9');
    } finally { disposeGroup(group); }
  });

  it('keeps UID mapping across multiple stair parts, log face materials and wireframe markers', () => {
    const blocks = [block('stair', -2, -1, -2, 'minecraft:oak_stairs'), block('log', -1, -1, -2, 'minecraft:oak_log'), block('marker', 0, -1, -2, 'minecraft:dragon_egg')];
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock));
    try {
      expect(group.children.filter(mesh => mesh.userData.uids.includes('stair')).length).toBeGreaterThan(1);
      const log = group.children.find(mesh => mesh.userData.uids.includes('log'))!;
      expect(materials(log)).toHaveLength(6);
      expect(materials(log).filter(material => material.color.getHex() === 0xc6ab76)).toHaveLength(2);
      const marker = group.children.find(mesh => mesh.userData.uids.includes('marker'))!;
      expect(materials(marker).every(material => material.wireframe)).toBe(true);
      expect(pickModel(group, [-1.5, -.75, -4], [0, 0, 1])?.uid).toBe('stair');
    } finally { disposeGroup(group); }
  });

  it('hides instances from rays and applies exploded offsets without changing signed canonical records', () => {
    const blocks = [block('a', -2), block('b', -1)];
    const before = JSON.stringify(blocks);
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock), [0, 0, 0], [
      { uid: 'a', visible: true, opacity: .5, offsetY: 10 },
      { uid: 'b', visible: false, opacity: 1, offsetY: 0 },
    ]);
    try {
      expect(pickModel(group, [-1.5, -.5, -4], [0, 0, 1])).toBeNull();
      expect(pickModel(group, [-.5, -.5, -4], [0, 0, 1])).toBeNull();
      expect(pickModel(group, [-1.5, 9.5, -4], [0, 0, 1])).toMatchObject({ uid: 'a', point: [-1.5, 9.5, -2], normal: [0, 0, -1] });
      expect(JSON.stringify(blocks)).toBe(before);
      expect(group.children.reduce((n, mesh) => n + mesh.count, 0)).toBe(1);
    } finally { disposeGroup(group); }
  });

  it('multiplies original glass opacity and makes zero-opacity projections unpickable', () => {
    const blocks = [block('glass', -2, -1, -2, 'minecraft:glass'), block('zero', -1)];
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock), [0, 0, 0], [
      { uid: 'glass', visible: true, opacity: .5, offsetY: 0 },
      { uid: 'zero', visible: true, opacity: 0, offsetY: 0 },
    ]);
    try {
      expect(materials(group.children[0]!)[0]?.opacity).toBeCloseTo(.19);
      expect(pickModel(group, [-1.5, -.5, -4], [0, 0, 1])?.uid).toBe('glass');
      expect(pickModel(group, [-.5, -.5, -4], [0, 0, 1])).toBeNull();
    } finally { disposeGroup(group); }
  });

  it('retains unchanged chunks and disposes only changed chunk resources once', () => {
    const blocks = [block('a', -2), block('b', 16)];
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock));
    const old = group.children.find(mesh => mesh.userData.uids.includes('a'))!;
    const retained = group.children.find(mesh => mesh.userData.uids.includes('b'))!;
    let geometryDisposals = 0, materialDisposals = 0, instanceDisposals = 0, retainedDisposals = 0;
    old.geometry.addEventListener('dispose', () => geometryDisposals++);
    materials(old)[0]!.addEventListener('dispose', () => materialDisposals++);
    old.addEventListener('dispose', () => instanceDisposals++);
    retained.geometry.addEventListener('dispose', () => retainedDisposals++);
    try {
      updateModelGroup(group, [...blocks].reverse(), [...blocks].reverse().map(shapeForBlock));
      expect(group.children).toContain(old); expect(group.children).toContain(retained);
      const changed = [block('a', -2, -1, -2, 'minecraft:glass'), blocks[1]!];
      updateModelGroup(group, changed, changed.map(shapeForBlock));
      expect(group.children).not.toContain(old); expect(group.children).toContain(retained);
      expect([geometryDisposals, materialDisposals, instanceDisposals, retainedDisposals]).toEqual([1, 1, 1, 0]);
    } finally { disposeGroup(group); }
    expect([geometryDisposals, materialDisposals, instanceDisposals, retainedDisposals]).toEqual([1, 1, 1, 1]);
  });

  it('rebuilds only projection-affected chunks and reuses identical projections', () => {
    const blocks = [block('a', -2), block('b', 16)];
    const group = buildModelGroup(blocks, blocks.map(shapeForBlock));
    const retained = group.children.find(mesh => mesh.userData.uids.includes('b'))!;
    try {
      const projection = [{ uid: 'a', visible: true, opacity: .4, offsetY: 4 }];
      updateModelGroup(group, blocks, blocks.map(shapeForBlock), projection);
      expect(group.children).toContain(retained);
      const moved = group.children.find(mesh => mesh.userData.uids.includes('a'))!;
      updateModelGroup(group, blocks, blocks.map(shapeForBlock), projection);
      expect(group.children).toContain(moved);
      expect(pickModel(group, [-1.5, 3.5, -4], [0, 0, 1])?.uid).toBe('a');
      updateModelGroup(group, blocks, blocks.map(shapeForBlock), []);
      expect(pickModel(group, [-1.5, -.5, -4], [0, 0, 1])?.uid).toBe('a');
      expect(group.children).toContain(retained);
    } finally { disposeGroup(group); }
  });

  it('reapplies surviving projection entries on model edits and defaults new UIDs', () => {
    const a = block('a', -2), b = block('b', 16);
    const group = buildModelGroup([a], [shapeForBlock(a)], [0, 0, 0], [{ uid: 'a', visible: true, opacity: 1, offsetY: 5 }]);
    try {
      updateModelGroup(group, [a, b], [a, b].map(shapeForBlock));
      expect(pickModel(group, [-1.5, 4.5, -4], [0, 0, 1])?.uid).toBe('a');
      expect(pickModel(group, [16.5, -.5, -4], [0, 0, 1])?.uid).toBe('b');
      updateModelGroup(group, [b], [shapeForBlock(b)]);
      updateModelGroup(group, [a, b], [a, b].map(shapeForBlock));
      expect(pickModel(group, [-1.5, -.5, -4], [0, 0, 1])?.uid).toBe('a');
    } finally { disposeGroup(group); }
  });

  it('keeps preview resources independent from the persistent model', () => {
    const b = block('a', -2), shape = shapeForBlock(b);
    const model = buildModelGroup([b], [shape]), preview = buildModelGroup([b], [shape]);
    let disposed = 0;
    model.children[0]!.geometry.addEventListener('dispose', () => disposed++);
    expect(model.children[0]!.geometry).not.toBe(preview.children[0]!.geometry);
    expect(model.children[0]!.material).not.toBe(preview.children[0]!.material);
    disposeGroup(preview);
    expect(disposed).toBe(0);
    expect(pickModel(model, [-1.5, -.5, -4], [0, 0, 1])?.uid).toBe('a');
    disposeGroup(model); expect(disposed).toBe(1);
  });

  it('invalid projection input cannot destroy a current model or its resources', () => {
    const b = block('a', -2), shape = shapeForBlock(b), group = buildModelGroup([b], [shape]);
    const mesh = group.children[0];
    try {
      expect(() => updateModelGroup(group, [b], [shape], [{ uid: 'a', visible: true, opacity: NaN, offsetY: 0 }])).toThrow('Invalid viewer projection');
      expect(group.children[0]).toBe(mesh);
      expect(pickModel(group, [-1.5, -.5, -4], [0, 0, 1])?.uid).toBe('a');
    } finally { disposeGroup(group); }
  });
});

