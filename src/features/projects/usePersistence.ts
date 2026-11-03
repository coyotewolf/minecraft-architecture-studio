import { useEffect, useRef, useState } from 'react';
import { loadWorkspace, saveWorkspace, type WorkspaceRecord } from './storage.ts';
const LAST='architecture-studio:last-project';
/** Serialize writes so an older slow save cannot overwrite a newer edit. */
export function usePersistence(workspace:WorkspaceRecord,onRestore:(record:WorkspaceRecord)=>void,preferredProjectId?:string){
  const [status,setStatus]=useState('正在讀取本機專案…'),[ready,setReady]=useState(false);
  const savedSource=useRef<WorkspaceRecord|null>(null),saving=useRef<{source:WorkspaceRecord;promise:Promise<boolean>}|null>(null);
  const current=useRef(workspace),restore=useRef(onRestore),queue=useRef(Promise.resolve()),generation=useRef(0);
  current.current=workspace;restore.current=onRestore;
  useEffect(()=>{
    let canceled=false;
    void (async()=>{try{const id=preferredProjectId??localStorage.getItem(LAST);if(id){const record=await loadWorkspace(id);if(record&&!canceled)restore.current(record);}
      if(!canceled){setReady(true);setStatus('尚未儲存');}}
      catch(error){if(!canceled)setStatus('讀取失敗，原始儲存資料未覆寫：'+String(error));}})();
    return()=>{canceled=true;};
  },[]);
  function save(){
    const source=current.current;
    if(savedSource.current===source)return Promise.resolve(true);
    if(saving.current?.source===source)return saving.current.promise;
    const token=++generation.current,record={...current.current,updatedAt:new Date().toISOString()};
    let saved=false;
    setStatus('儲存中…');
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      try{await saveWorkspace(record);saved=true;savedSource.current=source;
        if(token===generation.current){
          let suffix='';try{localStorage.setItem(LAST,record.project.id);}catch{suffix='（瀏覽器無法記住下次開啟位置）';}
          setStatus('已儲存於此瀏覽器'+suffix);setReady(true);
        }
      }catch(error){if(token===generation.current)setStatus('儲存失敗，修改仍保留在畫面中：'+String(error));}
    });
    const promise=queue.current.then(()=>saved).finally(()=>{if(saving.current?.source===source)saving.current=null;});
    saving.current={source,promise};return promise;
  }
  const saveRef=useRef(save);saveRef.current=save;
  useEffect(()=>{
    if(!ready)return;
    ++generation.current;setStatus('尚未儲存');
    const timer=setTimeout(()=>saveRef.current(),600);
    return()=>{clearTimeout(timer);};
  },[workspace,ready]);
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(status==='尚未儲存'||status==='儲存中…'||status.startsWith('儲存失敗')){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[status]);
  return {status,save,ready};
}

