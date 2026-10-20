import { CampusPanel } from './features/campus/CampusPanel.tsx';
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BlockPos, BlockRecord, BlockState, EditTransaction, MinecraftId } from './core/contracts.ts';
import { VoxelEngine } from './core/engine.ts';
import { createEmptyProject } from './core/project.ts';
import { normalizeBlockState } from './core/versioned-registry.ts';
import { createDemoProject } from './fixtures/two-floor-house.ts';
import { shapeForBlock } from './features/viewer/geometry.ts';
import { createViewer, type ViewerHandle, type ViewerPick } from './features/viewer/runtime.js';
import { CameraToolbar, BlockInspector } from './features/viewer/ViewerPanels.tsx';
import { EditorPanel, type EditorTool } from './features/editor/EditorPanel.tsx';
import { changeSelectedState, editAt, type CollisionPolicy } from './features/editor/commands.ts';
import { BatchPanel } from './features/editor/BatchPanel.tsx';
import { batchEdit } from './features/editor/batch.ts';
import { BlueprintPanel } from './features/blueprint/BlueprintPanel.tsx';
import { BuildControls, MaterialsPanel, ProgressDock, type BuildPanelProps } from './features/build/BuildPanel.tsx';
import { constructionSteps, inventory, reconcileBuild } from './features/build/model.ts';
import { viewProjection } from './features/build/projection.ts';
import { ProjectPanel } from './features/projects/ProjectPanel.tsx';
import { usePersistence } from './features/projects/usePersistence.ts';
import type { WorkspaceRecord } from './features/projects/storage.ts';
import { designDiff } from './features/editor/commands.ts';
import type { Project } from './core/contracts.ts';
import { createWorkspace } from './features/projects/storage.ts';
import './features/studio-panels.css';
import { AiPanel } from './features/ai/AiPanel.tsx';
import { validateProposal } from './features/ai/proposals.ts';
import './style.css';
import { CollectionPanel } from './features/collection/CollectionPanel.tsx';
import './features/editor/editor.css';
import './studio-redesign.css';
import { createAtriumProject } from './fixtures/glass-atrium.ts';
import { ReferencePanel } from './features/references/ReferencePanel.tsx';
import type { ReferenceImage } from './features/references/storage.ts';

