import { useMemo, type ReactElement } from 'react';
import type { Project } from '../../core/contracts.ts';
import { constructionSteps, inventory, reconcileBuild } from './model.ts';

export interface BuildPanelProps {
  project: Project; approved: Project; completed: readonly string[]; prepared: Readonly<Record<string, number>>;
  layer: number; onLayer: (layer: number) => void;
  mode: 'all' | 'layer' | 'through' | 'ghost'; onMode: (mode: 'all' | 'layer' | 'through' | 'ghost') => void;
  progress: number; onProgress: (progress: number) => void;
  exploded: boolean; onExploded: (exploded: boolean) => void;
  onPrepared: (itemId: string, quantity: number) => void; onCompleted: (uids: readonly string[]) => void; onApprove: () => void;
}
export function BuildPanel(props: BuildPanelProps): ReactElement {
  const materials = useMemo(() => inventory(props.project), [props.project]);
  const steps = useMemo(() => constructionSteps(props.project), [props.project]);
  const reconciliation = useMemo(() => reconcileBuild(props.approved, props.project, props.completed), [props.approved, props.project, props.completed]);
  const complete = useMemo(() => new Set(reconciliation.retainedCompleted), [reconciliation]);
  const layers = useMemo(() => [...new Set(props.project.blocks.map(b => b.pos.y))].sort((a, b) => a - b), [props.project]);
  const minY = layers[0] ?? 0, maxY = layers.at(-1) ?? 0;
  const stepIndex = Math.min(steps.length - 1, Math.floor(props.progress / 100 * steps.length + 1e-9));
  const step = steps[stepIndex];
  const pending = reconciliation.added.length + reconciliation.changed.length + reconciliation.removed.length > 0;
  const stepComplete = step?.blockUids.every(uid => complete.has(uid)) ?? false;
  function changeStep(delta: number) {
    if (!steps.length) return;
    const index = Math.max(0, Math.min(steps.length - 1, stepIndex + delta));
    props.onProgress(index / steps.length * 100);
  }
  function toggleStep() {
    if (!step || pending) return;
    const next = new Set(props.completed);
    for (const uid of step.blockUids) { if (stepComplete) next.delete(uid); else next.add(uid); }
    props.onCompleted([...next]);
  }
  return <section className="build-panel" aria-label="材料與施工">
    <h2>材料與施工</h2>
    <p>施工順序會優先考慮設計中下方的方塊，再按階段與座標安排。承托強度、鄰接更新、可達性與生存取得方式尚未完整驗證；請在遊戲中確認，必要時搭設臨時鷹架。</p>
    <label>檢視樓層 Y <input aria-label="施工檢視樓層" type="number" min={minY} max={maxY} value={props.layer}
      onChange={event => { const n = event.target.valueAsNumber; if (Number.isSafeInteger(n) && n >= minY && n <= maxY) props.onLayer(n); }} /></label>
    <input aria-label="樓層滑桿" type="range" min={minY} max={maxY} step="1" value={Math.max(minY, Math.min(maxY, props.layer))} onChange={event => props.onLayer(Number(event.target.value))} />
    <label>顯示方式 <select aria-label="施工顯示方式" value={props.mode} onChange={event => props.onMode(event.target.value as BuildPanelProps['mode'])}>
      <option value="all">全部</option><option value="layer">目前樓層</option><option value="through">目前樓層以下</option><option value="ghost">上方半透明</option>
    </select></label>
    <label><input type="checkbox" checked={props.exploded} onChange={event => props.onExploded(event.target.checked)} />樓層分解檢視</label>
    <label>施工順序預覽 {Math.round(props.progress)}%<input aria-label="施工順序進度" type="range" min="0" max="100" step="0.1" value={props.progress} onChange={event => props.onProgress(Number(event.target.value))} /></label>
    <p>預覽進度與實際完成標記分開保存。已完成 {complete.size} / {props.project.blocks.length} 格。</p>
    {pending && <div role="status"><p>設計待核對：新增 {reconciliation.added.length}、變更 {reconciliation.changed.length}、移除 {reconciliation.removed.length} 格。核對後僅保留未變更方塊的完成標記。</p>
      <button type="button" onClick={props.onApprove}>確認施工設計變更</button></div>}
    {step ? <div>
      <h3>步驟 {stepIndex + 1} / {steps.length}：{step.label}</h3>
      <p>此步驟 {step.blockUids.length} 格{step.blockUids.length > 1 ? '（成組施工）' : ''}</p>
      {step.warnings.length > 0 && <ul>{step.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      <button type="button" disabled={stepIndex <= 0} onClick={() => changeStep(-1)}>上一步</button>
      <button type="button" disabled={stepIndex >= steps.length - 1} onClick={() => changeStep(1)}>下一步</button>
      <button type="button" disabled={pending} onClick={toggleStep}>{stepComplete ? '取消此步完成' : '標記此步完成'}</button>
    </div> : <p>目前沒有可施工方塊。</p>}
    <h3>材料清單</h3>
    <p>佔用格數 {materials.occupiedCells}；放置物品總數 {materials.totalInventoryItems ?? '尚無法完整計算'}。</p>
    {materials.unresolved.length > 0 && <p role="status">有 {materials.unresolved.length} 格的放置物品或用量尚未確認，清單僅列已確認部分。</p>}
    <div style={{ overflowX: 'auto' }}><table><thead><tr><th>物品</th><th>需求</th><th>整組＋餘量</th><th>已備</th><th>尚缺</th></tr></thead><tbody>
      {materials.items.map(item => {
        const prepared = props.prepared[item.itemId] ?? 0;
        const missing = Math.max(0, item.required - prepared);
        return <tr key={item.itemId}><th scope="row"><code>{item.itemId}</code></th><td>{item.required}</td><td>{item.fullStacks} 組＋{item.remainder}（每組 {item.maxStack}）</td>
          <td><input style={{ width: '6rem' }} aria-label={`${item.itemId} 已備數量`} type="number" min="0" step="1" value={prepared}
            onChange={event => { const n = event.target.valueAsNumber; if (Number.isSafeInteger(n) && n >= 0) props.onPrepared(item.itemId, n); }} /></td>
          <td>{missing === 0 ? '已備齊' : `${missing}（${prepared > 0 ? '部分備齊' : '未準備'}）`}</td></tr>;
      })}
    </tbody></table></div>
  </section>;
}

