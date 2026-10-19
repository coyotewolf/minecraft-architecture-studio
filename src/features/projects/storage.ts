import { parseTransaction } from '../../core/engine.ts';
import type { EditTransaction, Project } from '../../core/contracts.ts';
import { MAX_COORDINATE } from '../../core/coordinates.ts';
import { deepFreeze, object, parseProject, stableJson, text } from '../../core/model.ts';
import { itemStackSize } from '../../core/versioned-registry.ts';

export interface WorkspaceRecord {
  readonly schemaVersion: 1;
  readonly project: Project;
  readonly original: Project;
  readonly originalAi?:boolean;
  readonly approvedDesign: Project;
  readonly milestones: readonly { readonly id: string; readonly title: string; readonly createdAt: string; readonly project: Project }[];
  readonly prepared: Readonly<Record<string, number>>;
  readonly completed: readonly string[];
  readonly view: { readonly layer: number; readonly mode: 'all' | 'layer' | 'through' | 'ghost'; readonly progress: number };
  readonly updatedAt: string;
  readonly revisionLog: readonly { readonly id: string; readonly label: string; readonly at: string; readonly detail?:string; readonly transaction?:EditTransaction }[];
}

export const MAX_WORKSPACE_BYTES = 128 * 1024 * 1024;
export const MAX_SNAPSHOT_BLOCKS = 250_000;
function identifier(value: unknown): string {
  const id = text(value);
  if (!/^[A-Za-z0-9_:.,-]+$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Unsafe identifier');
  return id;
}
function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) {
    throw new Error('Expected valid ISO UTC timestamp');
  }
  return result;
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid or oversized array');
  return value;
}
function unique(ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate identifier');
}

/** Detached validated records are the only values allowed across backup/storage boundaries. */
export function parseWorkspace(input: unknown): WorkspaceRecord {
  const w = object(input, ['schemaVersion', 'project', 'original','originalAi', 'approvedDesign', 'milestones', 'prepared', 'completed', 'view', 'updatedAt', 'revisionLog']);
  if (w.schemaVersion !== 1) throw new Error('Unsupported workspace schema version');
  const rawMilestones = array(w.milestones, 10).map(value => object(value, ['id', 'title', 'createdAt', 'project']));
  // Count raw snapshots before constructing any normalized copies.
  const rawProjects = [w.project, w.original, w.approvedDesign, ...rawMilestones.map(m => m.project)];
  let blocks = 0;
  for (const raw of rawProjects) {
    if (!raw || typeof raw !== 'object' || !('blocks' in raw) || !Array.isArray(raw.blocks)) throw new Error('Invalid snapshot');
    blocks += raw.blocks.length;
    if (blocks > MAX_SNAPSHOT_BLOCKS) throw new Error('Workspace snapshot block limit exceeded');
  }
  function snapshot(raw: unknown): Project {
    const p = parseProject(raw);
    identifier(p.id); identifier(p.designRevision);
    for (const b of p.blocks) {
      identifier(b.uid); identifier(b.edits.createdByTransactionId); identifier(b.edits.lastModifiedByTransactionId);
      for (const id of [b.componentId, b.logicalStructureId, b.constructionPhaseId, b.source.referenceRegionId]) if (id !== undefined) identifier(id);
    }
    for (const s of p.logicalStructures) identifier(s.uid);
    return p;
  }
  const project = snapshot(w.project), original = snapshot(w.original), approvedDesign = snapshot(w.approvedDesign);
  const milestones = rawMilestones.map(m => ({ id: identifier(m.id), title: text(m.title), createdAt: date(m.createdAt), project: snapshot(m.project) }));
  unique(milestones.map(m => m.id));
  if ([original, approvedDesign, ...milestones.map(m => m.project)].some(p => p.id !== project.id)) throw new Error('Snapshot project ID mismatch');
  const preparedInput = object(w.prepared, Object.keys(w.prepared && typeof w.prepared === 'object' ? w.prepared : {}));
  const prepared: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [id, quantity] of Object.entries(preparedInput)) {
    itemStackSize(id);
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Invalid prepared quantity');
    prepared[id] = quantity;
  }
  const completed = array(w.completed, 50_000).map(identifier);
  unique(completed);
  const approvedUids = new Set(approvedDesign.blocks.map(b => b.uid));
  if (completed.some(uid => !approvedUids.has(uid))) throw new Error('Completed UID is not in approved design');
  const view = object(w.view, ['layer', 'mode', 'progress']);
  if (typeof view.layer !== 'number' || !Number.isSafeInteger(view.layer) || Math.abs(view.layer) > MAX_COORDINATE) throw new Error('Invalid view layer');
  if (view.mode !== 'all' && view.mode !== 'layer' && view.mode !== 'through' && view.mode !== 'ghost') throw new Error('Invalid view mode');
  if (typeof view.progress !== 'number' || !Number.isFinite(view.progress) || view.progress < 0 || view.progress > 100) throw new Error('Invalid view progress');
  let logCells=0;
  const revisionLog = array(w.revisionLog, 500).map(value => {
    const r = object(value, ['id', 'label', 'at','detail','transaction']);
    if(r.detail!==undefined&&(typeof r.detail!=='string'||r.detail.length>8192))throw new Error('Invalid audit detail');
    const transaction=r.transaction===undefined?undefined:parseTransaction(r.transaction);
    logCells+=transaction?.changes.length??0;if(logCells>100000)throw new Error('History cell limit exceeded');
    return { id: identifier(r.id), label: text(r.label), at: date(r.at),...(r.detail===undefined?{}:{detail:r.detail as string}),...(transaction?{transaction}:{}) };
  });
  unique(revisionLog.map(r => r.id));
  if(w.originalAi!==undefined&&typeof w.originalAi!=='boolean')throw new Error('Invalid original AI marker');
  const originalAi=w.originalAi??revisionLog.some(r=>r.transaction?.cause==='ai_approved');
  return deepFreeze({ schemaVersion: 1, project, original, originalAi, approvedDesign, milestones, prepared, completed,
    view: { layer: view.layer, mode: view.mode, progress: view.progress }, updatedAt: date(w.updatedAt), revisionLog });
}

