import { describe, expect, it } from 'vitest';
import { BLOCK_IDS, getRegistryEntry, itemStackSize, normalizeBlockState } from './versioned-registry.ts';

describe('pinned Java 1.20.1 registry', () => {
  it('validates every projected default across 1000 non-air block IDs', () => {
    expect(BLOCK_IDS).toHaveLength(1000);
    expect(new Set(BLOCK_IDS).size).toBe(1000);
    for (const id of BLOCK_IDS) {
      const entry = getRegistryEntry(id);
      expect(normalizeBlockState(id, {})).toEqual(entry.defaults);
      expect(Object.keys(entry.defaults).sort()).toEqual(Object.keys(entry.properties).sort());
      for (const [key, values] of Object.entries(entry.properties)) expect(values).toContain(entry.defaults[key]);
    }
  });
  it('decodes actual mixed-radix defaults and boolean ordering', () => {
    expect(normalizeBlockState('minecraft:stone', {})).toEqual({});
    expect(normalizeBlockState('minecraft:oak_stairs', {})).toEqual({ facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' });
    expect(normalizeBlockState('minecraft:oak_door', {})).toEqual({ facing: 'north', half: 'lower', hinge: 'left', open: 'false', powered: 'false' });
    expect(normalizeBlockState('minecraft:red_bed', {})).toEqual({ facing: 'north', occupied: 'false', part: 'foot' });
    expect(normalizeBlockState('minecraft:oak_slab', {})).toEqual({ type: 'bottom', waterlogged: 'false' });
    expect(normalizeBlockState('minecraft:snow', {})).toEqual({ layers: '1' });
  });
  it('accepts valid states, fills defaults and rejects illegal keys and values', () => {
    expect(normalizeBlockState('minecraft:oak_stairs', { facing: 'east', shape: 'outer_left' }).facing).toBe('east');
    expect(normalizeBlockState('minecraft:oak_slab', { type: 'double' }).type).toBe('double');
    expect(() => normalizeBlockState('minecraft:oak_stairs', { facing: 'up' })).toThrow('Invalid');
    expect(() => normalizeBlockState('minecraft:stone', { waterlogged: 'false' })).toThrow('Unknown property');
    expect(() => normalizeBlockState('minecraft:snow', { layers: '9' })).toThrow('Invalid');
    expect(() => normalizeBlockState('minecraft:stone', JSON.parse('{"__proto__":"bad"}'))).toThrow();
  });
  it('rejects fake, wrong-namespace, prototype and all air IDs', () => {
    for (const id of ['stone', 'mod:stone', 'minecraft:not_real', 'constructor', '__proto__', 'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']) {
      expect(() => getRegistryEntry(id)).toThrow('block ID');
    }
  });
  it('distinguishes placement mapping, slabs and pairs without mining drops', () => {
    expect(getRegistryEntry('minecraft:stone').inventory).toEqual({ kind: 'per_cell', itemId: 'minecraft:stone', count: 1 });
    expect(getRegistryEntry('minecraft:oak_slab').inventory).toEqual({ kind: 'slab', itemId: 'minecraft:oak_slab' });
    for (const id of ['minecraft:oak_door', 'minecraft:red_bed', 'minecraft:sunflower']) {
      expect(getRegistryEntry(id).inventory).toEqual({ kind: 'logical_structure', itemId: id });
    }
    for (const id of ['minecraft:water', 'minecraft:snow', 'minecraft:candle', 'minecraft:sea_pickle', 'minecraft:turtle_egg', 'minecraft:pink_petals']) {
      expect(getRegistryEntry(id).inventory.kind).toBe('unresolved');
    }
  });
  it('uses versioned item stack sizes and rejects unknown items', () => {
    expect(itemStackSize('minecraft:stone')).toBe(64);
    expect(itemStackSize('minecraft:oak_door')).toBe(64);
    expect(itemStackSize('minecraft:red_bed')).toBe(1);
    expect(itemStackSize('minecraft:water_bucket')).toBe(1);
    expect(itemStackSize('minecraft:ender_pearl')).toBe(16);
    expect(() => itemStackSize('minecraft:no_item')).toThrow();
  });
  it('does not expose mutable registry collections', () => {
    const entry = getRegistryEntry('minecraft:oak_door');
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.properties.facing)).toBe(true);
    expect(Object.isFrozen(entry.inventory)).toBe(true);
    expect(() => { (entry.defaults as Record<string, string>).facing = 'east'; }).toThrow();
    expect(() => { (BLOCK_IDS as string[]).push('minecraft:fake'); }).toThrow();
  });
});
