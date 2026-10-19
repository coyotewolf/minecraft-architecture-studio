import { describe, expect, it } from 'vitest';
import type { BlockState, MinecraftId } from '../../core/contracts.ts';
import { BLOCK_IDS, getRegistryEntry, normalizeBlockState } from '../../core/versioned-registry.ts';
import { transformState } from './batch.ts';

function roundTrips(id: MinecraftId, input: BlockState): void {
  const original = normalizeBlockState(id, input);
  for (const [kind, count] of [['rotate', 4], ['mirror_x', 2], ['mirror_z', 2]] as const) {
    let current = original;
    for (let step = 0; step < count; step++) {
      current = transformState(id, current, kind);
      expect(normalizeBlockState(id, current)).toEqual(current);
    }
    expect(current).toEqual(original);
  }
}

describe('Registry defaults preserve valid state domains and transform round trips', () => {
  it.each(BLOCK_IDS)('%s defaults round trip under quarter rotations and both mirrors', id => {
    roundTrips(id, getRegistryEntry(id).defaults);
  });
});

describe('Asymmetric legal directional state fixtures', () => {
  it('covers every registered oak stair facing, shape and half combination', () => {
    const id = 'minecraft:oak_stairs';
    const properties = getRegistryEntry(id).properties;
    for (const facing of properties.facing!) for (const shape of properties.shape!) for (const half of properties.half!) {
      roundTrips(id, { facing, shape, half });
    }
    const original = normalizeBlockState(id, { facing: 'west', shape: 'outer_left', half: 'top' });
    expect(transformState(id, original, 'rotate')).toMatchObject({ facing: 'north', shape: 'outer_left', half: 'top' });
    expect(transformState(id, original, 'mirror_x')).toMatchObject({ facing: 'east', shape: 'outer_right', half: 'top' });
  });

  it.each(['minecraft:rail', 'minecraft:powered_rail', 'minecraft:detector_rail', 'minecraft:activator_rail'] as const)('%s legal shapes round trip and rotate slopes', id => {
    for (const shape of getRegistryEntry(id).properties.shape!) roundTrips(id, { shape });
    expect(transformState(id, normalizeBlockState(id, { shape: 'ascending_north' }), 'rotate')).toMatchObject({ shape: 'ascending_east' });
  });

  it('rotates and mirrors rail curves with canonical shape ordering', () => {
    const original = normalizeBlockState('minecraft:rail', { shape: 'north_east' });
    expect(transformState('minecraft:rail', original, 'rotate')).toMatchObject({ shape: 'south_east' });
    expect(transformState('minecraft:rail', original, 'mirror_x')).toMatchObject({ shape: 'north_west' });
    expect(transformState('minecraft:rail', original, 'mirror_z')).toMatchObject({ shape: 'south_east' });
  });

  it('moves asymmetric fence connections rather than merely keeping legal values', () => {
    const id = 'minecraft:oak_fence';
    const original = normalizeBlockState(id, { north: 'true', east: 'false', south: 'false', west: 'true', waterlogged: 'true' });
    roundTrips(id, original);
    expect(transformState(id, original, 'rotate')).toEqual({ north: 'true', east: 'true', south: 'false', west: 'false', waterlogged: 'true' });
    expect(transformState(id, original, 'mirror_x')).toEqual({ north: 'true', east: 'true', south: 'false', west: 'false', waterlogged: 'true' });
    expect(transformState(id, original, 'mirror_z')).toEqual({ north: 'false', east: 'false', south: 'true', west: 'true', waterlogged: 'true' });
  });

  it('covers all sixteen sign rotations with exact directional expectations', () => {
    for (let rotation = 0; rotation < 16; rotation++) {
      const id = 'minecraft:oak_sign';
      const original = normalizeBlockState(id, { rotation: String(rotation) });
      roundTrips(id, original);
      expect(transformState(id, original, 'rotate').rotation).toBe(String((rotation + 4) % 16));
      expect(transformState(id, original, 'mirror_x').rotation).toBe(String((16 - rotation) % 16));
      expect(transformState(id, original, 'mirror_z').rotation).toBe(String((24 - rotation) % 16));
    }
  });

  it('covers door hinges, halves and directions without changing open state', () => {
    const id = 'minecraft:oak_door';
    const properties = getRegistryEntry(id).properties;
    for (const facing of properties.facing!) for (const hinge of properties.hinge!) for (const half of properties.half!) {
      const original = normalizeBlockState(id, { facing, hinge, half, open: 'true' });
      roundTrips(id, original);
      expect(transformState(id, original, 'mirror_x')).toMatchObject({ hinge: hinge === 'left' ? 'right' : 'left', half, open: 'true' });
    }
  });

  it.each(['minecraft:chest', 'minecraft:trapped_chest'] as const)('%s mirrors left/right chest parts and preserves single', id => {
    for (const facing of getRegistryEntry(id).properties.facing!) for (const type of getRegistryEntry(id).properties.type!) {
      const original = normalizeBlockState(id, { facing, type });
      roundTrips(id, original);
      const mirroredType = type === 'single' ? 'single' : type === 'left' ? 'right' : 'left';
      expect(transformState(id, original, 'mirror_x').type).toBe(mirroredType);
      expect(transformState(id, original, 'mirror_z').type).toBe(mirroredType);
      expect(transformState(id, original, 'rotate').type).toBe(type);
    }
  });
});
