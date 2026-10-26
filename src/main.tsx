import { StrictMode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { GeneratorPanel } from './features/generator/GeneratorPanel.tsx';
import { BatchPanel } from './features/editor/BatchPanel.tsx';
import { selectionEdit, selectedBlocks } from './features/editor/selection.ts';
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
const CampusPanel=lazy(()=>import('./features/campus/CampusPanel.tsx').then(module=>({default:module.CampusPanel})));
export interface StudioEditContext { initialSelection?:string|null; editingFocus?:boolean }
export function App(){
 const [screen,setScreen]=useState<'home'|'campus'|'collection'|'studio'>(()=>{const params=new URLSearchParams(location.search);return params.has('sample')?'studio':params.get('view')==='collection'?'collection':params.get('view')==='campus'?'campus':'home';});
 const [origin,setOrigin]=useState<'campus'|'collection'>('campus');
 const [initial,setInitial]=useState<Project|undefined>(undefined);
 const [editContext,setEditContext]=useState<StudioEditContext>({});
 function navigate(next:'campus'|'collection'){const url=new URL(location.href);url.searchParams.delete('sample');url.searchParams.set('view',next);history.replaceState(null,'',url);setInitial(undefined);setScreen(next);}
 function open(project:Project,from:'campus'|'collection',context:StudioEditContext={}){setInitial(project);setEditContext(context);setOrigin(from);setScreen('studio');}
 if(screen==='collection')return <CollectionPanel onOpen={project=>open(project,'collection')} onEdit={(project,selectedUid)=>open(project,'collection',{initialSelection:selectedUid,editingFocus:true})} onCampus={()=>navigate('campus')} onCreate={()=>open(createEmptyProject(crypto.randomUUID(),'我的新建築'),'collection',{editingFocus:true})}/>;
 if(screen==='home')return <main className="studio"><header className="studio-header"><div><p className="eyebrow">BLOCK ATELIER</p><h1>建築設計工作室</h1></div></header><section className="project-heading"><div><h2>從一棟建築開始</h2><p>開啟建築庫，挑選要編輯或繼續施工的建築。</p><button onClick={()=>navigate('collection')}>開啟建築庫</button><button onClick={()=>open(createEmptyProject(crypto.randomUUID(),'我的新建築'),'collection',{editingFocus:true})}>建立新建築</button></div></section><section className="project-heading"><div><h2>全基地總覽</h2><p>全基地包含大型模型，載入時需要較多記憶體與時間。一般編輯請從建築庫選取單棟建築。</p><button onClick={()=>navigate('campus')}>載入完整基地</button></div></section></main>;
 if(screen==='campus')return <Suspense fallback={<main className="studio"><p role="status">正在載入全基地工具…</p></main>}><CampusPanel onOpen={project=>open(project,'campus')} onCollection={()=>navigate('collection')}/></Suspense>;
 return <StudioApp initialProject={initial} {...editContext} onCampus={()=>navigate(origin)} returnLabel={origin==='collection'?'返回建築庫':'返回全基地'}/>;
}
export function StudioApp({initialProject,initialSelection=null,editingFocus=false,onCampus,returnLabel="返回全基地"}:StudioEditContext & {initialProject?:Project|undefined;onCampus:()=>void;returnLabel?:string}) {
  const [engine, setEngine] = useState(() => new VoxelEngine(initialProject??(new URLSearchParams(location.search).get('sample')==='house'?createDemoProject():createAtriumProject())));
  const [project, setProject] = useState(() => engine.snapshot());
  const [workspace,setWorkspace]=useState(()=>createWorkspace(project));
  const [buildMode,setBuildMode]=useState(false);
  const [showOverview,setShowOverview]=useState(!editingFocus);
  const selectionRestored=useRef(false);
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
  const [selected, setPrimarySelected] = useState<string|null>(null);
  const [selectedUids,setSelectedUids]=useState<string[]>([]);
  const [contextMenu,setContextMenu]=useState<{x:number;y:number}|null>(null);
  const [dragFeedback,setDragFeedback]=useState('');
  const [additiveSelection,setAdditiveSelection]=useState(false);
  const [moveOffset,setMoveOffset]=useState<BlockPos>({x:0,y:0,z:0});
  function setSelected(uid:string|null){setPrimarySelected(uid);setSelectedUids(uid?[uid]:[]);}
  function chooseSelection(uid:string|null,additive=false){
    clearPreview();setMoveOffset({x:0,y:0,z:0});
    if(!additive){setSelected(uid);return;}
    if(!uid)return;
    const members=selectedBlocks(project,[uid]).map(b=>b.uid),current=selectedBlocks(project,selectedUids).map(b=>b.uid);
    const next=current.includes(uid)?current.filter(id=>!members.includes(id)):[...new Set([...current,...members])];
    if(next.length>5000){setError('一次最多選取 5,000 格，請分區編輯。');return;}
    setSelectedUids(next);setPrimarySelected(next.includes(uid)?uid:next.at(-1)??null);
  }
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
  const onBoxSelection=useRef<(uids:readonly string[],additive:boolean)=>void>(()=>{});
  const onDrag=useRef<(delta:BlockPos,phase:'preview'|'commit'|'cancel')=>void>(()=>{});
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
  const selection=useMemo(()=>selectedBlocks(project,selectedUids),[project,selectedUids]);
  const block = project.blocks.find(b=>b.uid===selected)??null;
  function clearPreview(){setPending(null);setDragFeedback('');viewer.current?.preview([],[],true);}
  function stage(transaction:EditTransaction,audit?:string,description='') {
    if(!persistence.ready){setError('請等待本機專案讀取完成後再編輯。');return;}
    if(buildMode||exploded){setError('請切回編輯模式並關閉分解檢視後修改。');return;}
    const controls=document.querySelector<HTMLDetailsElement>('.editor-section');if(controls)controls.open=true;
    setError('');
    const preview=engine.preview(transaction);
    const records=transaction.changes.flatMap(c=>c.after?[c.after]:c.before?[c.before]:[]);
    const next:PendingEdit={transaction,valid:preview.ok,message:preview.ok?'確認後才會修改模型。'+description:preview.diagnostics.map(d=>d.message).join('；'),records,cells:transaction.changes.length,...(audit?{audit}:{})};
    setPending(next);viewer.current?.preview(records,records.map(shapeForBlock),next.valid);
  }
  function stageAction(pos:BlockPos,action:Exclude<EditorTool,'select'|'eyedropper'>){
    try {stage(editAt(engine.snapshot(),action,pos,blockId,blockState,collision));}
    catch(e){viewer.current?.preview([],[],false);setPending({transaction:null,valid:false,message:e instanceof Error?e.message:'無法建立預覽',records:[],cells:0});}
  }
  function commitDirect(transaction:EditTransaction,label:string){
    if(!persistence.ready||buildMode||exploded)return;
    try{publish(engine.commit(transaction),label);clearPreview();setMoveOffset({x:0,y:0,z:0});setError('');}
    catch(e){clearPreview();setError(e instanceof Error?e.message:'操作未完成，原模型已保留。');}
  }
  function executeAt(pos:BlockPos,action:'place'|'remove'|'replace'){
    try{commitDirect(editAt(engine.snapshot(),action,pos,blockId,blockState,collision),'方塊'+action);}
    catch(e){clearPreview();setError(e instanceof Error?e.message:'無法修改方塊。');}
  }
  function executeSelection(operation:'remove'|'move'|'copy',offset:BlockPos=moveOffset){
    try{commitDirect(selectionEdit(engine.snapshot(),selectedUids,operation,offset),operation==='remove'?'刪除選取':operation==='copy'?'複製選取':'移動選取');}
    catch(e){clearPreview();setError(e instanceof Error?e.message:'選取操作未完成。');}
    setContextMenu(null);
  }
  onBoxSelection.current=(uids,additive)=>{
    const next=selectedBlocks(project,additive?[...selectedUids,...uids]:uids).map(b=>b.uid);
    if(next.length>5000){setError('框選超過 5,000 格。請用逐層或剖面縮小範圍。');return;}
    clearPreview();setError('');setSelectedUids(next);setPrimarySelected(next.at(-1)??null);setMoveOffset({x:0,y:0,z:0});
  };
  onDrag.current=(delta,phase)=>{
    if(phase==='cancel'){clearPreview();setMoveOffset({x:0,y:0,z:0});return;}
    if(!(delta.x||delta.y||delta.z)){clearPreview();return;}
    if(phase==='commit'){executeSelection('move',delta);return;}
    try{
      const tx=selectionEdit(engine.snapshot(),selectedUids,'move',delta),check=engine.preview(tx);
      const records=tx.changes.flatMap(c=>c.after?[c.after]:[]);
      viewer.current?.preview(records,records.map(shapeForBlock),check.ok);
      setDragFeedback(`X ${delta.x} · Y ${delta.y} · Z ${delta.z} · ${check.ok?'放開完成移動':'位置無效，放開不會修改'}`);
    }catch(e){viewer.current?.preview([],[],false);setDragFeedback(e instanceof Error?e.message:'此位置無法放置');}
  };
  onPick.current=(uid,pick)=>{
    if(!pick){setSelected(null);return;}
    if(pick.context){chooseSelection(uid,false);return;}
    if(buildMode||exploded){setSelected(uid);return;}
    chooseSelection(uid,tool==='select'&&(!!pick.additive||additiveSelection));
    const pos=tool==='place'&&uid?{x:pick.pos.x+pick.normal.x,y:pick.pos.y+pick.normal.y,z:pick.pos.z+pick.normal.z}:pick.pos;
    setTarget(pos);
    if(tool==='eyedropper'&&uid){const b=engine.getByUid(uid);if(b){setBlockId(b.id);setBlockState(b.state);setTool('place');}return;}
    if(tool==='place'||tool==='remove'||tool==='replace')executeAt(pos,tool);
  };
  useEffect(()=>{
    if(!host.current)return;
    try {viewer.current=createViewer(host.current,engine.snapshot().blocks,engine.snapshot().blocks.map(shapeForBlock),(uid,pick)=>onPick.current(uid,pick),setError,(delta,phase)=>onDrag.current(delta,phase),(uids,additive)=>onBoxSelection.current(uids,additive));}
    catch(e){setError(e instanceof Error?e.message:'3D 初始化失敗');}
    return ()=>{viewer.current?.dispose();viewer.current=null;};
  },[engine]);
  useEffect(()=>{viewer.current?.updateModel(project.blocks,shapes);},[project.blocks,shapes]);
  useEffect(()=>{viewer.current?.setProjection(projection);},[project.blocks,projection]);
  useEffect(()=>{viewer.current?.selectMany(selection.map(b=>b.uid));},[selection,projection,engine]);
  useEffect(()=>{viewer.current?.setEditingEnabled(persistence.ready&&!buildMode&&!exploded&&tool==='select');},[persistence.ready,buildMode,exploded,tool,engine]);
  useEffect(()=>{viewer.current?.workPlane(workY);},[workY,engine]);
  useEffect(()=>{
    // Hydration replaces the engine and clears its selection. Apply this handoff
    // once, only after the saved workspace has become the authoritative model.
    if(!persistence.ready||selectionRestored.current)return;
    selectionRestored.current=true;
    if(!editingFocus)return;
    setViewMode('all');setBuildMode(false);setExploded(false);
    const picked=initialSelection?engine.getByUid(initialSelection):null;
    if(picked){setSelected(picked.uid);setTarget(picked.pos);setWorkY(picked.pos.y);setLayer(picked.pos.y);viewer.current?.preset('front');}
  },[persistence.ready,engine,initialSelection,editingFocus]);
  function confirm(){
    if(!pending?.valid||!pending.transaction)return;
    try {const next=engine.commit(pending.transaction);if(pending.audit){setProject(next);setWorkspace(w=>{const priorAi=w.originalAi===true;const entries=[...w.revisionLog,{id:crypto.randomUUID(),label:'接受 AI 提案',at:new Date().toISOString(),detail:pending.audit!,transaction:pending.transaction!}].slice(-500);let cells=entries.reduce((n,r)=>n+(r.transaction?.changes.length??0),0);while(cells>100000){const removed=entries.shift();cells-=removed?.transaction?.changes.length??0;}return {...w,original:priorAi?w.original:next,originalAi:true,revisionLog:entries};});}else publish(next,'套用編輯');clearPreview();setMoveOffset({x:0,y:0,z:0});setError('');}
    catch(e){setPending({...pending,valid:false,message:e instanceof Error?e.message:'變更失敗'});}
  }
  function history(redo=false){
    try {publish(redo?engine.redo():engine.undo(),redo?'重做':'復原');clearPreview();setMoveOffset({x:0,y:0,z:0});setError('');}
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
  const axisBounds=useMemo(()=>{let min=Infinity,max=-Infinity;for(const b of project.blocks){const n=b.pos[cutAxis||'x'];min=Math.min(min,n);max=Math.max(max,n);}return project.blocks.length?{min,max}:{min:0,max:0};},[project,cutAxis]);
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
  return <main className={`studio design-studio${editingFocus?' editing-focus':''}${showOverview?'':' overview-collapsed'}`} onPointerDownCapture={event=>{if(!(event.target as HTMLElement).closest('.cad-context-menu'))setContextMenu(null);}} onKeyDownCapture={event=>{
    const element=event.target as HTMLElement;
    if(element.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')||event.nativeEvent.isComposing)return;
    const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
    const consume=()=>{event.preventDefault();event.stopPropagation();};
    if(key==='escape'){consume();if(contextMenu){setContextMenu(null);return;}if(viewer.current?.cancelDrag())return;if(pending)clearPreview();else setSelected(null);setMoveOffset({x:0,y:0,z:0});document.querySelectorAll<HTMLDetailsElement>('.utility-drawer[open]').forEach(d=>d.open=false);return;}
    if(mod&&key==='s'){consume();if(persistence.ready)void persistence.save();return;}
    if(buildMode||exploded||!persistence.ready)return;
    if(mod&&(key==='z'||key==='y')){consume();if(key==='y'||event.shiftKey){if(engine.canRedo)history(true);}else if(engine.canUndo)history();return;}
    if(mod&&key==='a'&&element.tagName==='CANVAS'){consume();const visible=new Set(projection.filter(p=>p.visible).map(p=>p.uid));const ids=project.blocks.filter(b=>visible.has(b.uid)).map(b=>b.uid);if(selectedBlocks(project,ids).length>5000)setError('目前顯示超過 5,000 格。請先用逐層或剖面縮小範圍，再全選。');else{clearPreview();setSelectedUids(ids);setPrimarySelected(ids[0]??null);}return;}
    if(mod)return;
    if((key==='delete'||key==='backspace')&&selection.length){consume();executeSelection('remove');return;}
    if(event.altKey&&['arrowleft','arrowright','arrowup','arrowdown','pageup','pagedown'].includes(key)&&selection.length){consume();const axis=key==='pageup'||key==='pagedown'?'y':key==='arrowleft'||key==='arrowright'?'x':'z';const sign=['arrowleft','arrowup','pagedown'].includes(key)?-1:1;const next={x:0,y:0,z:0,[axis]:sign*(event.shiftKey?10:1)};executeSelection('move',next);return;}
    if(event.altKey)return;
    if(key==='enter'&&pending&&element.tagName==='CANVAS'){consume();confirm();setMoveOffset({x:0,y:0,z:0});return;}
    if(element.tagName==='CANVAS'){
      const tools:Record<string,EditorTool>={v:'select',b:'place',r:'replace',i:'eyedropper'};
      if(tools[key]){consume();setTool(tools[key]);clearPreview();}
      if(key==='s'){consume();const r=host.current?.getBoundingClientRect();if(r)setContextMenu({x:Math.min(r.x+r.width/2,window.innerWidth-210),y:Math.min(r.y+r.height/2,window.innerHeight-250)});}
      if(key==='f'&&block){consume();viewer.current?.focus(block.uid);}
    }
  }}>
    <header className="studio-header"><div className="studio-brand"><span className="brand-mark" aria-hidden="true">▧</span><div><p className="eyebrow">ARCHITECTURE / JAVA 1.20.1</p><h1>BLOCK ATELIER<span>建築設計工作室</span></h1></div></div><div className="header-actions"><button disabled={switching} onClick={()=>void returnToCampus()}>{returnLabel}</button>
      <details className="utility-drawer" data-reference-drawer onToggle={closeOtherDrawers}><summary>設計參考</summary><div className="drawer-content"><button className="drawer-close" onClick={closeDrawer}>關閉面板</button><ReferencePanel projectId={project.id} onSelectionChange={onReferenceSelection}/></div></details>
          <details className="utility-drawer" onToggle={closeOtherDrawers}><summary>專案與備份</summary><div className="drawer-content"><button className="drawer-close" onClick={closeDrawer}>關閉面板</button><ProjectPanel workspace={currentWorkspace} status={persistence.status} onSave={persistence.save} onChange={openWorkspace}/></div></details>

          <details className="utility-drawer" onToggle={closeOtherDrawers}><summary>AI 圖片分析與編輯</summary><div className="drawer-content"><button className="drawer-close" onClick={closeDrawer}>關閉面板</button><AiPanel key={project.id} project={project} onProposal={(raw,scope,audit)=>{try{if(activeProject.current.id!==project.id)throw new Error("專案已切換，請重新產生提案。");const result=validateProposal(engine.snapshot(),raw,scope);stage(result.transaction,audit,result.summary+" "+result.uncertainties.join("；"));}catch(e){clearPreview();setError(e instanceof Error?e.message:"AI 提案無效");}}}/></div></details>

    </div></header>
    {editingFocus&&<section className="editing-heading" aria-label="編輯與儲存"><div><h2>編輯 {project.title}</h2><p>點選、框選、拖動。放開即完成，Ctrl＋Z 隨時復原。</p></div><div className="editing-save"><span role="status">{persistence.status}</span><button disabled={!persistence.ready||switching} onClick={()=>void persistence.save()}>立即儲存</button><button aria-expanded={showOverview} onClick={()=>setShowOverview(value=>!value)}>{showOverview?'收起總覽與參考':'顯示總覽與參考'}</button></div></section>}
    <section className="project-heading"><div><p className="eyebrow">FROM INSPIRATION TO EVERY BLOCK</p><h2>REAL HOUSE <span>→</span> MINECRAFT BUILD</h2><p>看見構造，掌握每一層。從設計參考到你的下一個方塊。</p></div><div className="project-actions"><button disabled={switching} onClick={()=>load('atrium')}>載入玻璃拱廊</button><button disabled={switching} onClick={()=>load(true)}>載入示範木屋</button><button disabled={switching} onClick={()=>load(false)}>空白專案</button></div></section>
    <section className="studio-summary" aria-label="模型摘要"><dl className="stat"><dt>PROJECT / 目前模型</dt><dd>{project.title}</dd></dl><dl className="stat"><dt>寬 × 高 × 深</dt><dd>{bounds.join(' × ')}<small> blocks</small></dd></dl><dl className="stat"><dt>佔用方塊格數</dt><dd data-testid="cell-count">{project.blocks.length.toString()}</dd></dl><dl className="stat"><dt>實際備料物品</dt><dd>{materials.totalInventoryItems??'待確認'}<small> / {materials.items.length} 種</small></dd></dl><dl className="stat"><dt>設計依據</dt><dd className={estimatedCount?'estimated-badge':''}>{estimatedCount?'AI Estimated Area':'手動設計'}<small>{estimatedCount?` ${estimatedCount} 格推估`:''}</small></dd></dl></section>
    <div className="architecture-workspace">
      <aside className="control-rail" aria-label="建築控制">
        <section className="reference-card"><div className="panel-heading"><span className="eyebrow">DESIGN REFERENCE</span><button onClick={openReferences}>查看圖冊 ↗</button></div>{referenceImage&&brokenReferenceUrl!==referenceImage.url?<img src={referenceImage.url} alt={referenceImage.title} onError={()=>setBrokenReferenceUrl(referenceImage.url)}/>:<button className="reference-placeholder" onClick={openReferences}>{referenceImage?'圖片無法顯示 · 重新選擇參考':'＋ 加入你的設計照片'}</button>}<div className="reference-caption"><strong>{referenceImage?.title??'你的設計參考'}</strong><p>{referenceImage?.notes??'從圖冊選擇圖片，或加入本機照片。'}</p><span>概念／設計推估 · 非原圖精確量測</span></div></section>
        <details className="controls-section" open={!editingFocus||buildMode}><summary>材料與施工引導</summary><BuildControls {...buildProps}/></details>
            <details className="editor-section primary-editor" open={editingFocus}><summary>編輯工具與方塊</summary>
      <EditorPanel tool={tool} onTool={v=>{setTool(v);clearPreview();}} blockId={blockId} onBlockId={id=>{setBlockId(id);setBlockState(normalizeBlockState(id,{}));clearPreview();}} state={blockState} onState={s=>{setBlockState(s);clearPreview();}} workY={workY} onWorkY={setWorkY} collision={collision} onCollision={v=>{setCollision(v);clearPreview();}} canUndo={engine.canUndo} canRedo={engine.canRedo} onUndo={()=>history()} onRedo={()=>history(true)} preview={pending} onConfirm={confirm} onCancel={clearPreview}/>
      <fieldset className="coordinate-editor"><legend>座標操作</legend>{(['x','y','z'] as const).map(axis=><label key={axis}>目標 {axis.toUpperCase()}<input type="number" step="1" min="-30000000" max="30000000" value={target[axis]} onChange={event=>setTarget({...target,[axis]:Number(event.target.value)})}/></label>)}<button disabled={tool==='select'||tool==='eyedropper'} onClick={()=>{if(tool==='place'||tool==='remove'||tool==='replace')stageAction(target,tool);}}>預覽座標操作</button></fieldset>
      <button disabled={!block||block.id!==blockId} onClick={()=>{if(block)try{commitDirect(changeSelectedState(project,block.uid,blockState),'修改方塊狀態');}catch(e){setError(e instanceof Error?e.message:'狀態修改失敗');}}}>將狀態套用到選取方塊</button>
    </details>
    <details className="editor-section generator-section"><summary>本機建築生成</summary><fieldset disabled={!persistence.ready||buildMode||exploded}><GeneratorPanel project={project} onInvalidate={clearPreview} onPreview={transaction=>{stage(transaction,undefined,'本機參數式建築；未使用 AI。');viewer.current?.framePreview();host.current?.scrollIntoView({block:'center',behavior:'smooth'});}} /></fieldset><p>生成後使用預覽列的「套用批次預覽」，整棟可一次復原。</p></details><details className="editor-section"><summary>批次編輯</summary><BatchPanel selectedCount={selection.length} onPreview={request=>{try{stage(batchEdit(project,request,blockId,blockState,collision));}catch(e){viewer.current?.preview([],[],false);setPending({transaction:null,valid:false,message:e instanceof Error?e.message:"批次失敗",records:[],cells:0});}}}/><p>批次共用上方編輯工具的預覽確認與復原按鈕。</p></details>

      </aside>
      <section className="model-stage" aria-label="建築設計畫布">
        <div className="stage-heading"><div><span className="eyebrow">LIVE BLOCK MODEL</span><h2>{project.title}</h2></div><nav aria-label="工作模式"><button aria-pressed={!buildMode} onClick={()=>{setBuildMode(false);clearPreview();}}>編輯模式</button><button aria-pressed={buildMode} onClick={()=>{setBuildMode(true);clearPreview();}}>施工模式</button></nav></div>
        <section className="viewport-panel" aria-label="模型檢視"><div className="cad-command-bar" role="toolbar" aria-label="CAD 編輯工具">{([{id:'select',label:'選取'},{id:'place',label:'放置'},{id:'replace',label:'替換'},{id:'eyedropper',label:'吸取'}] as const).map(t=><button key={t.id} aria-pressed={tool===t.id} onClick={()=>{setTool(t.id);clearPreview();}}>{t.label}</button>)}<span className="cad-tool-divider"/><button aria-label="復原上一步" disabled={!engine.canUndo} onClick={()=>history()}>復原</button><button aria-label="重做上一步" disabled={!engine.canRedo} onClick={()=>history(true)}>重做</button><span className="cad-grid-note">吸附 1 格</span></div>      <CameraToolbar onPreset={p=>viewer.current?.preset(p)} onReset={()=>viewer.current?.reset()} onFocus={()=>{if(selected)viewer.current?.focus(selected);}} hasSelection={!!block}/>
      <div className="viewport-host" ref={host} onContextMenu={event=>{event.preventDefault();setContextMenu({x:Math.max(8,Math.min(event.clientX,window.innerWidth-218)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-260))});}}><p className="viewer-status" role="status">{error?'未修改：'+error:dragFeedback|| (project.blocks.length?'左鍵選取 · Ctrl 多選 · 拖曳軸向箭頭移動':'空白專案 · 在工作平面放置第一個方塊')}</p><span className="viewer-reticle" aria-hidden="true">＋</span><p className="viewer-help" id="viewer-help">左鍵選取／空白框選 · Ctrl 點選多選<br/>中鍵旋轉 · Ctrl＋中鍵平移 · 滾輪縮放<br/>拖曳 XYZ 箭頭移動 · Delete 刪除 · Ctrl＋Z 復原<br/>右鍵／S：快捷選單 · Esc：取消拖曳<br/>觸控：單指旋轉、雙指縮放／平移</p></div>
</section>
        <section className="selection-actions cad-selection-properties" aria-label="選取方塊快捷編輯"><div><strong>{selection.length?`已選取 ${selection.length} 格${block?' · '+block.id.replace('minecraft:',''):''}`:'點選方塊，或在空白處拖出選取框'}</strong>{block&&<span> X {block.pos.x} · Y {block.pos.y} · Z {block.pos.z}</span>}</div>
          <div className="selection-action-buttons"><button disabled={!selection.length||buildMode||exploded} onClick={()=>executeSelection('remove')}>刪除選取</button><button disabled={!block||selection.length!==1||buildMode||exploded} onClick={()=>{if(block)executeAt(block.pos,'replace');}}>替換材質</button><button disabled={!block} onClick={()=>{if(block)viewer.current?.focus(block.uid);}}>聚焦</button><button aria-pressed={additiveSelection} onClick={()=>{setTool('select');setAdditiveSelection(v=>!v);clearPreview();}}>多選 {additiveSelection?'開啟':'關閉'}</button><button disabled={!selection.length} onClick={()=>{clearPreview();setSelected(null);}}>清除選取</button></div>
          <details className="selection-move"><summary>精確位移／複製</summary><div className="selection-offset">{(['x','y','z'] as const).map(axis=><label key={axis}>位移 {axis.toUpperCase()}<input type="number" step="1" value={moveOffset[axis]} onChange={e=>{clearPreview();setMoveOffset(v=>({...v,[axis]:Number(e.target.value)}));}}/></label>)}</div><button disabled={!selection.length||buildMode||exploded} onClick={()=>executeSelection('move')}>移動選取</button><button disabled={!selection.length||buildMode||exploded} onClick={()=>executeSelection('copy')}>複製選取</button></details>
          <details className="keyboard-guide"><summary>操作說明</summary><p>左鍵選取，Ctrl／⌘＋點選增減選取。空白處由左往右框選完整包住的方塊；由右往左框選碰到的方塊。框選會選到目前顯示範圍內的前後各層，室內編輯建議先剖面或逐層。</p><p>選取後拖 XYZ 箭頭沿單軸移動；直接拖選取方塊沿 XZ 移動，Shift 拖曳改高度。吸附整數格，放開完成，碰撞會取消。門與床會整組處理。</p><p>中鍵拖曳旋轉 · Ctrl＋中鍵平移 · 滾輪縮放。右鍵或 S 開啟快捷選單。</p><p>Delete／Backspace 直接刪除 · Ctrl／⌘＋Z 復原 · Ctrl／⌘＋Shift＋Z 重做 · Ctrl／⌘＋S 儲存。Escape 取消拖曳或清除選取。</p><p>Alt＋方向鍵移動 X/Z；Alt＋PageUp／PageDown 移動 Y；加 Shift 為 10 格。V 選取、B 放置、R 替換、I 吸取、F 聚焦。</p><p>每次最多 5,000 格；Ctrl／⌘＋A 全選目前顯示。文字欄位保留原生快捷鍵。批次與 AI 提案仍可預覽後套用。</p></details>
          {pending&&<div className="selection-preview" role="status"><p>{pending.cells} 格 · {pending.message}</p><button disabled={!pending.valid} onClick={confirm}>套用批次預覽</button><button onClick={clearPreview}>取消預覽</button></div>}
        </section>
        <details className="view-options"><summary>剖面、材質與推估區域</summary><div className="view-options-grid">
          <label><input type="checkbox" checked={hideRoof} onChange={e=>setHideRoof(e.target.checked)}/>隱藏屋頂</label><label><input type="checkbox" checked={ghostFuture} onChange={e=>setGhostFuture(e.target.checked)}/>Ghost Completed House</label><label><input type="checkbox" checked={estimatedOnly} onChange={e=>setEstimatedOnly(e.target.checked)}/>高亮 AI Estimated Area</label>
          <label>室內剖面<select aria-label="剖面軸" value={cutAxis} onChange={e=>{setCutAxis(e.target.value as ''|'x'|'z');setCutValue(0);}}><option value="">完整建築</option><option value="x">X 左右剖面</option><option value="z">Z 前後剖面</option></select></label>{cutAxis&&<label>保留 {cutAxis.toUpperCase()} ≤ {cutValue}<input aria-label="剖面位置" type="range" min={axisBounds.min} max={axisBounds.max} value={Math.max(axisBounds.min,Math.min(axisBounds.max,cutValue))} onChange={e=>setCutValue(Number(e.target.value))}/></label>}
          <label>搜尋並高亮方塊<input aria-label="高亮方塊" value={materialFocus} onChange={e=>setMaterialFocus(e.target.value)} placeholder="例如 quartz、glass"/></label>
          <fieldset className="material-visibility"><legend>材質顯示</legend>{materialIds.map(id=><label key={id}><input type="checkbox" checked={!hiddenMaterials.includes(id)} onChange={e=>setHiddenMaterials(v=>e.target.checked?v.filter(x=>x!==id):[...v,id])}/>{id.replace('minecraft:','')}</label>)}</fieldset>
        </div></details>
            <details className="blueprint-section"><summary>2D 逐層藍圖</summary><BlueprintPanel project={project} selected={selected} layer={layer} onLayer={setLayer} onCell={pos=>{const b=engine.getAt(pos);setSelected(b?.uid??null);setTarget(pos);if(tool==="eyedropper"&&b){setBlockId(b.id);setBlockState(b.state);setTool("place");}else if(tool==="place"||tool==="remove"||tool==="replace")executeAt(pos,tool);}}/></details>

      </section>
      <aside className="inspection-rail" aria-label="材料與檢查器"><details className="materials-section" open={!editingFocus||buildMode}><summary>材料清單</summary><MaterialsPanel {...buildProps}/></details><BlockInspector block={block} unsupportedCount={shapes.filter(s=>!s.supported).length}/></aside>
    </div>
    {(!editingFocus||buildMode)&&<ProgressDock {...buildProps}/>}
    {contextMenu&&<div className="cad-context-menu" role="menu" aria-label="方塊快捷選單" style={{left:contextMenu.x,top:contextMenu.y}}><strong>{selection.length} 格已選取</strong><button role="menuitem" aria-label="刪除選取" disabled={!selection.length||buildMode||exploded} onClick={()=>executeSelection('remove')}>刪除選取 <kbd>Delete</kbd></button><button role="menuitem" disabled={!selection.length} onClick={()=>{setContextMenu(null);const el=document.querySelector<HTMLDetailsElement>('.selection-move');if(el){el.open=true;el.scrollIntoView({block:'nearest'});el.querySelector('input')?.focus();}}}>精確移動／複製</button><button role="menuitem" disabled={!block} onClick={()=>{if(block)viewer.current?.focus(block.uid);setContextMenu(null);}}>聚焦選取</button><button role="menuitem" disabled={!engine.canUndo} onClick={()=>{history();setContextMenu(null);}}>復原 <kbd>Ctrl Z</kbd></button><button role="menuitem" disabled={!engine.canRedo} onClick={()=>{history(true);setContextMenu(null);}}>重做</button><button role="menuitem" onClick={()=>setContextMenu(null)}>關閉</button></div>}
    <footer className="studio-footer"><span className="save-indicator">● {persistence.status}</span><span>＋X 東 / ＋Y 上 / ＋Z 南 · Java 1.20.1</span><details><summary>設計與施工說明</summary><p>所有座標、材料與下載均來自同一份方塊模型。參考建築為概念圖的比例設計，全部推估座標標記 AI Estimated Area。原版方塊與狀態經資料驗證，實際施工仍需在遊戲中確認承托與通行。材質為自行製作的示意紋理。</p>{project.blocks.length>=10000&&<p>整棟建築可在同一專案施工；大型模型建議逐層檢視，互動速度依裝置而異。</p>}</details></footer>
  </main>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<StrictMode><App/></StrictMode>);
