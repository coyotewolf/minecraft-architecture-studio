import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { BlockPos, Project } from '../../core/contracts.ts';
import './blueprint.css';

const LIMIT = 30_000_000;
const clamp = (n: number) => Math.max(-LIMIT, Math.min(LIMIT, n));
export interface BlueprintGrid {
  originX: number; originZ: number; cellSize: number; columns: number; rows: number;
  offsetX: number; offsetY: number; width: number; height: number;
}
/** CSS-pixel projection; floor is required for signed canonical coordinates. */
export function blueprintCellAt(grid: BlueprintGrid, pixelX: number, pixelY: number, layer: number): BlockPos | null {
  const column = Math.floor((pixelX - grid.offsetX) / grid.cellSize);
  const row = Math.floor((pixelY - grid.offsetY) / grid.cellSize);
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return null;
  return { x: grid.originX + column, y: layer, z: grid.originZ + row };
}
function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return 'hsl(' + (Math.abs(hash) % 360) + ', 38%, 49%)';
}
function IntegerInput(props: { label: string; value: number; onValue: (value: number) => void }): ReactElement {
  const [draft, setDraft] = useState(String(props.value));
  useEffect(() => { setDraft(String(props.value)); }, [props.value]);
  return <label>{props.label}<input type="number" min={-LIMIT} max={LIMIT} step={1} value={draft}
    onChange={event => {
      const text = event.currentTarget.value; setDraft(text);
      const n = Number(text);
      if (text.trim() !== '' && Number.isInteger(n) && Math.abs(n) <= LIMIT) props.onValue(n);
    }} onBlur={() => setDraft(String(props.value))} /></label>;
}

