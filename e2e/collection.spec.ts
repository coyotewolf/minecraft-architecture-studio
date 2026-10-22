import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { BuildingCollection } from '../src/features/collection/storage.ts';
import { coordinate } from './helpers.ts';
async function ready(page:Page){await expect(page.getByRole('heading',{name:'獨立建築收藏',exact:true})).toBeVisible({timeout:180000});await expect(page.locator('.collection-preview canvas')).toHaveAttribute('data-renderer-stats',/visibleCells/,{timeout:120000});}
async function backup(page:Page):Promise<BuildingCollection>{const event=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'匯出收藏備份',exact:true}).click();const file=await(await event).path();if(!file)throw new Error('Missing backup');return JSON.parse(await readFile(file,'utf8')) as BuildingCollection;}
test('collection preserves metadata, edited complete building and additive backup copies',async({page},testInfo)=>{
 test.setTimeout(600000);const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser page error:',e.message);});page.on('crash',()=>console.error('Browser renderer crashed'));page.on('console',m=>{if(m.type()==='error')console.error('Browser console:',m.text());});await page.goto('/?view=collection');await ready(page);console.info('Collection ready');
 await page.getByLabel('收藏專案名稱',{exact:true}).fill('朋友的建築收藏');await page.getByLabel('建築名稱',{exact:true}).fill('金葉試作');await page.getByRole('textbox',{name:'建築筆記',exact:true}).fill('先完成外殼，再規劃花園。');await page.getByRole('button',{name:'儲存收藏',exact:true}).click();await expect(page.getByRole('status')).toContainText('已儲存',{timeout:30000});await page.reload();await ready(page);
 await expect(page.getByLabel('收藏專案名稱',{exact:true})).toHaveValue('朋友的建築收藏');await expect(page.getByLabel('建築名稱',{exact:true})).toHaveValue('金葉試作');await expect(page.getByRole('textbox',{name:'建築筆記',exact:true})).toHaveValue('先完成外殼，再規劃花園。');
 console.info('Metadata reload verified');const original=await backup(page),entry=original.entries[0]!,part=entry.project;expect(part.blocks.length).toBeGreaterThan(1000);const bounds=part.blocks.reduce((a,b)=>({minX:Math.min(a.minX,b.pos.x),maxX:Math.max(a.maxX,b.pos.x),minY:Math.min(a.minY,b.pos.y),maxY:Math.max(a.maxY,b.pos.y),minZ:Math.min(a.minZ,b.pos.z),maxZ:Math.max(a.maxZ,b.pos.z)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity});expect(bounds.maxY-bounds.minY+1).toBeLessThanOrEqual(100);expect(bounds.minY).toBe(0);expect(bounds.maxY).toBe(99);await expect(page.getByTestId('collection-dimensions')).toHaveText('寬 '+(bounds.maxX-bounds.minX+1)+' × 高 '+(bounds.maxY-bounds.minY+1)+' × 深 '+(bounds.maxZ-bounds.minZ+1)+' 格');expect(new Set(part.blocks.map(b=>[b.pos.x,b.pos.y,b.pos.z].join(','))).size).toBe(part.blocks.length);expect('parts' in entry).toBe(false);
 const buildingDownload=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'下載完整建築 JSON',exact:true}).click();const buildingFile=await(await buildingDownload).path();if(!buildingFile)throw new Error('Missing building file');expect(JSON.parse(await readFile(buildingFile,'utf8'))).toEqual(part);
 for(const [name,yaw] of [['正面',180],['背面',0]] as const){await page.getByRole('button',{name,exact:true}).click();await expect.poll(async()=>JSON.parse((await page.locator('.collection-preview canvas').getAttribute('data-camera'))!).yaw).toBeCloseTo(yaw,3);await expect.poll(async()=>JSON.parse((await page.locator('.collection-preview canvas').getAttribute('data-camera'))!).pitch).toBeCloseTo(14,3);}
 await page.getByRole('button',{name:'俯視',exact:true}).click();await expect.poll(async()=>JSON.parse((await page.locator('.collection-preview canvas').getAttribute('data-camera'))!).pitch).toBeGreaterThan(80);await page.getByRole('button',{name:'正面參考',exact:true}).click();await expect.poll(()=>page.locator('.collection-reference img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/collection-desktop.png',fullPage:true});
 console.info('Backup and cameras verified');await page.getByRole('button',{name:'開啟完整建築施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(part.blocks.length),{timeout:180000});console.info('Complete editor opened');const summary=page.locator('summary').filter({hasText:/^編輯工具與方塊$/});if(await summary.locator('..').getAttribute('open')===null)await summary.click();await page.getByRole('radio',{name:'放置',exact:true}).check();await page.getByRole('combobox',{name:'方塊種類',exact:true}).selectOption('minecraft:stone');const pos={x:entry.project.blocks.reduce((m,b)=>Math.max(m,b.pos.x),-Infinity)+2,y:0,z:0};await coordinate(page,pos.x,pos.y,pos.z);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(part.blocks.length+1),{timeout:30000});await page.getByRole('button',{name:'復原',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(part.blocks.length),{timeout:30000});await page.getByRole('button',{name:'重做',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(part.blocks.length+1),{timeout:30000});console.info('Full building edit undo redo verified');console.info('Returning from complete editor');await page.getByRole('button',{name:'返回建築庫',exact:true}).click();await ready(page);console.info('Returned to collection');
 await expect(page.getByRole('textbox',{name:'建築筆記',exact:true})).toHaveValue(entry.notes);const edited=await backup(page);const current=edited.entries[0]!.project;expect(current.blocks).toHaveLength(part.blocks.length+1);expect(current.blocks.find(b=>b.pos.x===pos.x&&b.pos.y===pos.y&&b.pos.z===pos.z)).toMatchObject({id:'minecraft:stone',source:{origin:'user_created'}});
 await page.getByRole('button',{name:'開啟完整建築施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(current.blocks.length),{timeout:180000});console.info('Returning from complete editor');await page.getByRole('button',{name:'返回建築庫',exact:true}).click();await ready(page);console.info('Returned to collection');
 const importPath=testInfo.outputPath('collection-backup.json');await writeFile(importPath,JSON.stringify(edited));await page.getByLabel('匯入收藏備份',{exact:true}).setInputFiles(importPath);await expect(page.getByRole('status')).toContainText('已加入備份',{timeout:60000});const imported=await backup(page);expect(imported.entries).toHaveLength(2);expect(imported.entries[0]).toEqual(edited.entries[0]);expect(imported.entries[1]!.project.id).not.toEqual(edited.entries[0]!.project.id);expect(imported.entries[1]!.project.blocks).toEqual(edited.entries[0]!.project.blocks);await page.reload();await ready(page);expect((await backup(page)).entries).toEqual(imported.entries);
 // Reload and returning from the editor must keep the selected building, not jump to the oldest entry.
 await page.getByRole('button',{name:'載入新版金葉塔',exact:true}).click();await expect(page.getByRole('status')).toContainText('已加入 V14',{timeout:60000});await ready(page);
 const freshName='金葉之塔（100 格・葉片比例重製版 V14）';await expect(page.getByLabel('建築名稱',{exact:true})).toHaveValue(freshName);
 await page.reload();await ready(page);await expect(page.getByLabel('建築名稱',{exact:true})).toHaveValue(freshName);
 await page.getByRole('button',{name:'開啟完整建築施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(part.blocks.length),{timeout:180000});
 await page.getByRole('button',{name:'返回建築庫',exact:true}).click();await ready(page);await expect(page.getByLabel('建築名稱',{exact:true})).toHaveValue(freshName);
 const withLatest=await backup(page);expect(withLatest.entries).toHaveLength(3);expect(withLatest.entries.slice(0,2)).toEqual(imported.entries);expect(errors).toEqual([]);
});
test('mobile collection has no overflow and supports touch view and reference controls',async({browser})=>{
 test.setTimeout(120000);const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});try{const page=await context.newPage();await page.goto('/?view=collection');await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);for(const name of ['正面','背面','俯視'])await page.getByRole('button',{name,exact:true}).tap();await page.getByRole('button',{name:'背面參考',exact:true}).tap();await expect(page.locator('.collection-reference img')).toHaveAttribute('src','/local-references/golden-leaf-rear.png');await page.getByRole('button',{name:'等角',exact:true}).tap();await page.locator('.collection-preview canvas').scrollIntoViewIfNeeded();const canvas=page.locator('.collection-preview canvas'),rect=(await canvas.boundingBox())!,before=await canvas.getAttribute('data-camera');const session=await context.newCDPSession(page),x=rect.x+rect.width/2,y=rect.y+rect.height/2;await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+15,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>canvas.getAttribute('data-camera')).not.toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/collection-mobile.png',fullPage:true});}finally{await context.close();}
});

test('current revision link adds a missing design once and preserves the old collection',async({page})=>{
 test.setTimeout(180000);await page.goto('/?view=collection');await ready(page);
 const original=await backup(page);
 // An earlier revision marker on the valid fixture isolates version routing from geometry generation.
 const older={...original,entries:[{...original.entries[0]!,name:'保留的早期建築',project:{...original.entries[0]!.project,id:'routing-old-project',designRevision:'golden-leaf-100-v8'}}]};
 await page.evaluate(async()=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('minecraft-building-collection');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});localStorage.removeItem('minecraft-building-collection-active');});
 // Seed the supported legacy inline storage envelope, then exercise real read/migration/write.
 await page.evaluate(async data=>{const req=indexedDB.open('minecraft-building-collection',3);await new Promise<void>((resolve,reject)=>{req.onupgradeneeded=()=>{for(const name of ['collection','parts','buildings'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name);};req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});const db=req.result,tx=db.transaction('collection','readwrite');tx.objectStore('collection').put(data,'current');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();},older);
 await page.goto('/?view=collection&revision=golden-leaf-100-v14');await ready(page);
 await expect(page.getByTestId('collection-design-version')).toHaveText('模型 V14');
 const upgraded=await backup(page);expect(upgraded.entries).toHaveLength(2);expect(upgraded.entries[0]).toEqual(older.entries[0]);
 await page.goto('/?view=collection&revision=golden-leaf-100-v14');await ready(page);
 expect((await backup(page)).entries).toEqual(upgraded.entries);
 await expect(page.getByTestId('collection-design-version')).toHaveText('模型 V14');
 await page.getByRole('button',{name:/保留的早期建築/}).click();await expect(page.getByRole('region',{name:'金葉塔更新'})).toBeVisible();await page.getByRole('button',{name:'查看新版 V14',exact:true}).click();await ready(page);await expect(page.getByTestId('collection-design-version')).toHaveText('模型 V14');expect((await backup(page)).entries).toEqual(upgraded.entries);await expect(page.getByRole('region',{name:'金葉塔更新'})).toHaveCount(0);
});

