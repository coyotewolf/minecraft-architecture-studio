import { useMemo, useState, type ReactElement } from 'react';
import type { Project } from '../../core/contracts.ts';
import { constructionSteps, inventory, reconcileBuild } from './model.ts';
import { categoryName, layerMembers, materialCategories, materialName, toggleLayerCompletion } from './ui-model.ts';

export interface BuildPanelProps {
  derived?: { steps: ReturnType<typeof constructionSteps>; materials: ReturnType<typeof inventory>; reconciliation: ReturnType<typeof reconcileBuild> };
  project: Project; approved: Project; completed: readonly string[]; prepared: Readonly<Record<string, number>>;
  layer: number; onLayer: (layer: number) => void;
  mode: 'all' | 'layer' | 'through' | 'ghost'; onMode: (mode: 'all' | 'layer' | 'through' | 'ghost') => void;
  progress: number; onProgress: (progress: number) => void;
  exploded: boolean; onExploded: (exploded: boolean) => void;
  onPrepared: (itemId: string, quantity: number) => void; onCompleted: (uids: readonly string[]) => void; onApprove: () => void;
}

function useBuild(props: BuildPanelProps) {
  const steps = useMemo(() => props.derived?.steps ?? constructionSteps(props.project), [props.project, props.derived?.steps]);
  const reconciliation = useMemo(() => props.derived?.reconciliation ?? reconcileBuild(props.approved, props.project, props.completed), [props.approved, props.project, props.completed, props.derived?.reconciliation]);
  const complete = useMemo(() => new Set(reconciliation.retainedCompleted), [reconciliation]);
  const pending = reconciliation.added.length + reconciliation.changed.length + reconciliation.removed.length > 0;
  const stepIndex = Math.min(steps.length - 1, Math.floor(props.progress / 100 * steps.length + 1e-9));
  return { steps, reconciliation, complete, pending, stepIndex, step: steps[stepIndex] };
}

