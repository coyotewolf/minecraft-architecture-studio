import type { BlockPos, BlockRecord, BlockState, EditTransaction, LogicalStructure, MinecraftId, Project } from '../../core/contracts.ts';
import { coordinateKey } from '../../core/coordinates.ts';
import { parsePosition, stableJson } from '../../core/model.ts';
import { normalizeBlockState } from '../../core/versioned-registry.ts';

export type CollisionPolicy = EditTransaction['collisionPolicy'];
export type EditorAction = 'place' | 'remove' | 'replace';
const fresh = () => crypto.randomUUID();

/** Include every member when a selection intersects a logical structure. */
export function expandSelection(project: Project, uids: readonly string[]): BlockRecord[] {
  const selected = new Set(uids);
  for (const group of project.logicalStructures) {
    if (group.memberUids.some(uid => selected.has(uid))) {
      group.memberUids.forEach(uid => selected.add(uid));
    }
  }
  return project.blocks.filter(block => selected.has(block.uid));
}

/** Build a reversible before/after diff; the engine still owns validation and publication. */
export function designDiff(project: Project, blocks: readonly BlockRecord[], structures: readonly LogicalStructure[],
  cause: EditTransaction['cause'] = 'user', id: string = fresh()): EditTransaction {
  const before = new Map(project.blocks.map(b => [coordinateKey(b.pos), b]));
  const after = new Map(blocks.map(b => [coordinateKey(b.pos), b]));
  if (after.size !== blocks.length) throw new Error('目標位置重疊，請調整範圍。');
  const oldGroups = new Map(project.logicalStructures.map(g => [g.uid, g]));
  const newGroups = new Map(structures.map(g => [g.uid, g]));
  return {
    id, baseRevision: project.designRevision, cause, collisionPolicy: 'cancel',
    changes: [...new Set([...before.keys(), ...after.keys()])].flatMap(key => {
      const a = before.get(key) ?? null, b = after.get(key) ?? null;
      return stableJson(a) === stableJson(b) ? [] : [{ pos: (a ?? b)!.pos, before: a, after: b }];
    }),
    structures: [...new Set([...oldGroups.keys(), ...newGroups.keys()])].flatMap(uid => {
      const a = oldGroups.get(uid) ?? null, b = newGroups.get(uid) ?? null;
      return stableJson(a) === stableJson(b) ? [] : [{ uid, before: a, after: b }];
    }),
  };
}

export function createPlacement(pos: BlockPos, id: MinecraftId, requested: BlockState, transactionId: string): {
  blocks: BlockRecord[]; structures: LogicalStructure[];
} {
  const state = normalizeBlockState(id, requested);
  let kind: LogicalStructure['kind'] | undefined;
  if (id.endsWith('_door') && !id.endsWith('_trapdoor')) kind = 'door';
  else if (id.endsWith('_bed')) kind = 'bed';
  else if (state.half === 'lower' || state.half === 'upper') kind = 'tall_plant';
  const groupId = kind ? fresh() : undefined;
  const make = (p: BlockPos, s: BlockState): BlockRecord => ({
    uid: fresh(), id, pos: parsePosition(p), state: normalizeBlockState(id, s),
    source: { origin: 'user_created' },
    edits: { createdByTransactionId: transactionId, lastModifiedByTransactionId: transactionId, userModified: false },
    ...(groupId ? { logicalStructureId: groupId } : {}),
  });
  if (!kind) return { blocks: [make(pos, state)], structures: [] };
  const anchor = make(pos, { ...state, ...(kind === 'bed' ? { part: 'foot' } : { half: 'lower' }) });
  const direction = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[state.facing ?? 'north']!;
  const otherPos = kind === 'bed'
    ? { x: pos.x + direction[0]!, y: pos.y, z: pos.z + direction[1]! }
    : { ...pos, y: pos.y + 1 };
  const other = make(otherPos, { ...state, ...(kind === 'bed' ? { part: 'head' } : { half: 'upper' }) });
  return { blocks: [anchor, other], structures: [{ uid: groupId!, kind, anchorUid: anchor.uid, memberUids: [anchor.uid, other.uid] }] };
}

/** Logical pairs collide, replace, skip and remove as a unit. */
export function editAt(project: Project, action: EditorAction, pos: BlockPos, id: MinecraftId,
  state: BlockState = {}, collision: CollisionPolicy = 'cancel'): EditTransaction {
  parsePosition(pos);
  const at = project.blocks.find(b => coordinateKey(b.pos) === coordinateKey(pos));
  const removed = new Set<string>();
  if (action !== 'place') {
    if (!at) throw new Error('這個位置沒有可修改的方塊。');
    expandSelection(project, [at.uid]).forEach(b => removed.add(b.uid));
  }
  const transactionId = fresh();
  const incoming = action === 'remove' ? { blocks: [], structures: [] } : createPlacement(pos, id, state, transactionId);
  const targets = new Set(incoming.blocks.map(b => coordinateKey(b.pos)));
  const conflicts = project.blocks.filter(b => !removed.has(b.uid) && targets.has(coordinateKey(b.pos)));
  if (conflicts.length && collision === 'cancel') throw new Error('目標位置已有方塊；請選擇替換或其他位置。');
  if (conflicts.length && collision === 'skip') throw new Error('整個放置單元已略過，沒有變更。');
  if (conflicts.length) expandSelection(project, conflicts.map(b => b.uid)).forEach(b => removed.add(b.uid));
  return designDiff(project,
    [...project.blocks.filter(b => !removed.has(b.uid)), ...incoming.blocks],
    [...project.logicalStructures.filter(g => !g.memberUids.some(uid => removed.has(uid))), ...incoming.structures],
    'user', transactionId);
}

export function changeSelectedState(project: Project, uid: string, state: BlockState): EditTransaction {
  const block = project.blocks.find(b => b.uid === uid);
  if (!block) throw new Error('選取的方塊已不存在。');
  const members = expandSelection(project, [uid]);
  const changed = new Map(members.map(b => [b.uid, {
    ...b,
    state: normalizeBlockState(b.id, {
      ...state,
      ...(b.logicalStructureId && b.state.half ? { half: b.state.half } : {}),
      ...(b.logicalStructureId && b.state.part ? { part: b.state.part } : {}),
    }),
  }]));
  return designDiff(project, project.blocks.map(b => changed.get(b.uid) ?? b), project.logicalStructures);
}
