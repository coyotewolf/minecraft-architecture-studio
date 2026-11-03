import source from '../data/java-1.20.1.json';
import type { BlockState, InventoryRule, MinecraftId, RegistryEntry } from './contracts.ts';
import { MINECRAFT_VERSION } from './contracts.ts';
import { normalizeState } from './registry.ts';

interface RegistryData {
  minecraftVersion: string;
  blocks: readonly { id: MinecraftId; properties: Record<string, string[]>; defaults: Record<string, string> }[];
  items: Record<string, number>;
}
const data = source as unknown as RegistryData;
if (data.minecraftVersion !== MINECRAFT_VERSION || data.blocks.length !== 1003 || Object.keys(data.items).length !== 1255) {
  throw new Error('Unexpected pinned registry');
}
const air = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
const items = new Map(Object.entries(data.items));
const entries = new Map<string, RegistryEntry>();
function inventory(id: MinecraftId, properties: RegistryEntry['properties']): InventoryRule {
  if (!items.has(id)) return { kind: 'unresolved', reason: 'No same-ID placement item; explicit mapping required' };
  if (['candles', 'pickles', 'layers', 'eggs', 'flower_amount'].some(key => Object.hasOwn(properties, key))) {
    return { kind: 'unresolved', reason: 'State-dependent item quantity requires an M6 rule' };
  }
  if (id.endsWith('_slab') && properties.type?.includes('double')) return { kind: 'slab', itemId: id };
  if (id.endsWith('_door') || id.endsWith('_bed') || properties.half?.includes('lower')) {
    return { kind: 'logical_structure', itemId: id };
  }
  return { kind: 'per_cell', itemId: id, count: 1 };
}
for (const row of data.blocks) {
  if (air.has(row.id)) continue;
  const properties = Object.freeze(Object.fromEntries(Object.entries(row.properties).map(([key, values]) => [key, Object.freeze([...values])])));
  const defaults = Object.freeze({ ...row.defaults });
  const entry = Object.freeze({ id: row.id, properties, defaults, inventory: Object.freeze(inventory(row.id, properties)) });
  normalizeState(entry, defaults);
  if (entries.has(row.id)) throw new Error('Duplicate registry ID');
  entries.set(row.id, entry);
}
/** Includes state-domain entries; model-level structure rules may further restrict use. */
export const BLOCK_IDS: readonly MinecraftId[] = Object.freeze([...entries.values()].map(entry => entry.id));
export function getRegistryEntry(id: string): RegistryEntry {
  const entry = entries.get(id);
  if (!entry) throw new Error('Unknown or unstorable block ID: ' + id);
  return entry;
}
export function normalizeBlockState(id: string, state: BlockState): BlockState {
  return normalizeState(getRegistryEntry(id), state);
}
export function itemStackSize(itemId: string): number {
  const size = items.get(itemId);
  if (size === undefined) throw new Error('Unknown item ID: ' + itemId);
  return size;
}