export function createWorkspace(project: Project): WorkspaceRecord {
  return parseWorkspace({ schemaVersion: 1, project, original: project, approvedDesign: project, milestones: [], prepared: {}, completed: [],
    view: { layer: 0, mode: 'all', progress: 0 }, updatedAt: new Date().toISOString(), revisionLog: [] });
}
function checkTextSize(value: string): void {
  if (value.length > MAX_WORKSPACE_BYTES || new TextEncoder().encode(value).length > MAX_WORKSPACE_BYTES) throw new Error('Workspace backup exceeds 128 MiB limit');
}
export function serializeWorkspace(record: WorkspaceRecord): string {
  const json = stableJson(parseWorkspace(record));
  checkTextSize(json);
  return json;
}
export function deserializeWorkspace(value: string): WorkspaceRecord {
  if (typeof value !== 'string') throw new Error('Expected JSON text');
  checkTextSize(value);
  return parseWorkspace(JSON.parse(value) as unknown);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable')); return; }
    const request = indexedDB.open('minecraft-architecture-studio', 1);
    let rejected = false;
    request.onblocked = () => { rejected = true; reject(new Error('IndexedDB upgrade is blocked; close other app tabs')); };
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'project.id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (rejected) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
/** Request success alone does not establish durability: resolve only on transaction completion. */
async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('projects', mode);
      let result: T;
      let failure: DOMException | null = null;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.onerror = () => { failure = tx.error; };
      try {
        const request = run(tx.objectStore('projects'));
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => { failure = request.error; };
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally { db.close(); }
}
export async function saveWorkspace(record: WorkspaceRecord): Promise<void> {
  const valid = parseWorkspace(record);
  await transact('readwrite', store => store.put(valid));
}
export async function loadWorkspace(id: string): Promise<WorkspaceRecord | undefined> {
  const key = identifier(id);
  const value: unknown = await transact('readonly', store => store.get(key));
  return value === undefined ? undefined : parseWorkspace(value);
}
export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  const values: unknown[] = await transact('readonly', store => store.getAll());
  return values.map(parseWorkspace).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.project.id.localeCompare(b.project.id));
}
export async function deleteWorkspace(id: string): Promise<void> {
  const key = identifier(id);
  await transact('readwrite', store => store.delete(key));
}
