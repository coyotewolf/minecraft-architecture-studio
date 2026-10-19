import type { BlockRecord, CommandEngine, EditTransaction, LogicalStructure, PreflightResult, Project, StructureChange, VoxelChange } from './contracts.ts';
import { coordinateKey } from './coordinates.ts';
import { deepFreeze, MAX_TRANSACTION_CHANGES, object, parseBlock, parsePosition, parseProject, parseStructure, stableJson, text } from './model.ts';

function same(a: unknown, b: unknown): boolean { return stableJson(a) === stableJson(b); }
function parseTransaction(input: unknown): EditTransaction {
  const t = object(input, ['id', 'baseRevision', 'cause', 'collisionPolicy', 'changes', 'structures']);
  if (typeof t.cause !== 'string' || !['user', 'ai_approved', 'import', 'undo', 'redo'].includes(t.cause)) throw new Error('Unknown transaction cause');
  if (t.collisionPolicy !== 'cancel' && t.collisionPolicy !== 'replace' && t.collisionPolicy !== 'skip') throw new Error('Unknown collision policy');
  if (!Array.isArray(t.changes) || !Array.isArray(t.structures) || t.changes.length + t.structures.length > MAX_TRANSACTION_CHANGES) throw new Error('Invalid or oversized transaction');
  const changes = t.changes.map((value): VoxelChange => {
    const c = object(value, ['pos', 'before', 'after']);
    const pos = parsePosition(c.pos);
    const before = c.before === null ? null : parseBlock(c.before);
    const after = c.after === null ? null : parseBlock(c.after);
    if ((!before && !after) || same(before, after)) throw new Error('Empty change');
    for (const b of [before, after]) if (b && coordinateKey(b.pos) !== coordinateKey(pos)) throw new Error('Change position mismatch');
    return { pos, before, after };
  });
  const structures = t.structures.map((value): StructureChange => {
    const c = object(value, ['uid', 'before', 'after']);
    const uid = text(c.uid);
    const before = c.before === null ? null : parseStructure(c.before);
    const after = c.after === null ? null : parseStructure(c.after);
    if ((!before && !after) || same(before, after)) throw new Error('Empty structure change');
    for (const s of [before, after]) if (s && s.uid !== uid) throw new Error('Structure UID mismatch');
    return { uid, before, after };
  });
  if (new Set(changes.map(c => coordinateKey(c.pos))).size !== changes.length || new Set(structures.map(s => s.uid)).size !== structures.length) {
    throw new Error('Repeated transaction target');
  }
  return { id: text(t.id), baseRevision: text(t.baseRevision), cause: t.cause as EditTransaction['cause'], collisionPolicy: t.collisionPolicy, changes, structures };
}
interface Prepared { transaction: EditTransaction; project: Project }
export class VoxelEngine implements CommandEngine {
  #project: Project;
  #cells: Map<string, BlockRecord>;
  #uids: Map<string, BlockRecord>;
  #undo: EditTransaction[] = [];
  #redo: EditTransaction[] = [];
  #usedTransactions = new Set<string>();
  #usedRevisions: Set<string>;

