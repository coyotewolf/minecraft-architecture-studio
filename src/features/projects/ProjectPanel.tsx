import { useState, type ReactElement } from 'react';
import type { Project } from '../../core/contracts.ts';
import { exportProject, importProject, MAX_IMPORT_BYTES } from '../../core/model.ts';
import { inventory } from '../build/model.ts';
import { csvToModel, modelToCsv } from './exports.ts';
import { createWorkspace, deleteWorkspace, deserializeWorkspace, listWorkspaces, loadWorkspace, MAX_WORKSPACE_BYTES, parseWorkspace, serializeWorkspace, type WorkspaceRecord } from './storage.ts';

export interface ProjectPanelProps { workspace: WorkspaceRecord; status: string; onChange: (workspace: WorkspaceRecord, action?: 'open'|'metadata'|'restore') => void; onSave: () => void }
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
export function ProjectPanel(props: ProjectPanelProps): ReactElement {
  const [saved, setSaved] = useState<WorkspaceRecord[]>([]);
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const w = props.workspace;
  function run(action: () => void) { setError(''); setNotice(''); try { action(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } }
  async function refresh() {
    setBusy(true); setError('');
    try { setSaved(await listWorkspaces()); setListed(true); } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  function change(next: WorkspaceRecord, label: string, action:'open'|'metadata'|'restore'='metadata') {
    const at = new Date().toISOString();
    props.onChange(parseWorkspace({ ...next, updatedAt: at,
      revisionLog: [...next.revisionLog, { id: crypto.randomUUID(), label, at }].slice(-500) }),action);
    setNotice(label + '；請確認儲存狀態。');
  }
  async function open(id: string) {
    if (!window.confirm('開啟此專案將取代目前工作區；未儲存的修改將遺失。繼續？')) return;
    setBusy(true); setError('');
    try { const record = await loadWorkspace(id); if (!record) throw new Error('專案已不存在，請重新整理清單'); props.onChange(record); setNotice('已開啟儲存的專案。'); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm('確定刪除此瀏覽器中儲存的專案？此動作無法復原，請先下載備份。')) return;
    setBusy(true); setError('');
    try { await deleteWorkspace(id); setSaved(await listWorkspaces()); setListed(true); setNotice('已刪除儲存記錄；目前開啟的工作區仍保留在畫面上。'); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  function duplicate() {
    const id = crypto.randomUUID();
    const title = w.project.title + '（副本）';
    const clone = (p: Project): Project => ({ ...p, id, title });
    change({ ...w, project: clone(w.project), original: clone(w.original), approvedDesign: clone(w.approvedDesign),
      milestones: w.milestones.map(m => ({ ...m, project: clone(m.project) })) }, '建立專案副本','open');
  }
  function restore(project: Project, label: string) {
    if (window.confirm('還原將取代目前設計，並保留施工核對基準。未儲存修改可能遺失，確定繼續？')) change({ ...w, project }, label,'restore');
  }
  async function importFile(file: File, format: 'workspace' | 'model' | 'csv') {
    setBusy(true); setError(''); setNotice('');
    try {
      const limit = format === 'workspace' ? MAX_WORKSPACE_BYTES : MAX_IMPORT_BYTES;
      if (file.size > limit) throw new Error(`檔案超過 ${limit / 1024 / 1024} MiB 上限`);
      const text = await file.text();
      const next = format === 'workspace' ? deserializeWorkspace(text) : createWorkspace(format === 'model' ? importProject(text) : csvToModel(text));
      if (window.confirm('匯入內容已通過驗證。取代目前工作區？未儲存修改將遺失。')) { props.onChange(next); setNotice('匯入完成；請儲存專案。'); }
    } catch (reason) { setError('匯入失敗：' + String(reason)); } finally { setBusy(false); }
  }
  function materials(format: 'json' | 'csv') {
    const summary = inventory(w.project);
    if (format === 'json') download(JSON.stringify(summary, null, 2), 'materials.json', 'application/json');
    else {
      const rows = [['itemId', 'required', 'maxStack', 'fullStacks', 'remainder'],
        ...summary.items.map(i => [i.itemId, i.required, i.maxStack, i.fullStacks, i.remainder]),
        ['occupiedCells', summary.occupiedCells, '', '', ''], ['totalInventoryItems', summary.totalInventoryItems ?? 'unresolved', '', '', ''],
        ['unresolvedCells', summary.unresolved.reduce((n, r) => n + r.blockUids.length, 0), '', '', '']];
      download(rows.map(r => r.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n'), 'materials.csv', 'text/csv;charset=utf-8');
    }
  }
  return <section aria-label="專案與備份" className="project-panel">
    <h2>專案與備份</h2><p role="status">{props.status}</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form key={w.project.id + ':' + w.project.title} onSubmit={event => { event.preventDefault(); const title = String(new FormData(event.currentTarget).get('title') ?? ''); run(() => change({ ...w, project: { ...w.project, title } }, '重新命名專案')); }}>
      <label>專案名稱 <input name="title" aria-label="專案名稱" defaultValue={w.project.title} maxLength={512} /></label><button type="submit" disabled={busy}>重新命名</button>
    </form>
    <button type="button" disabled={busy} onClick={() => run(props.onSave)}>立即儲存</button>
    <button type="button" disabled={busy} onClick={() => run(duplicate)}>建立副本</button>
    <button type="button" disabled={busy} onClick={() => void refresh()}>重新整理已儲存專案</button>
    {!listed ? <p>按「重新整理已儲存專案」讀取此瀏覽器的實際記錄。</p> : saved.length === 0 ? <p>此瀏覽器尚無儲存專案。</p> : <ul>{saved.map(record => <li key={record.project.id}>
      {record.project.title || '未命名專案'} · {record.updatedAt}<button type="button" disabled={busy} onClick={() => void open(record.project.id)}>開啟</button>
      <button type="button" disabled={busy || record.project.id === w.project.id} title={record.project.id === w.project.id ? '請先開啟其他專案，避免自動儲存重建目前記錄' : undefined} onClick={() => void remove(record.project.id)}>刪除</button>
    </li>)}</ul>}
    <h3>版本快照（{w.milestones.length} / 10）</h3>
    <button type="button" disabled={busy || w.milestones.length >= 10} onClick={() => run(() => change({ ...w, milestones: [...w.milestones,
      { id: crypto.randomUUID(), title: `快照 ${w.milestones.length + 1}`, createdAt: new Date().toISOString(), project: w.project }] }, '保存版本快照'))}>保存版本快照</button>
    <button type="button" disabled={busy} onClick={() => run(() => restore(w.original, '還原原始設計'))}>還原原始設計</button>
    <ul>{w.milestones.map(m => <li key={m.id}>{m.title} · {m.createdAt}<button type="button" disabled={busy} onClick={() => run(() => restore(m.project, '還原' + m.title))}>還原</button></li>)}</ul>
    <h3>下載與匯入</h3><p>完整備份包含原始設計、版本快照、材料與施工進度。模型 JSON／CSV 僅包含設計，匯入後建立新的工作區狀態。</p>
    <button type="button" onClick={() => run(() => download(serializeWorkspace(w), 'workspace.json', 'application/json'))}>下載完整備份</button>
    <button type="button" onClick={() => run(() => download(exportProject(w.project), 'model.json', 'application/json'))}>下載模型 JSON</button>
    <button type="button" onClick={() => run(() => download(modelToCsv(w.project), 'model.csv', 'text/csv;charset=utf-8'))}>下載完整 XYZ CSV</button>
    <button type="button" onClick={() => run(() => materials('json'))}>下載材料 JSON</button>
    <button type="button" onClick={() => run(() => materials('csv'))}>下載材料 CSV</button>
    {(['workspace', 'model', 'csv'] as const).map(format => <label key={format} style={{ display: 'block' }}>
      {format === 'workspace' ? '匯入完整備份' : format === 'model' ? '匯入模型 JSON' : '匯入完整 XYZ CSV'}
      <input type="file" disabled={busy} accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file, format); }} />
    </label>)}
  </section>;
}
