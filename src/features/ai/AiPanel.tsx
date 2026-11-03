import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { BlockPos, Project } from '../../core/contracts.ts';
import { MAX_COORDINATE } from '../../core/coordinates.ts';
import './ai.css';

interface Props { project: Project; onProposal: (raw: unknown, scope: { min: BlockPos; max: BlockPos }, audit: string) => void }
type Kind = 'analyze' | 'generate' | 'edit';
type Dimensions = { x: number; y: number; z: number };
interface Capabilities { enabled: boolean; reason: string; model: string }
interface Analysis { summary: string; dimensions: Dimensions; uncertainties: string[] }
function dimensions(value: unknown): Dimensions {
  if (!value || typeof value !== 'object') throw new Error('服務未回傳有效的尺寸建議');
  const d = value as Record<string, unknown>;
  const result = { x: d.x, y: d.y, z: d.z };
  for (const n of Object.values(result)) if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > 256) throw new Error('建議尺寸必須介於 1 至 256 格');
  return result as Dimensions;
}
function readImage(file: File): Promise<{ name: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result !== 'string') reject(new Error('圖片讀取失敗')); else resolve({ name: file.name, mime: file.type, dataUrl: reader.result }); };
    reader.onerror = () => reject(new Error('圖片讀取失敗：' + file.name));
    reader.readAsDataURL(file);
  });
}
export function AiPanel(props: Props): ReactElement {
  const [capability, setCapability] = useState<Capabilities>({ enabled: false, reason: '正在確認服務狀態…', model: '' });
  const [kind, setKind] = useState<Kind>('analyze');
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [thumbnails, setThumbnails] = useState<{ name: string; url: string }[]>([]);
  const [size, setSize] = useState<Dimensions>({ x: 16, y: 16, z: 16 });
  const [scope, setScope] = useState({ min: { x: 0, y: 0, z: 0 }, max: { x: 15, y: 15, z: 15 } });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { setCapability({ enabled: false, reason: 'AI 服務狀態查詢逾時；手動編輯仍可使用。', model: '' }); controller.abort(); }, 10_000);
    void fetch('/api/ai/capabilities', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('無法取得 AI 服務狀態');
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object') throw new Error('服務狀態格式錯誤');
      const c = value as Record<string, unknown>;
      if (typeof c.enabled !== 'boolean' || typeof c.reason !== 'string' || typeof c.model !== 'string') throw new Error('服務狀態格式錯誤');
      if (!controller.signal.aborted) setCapability({ enabled: c.enabled, reason: c.reason.slice(0, 2_000), model: c.model.slice(0, 200) });
    }).catch(() => { if (!controller.signal.aborted) setCapability({ enabled: false, reason: 'AI 服務無法連線；手動編輯仍可使用。', model: '' }); })
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); active.current?.abort(); };
  }, []);
  useEffect(() => {
    const previews = files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    setThumbnails(previews);
    return () => { for (const preview of previews) URL.revokeObjectURL(preview.url); };
  }, [files]);
  function upload(list: FileList | null) {
    setError('');
    if (!list) return;
    const next = [...list];
    if (next.length < 1 || next.length > 4 || next.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || file.size === 0)) {
      setError('請選取 1 至 4 張 PNG、JPEG 或 WebP 圖片，每張不得超過 2 MiB。'); return;
    }
    setFiles(next); setConsent(false); setAnalysis(null);
  }
  async function submit() {
    setError(''); setNotice('');
    if (!capability.enabled || !consent || busy) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      if (!prompt.trim()) throw new Error('請輸入分析或修改需求');
      dimensions(size);
      let volume = 1;
      for (const axis of ['x', 'y', 'z'] as const) {
        const min = scope.min[axis], max = scope.max[axis];
        if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || Math.abs(min) > MAX_COORDINATE || Math.abs(max) > MAX_COORDINATE || min > max) throw new Error('範圍座標必須是有效整數，且最小值不得大於最大值');
        volume *= max - min + 1;
      }
      if (volume > 10_000) throw new Error('提案範圍不得超過 10,000 格');
      active.current = controller; setBusy(true);
      timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
      const images = await Promise.all(files.map(readImage));
      if (controller.signal.aborted) throw new Error('已取消請求');
      const response = await fetch('/api/ai/propose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ kind, project: props.project, scope, prompt, images, dimensions: size, consent: true }) });
      if (!response.ok) throw new Error(`AI 服務未完成請求（HTTP ${response.status}）`);
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('kind' in result)) throw new Error('服務回應格式錯誤');
      if (result.kind === 'analysis') {
        const a = result as Record<string, unknown>;
        if (typeof a.summary !== 'string' || a.summary.length > 4096 || !Array.isArray(a.uncertainties) || a.uncertainties.length > 100 || a.uncertainties.some(v => typeof v !== 'string' || v.length > 4096)) throw new Error('分析回應格式或大小不符');
        const suggested = dimensions(a.dimensions);
        setAnalysis({ summary: a.summary, dimensions: suggested, uncertainties: a.uncertainties as string[] });
        setSize(suggested); setNotice('已收到估計分析；請自行核對並調整尺寸。');
      } else if (result.kind === 'proposal') {
        const audit = `${new Date().toISOString()} | ${kind} | ${capability.model} | ${JSON.stringify(scope)} | ${prompt}`;
        props.onProposal(result, scope, audit); setNotice('提案已送交驗證與差異預覽，尚未套用。');
      } else throw new Error('不支援的 AI 回應類型');
    } catch (reason) {
      setError(controller.signal.aborted ? timedOut ? '請求超過 60 秒，已停止等待。服務端可能仍在處理或計費。' : '已取消等待；服務端可能仍在處理或計費。' : String(reason));
    } finally { if (timeout) clearTimeout(timeout); active.current = null; setBusy(false); }
  }
  return <section className="ai-panel" aria-label="AI 圖片與編輯提案">
    <h2>AI 圖片與編輯提案</h2>
    <p role="status">{capability.enabled ? `服務已設定：${capability.model}。${capability.reason}` : capability.reason}</p>
    <p>圖片分析與尺寸屬估計，無法確認照片未顯示的背面、內部或真實尺度。所有方塊提案必須經驗證、預覽與確認後才能套用。</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <fieldset disabled={busy}><legend>準備輸入（尚未傳送）</legend>
      <label>操作 <select value={kind} onChange={event => { setKind(event.target.value as Kind); setConsent(false); }}><option value="analyze">分析圖片</option><option value="generate">產生設計提案</option><option value="edit">編輯設計提案</option></select></label>
      <label>需求 <textarea value={prompt} maxLength={4_000} onChange={event => { setPrompt(event.target.value); setConsent(false); }} /></label>
      <label>參考圖片（1–4 張，每張最多 2 MiB）<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { upload(event.target.files); event.target.value = ''; }} /></label>
      <div className="ai-thumbnails">{thumbnails.map((p, i) => <figure key={p.url}><img src={p.url} alt={`參考圖片 ${i + 1}：${p.name}`} /><figcaption>{p.name}</figcaption></figure>)}</div>
      {files.length > 0 && <button type="button" onClick={() => { setFiles([]); setConsent(false); }}>移除圖片</button>}
      <fieldset><legend>使用者可調整的建議尺寸（格）</legend><div className="ai-coordinate-grid">{(['x', 'y', 'z'] as const).map(axis => <label key={axis}>{axis === 'x' ? '寬' : axis === 'y' ? '高' : '深'}<input type="number" min="1" max="256" step="1" value={Number.isNaN(size[axis]) ? '' : size[axis]} onChange={event => { setSize({ ...size, [axis]: event.target.valueAsNumber }); setConsent(false); }} /></label>)}</div></fieldset>
      <fieldset><legend>允許修改範圍（最多 10,000 格）</legend>{(['min', 'max'] as const).map(bound => <div key={bound} className="ai-coordinate-grid">{(['x', 'y', 'z'] as const).map(axis => <label key={axis}>{bound === 'min' ? '最小' : '最大'} {axis.toUpperCase()}<input type="number" step="1" min={-MAX_COORDINATE} max={MAX_COORDINATE} value={Number.isNaN(scope[bound][axis]) ? '' : scope[bound][axis]} onChange={event => { setScope({ ...scope, [bound]: { ...scope[bound], [axis]: event.target.valueAsNumber } }); setConsent(false); }} /></label>)}</div>)}</fieldset>
      <label className="ai-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />我同意傳送這些圖片與設計，並承擔已設定服務的費用</label>
    </fieldset>
    <button type="button" disabled={!capability.enabled || !consent || busy} onClick={() => void submit()}>{busy ? '等待服務回應…' : '傳送並取得提案'}</button>
    {busy && <button type="button" onClick={() => active.current?.abort()}>取消等待</button>}
    {analysis && <section aria-label="AI 估計分析"><h3>AI 估計分析（非實測）</h3><p>{analysis.summary}</p><p>建議 {analysis.dimensions.x} × {analysis.dimensions.y} × {analysis.dimensions.z} 格；可在上方調整。</p><ul>{analysis.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul></section>}
  </section>;
}