export function BuildControls(props: BuildPanelProps): ReactElement {
  const { reconciliation, complete, pending, step, stepIndex, steps } = useBuild(props);
  const layers = useMemo(() => [...new Set(props.project.blocks.map(b => b.pos.y))].sort((a,b) => a-b), [props.project]);
  const members = useMemo(() => layerMembers(props.project, props.layer), [props.project, props.layer]);
  const layerBlocks = useMemo(() => props.project.blocks.filter(b => b.pos.y === props.layer), [props.project, props.layer]);
  const layerMaterials=useMemo(()=>{const counts=new Map<string,number>();for(const b of layerBlocks)counts.set(b.id,(counts.get(b.id)??0)+1);return [...counts].sort(([a],[b])=>a.localeCompare(b));},[layerBlocks]);
  const minY = layers[0] ?? 0, maxY = layers.at(-1) ?? 0;
  const layerComplete = members.length > 0 && members.every(uid => complete.has(uid));
  const previousY = [...layers].reverse().find(y => y < props.layer), nextY = layers.find(y => y > props.layer);
  return <section className="build-controls" aria-label="施工樓層控制">
    <header className="panel-heading"><span className="eyebrow">LAYER CONTROL</span><h2>逐層施工</h2></header>
    <div className="layer-readout"><span>目前樓層</span><strong>Y {props.layer}</strong><span>{layerBlocks.length} 格 · {new Set(layerBlocks.map(b => b.id)).size} 種方塊</span></div>
    <div className="layer-stepper"><button type="button" aria-label="上一層" disabled={previousY === undefined} onClick={() => { if(previousY !== undefined) props.onLayer(previousY); }}>−</button>
      <label>檢視樓層 Y<input aria-label="施工檢視樓層" type="number" min={minY} max={maxY} value={props.layer} onChange={event => { const n=event.target.valueAsNumber; if(Number.isSafeInteger(n)&&n>=minY&&n<=maxY)props.onLayer(n); }}/></label>
      <button type="button" aria-label="下一層" disabled={nextY === undefined} onClick={() => { if(nextY !== undefined) props.onLayer(nextY); }}>＋</button></div>
    <input aria-label="樓層滑桿" type="range" min={minY} max={maxY} step="1" value={Math.max(minY,Math.min(maxY,props.layer))} onChange={event => props.onLayer(Number(event.target.value))}/>
    <div className="range-endpoints"><span>Y {minY}</span><span>Y {maxY}</span></div>
    <label>顯示方式<select aria-label="施工顯示方式" value={props.mode} onChange={event => props.onMode(event.target.value as BuildPanelProps['mode'])}><option value="all">全部</option><option value="layer">目前樓層</option><option value="through">目前樓層以下</option><option value="ghost">上方半透明</option></select></label>
    <label className="toggle-row"><input type="checkbox" checked={props.mode==='ghost'} onChange={event => props.onMode(event.target.checked?'ghost':'through')}/>上方半透明</label>
    <label className="toggle-row"><input type="checkbox" checked={props.exploded} onChange={event => props.onExploded(event.target.checked)}/>樓層分解檢視</label>
    <div className="layer-completion"><label className="toggle-row"><input type="checkbox" aria-label="本層已完成" disabled={pending||!members.length} checked={layerComplete} onChange={() => props.onCompleted(toggleLayerCompletion(props.project,props.layer,reconciliation.retainedCompleted))}/>本層已完成</label>
      <small>門、床等成組方塊會一併標記，共 {members.length} 格。</small>
      <button type="button" disabled={nextY===undefined} onClick={() => { if(nextY!==undefined)props.onLayer(nextY); }}>前往下一層</button></div>
    <details className="layer-materials"><summary>本層材料與施工提示</summary><ul>{layerMaterials.map(([id,count])=><li key={id}>{materialName(id)} · {count} 格</li>)}</ul><p>先依俯視圖對齊 X／Z，保持中央通道；懸空拱頂施工時搭設臨時鷹架。此處列佔用格數，完整備料以右側物品清單為準。</p></details><div className="current-build-step"><span>目前步驟 {steps.length ? stepIndex+1 : 0} / {steps.length}</span><p>{step?.label ?? '目前沒有可施工方塊。'}</p></div>
    {pending && <div className="build-reconciliation" role="status"><p>設計待核對：新增 {reconciliation.added.length}、變更 {reconciliation.changed.length}、移除 {reconciliation.removed.length} 格。核對後僅保留未變更方塊的完成標記。</p><button type="button" onClick={props.onApprove}>確認施工設計變更</button></div>}
    <details className="build-caveat"><summary>施工注意事項</summary><p>順序優先考慮設計中下方的方塊，再按階段與座標安排。承托、鄰接更新、可達性及生存取得方式需在遊戲中確認，必要時搭設臨時鷹架。</p></details>
  </section>;
}