async function seedCollectionIndex(page:Page,data:BuildingCollection){
 await page.evaluate(async collection=>{
  const req=indexedDB.open('minecraft-building-collection',3);
  await new Promise<void>((resolve,reject)=>{req.onupgradeneeded=()=>{for(const name of ['collection','parts','buildings'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name);};req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});
  const db=req.result,tx=db.transaction(['collection','parts','buildings'],'readwrite');
  tx.objectStore('parts').clear();tx.objectStore('buildings').clear();tx.objectStore('collection').put(collection,'current');
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 },data);
}
test('a full library still opens its old buildings when the revision cannot be added',async({page})=>{
 test.setTimeout(180000);await page.goto('/?view=collection');await ready(page);const initial=await backup(page),first=initial.entries[0]!;
 const old={...initial,entries:Array.from({length:100},(_,i)=>({...first,id:'full-'+i,name:'保留建築 '+i,notes:'不可遺失的筆記 '+i,project:{...first.project,id:'full-project-'+i,designRevision:'golden-leaf-100-v8',blocks:[first.project.blocks[0]!],logicalStructures:[]}}))};
 await seedCollectionIndex(page,old);
 await page.goto('/?view=collection&revision=golden-leaf-100-v14');await ready(page);
 await expect(page.getByRole('status')).toContainText('新版尚未加入');
 await expect(page.getByRole('textbox',{name:'建築筆記',exact:true})).toHaveValue('不可遺失的筆記 0');
 await expect(page.locator('.collection-library > button')).toHaveCount(100);
 expect((await backup(page)).entries).toEqual(old.entries);
 await page.reload();await ready(page);await expect(page.getByRole('status')).toContainText('新版尚未加入');
});
test('a failed automatic revision save keeps the existing model and notes usable',async({page})=>{
 test.setTimeout(180000);await page.goto('/?view=collection');await ready(page);const original=await backup(page),first=original.entries[0]!;
 const old={...original,entries:[{...first,id:'quota-old',notes:'保留原設計與筆記',project:{...first.project,id:'quota-old-project',designRevision:'golden-leaf-100-v8'}}]};
 await seedCollectionIndex(page,old);
 await page.addInitScript(()=>{
  const originalPut=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
   if(this.name==='buildings')throw new DOMException('Test storage full','QuotaExceededError');
   return originalPut.apply(this,args);
  };
 });
 await page.goto('/?view=collection&revision=golden-leaf-100-v14');await ready(page);
 await expect(page.getByRole('status')).toContainText('新版尚未加入');
 await expect(page.getByTestId('collection-design-version')).toHaveText('模型 V8');
 await expect(page.getByRole('textbox',{name:'建築筆記',exact:true})).toHaveValue('保留原設計與筆記');
 expect((await backup(page)).entries).toEqual(old.entries);
 const persisted=await page.evaluate(async()=>{
  const r=indexedDB.open('minecraft-building-collection',3);await new Promise<void>(resolve=>{r.onsuccess=()=>resolve();});
  const db=r.result,tx=db.transaction('collection','readonly'),get=tx.objectStore('collection').get('current');
  await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});db.close();return get.result;
 });
 expect(persisted).toEqual(old);
});
test('a revision crossing one million total cells loads and persists without losing earlier versions',async({page})=>{
 test.setTimeout(600000);await page.goto('/?view=collection');await ready(page);const initial=await backup(page),first=initial.entries[0]!;
 // Nineteen independently stored old buildings total 950,019 cells; V14 takes this above one million.
 const seed={...first.project,designRevision:'golden-leaf-100-v8',logicalStructures:[],blocks:[]};
 await page.evaluate(async input=>{
  const blocks=Array.from({length:50001},(_,i)=>({uid:'kept-'+i,id:'minecraft:stone',pos:{x:i%300,y:Math.floor(i/300),z:0},state:{},source:{origin:'user_created'},edits:{createdByTransactionId:'seed',lastModifiedByTransactionId:'seed',userModified:true}}));
  const entries=[],records=[];
  for(let i=0;i<19;i++){
   const id='preserved-project-'+i,p={...input,id,blocks};
   entries.push({id:'preserved-'+i,name:'保留版本 '+i,notes:'歷史筆記 '+i,reference:'golden-leaf',project:id});
   records.push({id,blob:await new Response(new Blob([JSON.stringify(p)]).stream().pipeThrough(new CompressionStream('gzip'))).blob()});
  }
  const r=indexedDB.open('minecraft-building-collection',3);await new Promise<void>(resolve=>{r.onsuccess=()=>resolve();});
  const db=r.result,tx=db.transaction(['collection','buildings','parts'],'readwrite');
  tx.objectStore('buildings').clear();tx.objectStore('parts').clear();
  for(const record of records)tx.objectStore('buildings').put(record.blob,record.id);
  tx.objectStore('collection').put({storageVersion:3,collection:{schemaVersion:2,name:'歷代建築',entries}},'current');
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 },seed);
 await page.addInitScript(()=>{
  const audit={getAll:[] as string[],buildingGets:[] as string[]};
  (globalThis as typeof globalThis & {libraryReadAudit:typeof audit}).libraryReadAudit=audit;
  const getAll=IDBObjectStore.prototype.getAll,get=IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.getAll=function(...args:Parameters<IDBObjectStore['getAll']>){audit.getAll.push(this.name);return getAll.apply(this,args);};
  IDBObjectStore.prototype.get=function(...args:Parameters<IDBObjectStore['get']>){if(this.name==='buildings')audit.buildingGets.push(String(args[0]));return get.apply(this,args);};
 });
 await page.goto('/?view=collection&revision=golden-leaf-100-v14');await ready(page);
 await expect(page.getByTestId('collection-design-version')).toHaveText('模型 V14');
 await expect(page.locator('.collection-library > button')).toHaveCount(20);
 const audit=await page.evaluate(()=>(globalThis as typeof globalThis & {libraryReadAudit:{getAll:string[];buildingGets:string[]}}).libraryReadAudit);
 expect(audit.getAll).toEqual([]);
 expect(audit.buildingGets).toHaveLength(2); // Only old-index newest candidate plus selected V14, never nineteen models.
 const memorySession=await page.context().newCDPSession(page);
 await memorySession.send('HeapProfiler.collectGarbage');
 const memory=await memorySession.send('Runtime.getHeapUsage');
 console.info('Lazy library heap after GC (MiB):',Math.round(memory.usedSize/1024/1024));
 await writeFile('evidence/collection-lazy-memory.json',JSON.stringify({entries:20,canonicalCells:1001004,buildingReads:audit.buildingGets,bulkReads:audit.getAll,heapUsedBytes:memory.usedSize,note:'Chromium JS heap after GC, not total process or GPU memory'},null,2));
 await page.screenshot({path:'evidence/collection-lazy-recovery.png'});


 await expect(page.getByRole('status')).toHaveText('已載入本機收藏');
 const counts=await page.evaluate(async()=>{
  const r=indexedDB.open('minecraft-building-collection',3);await new Promise<void>(resolve=>{r.onsuccess=()=>resolve();});
  const db=r.result,tx=db.transaction(['collection','buildings'],'readonly'),metadata=tx.objectStore('collection').get('current'),blobs=tx.objectStore('buildings').getAll();
  await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});db.close();
  const projects=[];
  for(const blob of blobs.result as Blob[]){const p=JSON.parse(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text());projects.push({id:p.id,count:p.blocks.length,first:p.blocks[0].uid,last:p.blocks.at(-1).uid});}
  return {entries:metadata.result.library.entries,projects};
 });
 expect(counts.projects.reduce((n,p)=>n+p.count,0)).toBe(950019+first.project.blocks.length);
 for(let i=0;i<19;i++){
  expect(counts.entries[i]).toMatchObject({id:'preserved-'+i,notes:'歷史筆記 '+i,projectId:'preserved-project-'+i});
  expect(counts.projects.find(p=>p.id==='preserved-project-'+i)).toMatchObject({count:50001,first:'kept-0',last:'kept-50000'});
 }
 await page.reload();await ready(page);
 await expect(page.getByTestId('collection-design-version')).toHaveText('模型 V14');
 await expect(page.locator('.collection-library > button')).toHaveCount(20);
});

