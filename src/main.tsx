import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEmptyProject } from './core/project.ts';
import { createDemoProject } from './fixtures/two-floor-house.ts';
import { shapeForBlock } from './features/viewer/geometry.ts';
import { createViewer, type ViewerHandle } from './features/viewer/runtime.js';
import { CameraToolbar, BlockInspector } from './features/viewer/ViewerPanels.tsx';
import './style.css';

export function App() {
  const [project, setProject] = useState(createDemoProject);
  const [selected, setSelected] = useState<string|null>(null);
  const [error, setError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerHandle|null>(null);
  const shapes = useMemo(()=>project.blocks.map(shapeForBlock),[project.blocks]);
  const block = project.blocks.find(b=>b.uid===selected)??null;
  useEffect(()=>{
    if(!host.current)return;
    try {viewer.current=createViewer(host.current,project.blocks,shapes,setSelected,setError);}
    catch(e){setError(e instanceof Error?e.message:'3D 初始化失敗');}
    return ()=>{viewer.current?.dispose();viewer.current=null;};
  },[project.blocks,shapes]);
  useEffect(()=>{viewer.current?.select(selected);},[selected]);
  const bounds = useMemo(()=>{
    if(!project.blocks.length)return [0,0,0];
    return (['x','y','z'] as const).map(axis=>{let min=Infinity,max=-Infinity;for(const b of project.blocks){min=Math.min(min,b.pos[axis]);max=Math.max(max,b.pos[axis]);}return max-min+1;});
  },[project.blocks]);
  function load(demo:boolean){setSelected(null);setError('');setProject(demo?createDemoProject():createEmptyProject('empty','空白專案'));}
  return <main className="studio">
    <header className="studio-header"><div><p className="eyebrow">MINECRAFT ARCHITECTURE STUDIO</p><h1>從方塊，看見建築</h1><p>Java 1.20.1 · 3D 檢視工作台</p></div><div className="project-actions"><button onClick={()=>load(true)}>載入示範木屋</button><button onClick={()=>load(false)}>空白專案</button></div></header>
    <section className="studio-summary" aria-label="模型摘要"><dl className="stat"><dt>目前模型</dt><dd>{project.title}</dd></dl><dl className="stat"><dt>佔用方塊格數</dt><dd data-testid="cell-count">{project.blocks.length}</dd></dl><dl className="stat"><dt>寬 × 高 × 深</dt><dd>{bounds.join(' × ')}</dd></dl><dl className="stat"><dt>版本</dt><dd>Java {project.minecraftVersion}</dd></dl></section>
    <div className="studio-workspace"><section className="viewport-panel" aria-label="模型檢視">
      <CameraToolbar onPreset={p=>viewer.current?.preset(p)} onReset={()=>viewer.current?.reset()} onFocus={()=>{if(selected)viewer.current?.focus(selected);}} hasSelection={!!block}/>
      <div className="viewport-host" ref={host}><p className="viewer-status" role="status">{error?'無法啟動 3D：'+error:project.blocks.length?'展示模型 · 點選方塊查看資料':'空白專案 · 尚無方塊'}</p><span className="viewer-reticle" aria-hidden="true">＋</span><p className="viewer-help" id="viewer-help">拖曳旋轉 · 右鍵拖曳平移 · 滾輪縮放<br/>觸控：單指旋轉、雙指縮放／平移<br/>鍵盤：方向鍵旋轉、Shift＋方向鍵平移、＋／− 縮放、Enter 選取中心方塊</p></div>
    </section><BlockInspector block={block} unsupportedCount={shapes.filter(s=>!s.supported).length}/></div>
    <p className="capability-note">展示模型為手工建立；材質使用示意色，未使用 Minecraft 遊戲貼圖。現在可檢視與選取；編輯、儲存、材料清單與 AI 生成功能仍在後續階段。</p>
    <footer className="studio-footer">座標：＋X 向東、＋Y 向上、＋Z 向南；北方為 −Z。這個專案目前只保留在記憶體中。</footer>
  </main>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<StrictMode><App/></StrictMode>);