interface PendingEdit { transaction: EditTransaction | null; valid: boolean; message: string; records: readonly BlockRecord[]; cells: number; audit?:string }
export function App(){
 const [screen,setScreen]=useState<'campus'|'collection'|'studio'>(()=>new URLSearchParams(location.search).has('sample')?'studio':new URLSearchParams(location.search).get('view')==='collection'?'collection':'campus');
 const [origin,setOrigin]=useState<'campus'|'collection'>('campus');
 const [initial,setInitial]=useState<Project|undefined>(undefined);
 function navigate(next:'campus'|'collection'){const url=new URL(location.href);url.searchParams.delete('sample');if(next==='collection')url.searchParams.set('view','collection');else url.searchParams.delete('view');history.replaceState(null,'',url);setScreen(next);}
 function open(project:Project,from:'campus'|'collection'){setInitial(project);setOrigin(from);setScreen('studio');}
 if(screen==='collection')return <CollectionPanel onOpen={project=>open(project,'collection')} onCampus={()=>navigate('campus')}/>;
 if(screen==='campus')return <CampusPanel onOpen={project=>open(project,'campus')} onCollection={()=>navigate('collection')}/>;
 return <StudioApp initialProject={initial} onCampus={()=>navigate(origin)} returnLabel={origin==='collection'?'返回建築庫':'返回全基地'}/>;
}
export function StudioApp({initialProject,onCampus,returnLabel="返回全基地"}:{initialProject?:Project|undefined;onCampus:()=>void;returnLabel?:string}) {
  const [engine, setEngine] = useState(() => new VoxelEngine(initialProject??(new URLSearchParams(location.search).get('sample')==='house'?createDemoProject():createAtriumProject())));
  const [project, setProject] = useState(() => engine.snapshot());
  const [workspace,setWorkspace]=useState(()=>createWorkspace(project));
  const [buildMode,setBuildMode]=useState(false);
  const [switching,setSwitching]=useState(false);
  const switchInFlight=useRef(false);
  const [exploded,setExploded]=useState(false);
  const [hideRoof,setHideRoof]=useState(false),[ghostFuture,setGhostFuture]=useState(true),[estimatedOnly,setEstimatedOnly]=useState(false);
  const [materialFocus,setMaterialFocus]=useState(''),[hiddenMaterials,setHiddenMaterials]=useState<string[]>([]);
  const [cutAxis,setCutAxis]=useState<''|'x'|'z'>(''),[cutValue,setCutValue]=useState(0);
  const [referencePreview,setReferencePreview]=useState<{projectId:string;image:ReferenceImage|null}|null>(null);
  const [brokenReferenceUrl,setBrokenReferenceUrl]=useState<string|null>(null);
  const onReferenceSelection=useCallback((image:ReferenceImage|null)=>setReferencePreview({projectId:project.id,image}),[project.id]);
  const referenceImage=referencePreview?.projectId===project.id?referencePreview.image:null;
  const [viewMode,setViewMode]=useState<'all'|'layer'|'through'|'ghost'>('all');
  const [progress,setProgress]=useState(0);
  const [selected, setSelected] = useState<string|null>(null);
  const [error, setError] = useState('');
  const [tool, setTool] = useState<EditorTool>('select');
  const [blockId, setBlockId] = useState<MinecraftId>('minecraft:stone');
  const [blockState, setBlockState] = useState<BlockState>(() => normalizeBlockState('minecraft:stone', {}));
  const [workY, setWorkY] = useState(0);
  const [layer,setLayer]=useState(0);
  const [collision, setCollision] = useState<CollisionPolicy>('cancel');
  const [pending, setPending] = useState<PendingEdit|null>(null);
  const [target, setTarget] = useState<BlockPos>({x:0,y:0,z:0});
  const activeProject=useRef(project);activeProject.current=project;
  const activeEngine=useRef(engine);activeEngine.current=engine;
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerHandle|null>(null);
  const onPick = useRef<(uid:string|null,pick:ViewerPick|null)=>void>(()=>{});
  const shapes = useMemo(()=>project.blocks.map(shapeForBlock),[project.blocks]);
  const steps=useMemo(()=>constructionSteps(project),[project]);
  const projection=useMemo(()=>viewProjection(project,steps,{layer,mode:viewMode,progress,completed:workspace.completed,exploded,build:buildMode,hideRoof,ghostFuture,estimatedOnly,materialFocus,hiddenMaterials,...(cutAxis?{cut:{axis:cutAxis,value:cutValue}}:{})}),[project,steps,layer,viewMode,progress,workspace.completed,exploded,buildMode,hideRoof,ghostFuture,estimatedOnly,materialFocus,hiddenMaterials,cutAxis,cutValue]);
  const currentWorkspace=useMemo(()=>({...workspace,project,view:{layer,mode:viewMode,progress}}),[workspace,project,layer,viewMode,progress]);
  const latestWorkspace=useRef(currentWorkspace);latestWorkspace.current=currentWorkspace;
  const persistence=usePersistence(currentWorkspace,record=>openWorkspace(record),initialProject?.id);
  function publish(next:Project,label:string){setProject(next);const at=new Date().toISOString();setWorkspace(w=>({...w,revisionLog:[...w.revisionLog,{id:crypto.randomUUID(),label,at}].slice(-500)}));}
  function openWorkspace(w:WorkspaceRecord,action:'open'|'metadata'|'restore'='open'){
    if(action==='metadata'&&w.project.id===project.id){setWorkspace(w);if(w.project.title!==project.title)setProject(engine.rename(w.project.title));return;}
    if(action==='restore'&&w.project.id===project.id){const tx=designDiff(project,w.project.blocks,w.project.logicalStructures,'import');const next=engine.commit(tx);setWorkspace(w);setProject(next);clearPreview();return;}
    setHideRoof(false);setHiddenMaterials([]);setMaterialFocus('');setCutAxis('');setEstimatedOnly(false);const next=new VoxelEngine(w.project);clearPreview();setSelected(null);setError('');setEngine(next);setProject(next.snapshot());setWorkspace(w);setLayer(w.view.layer);setViewMode(w.view.mode);setProgress(w.view.progress);setExploded(false);setBuildMode(false);setTool('select');
  }
  const block = project.blocks.find(b=>b.uid===selected)??null;
  function clearPreview(){setPending(null);viewer.current?.preview([],[],true);}
  function stage(transaction:EditTransaction,audit?:string,description='') {
    if(buildMode||exploded){setError('請切回編輯模式並關閉分解檢視後修改。');return;}
    const controls=document.querySelector<HTMLDetailsElement>('.editor-section');if(controls)controls.open=true;
    const preview=engine.preview(transaction);
    const records=transaction.changes.flatMap(c=>c.after?[c.after]:c.before?[c.before]:[]);
    const next:PendingEdit={transaction,valid:preview.ok,message:preview.ok?'確認後才會修改模型。'+description:preview.diagnostics.map(d=>d.message).join('；'),records,cells:transaction.changes.length,...(audit?{audit}:{})};
    setPending(next);viewer.current?.preview(records,records.map(shapeForBlock),next.valid);
  }
  function stageAction(pos:BlockPos,action:Exclude<EditorTool,'select'|'eyedropper'>){
    try {stage(editAt(engine.snapshot(),action,pos,blockId,blockState,collision));}
    catch(e){viewer.current?.preview([],[],false);setPending({transaction:null,valid:false,message:e instanceof Error?e.message:'無法建立預覽',records:[],cells:0});}
  }
  onPick.current=(uid,pick)=>{
    if(!pick){setSelected(null);return;}
    if(buildMode||exploded){setSelected(uid);return;}
    setSelected(uid);
    const pos=tool==='place'&&uid?{x:pick.pos.x+pick.normal.x,y:pick.pos.y+pick.normal.y,z:pick.pos.z+pick.normal.z}:pick.pos;
    setTarget(pos);
    if(tool==='eyedropper'&&uid){const b=engine.getByUid(uid);if(b){setBlockId(b.id);setBlockState(b.state);setTool('place');}return;}
    if(tool==='place'||tool==='remove'||tool==='replace')stageAction(pos,tool);
  };
  useEffect(()=>{
    if(!host.current)return;
    try {viewer.current=createViewer(host.current,engine.snapshot().blocks,engine.snapshot().blocks.map(shapeForBlock),(uid,pick)=>onPick.current(uid,pick),setError);}
    catch(e){setError(e instanceof Error?e.message:'3D 初始化失敗');}
    return ()=>{viewer.current?.dispose();viewer.current=null;};
  },[engine]);
  useEffect(()=>{viewer.current?.updateModel(project.blocks,shapes);},[project.blocks,shapes]);
  useEffect(()=>{viewer.current?.setProjection(projection);},[project.blocks,projection]);
  useEffect(()=>{viewer.current?.select(selected);},[project.blocks,selected,projection]);
  useEffect(()=>{viewer.current?.workPlane(workY);},[workY,engine]);
  function confirm(){
    if(!pending?.valid||!pending.transaction)return;
    try {const next=engine.commit(pending.transaction);if(pending.audit){setProject(next);setWorkspace(w=>{const priorAi=w.originalAi===true;const entries=[...w.revisionLog,{id:crypto.randomUUID(),label:'接受 AI 提案',at:new Date().toISOString(),detail:pending.audit!,transaction:pending.transaction!}].slice(-500);let cells=entries.reduce((n,r)=>n+(r.transaction?.changes.length??0),0);while(cells>100000){const removed=entries.shift();cells-=removed?.transaction?.changes.length??0;}return {...w,original:priorAi?w.original:next,originalAi:true,revisionLog:entries};});}else publish(next,'套用編輯');clearPreview();setError('');}
    catch(e){setPending({...pending,valid:false,message:e instanceof Error?e.message:'變更失敗'});}
  }
  function history(redo=false){
    try {publish(redo?engine.redo():engine.undo(),redo?'重做':'復原');clearPreview();setError('');}
    catch(e){setError(e instanceof Error?e.message:'歷程操作失敗');}
  }
  async function load(demo:boolean|'atrium'){
    if(switchInFlight.current)return;
    switchInFlight.current=true;setSwitching(true);
    const departingId=latestWorkspace.current.project.id;
    const departingEngine=activeEngine.current;
    try{
      // Editing stays usable while storage is slow. Flush again if ANY workspace
      // field changed during the write, and never replace another opened project.
      while(true){
        const snapshot=latestWorkspace.current;
        const saved=await persistence.save();
        if(latestWorkspace.current.project.id!==departingId||activeEngine.current!==departingEngine)return;
        if(latestWorkspace.current!==snapshot)continue;
        if(!saved&&!window.confirm('儲存失敗。切換專案可能遺失目前修改；建議先下載備份。仍要切換？'))return;
        break;
      }
      clearPreview();setSelected(null);setError('');setTool('select');setHideRoof(false);setHiddenMaterials([]);setMaterialFocus('');setCutAxis('');setEstimatedOnly(false);
      const next=new VoxelEngine(demo?{...(demo==='atrium'?createAtriumProject():createDemoProject()),id:crypto.randomUUID()}:createEmptyProject(crypto.randomUUID(),'空白專案'));
      setEngine(next);setProject(next.snapshot());setWorkspace(createWorkspace(next.snapshot()));setLayer(0);setViewMode('all');setProgress(0);setExploded(false);setBuildMode(false);
    }finally{switchInFlight.current=false;setSwitching(false);}
  }
  const bounds=useMemo(()=>project.blocks.length?(['x','y','z'] as const).map(axis=>{let min=Infinity,max=-Infinity;for(const b of project.blocks){min=Math.min(min,b.pos[axis]);max=Math.max(max,b.pos[axis]);}return max-min+1;}):[0,0,0],[project.blocks]);
  const materials=useMemo(()=>inventory(project),[project]);
  const estimatedCount=project.blocks.filter(b=>b.source.origin==='ai_estimated'||b.source.origin==='inferred').length;
  const materialIds=useMemo(()=>[...new Set(project.blocks.map(b=>b.id))].sort(),[project]);
  const axisBounds=useMemo(()=>{const values=project.blocks.map(b=>b.pos[cutAxis||'x']);return values.length?{min:Math.min(...values),max:Math.max(...values)}:{min:0,max:0};},[project,cutAxis]);
  const buildReconciliation=useMemo(()=>reconcileBuild(workspace.approvedDesign,project,workspace.completed),[workspace.approvedDesign,project,workspace.completed]);
  const buildProps:BuildPanelProps={derived:{steps,materials,reconciliation:buildReconciliation},project,approved:workspace.approvedDesign,completed:workspace.completed,prepared:workspace.prepared,layer,onLayer:y=>{setLayer(y);if(viewMode==='all')setViewMode('through');},mode:viewMode,onMode:setViewMode,progress,onProgress:p=>{setProgress(p);setBuildMode(true);clearPreview();},exploded,onExploded:setExploded,onPrepared:(id,quantity)=>setWorkspace(w=>({...w,prepared:{...w.prepared,[id]:quantity}})),onCompleted:completed=>setWorkspace(w=>({...w,completed})),onApprove:()=>setWorkspace(w=>({...w,approvedDesign:project,completed:reconcileBuild(w.approvedDesign,project,w.completed).retainedCompleted}))};
  async function returnToCampus(){
    if(switchInFlight.current)return;
    switchInFlight.current=true;setSwitching(true);
    try{while(true){const snapshot=latestWorkspace.current;const saved=await persistence.save();if(!saved){setError('儲存失敗，請先下載施工備份再離開。');return;}if(snapshot===latestWorkspace.current)break;}onCampus();}finally{switchInFlight.current=false;setSwitching(false);}
  }
  function closeDrawer(event:React.MouseEvent<HTMLButtonElement>){event.currentTarget.closest('details')?.removeAttribute('open');}
  function openReferences(){document.querySelector<HTMLDetailsElement>('[data-reference-drawer]')?.setAttribute('open','');}
  function closeOtherDrawers(event:React.SyntheticEvent<HTMLDetailsElement>){const active=event.currentTarget;if(active.open)document.querySelectorAll<HTMLDetailsElement>('.utility-drawer[open]').forEach(d=>{if(d!==active)d.open=false;});}
  return <main className="studio design-studio" onKeyDown={event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)){event.preventDefault();history(event.shiftKey);}
    if(event.key==='Escape'){clearPreview();document.querySelectorAll<HTMLDetailsElement>('.utility-drawer[open]').forEach(d=>d.open=false);}
  }}>
    <header className="studio-header"><div className="studio-brand"><span className="brand-mark" aria-hidden="true">▧</span><div><p className="eyebrow">ARCHITECTURE / JAVA 1.20.1</p><h1>BLOCK ATELIER<span>建築設計工作室</span></h1></div></div><div className="header-actions"><button disabled={switching} onClick={()=>void returnToCampus()}>{returnLabel}</button>
      <details className="utility-drawer" data-reference-drawer onToggle={closeOtherDrawers}><summary>設計參考</summary><div className="drawer-content"><button className="drawer-close" onClick={closeDrawer}>關閉面板</button><ReferencePanel projectId={project.id} onSelectionChange={onReferenceSelection}/></div></details>
          <details className="utility-drawer" onToggle={closeOtherDrawers}><summary>專案與備份</summary><div className="drawer-content"><button className="drawer-close" onClick={closeDrawer}>關閉面板</button><ProjectPanel workspace={currentWorkspace} status={persistence.status} onSave={persistence.save} onChange={openWorkspace}/></div></details>

          <details className="utility-drawer" onToggle={closeOtherDrawers}><summary>AI 圖片分析與編輯</summary><div className="drawer-content"><button className="drawer-close" onClick={closeDrawer}>關閉面板</button><AiPanel key={project.id} project={project} onProposal={(raw,scope,audit)=>{try{if(activeProject.current.id!==project.id)throw new Error("專案已切換，請重新產生提案。");const result=validateProposal(engine.snapshot(),raw,scope);stage(result.transaction,audit,result.summary+" "+result.uncertainties.join("；"));}catch(e){clearPreview();setError(e instanceof Error?e.message:"AI 提案無效");}}}/></div></details>

    </div></header>
    <section className="project-heading"><div><p className="eyebrow">FROM INSPIRATION TO EVERY BLOCK</p><h2>REAL HOUSE <span>→</span> MINECRAFT BUILD</h2><p>看見構造，掌握每一層。從設計參考到你的下一個方塊。</p></div><div className="project-actions"><button disabled={switching} onClick={()=>load('atrium')}>載入玻璃拱廊</button><button disabled={switching} onClick={()=>load(true)}>載入示範木屋</button><button disabled={switching} onClick={()=>load(false)}>空白專案</button></div></section>
    <section className="studio-summary" aria-label="模型摘要"><dl className="stat"><dt>PROJECT / 目前模型</dt><dd>{project.title}</dd></dl><dl className="stat"><dt>寬 × 高 × 深</dt><dd>{bounds.join(' × ')}<small> blocks</small></dd></dl><dl className="stat"><dt>佔用方塊格數</dt><dd data-testid="cell-count">{project.blocks.length.toString()}</dd></dl><dl className="stat"><dt>實際備料物品</dt><dd>{materials.totalInventoryItems??'待確認'}<small> / {materials.items.length} 種</small></dd></dl><dl className="stat"><dt>設計依據</dt><dd className={estimatedCount?'estimated-badge':''}>{estimatedCount?'AI Estimated Area':'手動設計'}<small>{estimatedCount?` ${estimatedCount} 格推估`:''}</small></dd></dl></section>
    <div className="architecture-workspace">
      <aside className="control-rail" aria-label="建築控制">
        <section className="reference-card"><div className="panel-heading"><span className="eyebrow">DESIGN REFERENCE</span><button onClick={openReferences}>查看圖冊 ↗</button></div>{referenceImage&&brokenReferenceUrl!==referenceImage.url?<img src={referenceImage.url} alt={referenceImage.title} onError={()=>setBrokenReferenceUrl(referenceImage.url)}/>:<button className="reference-placeholder" onClick={openReferences}>{referenceImage?'圖片無法顯示 · 重新選擇參考':'＋ 加入你的設計照片'}</button>}<div className="reference-caption"><strong>{referenceImage?.title??'你的設計參考'}</strong><p>{referenceImage?.notes??'從圖冊選擇圖片，或加入本機照片。'}</p><span>概念／設計推估 · 非原圖精確量測</span></div></section>
        <details className="controls-section" open><summary>材料與施工引導</summary><BuildControls {...buildProps}/></details>
            <details className="editor-section"><summary>編輯工具與方塊</summary>
      <EditorPanel tool={tool} onTool={v=>{setTool(v);clearPreview();}} blockId={blockId} onBlockId={id=>{setBlockId(id);setBlockState(normalizeBlockState(id,{}));clearPreview();}} state={blockState} onState={s=>{setBlockState(s);clearPreview();}} workY={workY} onWorkY={setWorkY} collision={collision} onCollision={v=>{setCollision(v);clearPreview();}} canUndo={engine.canUndo} canRedo={engine.canRedo} onUndo={()=>history()} onRedo={()=>history(true)} preview={pending} onConfirm={confirm} onCancel={clearPreview}/>
      <fieldset className="coordinate-editor"><legend>座標操作</legend>{(['x','y','z'] as const).map(axis=><label key={axis}>目標 {axis.toUpperCase()}<input type="number" step="1" min="-30000000" max="30000000" value={target[axis]} onChange={event=>setTarget({...target,[axis]:Number(event.target.value)})}/></label>)}<button disabled={tool==='select'||tool==='eyedropper'} onClick={()=>{if(tool==='place'||tool==='remove'||tool==='replace')stageAction(target,tool);}}>預覽座標操作</button></fieldset>
      <button disabled={!block||block.id!==blockId} onClick={()=>{if(block)try{stage(changeSelectedState(project,block.uid,blockState));}catch(e){setError(e instanceof Error?e.message:'狀態修改失敗');}}}>將狀態套用到選取方塊</button>
    </details>
    <details className="editor-section"><summary>批次編輯</summary><BatchPanel selectedCount={block?1:0} onPreview={request=>{try{stage(batchEdit(project,request,blockId,blockState,collision));}catch(e){viewer.current?.preview([],[],false);setPending({transaction:null,valid:false,message:e instanceof Error?e.message:"批次失敗",records:[],cells:0});}}}/><p>批次共用上方編輯工具的預覽確認與復原按鈕。</p></details>

      </aside>
      <section className="model-stage" aria-label="建築設計畫布">
        <div className="stage-heading"><div><span className="eyebrow">LIVE BLOCK MODEL</span><h2>{project.title}</h2></div><nav aria-label="工作模式"><button aria-pressed={!buildMode} onClick={()=>{setBuildMode(false);clearPreview();}}>編輯模式</button><button aria-pressed={buildMode} onClick={()=>{setBuildMode(true);clearPreview();}}>施工模式</button></nav></div>
        <section className="viewport-panel" aria-label="模型檢視">      <CameraToolbar onPreset={p=>viewer.current?.preset(p)} onReset={()=>viewer.current?.reset()} onFocus={()=>{if(selected)viewer.current?.focus(selected);}} hasSelection={!!block}/>
      <div className="viewport-host" ref={host}><p className="viewer-status" role="status">{error?'無法完成操作：'+error:project.blocks.length?'建築模型 · 點選方塊查看或預覽變更':'空白專案 · 在工作平面放置第一個方塊'}</p><span className="viewer-reticle" aria-hidden="true">＋</span><p className="viewer-help" id="viewer-help">拖曳旋轉 · 右鍵拖曳平移 · 滾輪縮放<br/>觸控：單指旋轉、雙指縮放／平移<br/>鍵盤：方向鍵旋轉、Shift＋方向鍵平移、＋／− 縮放、Enter 操作中心方塊<br/>編輯需確認預覽；Ctrl＋Z 復原、Ctrl＋Shift＋Z 重做。</p></div>
