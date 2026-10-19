import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
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
import { BuildPanel } from './features/build/BuildPanel.tsx';
import { constructionSteps, reconcileBuild } from './features/build/model.ts';
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
import './features/editor/editor.css';

interface PendingEdit { transaction: EditTransaction | null; valid: boolean; message: string; records: readonly BlockRecord[]; cells: number; audit?:string }
export function App() {
  const [engine, setEngine] = useState(() => new VoxelEngine(createDemoProject()));
  const [project, setProject] = useState(() => engine.snapshot());
  const [workspace,setWorkspace]=useState(()=>createWorkspace(project));
  const [buildMode,setBuildMode]=useState(false);
  const [switching,setSwitching]=useState(false);
  const switchInFlight=useRef(false);
  const [exploded,setExploded]=useState(false);
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
  const projection=useMemo(()=>viewProjection(project,steps,{layer,mode:viewMode,progress,completed:workspace.completed,exploded,build:buildMode}),[project,steps,layer,viewMode,progress,workspace.completed,exploded,buildMode]);
  const currentWorkspace=useMemo(()=>({...workspace,project,view:{layer,mode:viewMode,progress}}),[workspace,project,layer,viewMode,progress]);
  const latestWorkspace=useRef(currentWorkspace);latestWorkspace.current=currentWorkspace;
  const persistence=usePersistence(currentWorkspace,record=>openWorkspace(record));
  function publish(next:Project,label:string){setProject(next);const at=new Date().toISOString();setWorkspace(w=>({...w,revisionLog:[...w.revisionLog,{id:crypto.randomUUID(),label,at}].slice(-500)}));}
  function openWorkspace(w:WorkspaceRecord,action:'open'|'metadata'|'restore'='open'){
    if(action==='metadata'&&w.project.id===project.id){setWorkspace(w);if(w.project.title!==project.title)setProject(engine.rename(w.project.title));return;}
    if(action==='restore'&&w.project.id===project.id){const tx=designDiff(project,w.project.blocks,w.project.logicalStructures,'import');const next=engine.commit(tx);setWorkspace(w);setProject(next);clearPreview();return;}
    const next=new VoxelEngine(w.project);clearPreview();setSelected(null);setError('');setEngine(next);setProject(next.snapshot());setWorkspace(w);setLayer(w.view.layer);setViewMode(w.view.mode);setProgress(w.view.progress);setExploded(false);setBuildMode(false);setTool('select');
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
  async function load(demo:boolean){
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
      clearPreview();setSelected(null);setError('');setTool('select');
      const next=new VoxelEngine(demo?{...createDemoProject(),id:crypto.randomUUID()}:createEmptyProject(crypto.randomUUID(),'空白專案'));
      setEngine(next);setProject(next.snapshot());setWorkspace(createWorkspace(next.snapshot()));setLayer(0);setViewMode('all');setProgress(0);setExploded(false);setBuildMode(false);
    }finally{switchInFlight.current=false;setSwitching(false);}
  }
  const bounds=useMemo(()=>project.blocks.length?(['x','y','z'] as const).map(axis=>{let min=Infinity,max=-Infinity;for(const b of project.blocks){min=Math.min(min,b.pos[axis]);max=Math.max(max,b.pos[axis]);}return max-min+1;}):[0,0,0],[project.blocks]);
  return <main className="studio" onKeyDown={event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)){event.preventDefault();history(event.shiftKey);}
    if(event.key==='Escape')clearPreview();
  }}>
    <header className="studio-header"><div><p className="eyebrow">MINECRAFT ARCHITECTURE STUDIO</p><h1>從方塊，看見建築</h1><p>Java 1.20.1 · 建築工作台</p></div><div className="project-actions"><button disabled={switching} onClick={()=>load(true)}>載入示範木屋</button><button disabled={switching} onClick={()=>load(false)}>空白專案</button></div></header>
    <nav aria-label="工作模式"><button aria-pressed={!buildMode} onClick={()=>{setBuildMode(false);clearPreview();}}>編輯模式</button><button aria-pressed={buildMode} onClick={()=>{setBuildMode(true);clearPreview();}}>施工模式</button><span>{exploded?"分解檢視中：僅供觀察，請關閉後編輯。":""}</span></nav>
    <section className="studio-summary" aria-label="模型摘要"><dl className="stat"><dt>目前模型</dt><dd>{project.title}</dd></dl><dl className="stat"><dt>佔用方塊格數</dt><dd data-testid="cell-count">{project.blocks.length}</dd></dl><dl className="stat"><dt>寬 × 高 × 深</dt><dd>{bounds.join(' × ')}</dd></dl><dl className="stat"><dt>版本</dt><dd>Java {project.minecraftVersion}</dd></dl></section>
    <details className="editor-section"><summary>編輯工具與方塊</summary>
      <EditorPanel tool={tool} onTool={v=>{setTool(v);clearPreview();}} blockId={blockId} onBlockId={id=>{setBlockId(id);setBlockState(normalizeBlockState(id,{}));clearPreview();}} state={blockState} onState={s=>{setBlockState(s);clearPreview();}} workY={workY} onWorkY={setWorkY} collision={collision} onCollision={v=>{setCollision(v);clearPreview();}} canUndo={engine.canUndo} canRedo={engine.canRedo} onUndo={()=>history()} onRedo={()=>history(true)} preview={pending} onConfirm={confirm} onCancel={clearPreview}/>
      <fieldset className="coordinate-editor"><legend>座標操作</legend>{(['x','y','z'] as const).map(axis=><label key={axis}>目標 {axis.toUpperCase()}<input type="number" step="1" min="-30000000" max="30000000" value={target[axis]} onChange={event=>setTarget({...target,[axis]:Number(event.target.value)})}/></label>)}<button disabled={tool==='select'||tool==='eyedropper'} onClick={()=>{if(tool==='place'||tool==='remove'||tool==='replace')stageAction(target,tool);}}>預覽座標操作</button></fieldset>
      <button disabled={!block||block.id!==blockId} onClick={()=>{if(block)try{stage(changeSelectedState(project,block.uid,blockState));}catch(e){setError(e instanceof Error?e.message:'狀態修改失敗');}}}>將狀態套用到選取方塊</button>
    </details>
    <details className="editor-section"><summary>批次編輯</summary><BatchPanel selectedCount={block?1:0} onPreview={request=>{try{stage(batchEdit(project,request,blockId,blockState,collision));}catch(e){viewer.current?.preview([],[],false);setPending({transaction:null,valid:false,message:e instanceof Error?e.message:"批次失敗",records:[],cells:0});}}}/><p>批次共用上方編輯工具的預覽確認與復原按鈕。</p></details>
    <div className="studio-workspace"><section className="viewport-panel" aria-label="模型檢視">
      <CameraToolbar onPreset={p=>viewer.current?.preset(p)} onReset={()=>viewer.current?.reset()} onFocus={()=>{if(selected)viewer.current?.focus(selected);}} hasSelection={!!block}/>
      <div className="viewport-host" ref={host}><p className="viewer-status" role="status">{error?'無法完成操作：'+error:project.blocks.length?'建築模型 · 點選方塊查看或預覽變更':'空白專案 · 在工作平面放置第一個方塊'}</p><span className="viewer-reticle" aria-hidden="true">＋</span><p className="viewer-help" id="viewer-help">拖曳旋轉 · 右鍵拖曳平移 · 滾輪縮放<br/>觸控：單指旋轉、雙指縮放／平移<br/>鍵盤：方向鍵旋轉、Shift＋方向鍵平移、＋／− 縮放、Enter 操作中心方塊<br/>編輯需確認預覽；Ctrl＋Z 復原、Ctrl＋Shift＋Z 重做。</p></div>
    </section><BlockInspector block={block} unsupportedCount={shapes.filter(s=>!s.supported).length}/></div>
    <details className="editor-section"><summary>2D 逐層藍圖</summary><BlueprintPanel project={project} selected={selected} layer={layer} onLayer={setLayer} onCell={pos=>{const b=engine.getAt(pos);setSelected(b?.uid??null);setTarget(pos);if(tool==="eyedropper"&&b){setBlockId(b.id);setBlockState(b.state);setTool("place");}else if(tool==="place"||tool==="remove"||tool==="replace")stageAction(pos,tool);}}/></details>
    <details className="editor-section"><summary>材料與施工引導</summary><BuildPanel project={project} approved={workspace.approvedDesign} completed={workspace.completed} prepared={workspace.prepared} layer={layer} onLayer={setLayer} mode={viewMode} onMode={setViewMode} progress={progress} onProgress={setProgress} exploded={exploded} onExploded={setExploded} onPrepared={(id,quantity)=>setWorkspace({...workspace,prepared:{...workspace.prepared,[id]:quantity}})} onCompleted={completed=>setWorkspace({...workspace,completed})} onApprove={()=>setWorkspace({...workspace,approvedDesign:project,completed:reconcileBuild(workspace.approvedDesign,project,workspace.completed).retainedCompleted})}/></details>
    <details className="editor-section"><summary>專案與備份</summary><ProjectPanel workspace={currentWorkspace} status={persistence.status} onSave={persistence.save} onChange={openWorkspace}/></details>
    <details className="editor-section"><summary>AI 圖片分析與編輯</summary><AiPanel key={project.id} project={project} onProposal={(raw,scope,audit)=>{try{if(activeProject.current.id!==project.id)throw new Error("專案已切換，請重新產生提案。");const result=validateProposal(engine.snapshot(),raw,scope);stage(result.transaction,audit,result.summary+" "+result.uncertainties.join("；"));}catch(e){clearPreview();setError(e instanceof Error?e.message:"AI 提案無效");}}}/></details>
    {project.blocks.length>=10000&&<p className="capability-note" role="status">大型模型在軟體繪圖或手機上可能較慢；建議使用目前樓層／下方樓層檢視。50,000 格是本版的容量上限，並非流暢度保證。</p>}
    <p className="capability-note">材質使用示意色，未使用 Minecraft 遊戲貼圖。手動編輯以預覽確認後套用；可保存於本機瀏覽器，下載備份後可在其他裝置匯入。</p>
    <footer className="studio-footer">座標：＋X 向東、＋Y 向上、＋Z 向南；北方為 −Z。{persistence.status}</footer>
  </main>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<StrictMode><App/></StrictMode>);



