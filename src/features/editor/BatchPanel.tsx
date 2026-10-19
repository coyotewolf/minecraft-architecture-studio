import { useState, type ReactElement } from 'react';
import './batch.css';

export interface BatchRequest {
  operation: 'line' | 'wall' | 'box' | 'hollow_box' | 'fill' | 'remove' | 'copy' | 'move' | 'rotate' | 'mirror_x' | 'mirror_z' | 'replace' | 'extrude' | 'duplicate_layer';
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
  turns: 1 | 2 | 3;
  thickness: number;
}

interface BatchPanelProps {
  onPreview: (request: BatchRequest) => void;
  selectedCount: number;
}

type CoordinateText = Record<'x' | 'y' | 'z', string>;
const axes = ['x', 'y', 'z'] as const;
const operations: readonly [BatchRequest['operation'], string][] = [
  ['line', '直線'], ['wall', '牆面'], ['box', '實心盒'], ['hollow_box', '空心盒'],
  ['fill', '填滿範圍'], ['remove', '移除範圍'], ['copy', '複製'], ['move', '移動'],
  ['rotate', '旋轉'], ['mirror_x', '沿 X 軸鏡像'], ['mirror_z', '沿 Z 軸鏡像'],
  ['replace', '替換材質'], ['extrude', '擠出'], ['duplicate_layer', '複製樓層'],
];
const validInteger = (text: string, min: number, max: number): boolean =>
  text.trim() !== '' && Number.isSafeInteger(Number(text)) && Number(text) >= min && Number(text) <= max;
const toCoordinates = (text: CoordinateText): BatchRequest['from'] =>
  ({ x: Number(text.x), y: Number(text.y), z: Number(text.z) });

export function BatchPanel({ onPreview, selectedCount }: BatchPanelProps): ReactElement {
  const [operation, setOperation] = useState<BatchRequest['operation']>('box');
  const [from, setFrom] = useState<CoordinateText>({ x: '0', y: '0', z: '0' });
  const [to, setTo] = useState<CoordinateText>({ x: '2', y: '2', z: '2' });
  const [offset, setOffset] = useState<CoordinateText>({ x: '0', y: '0', z: '0' });
  const [turns, setTurns] = useState<1 | 2 | 3>(1);
  const [thickness, setThickness] = useState('1');
  const valid = [from, to, offset].every(point => axes.every(axis => validInteger(point[axis], -30_000_000, 30_000_000)))
    && validInteger(thickness, 1, 30_000_000);
  const coordinates = (name: string, value: CoordinateText, update: (next: CoordinateText) => void): ReactElement => (
    <fieldset className="batch-coordinates">
      <legend>{name}</legend>
      {axes.map(axis => <label key={axis}>{name} {axis.toUpperCase()}
        <input type="number" min={-30_000_000} max={30_000_000} step={1} value={value[axis]}
          aria-invalid={!validInteger(value[axis], -30_000_000, 30_000_000)}
          onChange={event => update({ ...value, [axis]: event.currentTarget.value })} />
      </label>)}
    </fieldset>
  );

  return <section className="batch-panel" aria-label="批次建築工具">
    <h2>批次建築工具</h2>
    <p>使用目前選用的方塊、方塊狀態與碰撞處理方式。先產生預覽，確認後才套用變更。</p>
    <p>範圍包含起點與終點，選取時一併包含門、床等成對方塊。已選取 {selectedCount} 格。</p>
    <div className="batch-fields">
      <label>批次操作<select value={operation} onChange={event => setOperation(event.currentTarget.value as BatchRequest['operation'])}>
        {operations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>旋轉角度<select value={turns} onChange={event => setTurns(Number(event.currentTarget.value) as 1 | 2 | 3)}>
        <option value={1}>90°（四分之一圈）</option><option value={2}>180°（半圈）</option><option value={3}>270°（四分之三圈）</option>
      </select></label>
      <label>厚度<input type="number" min={1} max={30_000_000} step={1} value={thickness}
        aria-invalid={!validInteger(thickness, 1, 30_000_000)} onChange={event => setThickness(event.currentTarget.value)} /></label>
    </div>
    <div className="batch-regions">
      {coordinates('範圍起點', from, setFrom)}
      {coordinates('範圍終點', to, setTo)}
      {coordinates('位移', offset, setOffset)}
    </div>
    <p className="batch-hint">複製、移動與擠出使用位移；旋轉使用角度。複製樓層使用起點 Y 與位移 Y。各操作的可用範圍與結果由預覽驗證。</p>
    {!valid && <p className="batch-error" role="status">座標與位移須為 −30000000 至 30000000 的整數；厚度須為正整數。</p>}
    <button type="button" disabled={!valid} onClick={() => onPreview({ operation, from: toCoordinates(from), to: toCoordinates(to), offset: toCoordinates(offset), turns, thickness: Number(thickness) })}>預覽批次操作</button>
  </section>;
}