test('first-save failure still offers the complete unsaved building download',async({page})=>{
 test.setTimeout(120000);
 await page.addInitScript(()=>{
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
   if(this.name==='buildings')throw new DOMException('Test quota','QuotaExceededError');
   return put.apply(this,args);
  };
 });
 await page.goto('/?view=collection');await ready(page);
 await expect(page.getByRole('status')).toContainText('尚未儲存至瀏覽器');
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載完整建築 JSON',exact:true}).click();
 const file=await(await event).path();expect(file).toBeTruthy();
 const project=JSON.parse(await readFile(file!,'utf8'));
 expect(project.designRevision).toBe('golden-leaf-100-v14');expect(project.blocks).toHaveLength(50985);
});

test('preview selection opens focused editing with reversible changes and persists on return',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?view=collection');await ready(page);
 const canvas=page.locator('.collection-preview canvas');await canvas.scrollIntoViewIfNeeded();const rect=(await canvas.boundingBox())!;
 await canvas.click({position:{x:rect.width/2,y:rect.height/2}});
 await expect(page.getByRole('button',{name:'編輯選取方塊',exact:true})).toBeVisible();
 const picked=await page.locator('.collection-picked').textContent();
 await page.getByRole('button',{name:'編輯選取方塊',exact:true}).click();
 await expect(page.locator('.editing-heading')).toBeVisible({timeout:120000});
 await expect(page.locator('.selection-actions')).toContainText('已選取',{timeout:60000});
 const coords=picked!.match(/X ([-\d]+) · Y ([-\d]+) · Z ([-\d]+)/)![0];await expect(page.locator('.selection-actions')).toContainText(coords);
 const before=Number(await page.getByTestId('cell-count').textContent());
 await expect(page.locator('.primary-editor')).toHaveAttribute('open','');
 await page.getByRole('button',{name:'預覽移除選取方塊',exact:true}).click();
 await expect(page.getByTestId('cell-count')).toHaveText(String(before));
 await page.getByRole('button',{name:'確認快捷編輯',exact:true}).click();
 await expect(page.getByTestId('cell-count')).toHaveText(String(before-1));
 await page.getByRole('button',{name:'復原上一步',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(before));
 await page.getByRole('button',{name:'重做上一步',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(before-1));
 await page.getByRole('button',{name:'立即儲存',exact:true}).click();await expect(page.locator('.editing-save')).toContainText('已儲存',{timeout:30000});
 await page.screenshot({path:'evidence/preview-edit-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'返回建築庫',exact:true}).click();await ready(page);
 await page.reload();await ready(page);
 expect((await backup(page)).entries[0]!.project.blocks.length).toBe(before-1);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'編輯這棟建築',exact:true}).click();
 await expect(page.locator('.editing-heading')).toBeVisible({timeout:120000});await expect(page.locator('.editing-save')).toContainText('已儲存',{timeout:30000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'evidence/preview-edit-mobile.png',fullPage:true});expect(errors).toEqual([]);
});

test('keyboard multiselect and modifier drag are reversible and ignore text inputs',async({page})=>{
 test.setTimeout(240000);await page.goto('/?view=collection');await ready(page);const original=await backup(page),entry=original.entries[0]!;
 const sample=entry.project.blocks.find(b=>b.id==='minecraft:gold_block')!;
 const fixture={...original,entries:[{...entry,id:'keyboard-fixture',project:{...entry.project,id:'keyboard-fixture',title:'鍵盤操作驗證',blocks:[{...sample,uid:'left',pos:{x:0,y:0,z:0}},{...sample,uid:'right',pos:{x:4,y:0,z:0}}],logicalStructures:[]}}]};
 await seedCollectionIndex(page,fixture);await page.reload();await ready(page);await page.getByRole('button',{name:'編輯這棟建築',exact:true}).click();
 const canvas=page.locator('.viewport-host canvas');await expect(canvas).toBeVisible({timeout:120000});await expect(page.locator('.editing-save')).toContainText('已儲存',{timeout:30000});
 await page.getByRole('button',{name:'正面',exact:true}).click();await canvas.scrollIntoViewIfNeeded();
 const box=(await canvas.boundingBox())!;const points:{x:number,y:number}[]=[];const seen=new Set<string>();
 for(const yf of [.5,.55,.45,.6,.4]){for(const xf of [.2,.3,.4,.6,.7,.8]){const pos={x:box.width*xf,y:box.height*yf};await canvas.click({position:pos});const text=await page.locator('.selection-actions>div').first().textContent();const coord=text?.match(/X ([-\d]+)/)?.[1];if(coord&&!seen.has(coord)){seen.add(coord);points.push(pos);}if(points.length===2)break;}if(points.length===2)break;}
 expect(points).toHaveLength(2);
 await canvas.click({position:points[0]!});await canvas.click({position:points[1]!,modifiers:['Shift']});await expect(canvas).toHaveAttribute('data-selection-count','2');
 await page.keyboard.press('Delete');await expect(page.locator('.selection-preview')).toContainText('移除 2 格');await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.keyboard.press('Enter');await expect(page.getByTestId('cell-count')).toHaveText('0');await page.keyboard.press('Control+z');await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.keyboard.press('Control+Shift+z');await expect(page.getByTestId('cell-count')).toHaveText('0');await page.keyboard.press('Control+z');await expect(page.getByTestId('cell-count')).toHaveText('2');
 await canvas.click({position:points[0]!});await canvas.click({position:points[1]!,modifiers:['Control']});await expect(canvas).toHaveAttribute('data-selection-count','2');
 await page.keyboard.press('Alt+PageUp');await expect(page.locator('.selection-preview')).toContainText('位移 X 0 / Y 1 / Z 0');await page.keyboard.press('Escape');await expect(page.locator('.selection-preview')).toHaveCount(0);await expect(canvas).toHaveAttribute('data-selection-count','2');
 const rect=(await canvas.boundingBox())!,from=points[1]!,cameraBefore=await canvas.getAttribute('data-camera');
 await page.keyboard.down('Alt');await page.keyboard.down('Shift');await page.mouse.move(rect.x+from.x,rect.y+from.y);await page.mouse.down();await expect(canvas).toHaveAttribute('data-drag-state','y');await page.mouse.move(rect.x+from.x,rect.y+from.y-200,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');await page.keyboard.up('Alt');
 await expect(canvas).toHaveAttribute('data-drag-state','idle');expect(await canvas.getAttribute('data-camera')).toBe(cameraBefore);await expect(page.locator('.selection-preview')).toContainText('移動 2 格');await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.keyboard.press('Enter');await expect(page.locator('.selection-actions>div').first()).toContainText(/Y [1-9]/);await page.keyboard.press('Control+z');await expect(page.locator('.selection-actions>div').first()).toContainText('Y 0');await expect(page.locator('.selection-preview')).toHaveCount(0);
 await page.keyboard.down('Alt');await page.mouse.move(rect.x+from.x,rect.y+from.y);await page.mouse.down();await expect(canvas).toHaveAttribute('data-drag-state','xz');await page.mouse.move(rect.x+from.x+200,rect.y+from.y,{steps:8});await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-drag-delta'))!).x).not.toBe(0);expect(await canvas.getAttribute('data-camera')).toBe(cameraBefore);await page.keyboard.press('Escape');await expect(canvas).toHaveAttribute('data-drag-state','idle');await page.mouse.up();await page.keyboard.up('Alt');
 await page.locator('.selection-move summary').click();await page.locator('.selection-move').getByLabel('位移 X',{exact:true}).fill('10');await page.locator('.selection-move').getByLabel('位移 X',{exact:true}).press('Delete');await expect(page.locator('.selection-preview')).toHaveCount(0);await page.locator('.selection-move').getByLabel('位移 X',{exact:true}).fill('10');
 await page.getByRole('button',{name:'預覽移動選取',exact:true}).click();await page.getByRole('button',{name:'確認快捷編輯',exact:true}).click();
 await page.getByRole('button',{name:'返回建築庫',exact:true}).click();await ready(page);const changed=await backup(page);expect(changed.entries[0]!.project.blocks.map(b=>b.pos.x).sort((a,b)=>a-b)).toEqual([10,14]);
});