export function MaterialsPanel(props: BuildPanelProps): ReactElement {
  const [search,setSearch] = useState('');
  const materials=useMemo(() => props.derived?.materials ?? inventory(props.project),[props.project,props.derived?.materials]);
  const categories=useMemo(() => materialCategories(props.project),[props.project]);
  const query=search.trim().toLowerCase();
  const visible=materials.items.filter(item => (materialName(item.itemId)+' '+item.itemId+' '+(categories.get(item.itemId)??[]).map(c=>categoryName(c.category)).join(' ')).toLowerCase().includes(query));
  const groups=[...new Set(visible.map(item => categories.get(item.itemId)?.[0]?.category ?? '未分類'))].sort();
  const ready=materials.items.filter(item => (props.prepared[item.itemId]??0)>=item.required).length;
  return <section className="materials-panel" aria-label="材料清單"><header className="panel-heading"><span className="eyebrow">MATERIALS</span><h2>材料清單</h2><span>{ready} / {materials.items.length} 已備齊</span></header>
    <p className="materials-summary">佔用格數 {materials.occupiedCells}；放置物品總數 {materials.totalInventoryItems ?? '尚無法完整計算'}。</p>
    <label className="material-search">搜尋材料<input type="search" aria-label="材料搜尋" placeholder="名稱、ID 或建築分類" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    {materials.unresolved.length>0&&<p role="status">有 {materials.unresolved.length} 格的放置物品或用量尚未確認，清單僅列已確認部分。</p>}
    {groups.map(category=><section className="material-group" key={category} aria-label={categoryName(category)}><h3>{categoryName(category)}</h3>
      {visible.filter(item=>(categories.get(item.itemId)?.[0]?.category??'未分類')===category).map(item=>{
        const prepared=props.prepared[item.itemId]??0,missing=Math.max(0,item.required-prepared),parts=categories.get(item.itemId)??[];
        return <article className={'material-item'+(missing===0?' is-ready':'')} key={item.itemId}>
          <div className="material-identity"><span className="material-swatch" aria-hidden="true"/><div><strong>{materialName(item.itemId)}</strong><code>{item.itemId}</code></div><span className="material-required">× {item.required}</span></div>
          <p className="material-stacks">{item.fullStacks} 組＋{item.remainder}（每組 {item.maxStack}）</p>
          {parts.length>1&&<small className="material-categories">{parts.map(c=>categoryName(c.category)+' '+c.count).join(' · ')}</small>}
          <div className="material-preparation"><label><input type="checkbox" aria-label={item.itemId+' 已備齊'} checked={missing===0} onChange={event=>props.onPrepared(item.itemId,event.target.checked?item.required:0)}/>已備齊</label>
            <input aria-label={item.itemId+' 已備數量'} type="number" min="0" step="1" value={prepared} onChange={event=>{const n=event.target.valueAsNumber;if(Number.isSafeInteger(n)&&n>=0)props.onPrepared(item.itemId,n);}}/>
            <span className="material-missing">{missing===0?'已備齊':missing+'（'+(prepared>0?'部分備齊':'未準備')+'）'}</span></div>
        </article>;
      })}</section>)}
    {!visible.length&&<p className="empty-state">{materials.items.length?'沒有符合搜尋的材料。':'目前沒有材料需求。'}</p>}
  </section>;
}

export function ProgressDock(props: BuildPanelProps): ReactElement {
  const {steps,stepIndex,step,complete,pending,reconciliation}=useBuild(props);
  const stepComplete=step?.blockUids.every(uid=>complete.has(uid))??false;
  function changeStep(delta:number){if(steps.length)props.onProgress(Math.max(0,Math.min(steps.length-1,stepIndex+delta))/steps.length*100);}
  function toggleStep(){if(!step||pending)return;const next=new Set(reconciliation.retainedCompleted);for(const uid of step.blockUids){if(stepComplete)next.delete(uid);else next.add(uid);}props.onCompleted([...next]);}
  return <section className="progress-dock" aria-label="施工進度"><div className="progress-overview"><div><span className="eyebrow">BUILD PROGRESS</span><strong>已完成 {complete.size} / {props.project.blocks.length} 格</strong></div><p>預覽進度與實際完成標記分開保存。</p></div>
    <label className="progress-slider">施工順序預覽 {Math.round(props.progress)}%<input aria-label="施工順序進度" type="range" min="0" max="100" step="0.1" value={props.progress} onChange={event=>props.onProgress(Number(event.target.value))}/></label>
    {step?<div className="progress-step"><div><h3>步驟 {stepIndex+1} / {steps.length}：{step.label}</h3><span>此步驟 {step.blockUids.length} 格{step.blockUids.length>1?'（成組施工）':''}</span></div><div className="progress-actions"><button type="button" disabled={stepIndex<=0} onClick={()=>changeStep(-1)}>上一步</button><button type="button" disabled={stepIndex>=steps.length-1} onClick={()=>changeStep(1)}>下一步</button><button type="button" disabled={pending} onClick={toggleStep}>{stepComplete?'取消此步完成':'標記此步完成'}</button></div>{step.warnings.length>0&&<details className="step-warnings"><summary>此步驟注意事項</summary><ul>{step.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></details>}</div>:<p>目前沒有可施工方塊。</p>}
  </section>;
}

/** Compatibility composition; the studio may place the exports in separate rails. */
export function BuildPanel(props: BuildPanelProps): ReactElement {
  return <section className="build-panel" aria-label="材料與施工"><BuildControls {...props}/><MaterialsPanel {...props}/><ProgressDock {...props}/></section>;
}
