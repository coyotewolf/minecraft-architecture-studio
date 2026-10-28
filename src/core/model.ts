import { COORDINATE_CONVENTION, MINECRAFT_VERSION, SCHEMA_VERSION } from './contracts.ts';
import type { BlockRecord, Evidence, LogicalStructure, Project } from './contracts.ts';
import { coordinateKey, DIRECTIONS, position } from './coordinates.ts';
import { validateEvidence } from './project.ts';
import { normalizeBlockState } from './versioned-registry.ts';

// A building is one canonical project, even when its model exceeds the former 50k part size.
export const MAX_BLOCKS = 1_000_000;
export const MAX_TRANSACTION_CHANGES = 10_000;
export const MAX_IMPORT_BYTES = 384 * 1024 * 1024;
const validatedProjects = new WeakSet<object>();
const deeplyFrozenValues = new WeakSet<object>();

export function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !allowed.includes(key))) throw new Error('Unknown object field');
  return result;
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error('Expected bounded nonempty string');
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Expected boolean');
  return value;
}
function strings(value: unknown): Record<string, string> {
  const obj = object(value, Object.keys(value && typeof value === 'object' ? value : {}));
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val !== 'string') throw new Error('State values must be strings');
    result[key] = val;
  }
  return result;
}
function optionalText(obj: Record<string, unknown>, key: string): Record<string, string> {
  return obj[key] === undefined ? {} : { [key]: text(obj[key]) };
}
export function parsePosition(value: unknown) {
  const p = object(value, ['x', 'y', 'z']);
  if (typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number') throw new Error('Invalid coordinates');
  return position(p.x, p.y, p.z);
}
export function parseBlock(value: unknown): BlockRecord {
  const b = object(value, ['uid', 'id', 'pos', 'state', 'source', 'edits', 'category', 'componentId', 'logicalStructureId', 'constructionPhaseId']);
  const source = object(b.source, ['origin', 'confidence', 'referenceRegionId']);
  const origin = source.origin;
  if (origin !== 'observed' && origin !== 'inferred' && origin !== 'ai_estimated' && origin !== 'user_created') throw new Error('Unknown evidence origin');
  if (source.confidence !== undefined && typeof source.confidence !== 'number') throw new Error('Invalid confidence');
  const evidence: Evidence = {
    origin,
    ...(source.confidence === undefined ? {} : { confidence: source.confidence }),
    ...optionalText(source, 'referenceRegionId'),
  };
  validateEvidence(evidence);
  const edits = object(b.edits, ['createdByTransactionId', 'lastModifiedByTransactionId', 'userModified']);
  const id = text(b.id);
  const state = normalizeBlockState(id, strings(b.state));
  // Multi-stage pitcher crops need a conditional-height rule, not a generic pair.
  if (id === 'minecraft:pitcher_crop') throw new Error('Unsupported multi-stage structure: pitcher_crop');
  return {
    uid: text(b.uid), id: id as BlockRecord['id'], pos: parsePosition(b.pos), state, source: evidence,
    edits: {
      createdByTransactionId: text(edits.createdByTransactionId),
      lastModifiedByTransactionId: text(edits.lastModifiedByTransactionId),
      userModified: boolean(edits.userModified),
    },
    ...optionalText(b, 'category'), ...optionalText(b, 'componentId'),
    ...optionalText(b, 'logicalStructureId'), ...optionalText(b, 'constructionPhaseId'),
  };
}
export function parseStructure(value: unknown): LogicalStructure {
  const s = object(value, ['uid', 'kind', 'anchorUid', 'memberUids']);
  if (s.kind !== 'door' && s.kind !== 'bed' && s.kind !== 'tall_plant') throw new Error('Unknown structure kind');
  if (!Array.isArray(s.memberUids) || s.memberUids.length !== 2) throw new Error('Paired structures require two members');
  const memberUids = s.memberUids.map(text);
  if (new Set(memberUids).size !== 2) throw new Error('Duplicate structure member');
  const anchorUid = text(s.anchorUid);
  if (!memberUids.includes(anchorUid)) throw new Error('Structure anchor must be a member');
  return { uid: text(s.uid), kind: s.kind, anchorUid, memberUids };
}
function pairKind(b: BlockRecord): LogicalStructure['kind'] | null {
  if (b.id.endsWith('_door')) return 'door';
  if (b.id.endsWith('_bed')) return 'bed';
  if (b.state.half === 'lower' || b.state.half === 'upper') return 'tall_plant';
  return null;
}
function validateStructures(blocks: readonly BlockRecord[], structures: readonly LogicalStructure[]): void {
  const byUid = new Map(blocks.map(b => [b.uid, b]));
  const groups = new Map<string, LogicalStructure>();
  const claimed = new Set<string>();
  for (const s of structures) {
    if (groups.has(s.uid)) throw new Error('Duplicate structure UID');
    groups.set(s.uid, s);
    const members = s.memberUids.map(uid => {
      const b = byUid.get(uid);
      if (!b || b.logicalStructureId !== s.uid || claimed.has(uid)) throw new Error('Missing, mismatched or repeated structure member');
      claimed.add(uid);
      return b;
    });
    const anchor = byUid.get(s.anchorUid);
    const other = members.find(b => b.uid !== s.anchorUid);
    if (!anchor || !other || anchor.id !== other.id || pairKind(anchor) !== s.kind) throw new Error('Invalid structure identity');
    const part = s.kind === 'bed' ? 'part' : 'half';
    if (anchor.state[part] !== (s.kind === 'bed' ? 'foot' : 'lower') || other.state[part] !== (s.kind === 'bed' ? 'head' : 'upper')) {
      throw new Error('Invalid structure parts');
    }
    let expected;
    if (s.kind === 'bed') {
      const direction = DIRECTIONS[anchor.state.facing as keyof typeof DIRECTIONS];
      if (!direction) throw new Error('Invalid bed facing');
      expected = position(anchor.pos.x + direction.x, anchor.pos.y, anchor.pos.z + direction.z);
    } else expected = position(anchor.pos.x, anchor.pos.y + 1, anchor.pos.z);
    if (coordinateKey(other.pos) !== coordinateKey(expected)) throw new Error('Nonadjacent structure parts');
    for (const [key, value] of Object.entries(anchor.state)) {
      if (key !== part && other.state[key] !== value) throw new Error('Inconsistent paired state');
    }
  }
  for (const b of blocks) {
    if (pairKind(b) && (!b.logicalStructureId || !claimed.has(b.uid))) throw new Error('Unpaired multi-cell block');
    if (b.logicalStructureId && (!groups.has(b.logicalStructureId) || !claimed.has(b.uid))) throw new Error('Orphan structure reference');
  }
}
export function parseProject(value: unknown): Project {
  // Only objects created and recursively frozen by this parser can use this path.
  if (value && typeof value === 'object' && validatedProjects.has(value)) return value as Project;
  const p = object(value, ['schemaVersion', 'minecraftVersion', 'coordinateConvention', 'id', 'title', 'designRevision', 'blocks', 'logicalStructures']);
  if (p.schemaVersion !== SCHEMA_VERSION || p.minecraftVersion !== MINECRAFT_VERSION || p.coordinateConvention !== COORDINATE_CONVENTION) {
    throw new Error('Unsupported schema, game version or coordinate convention');
  }
  if (!Array.isArray(p.blocks) || p.blocks.length > MAX_BLOCKS || !Array.isArray(p.logicalStructures) || p.logicalStructures.length > MAX_BLOCKS / 2) {
    throw new Error('Invalid or oversized model');
  }
  const blocks = p.blocks.map(parseBlock);
  const coordinates = new Set<string>();
  const uids = new Set<string>();
  for (const b of blocks) {
    const key = coordinateKey(b.pos);
    if (coordinates.has(key)) throw new Error('Duplicate coordinate');
    if (uids.has(b.uid)) throw new Error('Duplicate block UID');
    coordinates.add(key); uids.add(b.uid);
  }
  const logicalStructures = p.logicalStructures.map(parseStructure);
  validateStructures(blocks, logicalStructures);
  if (typeof p.title !== 'string' || p.title.length > 512) throw new Error('Invalid project title');
  const result = deepFreeze({
    schemaVersion: SCHEMA_VERSION, minecraftVersion: MINECRAFT_VERSION, coordinateConvention: COORDINATE_CONVENTION,
    id: text(p.id), title: p.title, designRevision: text(p.designRevision), blocks, logicalStructures,
  });
  validatedProjects.add(result);
  return result;
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    if (deeplyFrozenValues.has(value)) return value;
    Object.freeze(value);
    for (const member of Object.values(value)) deepFreeze(member);
    deeplyFrozenValues.add(value);
  }
  return value;
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
/** Stable object-key ordering; arrays retain semantic order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, child: unknown) => {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return Object.fromEntries(Object.entries(child).sort(([a], [b]) => compare(a, b)));
    }
    return child;
  });
}
export function exportProject(project: Project): string {
  const valid = parseProject(project);
  return stableJson({
    ...valid,
    blocks: [...valid.blocks].sort((a, b) => compare(coordinateKey(a.pos), coordinateKey(b.pos))),
    logicalStructures: [...valid.logicalStructures].sort((a, b) => compare(a.uid, b.uid)),
  });
}
export function importProject(json: string): Project {
  if (json.length > MAX_IMPORT_BYTES || new TextEncoder().encode(json).length > MAX_IMPORT_BYTES) throw new Error('Import exceeds byte limit');
  return parseProject(JSON.parse(json) as unknown);
}