  constructor(project: Project) {
    this.#project = parseProject(project);
    this.#cells = new Map(this.#project.blocks.map(b => [coordinateKey(b.pos), b]));
    this.#uids = new Map(this.#project.blocks.map(b => [b.uid, b]));
    this.#usedRevisions = new Set([this.#project.designRevision]);
  }
  snapshot(): Project { return this.#project; }
  getAt(pos: { x: number; y: number; z: number }): BlockRecord | null { return this.#cells.get(coordinateKey(pos)) ?? null; }
  getByUid(uid: string): BlockRecord | null { return this.#uids.get(uid) ?? null; }
  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }

  #prepare(input: EditTransaction): Prepared {
    const t = parseTransaction(input);
    if (t.baseRevision !== this.#project.designRevision) throw new Error('Stale base revision');
    if (this.#usedTransactions.has(t.id)) throw new Error('Transaction ID already committed');
    const cells = new Map(this.#cells);
    const groups = new Map<string, LogicalStructure>(this.#project.logicalStructures.map(s => [s.uid, s]));
    const accepted: VoxelChange[] = [];
    for (const c of t.changes) {
      const key = coordinateKey(c.pos);
      const current = cells.get(key) ?? null;
      let before = c.before;
      // Collision policy applies only to insertion into an occupied cell.
      // Explicit replacements/removals still require exact before-images.
      if (before === null && current !== null) {
        if (t.collisionPolicy === 'cancel') throw new Error('Occupied cell');
        if (t.collisionPolicy === 'skip') continue;
        before = current;
      } else if (!same(before, current)) throw new Error('Before-image conflict');
      let after = c.after;
      if (after && t.cause !== 'undo' && t.cause !== 'redo') {
        const prior = this.#uids.get(after.uid);
        if (prior && (prior.id !== after.id || !same(prior.source, after.source))) {
          throw new Error('Existing UID must preserve block identity and evidence');
        }
        if (t.cause !== 'import') after = { ...after, edits: {
          createdByTransactionId: prior?.edits.createdByTransactionId ?? t.id,
          lastModifiedByTransactionId: t.id,
          userModified: prior ? prior.edits.userModified || t.cause === 'user' : false,
        } };
      }
      if (same(before, after)) continue;
      accepted.push({ ...c, before, after });
      if (after) cells.set(key, after); else cells.delete(key);
    }
    for (const c of t.structures) {
      const current = groups.get(c.uid) ?? null;
      if (!same(c.before, current)) throw new Error('Structure before-image conflict');
      if (c.after) groups.set(c.uid, c.after); else groups.delete(c.uid);
    }
    if (!accepted.length && !t.structures.length) throw new Error('Transaction has no accepted changes');
    const project = parseProject({ ...this.#project, blocks: [...cells.values()], logicalStructures: [...groups.values()] });
    const transaction = deepFreeze({ ...t, changes: accepted });
    return { project, transaction };
  }
  preview(transaction: EditTransaction): PreflightResult {
    try {
      const prepared = this.#prepare(transaction);
      return deepFreeze({ ok: true, normalized: prepared.transaction, warnings: [] });
    } catch (error) {
      return deepFreeze({ ok: false, diagnostics: [{ code: 'INVALID_TRANSACTION', severity: 'ERROR', message: error instanceof Error ? error.message : 'Invalid transaction' }] });
    }
  }
  #publish(prepared: Prepared): Project {
    const revision = crypto.randomUUID();
    if (this.#usedRevisions.has(revision)) throw new Error('Revision collision');
    const next = deepFreeze({ ...prepared.project, designRevision: revision });
    const cells = new Map(next.blocks.map(b => [coordinateKey(b.pos), b]));
    const uids = new Map(next.blocks.map(b => [b.uid, b]));
    // Swap only after every allocation/validation above succeeds.
    this.#project = next; this.#cells = cells; this.#uids = uids;
    this.#usedRevisions.add(revision);
    this.#usedTransactions.add(prepared.transaction.id);
    return next;
  }
  commit(transaction: EditTransaction): Project {
    if (transaction.cause === 'undo' || transaction.cause === 'redo') throw new Error('Use undo/redo history methods');
    const prepared = this.#prepare(transaction);
    const result = this.#publish(prepared);
    this.#undo.push(prepared.transaction); this.#redo = [];
    return result;
  }
  undo(): Project {
    const original = this.#undo.at(-1);
    if (!original) throw new Error('Nothing to undo');
    const inverse: EditTransaction = {
      ...original, id: crypto.randomUUID(), baseRevision: this.#project.designRevision, cause: 'undo', collisionPolicy: 'cancel',
      changes: original.changes.map(c => ({ ...c, before: c.after, after: c.before })),
      structures: original.structures.map(c => ({ ...c, before: c.after, after: c.before })),
    };
    const result = this.#publish(this.#prepare(inverse));
    this.#undo.pop(); this.#redo.push(original);
    return result;
  }
  redo(): Project {
    const original = this.#redo.at(-1);
    if (!original) throw new Error('Nothing to redo');
    const replay: EditTransaction = { ...original, id: crypto.randomUUID(), baseRevision: this.#project.designRevision, cause: 'redo', collisionPolicy: 'cancel' };
    const result = this.#publish(this.#prepare(replay));
    this.#redo.pop(); this.#undo.push(original);
    return result;
  }
}
