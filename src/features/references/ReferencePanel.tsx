import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { FEATURED_REFERENCE_ID } from './metadata.ts';
import { emptyReferenceBoard, loadReferenceBoard, MAX_REFERENCE_IMAGES, parseReferenceManifest, saveReferenceBoard, validateReferenceBlob, type ReferenceBoard, type ReferenceImage } from './storage.ts';
export { REFERENCE_METADATA, FEATURED_REFERENCE_ID } from './metadata.ts';
export interface ReferencePanelProps { projectId: string; compact?: boolean; onSelectionChange?: (image: ReferenceImage | null) => void }
/** Key isolates in-flight local reads/writes when the active project changes. */
export function ReferencePanel(props: ReferencePanelProps): ReactElement { return <ReferenceBoardView key={props.projectId} {...props} />; }
function ReferenceBoardView({ projectId, compact = false, onSelectionChange }: ReferencePanelProps): ReactElement {
  const [board, setBoard] = useState(() => emptyReferenceBoard(projectId));
  const latest = useRef(board), queue = useRef(Promise.resolve()), alive = useRef(true);
  const [ready, setReady] = useState(false), [retry, setRetry] = useState(0);
  const [status, setStatus] = useState('讀取本機參考板…'), [error, setError] = useState('');
  const [seeds, setSeeds] = useState<readonly ReferenceImage[]>([]), [manifestState, setManifestState] = useState('正在讀取參考圖冊…');
  const [urls, setUrls] = useState<readonly { id: string; url: string }[]>([]);
  const [draft, setDraft] = useState(''), [broken, setBroken] = useState<string | null>(null);
  const panelId = useId();
  const noteTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pendingNote=useRef<{id:string;text:string}|null>(null);
  useEffect(()=>()=>{
    if(noteTimer.current)clearTimeout(noteTimer.current);
    const note=pendingNote.current;
    if(note){const next={...latest.current,notes:{...latest.current.notes,[note.id]:note.text}};queue.current=queue.current.catch(()=>{}).then(()=>saveReferenceBoard(next)).catch(()=>{});}
  },[]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let canceled = false; setReady(false); setError('');
    void loadReferenceBoard(projectId).then(value => { if (!canceled) { latest.current = value; setBoard(value); setReady(true); setStatus('本機參考板已載入'); } })
      .catch(reason => { if (!canceled) { setError('讀取失敗，既有圖片未被覆寫：' + String(reason)); setStatus('本機儲存暫時不可用'); } });
    return () => { canceled = true; };
  }, [projectId, retry]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/local-references/manifest.json', { signal: controller.signal }).then(async response => {
      if (response.status === 404) { if (!controller.signal.aborted) setManifestState('此裝置沒有內建參考圖冊，請從本機加入圖片。'); return; }
      if (!response.ok) throw new Error('參考清單讀取失敗');
      const text = await response.text(); if (text.length > 128 * 1024) throw new Error('參考清單過大');
      const images = parseReferenceManifest(JSON.parse(text));
      if (!controller.signal.aborted) { setSeeds(images); setManifestState(images.length ? `${images.length} 張本機概念參考` : '請從本機加入參考圖片。'); }
    }).catch(() => { if (!controller.signal.aborted) setManifestState('此裝置沒有可用的內建圖冊；仍可加入自己的參考圖片。'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const next = board.uploads.map(image => ({ id: image.id, url: URL.createObjectURL(image.blob) })); setUrls(next);
    return () => { for (const image of next) URL.revokeObjectURL(image.url); };
  }, [board.uploads]);
  const images = useMemo(() => [...seeds, ...board.uploads.flatMap(image => {
    const url = urls.find(entry => entry.id === image.id)?.url;
    return url ? [{ id: image.id, name: image.name, title: image.name, url, notes: '使用者提供的參考圖片。精確尺寸與拍攝條件尚未確認；模型 XYZ 仍屬設計推估。' }] : [];
  })], [seeds, board.uploads, urls]);
  const selected = images.find(image => image.id === board.selectedId) ?? images.find(image => image.id === FEATURED_REFERENCE_ID) ?? images[0];
  useEffect(() => { onSelectionChange?.(selected ?? null); }, [selected, onSelectionChange]);
  useEffect(() => () => { onSelectionChange?.(null); }, [onSelectionChange]);
  useEffect(() => { setDraft(selected ? board.notes[selected.id] ?? '' : ''); setBroken(null); }, [selected?.id, board.notes]);
  function update(next: ReferenceBoard) {
    if (!ready) return;
    latest.current = next; setBoard(next); setStatus('正在儲存至此瀏覽器…'); setError('');
    queue.current = queue.current.catch(() => {}).then(() => saveReferenceBoard(next)).then(() => {
      if (alive.current && latest.current === next) setStatus('已保存在此瀏覽器');
    }).catch(reason => { if (alive.current && latest.current === next) { setError('圖片或筆記儲存失敗：' + String(reason)); setStatus('尚未儲存，請重試'); } });
  }
  function saveNote() {
    if(noteTimer.current)clearTimeout(noteTimer.current);noteTimer.current=null;
    const note=pendingNote.current;pendingNote.current=null;
    if(note)update({...latest.current,notes:{...latest.current.notes,[note.id]:note.text}});
  }
  function changeNote(value:string){
    setDraft(value);if(!selected)return;pendingNote.current={id:selected.id,text:value};
    if(noteTimer.current)clearTimeout(noteTimer.current);noteTimer.current=setTimeout(saveNote,400);
  }
  function select(id: string) { saveNote(); update({ ...latest.current, selectedId: id }); }
  function upload(files: FileList | null) {
    if (!files?.length || !ready) return;
    try {
      if (files.length + latest.current.uploads.length > MAX_REFERENCE_IMAGES) throw new Error('每個專案最多保留 11 張自行上傳的參考圖片');
      const added = [...files].map(file => ({ id: 'upload:' + crypto.randomUUID(), name: file.name, blob: validateReferenceBlob(file) }));
      saveNote(); update({ ...latest.current, uploads: [...latest.current.uploads, ...added], selectedId: added[0]!.id });
    } catch (reason) { setError(String(reason)); }
  }
  function remove() {
    if (!selected?.id.startsWith('upload:') || !window.confirm('從此專案的本機參考板移除此圖片與筆記？')) return;
    const next = latest.current, notes = { ...next.notes }; delete notes[selected.id];
    update({ ...next, uploads: next.uploads.filter(image => image.id !== selected.id), notes, selectedId: seeds.find(image => image.id === FEATURED_REFERENCE_ID)?.id ?? seeds[0]?.id ?? null });
  }
  return <section className={`reference-panel${compact ? ' reference-panel--compact' : ''}`} aria-label="建築參考圖冊">
    <header className="reference-panel__header"><div><p className="reference-panel__eyebrow">REFERENCE LIBRARY</p><h2>建築參考圖冊</h2></div><span className="reference-panel__count">{images.length.toString().padStart(2, '0')} 張</span></header>
    <p className="reference-panel__local">僅保存在此裝置 · 不會傳送給 AI 或雲端</p>
    {error && <p className="reference-panel__error" role="alert">{error}</p>}
    {selected ? <>
      <div id={`${panelId}-view`} role="tabpanel" aria-labelledby={`${panelId}-${selected.id}`} className="reference-panel__viewer">
        {broken === selected.id ? <div className="reference-panel__empty">此圖片無法顯示，請重新加入有效圖片。</div> : <img className="reference-panel__image" src={selected.url} alt={selected.title} onError={() => setBroken(selected.id)} />}
        <div className="reference-panel__caption"><span>{selected.id.startsWith('upload:') ? '使用者參考' : '概念設計參考'}</span><h3>{selected.title}</h3><p>非實測 · 尺寸待確認</p></div>
      </div>
      <div className="reference-panel__gallery" role="tablist" aria-label="參考圖片">{images.map((image, index) => <button type="button" role="tab" id={`${panelId}-${image.id}`} key={image.id} aria-selected={selected.id === image.id} aria-controls={`${panelId}-view`} tabIndex={selected.id===image.id?0:-1} onKeyDown={event=>{const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!offset&&event.key!=='Home'&&event.key!=='End')return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?images.length-1:(index+offset+images.length)%images.length;const target=images[next]!;select(target.id);document.getElementById(`${panelId}-${target.id}`)?.focus();}} disabled={!ready} onClick={() => select(image.id)} title={image.name}>
        <img src={image.url} alt="" loading="lazy" /><span className="reference-panel__index">{String(index + 1).padStart(2, '0')}</span><span>{image.title}</span>
      </button>)}</div>
      <div className="reference-panel__analysis"><div className="reference-panel__observed"><span className="reference-panel__tag">圖像參考 · 待人工核對</span><p>{selected.notes}</p></div>
        <div className="reference-panel__estimated"><span className="reference-panel__tag">AI／設計推估 · 非已知事實</span><p>不可由概念圖確定尺寸、背面與內部配置。所有 XYZ、樓層格數及建造機制都需要另行設計與驗證。</p></div>
        {!compact && <label className="reference-panel__notes">這張圖片的分析筆記<textarea aria-label="參考圖片分析筆記" value={draft} maxLength={4096} disabled={!ready} placeholder="記錄看見的特徵，並將推估、待驗證的項目分開註明…" onChange={event => changeNote(event.target.value)} onBlur={saveNote} /><span>{draft.length} / 4096</span></label>}
      </div>
    </> : <div className="reference-panel__empty"><span>＋</span><h3>把靈感放進工作台</h3><p>{manifestState}</p><p>可一次加入多張 PNG、JPEG 或 WebP 圖片。</p></div>}
    <footer className="reference-panel__footer"><label className="reference-panel__upload">加入參考圖片<input type="file" aria-label="加入本機參考圖片" accept="image/png,image/jpeg,image/webp" multiple disabled={!ready} onChange={event => { upload(event.target.files); event.target.value = ''; }} /></label>
      {selected && !compact && <button type="button" disabled={!ready} onClick={saveNote}>儲存筆記</button>}
      {selected?.id.startsWith('upload:') && <button type="button" disabled={!ready} onClick={remove}>移除此圖片</button>}
      {!ready && <button type="button" onClick={() => setRetry(value => value + 1)}>重試本機儲存</button>}
      {ready && error && <button type="button" onClick={() => update(latest.current)}>重試儲存</button>}
      <p>自行加入 {board.uploads.length} / 11 張 · 每張最多 4 MiB</p><p className="reference-panel__status" role="status">{status}</p>
      <p className="reference-panel__backup-note">圖片與筆記存於獨立的本機參考板，目前不包含在模型／專案備份中；請保留原始圖片檔案。</p>
    </footer>
  </section>;
}