</section>
        <details className="view-options"><summary>剖面、材質與推估區域</summary><div className="view-options-grid">
          <label><input type="checkbox" checked={hideRoof} onChange={e=>setHideRoof(e.target.checked)}/>隱藏屋頂</label><label><input type="checkbox" checked={ghostFuture} onChange={e=>setGhostFuture(e.target.checked)}/>Ghost Completed House</label><label><input type="checkbox" checked={estimatedOnly} onChange={e=>setEstimatedOnly(e.target.checked)}/>高亮 AI Estimated Area</label>
          <label>室內剖面<select aria-label="剖面軸" value={cutAxis} onChange={e=>{setCutAxis(e.target.value as ''|'x'|'z');setCutValue(0);}}><option value="">完整建築</option><option value="x">X 左右剖面</option><option value="z">Z 前後剖面</option></select></label>{cutAxis&&<label>保留 {cutAxis.toUpperCase()} ≤ {cutValue}<input aria-label="剖面位置" type="range" min={axisBounds.min} max={axisBounds.max} value={Math.max(axisBounds.min,Math.min(axisBounds.max,cutValue))} onChange={e=>setCutValue(Number(e.target.value))}/></label>}
          <label>搜尋並高亮方塊<input aria-label="高亮方塊" value={materialFocus} onChange={e=>setMaterialFocus(e.target.value)} placeholder="例如 quartz、glass"/></label>
          <fieldset className="material-visibility"><legend>材質顯示</legend>{materialIds.map(id=><label key={id}><input type="checkbox" checked={!hiddenMaterials.includes(id)} onChange={e=>setHiddenMaterials(v=>e.target.checked?v.filter(x=>x!==id):[...v,id])}/>{id.replace('minecraft:','')}</label>)}</fieldset>
        </div></details>
            <details className="blueprint-section"><summary>2D 逐層藍圖</summary><BlueprintPanel project={project} selected={selected} layer={layer} onLayer={setLayer} onCell={pos=>{const b=engine.getAt(pos);setSelected(b?.uid??null);setTarget(pos);if(tool==="eyedropper"&&b){setBlockId(b.id);setBlockState(b.state);setTool("place");}else if(tool==="place"||tool==="remove"||tool==="replace")stageAction(pos,tool);}}/></details>

      </section>
      <aside className="inspection-rail" aria-label="材料與檢查器"><details className="materials-section" open><summary>材料清單</summary><MaterialsPanel {...buildProps}/></details><BlockInspector block={block} unsupportedCount={shapes.filter(s=>!s.supported).length}/></aside>
    </div>
    <ProgressDock {...buildProps}/>
    <footer className="studio-footer"><span className="save-indicator">● {persistence.status}</span><span>＋X 東 / ＋Y 上 / ＋Z 南 · Java 1.20.1</span><details><summary>設計與施工說明</summary><p>所有座標、材料與下載均來自同一份方塊模型。參考建築為概念圖的比例設計，全部推估座標標記 AI Estimated Area。原版方塊與狀態經資料驗證，實際施工仍需在遊戲中確認承托與通行。材質為自行製作的示意紋理。</p>{project.blocks.length>=10000&&<p>大型模型可能較慢，建議逐層檢視；50,000 格為容量上限，並非流暢度保證。</p>}</details></footer>
  </main>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<StrictMode><App/></StrictMode>);
