import type { BlockState, RegistryEntry } from './contracts.ts';

/** Normalizes input against an explicitly supplied registry entry.
 * Introduced with synthetic M0 fixtures; M1 versioned-registry.ts supplies pinned production entries.
 */
export function normalizeState(entry: RegistryEntry, input: BlockState): BlockState {
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(entry.properties, key)) throw new Error(`Unknown property: ${key}`);
  }
  const output: Record<string, string> = {};
  for (const [key, allowed] of Object.entries(entry.properties)) {
    const value = Object.hasOwn(input, key) ? input[key] : entry.defaults[key];
    if (value === undefined || !allowed.includes(value)) {
      throw new Error(`Invalid state value: ${key}`);
    }
    output[key] = value;
  }
  return Object.freeze(output);
}
