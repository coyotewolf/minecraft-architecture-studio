import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlockRecord, Project } from '../../core/contracts.ts';
import { createGoldenLeafProject, GOLDEN_LEAF_DESIGN } from '../../fixtures/buildings/golden-leaf.ts';
import { createCampusViewer, type CampusViewer } from '../campus/overview-runtime.js';
import { listWorkspaceSummaries, loadWorkspace, type WorkspaceSummary } from '../projects/storage.ts';
import { copyEntry, deserializeBuildingImport, MAX_COLLECTION_BYTES, parseCollection, type BuildingCollection, type CollectionEntry } from './storage.ts';
import { createLibraryEntry, loadLibrary, loadLibraryEntry, saveLibrary, type Library, type LibraryEntry } from './library.ts';
import './collection.css';

export interface CollectionPanelProps { onOpen:(project:Project)=>void; onCampus:()=>void }
function initialCollection():BuildingCollection {return parseCollection({schemaVersion:2,name:'我的建築收藏',entries:[{id:'golden-leaf',name:'金葉之塔（100 格・葉片比例重製版 V14）',notes:'整棟設計高度 ≤100 格，包含基座、塔頂與裝飾。依正面與背面參考圖推估；尺寸、方塊數與室內配置是可編輯的設計，不是原圖精確還原。',reference:'golden-leaf',project:createGoldenLeafProject()}]});}
const selectionKey='minecraft-building-collection-active';
function rememberedEntry(c:Library){try{const id=localStorage.getItem(selectionKey);if(c.entries.some(e=>e.id===id))return id!;}catch{/* A blocked preference store must not block the building collection. */}return c.entries[0]?.id??'';}
function download(text:string|Blob,name='building-collection.json'){const url=URL.createObjectURL(text instanceof Blob?text:new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function setComparisonCamera(v:CampusViewer,blocks:readonly BlockRecord[],host:HTMLElement|null,view:'front'|'rear'){
 if(!blocks.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of blocks)for(const [i,a] of (['x','y','z'] as const).entries()){min[i]=Math.min(min[i]!,b.pos[a]);max[i]=Math.max(max[i]!,b.pos[a]+1);}
 const width=max[0]!-min[0]!,aspect=(host?.clientWidth||500)/(host?.clientHeight||500),pitch=14,angle=pitch*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),side=view==='front'?1:-1;
 let low=Infinity,high=-Infinity;for(const b of blocks){low=Math.min(low,b.pos.y*cos+(side>0?b.pos.z:b.pos.z+1)*side*sin);high=Math.max(high,(b.pos.y+1)*cos+(side>0?b.pos.z+1:b.pos.z)*side*sin);}
 const cz=(min[2]!+max[2]!)/2,cy=((low+high)/2-side*cz*sin)/cos;v.preset('front');const c=v.camera();v.setCamera({...c,projection:'orthographic',yaw:view==='front'?180:0,pitch,span:Math.max(high-low,width/aspect)*1.08,target:[(min[0]!+max[0]!)/2,cy,cz]});
}
export function CollectionPanel({onOpen,onCampus}:CollectionPanelProps){
 const [collection,setCollection]=useState<Library|null>(null),[active,setActive]=useState(''),[project,setProject]=useState<Project|null>(null);
 const [status,setStatus]=useState('正在讀取本機收藏…'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const [saved,setSaved]=useState<WorkspaceSummary[]>([]),[savedId,setSavedId]=useState(''),[reference,setReference]=useState<'front'|'rear'>('front'),[picked,setPicked]=useState<string|null>(null);
 const [previewEpoch,setPreviewEpoch]=useState(0);
 const unsavedInitial=useRef<Project|null>(null);
 const host=useRef<HTMLDivElement>(null),viewer=useRef<CampusViewer|null>(null),loadQueue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{
  let alive=true;
  void (async()=>{
   try{
    let c=await loadLibrary();if(!alive)return;
    let requestedId='';const notices:string[]=[];
    if(!c){const initial=initialCollection();c={name:initial.name,entries:initial.entries.map(createLibraryEntry)};try{await saveLibrary(c,initial.entries.map(e=>e.project));}catch(e){unsavedInitial.current=initial.entries[0]!.project;notices.push('尚未儲存至瀏覽器：'+String(e)+'。可先下載完整建築 JSON 備份。');}}
    if(new URLSearchParams(location.search).get('revision')===GOLDEN_LEAF_DESIGN.revision){
     requestedId=c.entries.find(e=>e.reference==='golden-leaf'&&e.revision===GOLDEN_LEAF_DESIGN.revision)?.id??'';
     // Old indexes have no revision metadata. Inspect only the newest candidate, never inflate the library.
     const last=c.entries.at(-1);
     if(!requestedId&&last?.reference==='golden-leaf'&&last.revision===undefined){
      try{const candidate=await loadLibraryEntry(last);if(candidate.designRevision===GOLDEN_LEAF_DESIGN.revision){requestedId=last.id;c={...c,entries:c.entries.map(e=>e.id===last.id?{...e,revision:candidate.designRevision,cellCount:candidate.blocks.length}:e)};}}catch{/* A broken historical record must not prevent adding a new design. */}
     }
     if(!requestedId)try{
      const added=copyEntry(initialCollection().entries[0]!),next={...c,entries:[...c.entries,createLibraryEntry(added)]};
      await saveLibrary(next,[added.project]);c=next;requestedId=added.id;
     }catch(e){notices.push('新版尚未加入：'+String(e)+'。已開啟原有收藏，建築與筆記均保留。');}
    }
    if(!alive)return;
    setCollection(c);setActive(requestedId||rememberedEntry(c));setStatus(notices.join(' ')||'已載入本機收藏');
    if(requestedId){const url=new URL(location.href);url.searchParams.delete('revision');history.replaceState(history.state,'',url);}
    try{const summaries=await listWorkspaceSummaries();if(alive)setSaved(summaries);}catch(e){if(alive)setStatus(s=>s+'；施工專案清單暫時無法讀取：'+String(e));}
   }catch(e){if(alive){setFailed(true);setStatus(String(e));}}
  })();
  return()=>{alive=false;};
 },[]);
 const entry=collection?.entries.find(e=>e.id===active);
 const selectedEntry=useRef<LibraryEntry|undefined>(undefined);selectedEntry.current=entry;
 useEffect(()=>{
  if(!active)return;
  let alive=true;const next=selectedEntry.current;
  viewer.current?.dispose();viewer.current=null;setProject(null);setPicked(null);setLoading(true);setFailed(false);
  // Serialize model reads so rapid clicks cannot decompress several buildings simultaneously.
  loadQueue.current=loadQueue.current.then(async()=>{
   if(!alive||!next)return;
   try{const p=unsavedInitial.current?.id===next.projectId?unsavedInitial.current:await loadLibraryEntry(next);if(alive){setProject(p);unsavedInitial.current=null;}}
   catch(e){if(alive){setFailed(true);setStatus('此建築暫時無法載入：'+String(e)+'。其他收藏仍可選取，原資料未被覆寫。');}}
   finally{if(alive)setLoading(false);}
  });
  try{localStorage.setItem(selectionKey,active);}catch{/* Preferences are optional. */}
  return()=>{alive=false;};
 },[active]);
 const blocks=useMemo(()=>project?.blocks??[],[project]);
 const dimensions=useMemo(()=>{if(!blocks.length)return {width:0,height:0,depth:0,minY:0,maxY:0};let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;for(const b of blocks){minX=Math.min(minX,b.pos.x);minY=Math.min(minY,b.pos.y);minZ=Math.min(minZ,b.pos.z);maxX=Math.max(maxX,b.pos.x);maxY=Math.max(maxY,b.pos.y);maxZ=Math.max(maxZ,b.pos.z);}return {width:maxX-minX+1,height:maxY-minY+1,depth:maxZ-minZ+1,minY,maxY};},[blocks]);
 useEffect(()=>{if(!host.current||!blocks.length||failed)return;try{const v=createCampusViewer(host.current,blocks,setPicked,undefined,{background:0x121719,ocean:false,label:'收藏建築 3D 模型'});viewer.current=v;setComparisonCamera(v,blocks,host.current,'front');return()=>{v.dispose();viewer.current=null;};}catch(e){setStatus('預覽無法建立：'+String(e));}},[blocks,failed,previewEpoch]);
 const selected=blocks.find(b=>b.uid===picked),revision=project?.designRevision??entry?.revision??'';
 function updateEntry(patch:Partial<Pick<CollectionEntry,'name'|'notes'>>){if(collection&&entry){setCollection({...collection,entries:collection.entries.map(e=>e.id===entry.id?{...e,...patch}:e)});setStatus('有尚未儲存的名稱或筆記');}}
 async function action(work:()=>Promise<void>){setBusy(true);setStatus('正在處理，請稍候…');try{await work();}catch(e){setStatus(String(e));}finally{setBusy(false);}}
 function currentLibrary():Library|null{
  if(!collection)return null;
  if(!entry||!project||project.id!==entry.projectId)return collection;
  return {...collection,entries:collection.entries.map(e=>e.id===entry.id?createLibraryEntry({id:e.id,name:e.name,notes:e.notes,reference:e.reference,project}):e)};
 }
 async function persist(){const next=currentLibrary();if(!next)return;await saveLibrary(next,project?[project]:[]);setCollection(next);setStatus('已儲存至此瀏覽器');}
 async function addEntries(incoming:readonly CollectionEntry[],message:string){
  const current=currentLibrary();if(!current)return;
  const copies=incoming.map(e=>copyEntry(e)),next={...current,entries:[...current.entries,...copies.map(createLibraryEntry)]};
  await saveLibrary(next,[...(project?[project]:[]),...copies.map(e=>e.project)]);
  setCollection(next);setActive(copies[0]?.id??active);setStatus(message);
 }
 async function showLatest(){
  if(!collection)return;
  const latest=collection.entries.find(e=>e.reference==='golden-leaf'&&e.revision===GOLDEN_LEAF_DESIGN.revision);
  if(latest){await persist();setActive(latest.id);setPicked(null);setStatus('已顯示 V14 葉片比例重製版；原有建築與編輯完整保留');}
  else await addEntries(initialCollection().entries,'已加入 V14 葉片比例重製版金葉塔；原有建築與編輯完整保留');
 }
 async function exportLibrary(){
  if(!collection)return;
  const chunks:Blob[]=[];let size=0;
  function push(text:string){const blob=new Blob([text]);size+=blob.size;if(size>MAX_COLLECTION_BYTES)throw new Error('收藏備份超過 512 MiB；請分別下載完整建築 JSON');chunks.push(blob);}
  push('{"schemaVersion":2,"name":'+JSON.stringify(collection.name)+',"entries":[');
  for(let i=0;i<collection.entries.length;i++){const e=collection.entries[i]!;const p=e.id===active&&project?project:await loadLibraryEntry(e);push((i?',':'')+JSON.stringify({id:e.id,name:e.name,notes:e.notes,reference:e.reference,project:p}));}
  push(']}');download(new Blob(chunks,{type:'application/json'}));setStatus('已匯出完整模型與收藏筆記；施工進度請另用施工專案備份');
 }
 function camera(view:'front'|'rear'|'top'|'iso'){const v=viewer.current;if(!v)return;if(view==='front'||view==='rear'){setComparisonCamera(v,blocks,host.current,view);}else v.preset(view);}
 return <main className="collection-page">
  <header className="collection-header"><div><span className="collection-eyebrow">BUILDING COLLECTION · JAVA 1.20.1</span><h1>獨立建築收藏</h1><p>逐棟保存設計，隨時回到施工。景觀組合尚未開放。</p></div><button onClick={()=>void action(async()=>{await persist();onCampus();})} disabled={busy}>返回基地總覽</button></header>
  <p role="status" className={failed?'collection-status error':'collection-status'}>{status}</p>
  {collection&&<>
   {entry?.reference==='golden-leaf'&&revision!==GOLDEN_LEAF_DESIGN.revision&&<div className="collection-status" role="region" aria-label="金葉塔更新"><strong>你目前查看的是先前設計。V14 金葉曲面修正版已可使用。</strong> <button disabled={busy||loading} onClick={()=>void action(showLatest)}>查看新版 V14</button><span> 原有建築與編輯會保留。</span></div>}
   <section className="collection-project" aria-label="收藏專案"><label>收藏專案名稱<input disabled={busy} maxLength={200} value={collection.name} onChange={e=>{setCollection({...collection,name:e.target.value});setStatus('有尚未儲存的名稱或筆記');}}/></label><button disabled={busy||loading} onClick={()=>void action(persist)}>儲存收藏</button><button disabled={busy||loading} onClick={()=>void action(exportLibrary)}>匯出收藏備份</button><label className="collection-import">加入建築或收藏備份<input aria-label="匯入收藏備份" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void action(async()=>{viewer.current?.dispose();viewer.current=null;try{if(file.size>MAX_COLLECTION_BYTES)throw new Error('檔案超過 512 MiB');await addEntries(deserializeBuildingImport(await file.text()).entries,'已加入備份中的建築；原有施工專案保持不變');}finally{setPreviewEpoch(n=>n+1);}});}}/></label></section>
   <div className="collection-layout"><aside className="collection-library" aria-label="收藏建築"><h2>建築清單 <small>{collection.entries.length}</small></h2>{collection.entries.map(e=><button key={e.id} disabled={busy} className={e.id===active?'active':''} aria-pressed={e.id===active} onClick={()=>{if(e.id!==active){setProject(null);setLoading(true);setActive(e.id);setPicked(null);}}}><strong>{e.name}</strong><span>{(e.id===active&&project?blocks.length:e.cellCount)?.toLocaleString()??'開啟後計算'} 格 · 完整建築</span></button>)}<div className="collection-add"><button disabled={busy||loading} onClick={()=>void action(async()=>{await addEntries(initialCollection().entries,'已加入 V14 葉片比例重製版金葉塔；原有建築與編輯完整保留');})}>載入新版金葉塔</button><p>新增 V14 葉片比例重製版：收窄上肩、重配前後金葉厚薄，重做短尖與斜向疊葉。保留原有設計與編輯。</p><h3>加入已有設計</h3><label>本機施工專案<select aria-label="加入的施工專案" value={savedId} onChange={e=>setSavedId(e.target.value)}><option value="">選擇已儲存專案</option>{saved.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label><button disabled={!savedId||busy} onClick={()=>void action(async()=>{const workspace=await loadWorkspace(savedId);if(!workspace)throw new Error('找不到施工專案');const p=workspace.project;await addEntries([{id:'copy',name:p.title,notes:'從本機施工專案建立的獨立副本。',reference:null,project:p}],'已加入獨立副本；原專案不受影響');})}>加入獨立副本</button></div></aside>
   {entry?<article className="collection-building"><div className="collection-building-title"><div><span className="collection-eyebrow">ASSEMBLED MODEL</span><h2>{entry.name}</h2>{entry.reference==='golden-leaf'&&/^golden-leaf-100-v\d+$/.test(revision)&&revision!==GOLDEN_LEAF_DESIGN.revision&&<p className="collection-caption">目前顯示較早版本。請按「載入新版金葉塔」加入 V14 葉片比例重製版；原建築會保留。</p>}</div><span>{blocks.length.toLocaleString()} 格 · {new Set(blocks.map(b=>b.id)).size} 種方塊</span></div>
    <div className="collection-dimensions" aria-label="建築實際尺寸"><strong data-testid="collection-dimensions">寬 {dimensions.width} × 高 {dimensions.height} × 深 {dimensions.depth} 格</strong><span data-testid="collection-design-version">{revision.match(/^golden-leaf-100-v(\d+)$/)?.[1]?'模型 V'+revision.match(/^golden-leaf-100-v(\d+)$/)![1]:'自訂／編輯版本'}</span><span>依實際方塊計算 · {blocks.length?'Y '+dimensions.minY+' 至 '+dimensions.maxY:'尚無方塊'}</span>{entry.reference==='golden-leaf'&&<span className="collection-version">{dimensions.height>0&&dimensions.height<=100?'金葉塔 · 符合整棟高度 ≤100 格規格':'保留目前設計；可另行載入 100 格新版'}</span>}</div>
    <div className="collection-comparison"><section className="collection-model"><div className="collection-preview" ref={host} aria-label="完整建築預覽">{loading&&<p role="alert">正在載入這棟建築…其他模型保留於本機。</p>}{failed&&<p role="alert">這棟建築暫時無法預覽，請選擇其他建築；原資料仍保留。</p>}</div><div className="collection-camera" aria-label="收藏視角">{(['front','rear','top','iso'] as const).map((v,i)=><button key={v} onClick={()=>camera(v)}>{['正面','背面','俯視','等角'][i]}</button>)}</div>
    <p className="collection-caption">{failed?'目前顯示收藏快照資料，非最新合併模型。':'完整預覽與施工使用同一份建築方塊模型。'}{blocks.filter(b=>b.source.origin==='ai_estimated'||b.source.origin==='inferred').length.toLocaleString()} 格為推估。{selected&&'選取 '+selected.id+' · XYZ '+[selected.pos.x,selected.pos.y,selected.pos.z].join(', ')}</p></section>
    {entry.reference==='golden-leaf'&&<section className="collection-reference"><div><h3>參考圖對照</h3><button aria-pressed={reference==='front'} onClick={()=>{setReference('front');camera('front');}}>正面參考</button><button aria-pressed={reference==='rear'} onClick={()=>{setReference('rear');camera('rear');}}>背面參考</button><p>參考圖僅供對照，不會替代 3D 方塊模型。</p><p>100 格新版目前於本機比較；既有 Higgsfield 場景為舊版，未代表此模型。</p></div><img src={'/local-references/golden-leaf-'+reference+'.png'} alt={reference==='front'?'金葉建築正面參考圖':'金葉建築背面參考圖'}/></section>}
    </div><section className="collection-metadata"><label>建築名稱<input maxLength={200} value={entry.name} onChange={e=>updateEntry({name:e.target.value})}/></label><label>建築筆記<textarea disabled={busy} maxLength={10000} rows={3} value={entry.notes} onChange={e=>updateEntry({notes:e.target.value})}/></label></section>
    <section className="collection-parts"><h3>完整建築施工</h3><p>整棟建築在同一個專案編輯、備料與施工。儲存後回到收藏，會載入最新模型。</p><div><button disabled={busy||loading||failed||!project} onClick={()=>void action(async()=>{await persist();viewer.current?.dispose();viewer.current=null;if(project)onOpen(project);})}>開啟完整建築施工</button><button disabled={busy||loading||failed||!project} onClick={()=>void action(async()=>{if(!project)return;download(JSON.stringify(project),entry.name.replace(/[\\/:*?"<>|]/g,'-')+'.json');setStatus('已下載單棟完整建築 JSON；可匯入施工專案繼續編輯');})}>下載完整建築 JSON</button></div></section>
   </article>:<p>收藏尚無建築，請加入施工專案或匯入備份。</p>}</div>
   <footer>資料只保存在此瀏覽器。清除網站資料會移除收藏；請定期匯出備份。備份含方塊、狀態、來源與筆記，不含施工歷程。</footer>
  </>}
 </main>;
}
