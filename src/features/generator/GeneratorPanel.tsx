import { useState, type ReactElement } from 'react';
import type { EditTransaction, Project } from '../../core/contracts.ts';
import { DEFAULT_BUILDING, GENERATOR_PALETTES, generateBuilding, type BuildingPreview, type BuildingRequest } from './core.ts';
import './generator.css';

export interface GeneratorPanelProps { project: Project; onPreview: (transaction: EditTransaction) => void; onInvalidate?: () => void }
const initial = { width: '13', depth: '11', floors: '2', floorHeight: '5', x: '0', y: '0', z: '0' };
const fields = [['width', '寬度 X', 8, 31], ['depth', '深度 Z', 7, 31], ['floors', '樓層數', 1, 20], ['floorHeight', '層高', 4, 8], ['x', '原點 X', -30000000, 30000000], ['y', '原點 Y', -30000000, 30000000], ['z', '原點 Z', -30000000, 30000000]] as const;
export function GeneratorPanel({ project, onPreview, onInvalidate }: GeneratorPanelProps): ReactElement {
  const [values, setValues] = useState(initial);
  const [palette, setPalette] = useState<BuildingRequest['palette']>(DEFAULT_BUILDING.palette);
  const [result, setResult] = useState<BuildingPreview | null>(null);
  const [error, setError] = useState('');
  const preview = () => {
    onInvalidate?.();
    try {
      if (Object.values(values).some(value => !value.trim())) throw new Error('請填寫所有尺寸與座標。');
      const next = generateBuilding(project, { width: Number(values.width), depth: Number(values.depth), floors: Number(values.floors), floorHeight: Number(values.floorHeight), origin: { x: Number(values.x), y: Number(values.y), z: Number(values.z) }, palette });
      onPreview(next.transaction); setResult(next); setError('');
    } catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : '無法產生建築。'); }
  };
  return <section className="generator-panel" aria-label="離線建築產生器">
    <h2>離線建築產生器</h2>
    <p>設定尺寸 → 預覽整棟 → 確認套用。原創參數式樓閣，包含地基、樓板、窗戶、入口、樓梯與平屋頂。</p>
    <p>入口朝北（−Z），原點是地基西北角。層高為樓板間距；總高度含地基與屋頂，最多 100 格、5,000 個方塊。</p>
    <div className="generator-fields">{fields.map(([key, label, min, max]) => <label key={key}>{label}<input type="number" step={1} min={min} max={max} value={values[key]} onChange={event => { onInvalidate?.(); setValues({ ...values, [key]: event.currentTarget.value }); setResult(null); setError(''); }} /></label>)}
      <label>建築材質<select value={palette} onChange={event => { onInvalidate?.(); setPalette(event.currentTarget.value as BuildingRequest['palette']); setResult(null); setError(''); }}>{Object.entries(GENERATOR_PALETTES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
    </div>
    <button type="button" onClick={preview}>預覽整棟建築</button>
    {error && <p role="alert">{error}</p>}
    {result && result.transaction.baseRevision === project.designRevision && <div role="status"><p>本次預覽：{result.dimensions.width} × {result.dimensions.height} × {result.dimensions.depth} 格（寬 × 高 × 深），共 {result.blockCount.toLocaleString()} 個方塊。請在畫面下方的預覽列確認套用。</p><details><summary>本次建築材料</summary><ul>{result.materials.map(row => <li key={row.id}>{row.id}：{row.count.toLocaleString()}</li>)}</ul></details></div>}
    <p>離線產生，不使用 AI 或付費服務；整棟加入目前專案，可一次復原，並隨同專案匯出。</p>
  </section>;
}
