import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../../core/contracts.ts';
import { createCampus, assembleCampus, campusToCsv, campusToJson, type Campus } from '../../fixtures/campus/index.ts';
import { inventory } from '../build/model.ts';
import { loadWorkspace } from '../projects/storage.ts';
import { createCampusViewer, type CampusViewer } from './overview-runtime.js';
import './campus.css';
interface Props {onOpen:(project:Project)=>void}
function download(data:string,name:string,type:string){const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export function CampusPanel({onOpen}:Props){
 const [campus,setCampus]=useState<Campus>(()=>createCampus()),[selected,setSelected]=useState(''),[error,setError]=useState(''),[picked,setPicked]=useState<string|null>(null),[ready,setReady]=useState(false),[cut,setCut]=useState(false);
 const host=useRef<HTMLDivElement>(null),viewer=useRef<CampusViewer|null>(null);
 useEffect(()=>{let canceled=false;void Promise.all(createCampus().districts.map(async d=>{const saved=await loadWorkspace(d.project.id);return saved?{...d,project:saved.project}:d;})).then(ds=>{if(!canceled){setCampus(assembleCampus(ds));setReady(true);}}).catch(e=>{if(!canceled){setError('本機分區無法合併：'+String(e));setReady(true);}});return()=>{canceled=true;};},[]);
 const district=campus.districts.find(d=>d.id===selected);
 const allBlocks=district?.project.blocks??campus.blocks;
 const blocks=useMemo(()=>{if(!cut)return allBlocks;let zMin=Infinity,zMax=-Infinity;for(const b of allBlocks){zMin=Math.min(zMin,b.pos.z);zMax=Math.max(zMax,b.pos.z);}return allBlocks.filter(b=>b.pos.z<=(zMin+zMax)/2);},[allBlocks,cut]);
 const materials=useMemo(()=>district?inventory(district.project):{items:campus.items,totalInventoryItems:campus.totalItems},[district,campus]);
 useEffect(()=>{if(!host.current)return;try{const v=createCampusViewer(host.current,blocks,uid=>setPicked(uid));viewer.current=v;return()=>{v.dispose();viewer.current=null;};}catch(e){setError('模型顯示失敗：'+String(e));}},[blocks]);
 useEffect(()=>{viewer.current?.select(picked);},[picked,blocks]);
 const pickedBlock=allBlocks.find(b=>b.uid===picked);
 const dimensions=useMemo(()=>{const result=[];for(const axis of ['x','y','z'] as const){let min=Infinity,max=-Infinity;for(const b of allBlocks){min=Math.min(min,b.pos[axis]);max=Math.max(max,b.pos[axis]);}result.push(max-min+1);}return result;},[allBlocks]);
 function select(id:string){setSelected(id);setPicked(null);setCut(false);setError('');}
 function exportFile(kind:'json'|'csv'|'materials'){try{if(kind==='json')download(campusToJson(campus),'完整基地.block-campus.json','application/json');else if(kind==='csv')download(campusToCsv(campus),'完整基地.XYZ.csv','text/csv;charset=utf-8');else download('Item,Quantity,StackSize,FullStacks,Remainder\r\n'+campus.items.map(i=>[i.itemId,i.required,i.maxStack,i.fullStacks,i.remainder].join(',')).join('\r\n'),'完整基地.材料.csv','text/csv;charset=utf-8');}catch(e){setError(String(e));}}
 return <main className="campus-page">
  <header className="campus-header"><div><p className="eyebrow">BLOCK ATELIER / CAMPUS EDITION</p><h1>群島未來基地</h1><p>11 張設計參考 · 全基地實體方塊 · 分區逐層施工</p></div><div className="campus-actions"><a href="https://higgsfield.ai/3d-jutsu/48489e23-0056-4141-b2a2-d65fa792ee04" target="_blank" rel="noreferrer">Higgsfield 前版場景 ↗</a><button onClick={()=>onOpen(campus.districts[0]!.project)} disabled={!ready}>開始施工</button></div></header>
  <div className="campus-stats" aria-label="全基地統計"><dl><dt>建築分區 / 地景分區</dt><dd>12 / {campus.districts.length-12}</dd></dl><dl><dt>全基地方塊格數</dt><dd data-testid="campus-cells">{campus.blocks.length.toLocaleString()}</dd></dl><dl><dt>全基地備料物品</dt><dd data-testid="campus-items">{campus.totalItems?.toLocaleString()??'待確認'}</dd></dl><dl><dt>目前寬 × 高 × 深</dt><dd>{dimensions.join(' × ')}</dd></dl></div>
  <div className="campus-layout"><aside className="campus-districts" aria-label="基地分區"><button className="campus-district-button" aria-pressed={!selected} onClick={()=>select('')}><strong>全基地總覽</strong><span>12 建築區 + {campus.districts.length-12} 地景施工區</span></button>{campus.districts.map(d=><button key={d.id} className="campus-district-button" aria-pressed={selected===d.id} onClick={()=>select(d.id)}><strong>{d.title}</strong><span>{d.project.blocks.length.toLocaleString()} 格 · {d.references.join(' / ')}</span></button>)}</aside>
   <section className="campus-stage" aria-label="全基地模型"><div className="campus-toolbar"><h2>{district?.title??'完整基地'}</h2>{(['reference','iso','top','front','side'] as const).map((p,i)=><button key={p} onClick={()=>viewer.current?.preset(p)}>{['參考圖視角','等角','俯視','正面','側面'][i]}</button>)}<label><input type="checkbox" checked={cut} onChange={e=>setCut(e.target.checked)}/>切開前半部看室內</label></div><div className="campus-viewport" ref={host}/><p className="campus-notice">拖曳旋轉 · 滾輪／雙指縮放 · 右鍵平移 · 點方塊查看 XYZ。建築、岩島與植栽皆來自施工方塊；藍色海面為展示背景，不列入備料。</p>{error&&<p role="alert">{error}</p>}</section>
   <aside className="campus-detail"><h2>{district?'分區施工檔':'從全景走進每一棟'}</h2><img src={'/local-references/'+(district?.references[0]??'reference-01')+'.png'} alt={district?.title??'原始全基地概念圖'} onError={e=>{e.currentTarget.hidden=true;}}/><p className="campus-notice">AI Estimated Area<br/>概念圖比例重建，所有尺寸、背面與室內補全皆為推估。</p>{district?<><ul className="campus-features">{district.features.map(f=><li key={f}>{f}</li>)}</ul><p>{district.notes}</p><button disabled={!ready} onClick={()=>onOpen(district.project)}>進入此區逐層施工</button><p>共用世界座標；編輯、材料、進度與備份各區獨立保存。返回總覽會載入已儲存修改。</p></>:<><p>選擇任何分區，可查看實際內裝與施工尺寸，再進入方塊編輯、逐層藍圖與材料清單。</p><p>機械、飛行器與龍以原版方塊雕塑呈現；農作與水景需另行遊戲內驗證。</p></>}{pickedBlock&&<div aria-label="總覽方塊資訊"><h3>{pickedBlock.id}</h3><p>X {pickedBlock.pos.x} / Y {pickedBlock.pos.y} / Z {pickedBlock.pos.z}</p><p>{JSON.stringify(pickedBlock.state)}</p><p>{pickedBlock.source.origin==='ai_estimated'?'AI Estimated Area':'使用者修改'}</p></div>}</aside>
  </div>
  <section className="campus-export"><h2>全基地施工資料</h2><p>下載目前全部分區，包含已保存的修改。每區也可在施工工作室獨立匯出與備份。</p><button onClick={()=>exportFile('json')}>下載完整基地 JSON</button><button onClick={()=>exportFile('csv')}>下載全部 XYZ CSV</button><button onClick={()=>exportFile('materials')}>下載全基地材料</button></section>
  <details className="campus-materials"><summary>{district?.title??'全基地'}材料 · {materials.items.length} 種</summary><table><thead><tr><th>材料</th><th>物品數量</th><th>整組 + 餘數</th></tr></thead><tbody>{materials.items.map(i=><tr key={i.itemId}><td>{i.itemId}</td><td>{i.required}</td><td>{i.fullStacks} × {i.maxStack} + {i.remainder}</td></tr>)}</tbody></table></details>
 </main>;
}
