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
import './style.css';
import './features/editor/editor.css';

interface PendingEdit { transaction: EditTransaction | null; valid: boolean; message: string; records: readonly BlockRecord[]; cells: number }
export function App() {
  const [engine, setEngine] = useState(() => new VoxelEngine(createDemoProject()));
  const [project, setProject] = useState(() => engine.snapshot());
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
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerHandle|null>(null);
  const onPick = useRef<(uid:string|null,pick:ViewerPick|null)=>void>(()=>{});
  const shapes = useMemo(()=>project.blocks.map(shapeForBlock),[project.blocks]);
  const block = project.blocks.find(b=>b.uid===selected)??null;
  function clearPreview(){setPending(null);viewer.current?.preview([],[],true);}
  function stage(transaction:EditTransaction) {
    const preview=engine.preview(transaction);
    const records=transaction.changes.flatMap(c=>c.after?[c.after]:c.before?[c.before]:[]);
    const next:PendingEdit={transaction,valid:preview.ok,message:preview.ok?'確認後才會修改模型。':preview.diagnostics.map(d=>d.message).join('；'),records,cells:transaction.changes.length};
    setPending(next);viewer.current?.preview(records,records.map(shapeForBlock),next.valid);
  }
  function stageAction(pos:BlockPos,action:Exclude<EditorTool,'select'|'eyedropper'>){
    try {stage(editAt(engine.snapshot(),action,pos,blockId,blockState,collision));}
    catch(e){viewer.current?.preview([],[],false);setPending({transaction:null,valid:false,message:e instanceof Error?e.message:'無法建立預覽',records:[],cells:0});}
  }
  onPick.current=(uid,pick)=>{
    if(!pick){setSelected(null);return;}
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
  useEffect(()=>{viewer.current?.select(selected);},[project.blocks,selected]);
  useEffect(()=>{viewer.current?.workPlane(workY);},[workY,engine]);
  function confirm(){
    if(!pending?.valid||!pending.transaction)return;
    try {const next=engine.commit(pending.transaction);setProject(next);clearPreview();setError('');}
    catch(e){setPending({...pending,valid:false,message:e instanceof Error?e.message:'變更失敗'});}
  }
  function history(redo=false){
    try {setProject(redo?engine.redo():engine.undo());clearPreview();setError('');}
    catch(e){setError(e instanceof Error?e.message:'歷程操作失敗');}
  }
  function load(demo:boolean){clearPreview();setSelected(null);setError('');setTool('select');const next=new VoxelEngine(demo?createDemoProject():createEmptyProject(crypto.randomUUID(),'空白專案'));setEngine(next);setProject(next.snapshot());}
  const bounds=useMemo(()=>project.blocks.length?(['x','y','z'] as const).map(axis=>{let min=Infinity,max=-Infinity;for(const b of project.blocks){min=Math.min(min,b.pos[axis]);max=Math.max(max,b.pos[axis]);}return max-min+1;}):[0,0,0],[project.blocks]);
  return <main className="studio" onKeyDown={event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)){event.preventDefault();history(event.shiftKey);}
    if(event.key==='Escape')clearPreview();
  }}>
    <header className="studio-header"><div><p className="eyebrow">MINECRAFT ARCHITECTURE STUDIO</p><h1>從方塊，看見建築</h1><p>Java 1.20.1 · 建築工作台</p></div><div className="project-actions"><button onClick={()=>load(true)}>載入示範木屋</button><button onClick={()=>load(false)}>空白專案</button></div></header>
    <section className="studio-summary" aria-label="模型摘要"><dl className="stat"><dt>目前模型</dt><dd>{project.title}</dd></dl><dl className="stat"><dt>佔用方塊格數</dt><dd data-testid="cell-count">{project.blocks.length}</dd></dl><dl className="stat"><dt>寬 × 高 × 深</dt><dd>{bounds.join(' × ')}</dd></dl><dl className="stat"><dt>版本</dt><dd>Java {project.minecraftVersion}</dd></dl></section>
    <details className="editor-section"><summary>編輯工具與方塊</summary>
      <EditorPanel tool={tool} onTool={v=>{setTool(v);clearPreview();}} blockId={blockId} onBlockId={id=>{setBlockId(id);setBlockState(normalizeBlockState(id,{}));clearPreview();}} state={blockState} onState={s=>{setBlockState(s);clearPreview();}} workY={workY} onWorkY={setWorkY} collision={collision} onCollision={v=>{setCollision(v);clearPreview();}} canUndo={engine.canUndo} canRedo={engine.canRedo} onUndo={()=>history()} onRedo={()=>history(true)} preview={pending} onConfirm={confirm} onCancel={clearPreview}/>
      <fieldset className="coordinate-editor"><legend>座標操作</legend>{(['x','y','z'] as const).map(axis=><label key={axis}>目標 {axis.toUpperCase()}<input type="number" step="1" min="-30000000" max="30000000" value={target[axis]} onChange={event=>setTarget({...target,[axis]:Number(event.target.value)})}/></label>)}<button disabled={tool==='select'||tool==='eyedropper'} onClick={()=>{if(tool==='place'||tool==='remove'||tool==='replace')stageAction(target,tool);}}>預覽座標操作</button></fieldset>
      <button disabled={!block||block.id!==blockId} onClick={()=>{if(block)try{stage(changeSelectedState(project,block.uid,blockState));}catch(e){setError(e instanceof Error?e.message:'狀態修改失敗');}}}>將狀態套用到選取方塊</button>
    </details>
    <details className="editor-section"><summary>批次編輯</summary><BatchPanel selectedCount={block?1:0} onPreview={request=>{try{stage(batchEdit(project,request,blockId,blockState,collision));}catch(e){setPending({transaction:null,valid:false,message:e instanceof Error?e.message:"批次失敗",records:[],cells:0});}}}/><p>批次共用上方編輯工具的預覽確認與復原按鈕。</p></details>
    <div className="studio-workspace"><section className="viewport-panel" aria-label="模型檢視">
      <CameraToolbar onPreset={p=>viewer.current?.preset(p)} onReset={()=>viewer.current?.reset()} onFocus={()=>{if(selected)viewer.current?.focus(selected);}} hasSelection={!!block}/>
      <div className="viewport-host" ref={host}><p className="viewer-status" role="status">{error?'無法完成操作：'+error:project.blocks.length?'建築模型 · 點選方塊查看或預覽變更':'空白專案 · 在工作平面放置第一個方塊'}</p><span className="viewer-reticle" aria-hidden="true">＋</span><p className="viewer-help" id="viewer-help">拖曳旋轉 · 右鍵拖曳平移 · 滾輪縮放<br/>觸控：單指旋轉、雙指縮放／平移<br/>鍵盤：方向鍵旋轉、Shift＋方向鍵平移、＋／− 縮放、Enter 操作中心方塊<br/>編輯需確認預覽；Ctrl＋Z 復原、Ctrl＋Shift＋Z 重做。</p></div>
    </section><BlockInspector block={block} unsupportedCount={shapes.filter(s=>!s.supported).length}/></div>
    <details className="editor-section"><summary>2D 逐層藍圖</summary><BlueprintPanel project={project} selected={selected} layer={layer} onLayer={setLayer} onCell={pos=>{const b=engine.getAt(pos);setSelected(b?.uid??null);setTarget(pos);if(tool==="eyedropper"&&b){setBlockId(b.id);setBlockState(b.state);setTool("place");}else if(tool==="place"||tool==="remove"||tool==="replace")stageAction(pos,tool);}}/></details>
    <p className="capability-note">材質使用示意色，未使用 Minecraft 遊戲貼圖。手動編輯以預覽確認後套用；AI、儲存與完整建造引導正在接續開發。</p>
    <footer className="studio-footer">座標：＋X 向東、＋Y 向上、＋Z 向南；北方為 −Z。目前只保留在記憶體中。</footer>
  </main>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<StrictMode><App/></StrictMode>);