export function BlueprintPanel(props: {
  project: Project;
  selected: string | null;
  layer: number;
  onLayer: (y: number) => void;
  onCell: (pos: BlockPos) => void;
}): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 480, height: 480 });
  const [cellSize, setCellSize] = useState(20);
  const [center, setCenter] = useState({ x: 0, z: 0 });
  const [focus, setFocus] = useState({ x: 0, z: 0 });
  const layerBlocks = useMemo(() => props.project.blocks.filter(b => b.pos.y === props.layer), [props.project.blocks, props.layer]);
  const byCell = useMemo(() => new Map(layerBlocks.map(b => [b.pos.x + ',' + b.pos.z, b])), [layerBlocks]);
  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of layerBlocks) counts.set(b.id, (counts.get(b.id) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  }, [layerBlocks]);
  const columns = Math.max(1, Math.min(21, Math.floor((size.width - 76) / cellSize)));
  const rows = Math.max(1, Math.min(21, Math.floor((size.height - 32) / cellSize)));
  const grid: BlueprintGrid = {
    originX: Math.max(-LIMIT, Math.min(LIMIT - columns + 1, center.x - Math.floor(columns / 2))),
    originZ: Math.max(-LIMIT, Math.min(LIMIT - rows + 1, center.z - Math.floor(rows / 2))),
    columns, rows, cellSize, offsetX: 76, offsetY: 32, width: size.width, height: size.height,
  };
  const { originX, originZ, offsetX, offsetY } = grid;
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.max(96, Math.floor(rect.width)), height: Math.max(96, Math.floor(rect.height)) });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(size.width * ratio); element.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#132024'; context.fillRect(0, 0, size.width, size.height);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = originX + column, z = originZ + row;
        const block = byCell.get(x + ',' + z);
        const px = offsetX + column * cellSize, py = offsetY + row * cellSize;
        context.fillStyle = block ? colorFor(block.id) : '#1d2a2e';
        context.fillRect(px, py, cellSize, cellSize);
        context.strokeStyle = '#425357'; context.lineWidth = 1;
        context.strokeRect(px + .5, py + .5, cellSize - 1, cellSize - 1);
        if (block?.uid === props.selected) {
          context.strokeStyle = '#f1ffc6'; context.lineWidth = 3;
          context.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
        }
        if (x === focus.x && z === focus.z) {
          context.strokeStyle = '#ffb75f'; context.lineWidth = 2; context.setLineDash([3, 2]);
          context.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2); context.setLineDash([]);
        }
      }
    }
    context.font = '11px sans-serif'; context.fillStyle = '#d9e6e4'; context.textAlign = 'center';
    const xStride = Math.max(1, Math.ceil(Math.max(42, String(originX).length * 7, String(originX + columns - 1).length * 7) / cellSize));
    for (let column = 0; column < columns; column++) {
      if (column % xStride === 0 || column === columns - 1) context.fillText(String(originX + column), offsetX + (column + .5) * cellSize, 24);
    }
    context.textAlign = 'right';
    const zStride = Math.max(1, Math.ceil(16 / cellSize));
    for (let row = 0; row < rows; row++) {
      if (row % zStride === 0) context.fillText(String(originZ + row), offsetX - 5, offsetY + (row + .5) * cellSize + 4);
    }
    context.textAlign = 'left'; context.fillText('X →', offsetX, 10); context.fillText('Z ↓', 4, 18);
  }, [size, columns, rows, cellSize, originX, originZ, offsetX, offsetY, byCell, props.selected, focus]);

  function moveFocus(x: number, z: number) {
    const next = { x: clamp(x), z: clamp(z) }; setFocus(next);
    if (next.x < originX || next.x >= originX + columns || next.z < originZ || next.z >= originZ + rows) setCenter(next);
  }
  function pan(dx: number, dz: number) {
    const next = { x: clamp(center.x + dx), z: clamp(center.z + dz) }; setCenter(next); setFocus(next);
  }
  function centerOnSelection() {
    const selectedBlock = props.project.blocks.find(b => b.uid === props.selected);
    if (selectedBlock) { setCenter({ x: selectedBlock.pos.x, z: selectedBlock.pos.z }); setFocus({ x: selectedBlock.pos.x, z: selectedBlock.pos.z }); props.onLayer(selectedBlock.pos.y); }
  }
  const focusedBlock = byCell.get(focus.x + ',' + focus.z);
  return <section className="blueprint-panel" aria-label="逐層藍圖">
    <h2>逐層藍圖</h2>
    <div className="blueprint-controls">
      <IntegerInput label="藍圖樓層 Y" value={props.layer} onValue={props.onLayer} />
      <IntegerInput label="藍圖中心 X" value={center.x} onValue={x => { setCenter({ ...center, x }); setFocus({ ...focus, x }); }} />
      <IntegerInput label="藍圖中心 Z" value={center.z} onValue={z => { setCenter({ ...center, z }); setFocus({ ...focus, z }); }} />
      <label>藍圖縮放（{cellSize} 像素／格）<input aria-label="藍圖縮放" type="range" min={8} max={48} step={1} value={cellSize} onChange={event => setCellSize(Number(event.currentTarget.value))} /></label>
    </div>
    <div className="blueprint-pan" role="group" aria-label="藍圖平移">
      <button type="button" onClick={() => pan(0, -5)}>向北平移</button>
      <button type="button" onClick={() => pan(0, 5)}>向南平移</button>
      <button type="button" onClick={() => pan(-5, 0)}>向西平移</button>
      <button type="button" onClick={() => pan(5, 0)}>向東平移</button>
      <button type="button" onClick={centerOnSelection} disabled={!props.project.blocks.some(b => b.uid === props.selected)}>藍圖聚焦選取</button>
    </div>
    <p className="blueprint-summary">Y = {props.layer} · 本層 {layerBlocks.length} 格 · {legend.length} 種方塊</p>
    <p id="blueprint-help">北方朝上，X 向右、Z 向下。點選格子或用方向鍵移動橘色游標，Enter／空白鍵操作；編輯仍需確認預覽。淺黃色框表示目前選取。</p>
    <div className="blueprint-viewport" ref={host}>
      <canvas ref={canvas} className="blueprint-canvas" aria-label="2D 藍圖" aria-describedby="blueprint-help" tabIndex={0}
        data-grid={JSON.stringify({ ...grid, layer: props.layer })}
        onKeyDown={event => {
          const moves: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const delta = moves[event.key];
          if (delta) { event.preventDefault(); moveFocus(focus.x + delta[0], focus.z + delta[1]); }
          else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onCell({ ...focus, y: props.layer }); }
        }}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { pointer.current = null; }}
        onPointerUp={event => {
          const start = pointer.current; pointer.current = null;
          if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const pos = blueprintCellAt(grid, (event.clientX - rect.left) * size.width / rect.width, (event.clientY - rect.top) * size.height / rect.height, props.layer);
          if (pos) { setFocus({ x: pos.x, z: pos.z }); props.onCell(pos); }
        }}>使用上方座標控制與方向鍵，定位要操作的方塊格。</canvas>
    </div>
    <p className="blueprint-target" role="status">藍圖目標：X {focus.x}，Y {props.layer}，Z {focus.z} · {focusedBlock?.id ?? '空氣（空格）'}</p>
    <button type="button" onClick={() => props.onCell({ ...focus, y: props.layer })}>操作藍圖目標格</button>
    <details className="blueprint-legend"><summary>本層方塊圖例（佔用格數）</summary>
      {legend.length ? <ul>{legend.map(([id, count]) => <li key={id}><span className="blueprint-swatch" style={{ backgroundColor: colorFor(id) }} aria-hidden="true" /><code>{id}</code><span>{count} 格</span></li>)}</ul> : <p>本層沒有方塊，空格仍可放置。</p>}
    </details>
    <p>圖例統計整層；畫面最多顯示 21 × 21 格。色塊表示佔用位置，不表示方塊的實際外形或所需物品數量。</p>
  </section>;
}
