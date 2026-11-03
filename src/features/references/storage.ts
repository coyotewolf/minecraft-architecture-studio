export const MAX_REFERENCE_IMAGES = 11;
export const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
export const REFERENCE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export interface ReferenceImage { readonly id: string; readonly url: string; readonly name: string; readonly title: string; readonly notes: string }
export interface UploadedReference { readonly id: string; readonly name: string; readonly blob: Blob }
export interface ReferenceBoard { readonly schemaVersion: 1; readonly projectId: string; readonly uploads: readonly UploadedReference[]; readonly selectedId: string | null; readonly notes: Readonly<Record<string, string>> }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('參考資料格式無效');
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('參考資料包含未知欄位');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit = 512): string { if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('參考名稱或識別碼無效'); return value; }
export function validateReferenceBlob(blob: unknown): Blob {
  if (!(blob instanceof Blob) || !REFERENCE_MIME_TYPES.includes(blob.type as typeof REFERENCE_MIME_TYPES[number]) || blob.size < 1 || blob.size > MAX_REFERENCE_BYTES) throw new Error('請使用 PNG、JPEG 或 WebP，每張最多 4 MiB');
  return blob;
}
export function parseReferenceManifest(input: unknown): readonly ReferenceImage[] {
  const manifest = object(input, ['images']);
  if (!Array.isArray(manifest.images) || manifest.images.length > MAX_REFERENCE_IMAGES) throw new Error('參考清單最多 11 張圖片');
  const ids = new Set<string>();
  return manifest.images.map(value => {
    const image = object(value, ['id', 'url', 'name', 'title', 'notes']);
    const id = text(image.id), url = text(image.url, 2048);
    if (ids.has(id)) throw new Error('參考圖片識別碼重複'); ids.add(id);
    if (!url.startsWith('/local-references/') || url.includes('..') || url.includes('\\')) throw new Error('參考圖片必須來自本機參考目錄');
    if (typeof image.notes !== 'string' || image.notes.length > 4096) throw new Error('參考說明過長');
    return { id, url, name: text(image.name), title: text(image.title), notes: image.notes };
  });
}
export function emptyReferenceBoard(projectId: string): ReferenceBoard { return { schemaVersion: 1, projectId: text(projectId), uploads: [], selectedId: null, notes: {} }; }
export function parseReferenceBoard(input: unknown): ReferenceBoard {
  const b = object(input, ['schemaVersion', 'projectId', 'uploads', 'selectedId', 'notes']);
  if (b.schemaVersion !== 1 || !Array.isArray(b.uploads) || b.uploads.length > MAX_REFERENCE_IMAGES) throw new Error('參考板版本或圖片數量無效');
  const ids = new Set<string>();
  const uploads = b.uploads.map(value => {
    const u = object(value, ['id', 'name', 'blob']); const id = text(u.id);
    if (!id.startsWith('upload:') || ids.has(id)) throw new Error('上傳圖片識別碼無效或重複'); ids.add(id);
    return { id, name: text(u.name), blob: validateReferenceBlob(u.blob) };
  });
  const rawNotes = object(b.notes, Object.keys(b.notes && typeof b.notes === 'object' ? b.notes : {}));
  if (Object.keys(rawNotes).length > MAX_REFERENCE_IMAGES * 2) throw new Error('參考筆記數量過多');
  const notes: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [id, value] of Object.entries(rawNotes)) {
    text(id); if (typeof value !== 'string' || value.length > 4096) throw new Error('每張圖片的筆記最多 4096 字'); notes[id] = value;
  }
  const selectedId = b.selectedId === null ? null : text(b.selectedId);
  return { schemaVersion: 1, projectId: text(b.projectId), uploads, selectedId, notes };
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('此瀏覽器無法使用本機圖片儲存')); return; }
    const request = indexedDB.open('minecraft-architecture-studio-references', 1); let rejected = false;
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('boards')) request.result.createObjectStore('boards', { keyPath: 'projectId' }); };
    request.onblocked = () => { rejected = true; reject(new Error('圖片儲存被其他分頁阻擋，請關閉其他分頁後重試')); };
    request.onerror = () => reject(request.error ?? new Error('無法開啟本機圖片儲存'));
    request.onsuccess = () => { const db = request.result; if (rejected) db.close(); else { db.onversionchange = () => db.close(); resolve(db); } };
  });
}
async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('boards', mode); let result: T; let failure: DOMException | null = null;
      tx.oncomplete = () => resolve(result); tx.onabort = () => reject(failure ?? tx.error ?? new Error('圖片儲存已中止'));
      tx.onerror = () => { failure = tx.error; };
      try { const request = operation(tx.objectStore('boards')); request.onsuccess = () => { result = request.result; }; request.onerror = () => { failure = request.error; }; }
      catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}
export async function loadReferenceBoard(projectId: string): Promise<ReferenceBoard> {
  const key = text(projectId); const value: unknown = await transact('readonly', store => store.get(key));
  if (value === undefined) return emptyReferenceBoard(key);
  const board = parseReferenceBoard(value); if (board.projectId !== key) throw new Error('參考板專案不符'); return board;
}
export async function saveReferenceBoard(board: ReferenceBoard): Promise<void> { const valid = parseReferenceBoard(board); await transact('readwrite', store => store.put(valid)); }
