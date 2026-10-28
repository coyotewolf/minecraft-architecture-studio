import type { BlockPos, BlockRecord, EditTransaction, Project } from '../../core/contracts.ts';
import { coordinateKey } from '../../core/coordinates.ts';
import { parsePosition } from '../../core/model.ts';
import { designDiff, expandSelection } from './commands.ts';

/** Resolve existing UIDs and include complete logical structures, without filling gaps. */
export function selectedBlocks(project: Project, uids: readonly string[]): BlockRecord[] {
  const existing = new Set(project.blocks.map(block => block.uid));
  return expandSelection(project, uids.filter(uid => existing.has(uid)));
}

/** One cancellable, reversible command for an arbitrary selection. */
export function selectionEdit(project: Project, uids: readonly string[], operation: 'remove' | 'move' | 'copy',
  offset: BlockPos = { x: 0, y: 0, z: 0 }): EditTransaction {
  parsePosition(offset);
  if (!['remove', 'move', 'copy'].includes(operation)) throw new Error('不支援的選取操作。');
  const selected = selectedBlocks(project, uids);
  if (!selected.length) throw new Error('請先選取可修改的方塊。');
  if (selected.length > 5000) throw new Error('單次選取最多 5,000 格。');
  if (operation !== 'remove' && offset.x === 0 && offset.y === 0 && offset.z === 0) {
    throw new Error('位移不能為零，沒有可套用的變更。');
  }
  const selectedUids = new Set(selected.map(block => block.uid));
  const groups = project.logicalStructures.filter(group => group.memberUids.some(uid => selectedUids.has(uid)));
  const remaining = project.blocks.filter(block => !selectedUids.has(block.uid));
  if (operation === 'remove') {
    return designDiff(project, remaining, project.logicalStructures.filter(group => !groups.includes(group)));
  }
  const id = crypto.randomUUID(), copy = operation === 'copy';
  const uidMap = new Map(selected.map(block => [block.uid, copy ? crypto.randomUUID() : block.uid]));
  const groupMap = new Map(groups.map(group => [group.uid, copy ? crypto.randomUUID() : group.uid]));
  const incoming = selected.map(block => ({
    ...block,
    uid: uidMap.get(block.uid)!,
    pos: parsePosition({ x: block.pos.x + offset.x, y: block.pos.y + offset.y, z: block.pos.z + offset.z }),
    ...(block.logicalStructureId ? { logicalStructureId: groupMap.get(block.logicalStructureId)! } : {}),
    edits: { createdByTransactionId: copy ? id : block.edits.createdByTransactionId,
      lastModifiedByTransactionId: id, userModified: !copy },
  }));
  const occupied = new Set((copy ? project.blocks : remaining).map(block => coordinateKey(block.pos)));
  if (incoming.some(block => occupied.has(coordinateKey(block.pos)))) {
    throw new Error('選取目標已有方塊；整個操作已取消。');
  }
  const copiedGroups = copy ? groups.map(group => ({ ...group, uid: groupMap.get(group.uid)!,
    anchorUid: uidMap.get(group.anchorUid)!, memberUids: group.memberUids.map(uid => uidMap.get(uid)!),
  })) : [];
  return designDiff(project, [...(copy ? project.blocks : remaining), ...incoming],
    [...project.logicalStructures, ...copiedGroups], 'user', id);
}
