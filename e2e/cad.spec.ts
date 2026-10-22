import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createEmptyProject } from '../src/core/project.ts';
import type { Project } from '../src/core/contracts.ts';
import type { BuildingCollection } from '../src/features/collection/storage.ts';
import { pixel } from './helpers.ts';

type Point = { x:number; y:number };
type Handle = Point & { axis:'x'|'y'|'z'; start:Point; tip:Point; unitsPerPixel:number };

async function openFixture(page:Page) {
  const project:Project = {...createEmptyProject('cad-pointer-fixture','CAD 操作驗證'),blocks:[0,4,8].map(x=>({uid:'cad-cube-'+x,id:'minecraft:stone',pos:{x,y:0,z:0},state:{},source:{origin:'user_created'},edits:{createdByTransactionId:'cad-seed',lastModifiedByTransactionId:'cad-seed',userModified:false}}))};
  const collection:BuildingCollection = {schemaVersion:2,name:'CAD 操作驗證',entries:[{id:'cad-fixture',name:'三個方塊',notes:'保留 CAD 編輯結果',reference:null,project}]};
  // Seed only persisted input. Every editing action below uses real mouse/keyboard input.
  await page.goto('/?view=collection');
  await expect(page.getByRole('heading',{name:'獨立建築收藏',exact:true})).toBeVisible({timeout:180000});
  await expect(page.locator('.collection-preview canvas')).toHaveAttribute('data-renderer-stats',/visibleCells/,{timeout:120000});
  await page.evaluate(async data=>{
    const req=indexedDB.open('minecraft-building-collection',3);
    await new Promise<void>((resolve,reject)=>{req.onupgradeneeded=()=>{for(const name of ['collection','parts','buildings'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name);};req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});
    const db=req.result,tx=db.transaction(['collection','parts','buildings'],'readwrite');
    tx.objectStore('parts').clear();tx.objectStore('buildings').clear();tx.objectStore('collection').put(data,'current');
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
    localStorage.removeItem('minecraft-building-collection-active');
  },collection);
  await page.reload();
  await expect(page.getByLabel('建築名稱',{exact:true})).toHaveValue('三個方塊',{timeout:120000});
  await page.getByRole('button',{name:'編輯這棟建築',exact:true}).click();
  const canvas=page.locator('.viewport-host canvas');
  await expect(canvas).toBeVisible({timeout:120000});
  await expect(page.getByTestId('cell-count')).toHaveText('3');
  await expect(page.locator('.editing-save')).toContainText('已儲存',{timeout:30000});
  await page.getByRole('button',{name:'正面',exact:true}).click();
  await canvas.scrollIntoViewIfNeeded();
  return {canvas,project};
}
async function cubeBounds(page:Page,x:number) {
  const corners:Point[]=[];
  for(const dx of [0,1])for(const y of [0,1])for(const z of [0,1])corners.push(await pixel(page,[x+dx,y,z]));
  return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y)),center:await pixel(page,[x+.5,.5,.5]),worldX:x};
}
async function drag(page:Page,from:Point,to:Point) {
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});
}
async function clearSelection(page:Page,canvas:Locator) {
  if(await canvas.getAttribute('data-selection-count')!=='0')await page.getByRole('button',{name:'清除選取',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-selection-count','0');
  await canvas.scrollIntoViewIfNeeded();
}
async function exportedBuilding(page:Page):Promise<Project> {
  const event=page.waitForEvent('download',{timeout:120000});
  await page.getByRole('button',{name:'下載完整建築 JSON',exact:true}).click();
  const path=await(await event).path();if(!path)throw new Error('Missing complete building download');
  return JSON.parse(await readFile(path,'utf8')) as Project;
}
const positions=(project:Project)=>project.blocks.map(b=>b.pos).sort((a,b)=>a.x-b.x);

test('CAD rectangle direction controls containment, Ctrl toggles and Delete immediately undoes',async({page})=>{
  test.setTimeout(240000);
  const {canvas}=await openFixture(page);
  const cubes=await Promise.all([0,4,8].map(x=>cubeBounds(page,x)));cubes.sort((a,b)=>a.left-b.left);
  const first=cubes[0]!,second=cubes[1]!,third=cubes[2]!;
  const camera=await canvas.getAttribute('data-camera');
  await drag(page,{x:first.left-15,y:first.top-15},{x:second.right+15,y:second.bottom+15});
  await expect(canvas).toHaveAttribute('data-box-selection',/"mode":"window"/);
  await page.mouse.up();await expect(canvas).toHaveAttribute('data-selection-count','2');
  expect(await canvas.getAttribute('data-camera')).toBe(camera);
  await page.keyboard.down('Control');await page.mouse.click(third.center.x,third.center.y);await page.keyboard.up('Control');
  await expect(canvas).toHaveAttribute('data-selection-count','3');
  await page.keyboard.down('Control');await page.mouse.click(third.center.x,third.center.y);await page.keyboard.up('Control');
  await expect(canvas).toHaveAttribute('data-selection-count','2');
  await page.keyboard.press('Delete');await expect(page.getByTestId('cell-count')).toHaveText('1');
  await expect(page.locator('.selection-preview')).toHaveCount(0);
  await page.keyboard.press('Control+z');await expect(page.getByTestId('cell-count')).toHaveText('3');
  await clearSelection(page,canvas);
  // Same partial rectangle excludes a cube in window mode and includes it in crossing mode.
  const fresh=await cubeBounds(page,first.worldX),left={x:fresh.left-15,y:fresh.top-15},right={x:fresh.center.x,y:fresh.bottom+15};
  await drag(page,left,right);await page.mouse.up();await expect(canvas).toHaveAttribute('data-selection-count','0');
  await drag(page,right,left);await expect(canvas).toHaveAttribute('data-box-selection',/"mode":"crossing"/);
  await page.mouse.up();await expect(canvas).toHaveAttribute('data-selection-count','1');
  await page.screenshot({path:'evidence/cad-rectangle-selection.png'});
});

test('CAD axis gizmo commits constrained movement, Escape cancels and middle drag orbits',async({page})=>{
  test.setTimeout(240000);
  const {canvas,project}=await openFixture(page);
  const center=await pixel(page,[4.5,.5,.5]);await page.mouse.click(center.x,center.y);
  await expect(canvas).toHaveAttribute('data-selection-count','1');
  const camera=await canvas.getAttribute('data-camera');
  const handle=async()=>{await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-gizmo-handles'))??'[]').some((h:Handle)=>h.axis==='y')).toBe(true);return (JSON.parse((await canvas.getAttribute('data-gizmo-handles'))!) as Handle[]).find(h=>h.axis==='y')!;};
  const h=await handle(),length=h.unitsPerPixel*88;
  await drag(page,h,{x:h.x+(h.tip.x-h.start.x)*2/length,y:h.y+(h.tip.y-h.start.y)*2/length});
  await expect(canvas).toHaveAttribute('data-drag-state','y');
  await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-drag-delta'))!)).toEqual({x:0,y:2,z:0});
  await page.mouse.up();await expect(canvas).toHaveAttribute('data-drag-state','idle');
  await expect(page.locator('.selection-actions>div').first()).toContainText('X 4 · Y 2 · Z 0');
  await expect(page.locator('.selection-preview')).toHaveCount(0);expect(await canvas.getAttribute('data-camera')).toBe(camera);
  await page.keyboard.press('Control+z');await expect(page.locator('.selection-actions>div').first()).toContainText('X 4 · Y 0 · Z 0');
  const cancel=await handle();
  await drag(page,cancel,{x:cancel.x,y:cancel.y-100});
  await expect(canvas).toHaveAttribute('data-drag-state','y');await page.keyboard.press('Escape');
  await expect(canvas).toHaveAttribute('data-drag-state','idle');await page.mouse.up();
  await expect(page.locator('.selection-preview')).toHaveCount(0);
  await expect(page.locator('.selection-actions>div').first()).toContainText('X 4 · Y 0 · Z 0');
  const rect=(await canvas.boundingBox())!;
  await drag(page,{x:rect.x+20,y:rect.y+20},{x:rect.x+140,y:rect.y+110});
  await expect(canvas).toHaveAttribute('data-box-selection',/"mode":"window"/);await page.keyboard.press('Escape');await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-box-selection','idle');await expect(canvas).toHaveAttribute('data-selection-count','1');
  await page.mouse.move(rect.x+30,rect.y+30);await page.mouse.down({button:'middle'});await page.mouse.move(rect.x+100,rect.y+70,{steps:12});await page.mouse.up({button:'middle'});
  await expect.poll(()=>canvas.getAttribute('data-camera')).not.toBe(camera);
  await page.getByRole('button',{name:'返回建築庫',exact:true}).click();
  await expect(page.getByRole('heading',{name:'獨立建築收藏',exact:true})).toBeVisible({timeout:120000});
  expect(positions(await exportedBuilding(page))).toEqual(positions(project));
});

test('CAD context delete and numeric move persist through save, return and full export',async({page})=>{
  test.setTimeout(240000);
  const {canvas}=await openFixture(page);
  const center=await pixel(page,[4.5,.5,.5]);await page.mouse.click(center.x,center.y);
  await page.mouse.click(center.x,center.y,{button:'right'});
  await page.getByRole('menuitem',{name:'刪除選取',exact:true}).click();
  await expect(page.getByTestId('cell-count')).toHaveText('2');
  await canvas.focus();await page.keyboard.press('Control+z');await expect(page.getByTestId('cell-count')).toHaveText('3');
  const restored=await pixel(page,[4.5,.5,.5]);await page.mouse.click(restored.x,restored.y);
  await expect(canvas).toHaveAttribute('data-selection-count','1');
  const move=page.locator('.selection-move');if(await move.getAttribute('open')===null)await move.locator('summary').click();
  await move.getByLabel('位移 X',{exact:true}).fill('10');
  // Editing numeric text must never trigger the canvas Delete shortcut.
  await move.getByLabel('位移 X',{exact:true}).press('Delete');await expect(page.getByTestId('cell-count')).toHaveText('3');
  await move.getByLabel('位移 X',{exact:true}).fill('10');
  await page.getByRole('button',{name:'移動選取',exact:true}).click();
  await expect(page.locator('.selection-actions>div').first()).toContainText('X 14 · Y 0 · Z 0');
  await expect(page.locator('.selection-preview')).toHaveCount(0);
  await page.getByRole('button',{name:'立即儲存',exact:true}).click();await expect(page.locator('.editing-save')).toContainText('已儲存',{timeout:30000});
  await page.getByRole('button',{name:'返回建築庫',exact:true}).click();
  await expect(page.getByRole('heading',{name:'獨立建築收藏',exact:true})).toBeVisible({timeout:120000});
  const saved=await exportedBuilding(page);expect(positions(saved)).toEqual([{x:0,y:0,z:0},{x:8,y:0,z:0},{x:14,y:0,z:0}]);
  await page.reload();await expect(page.getByLabel('建築名稱',{exact:true})).toHaveValue('三個方塊',{timeout:120000});
  expect(await exportedBuilding(page)).toEqual(saved);
  const backup=page.waitForEvent('download');await page.getByRole('button',{name:'匯出收藏備份',exact:true}).click();
  const path=await(await backup).path();if(!path)throw new Error('Missing collection backup');
  const collection=JSON.parse(await readFile(path,'utf8')) as BuildingCollection;
  expect(collection.entries[0]!.project).toEqual(saved);expect(collection.entries[0]!.notes).toBe('保留 CAD 編輯結果');
});


test('CAD right-click in Place tool selects an unselected cube without placing a block',async({page})=>{
  test.setTimeout(240000);
  const {canvas,project}=await openFixture(page);
  const selected=await pixel(page,[.5,.5,.5]);await page.mouse.click(selected.x,selected.y);
  await expect(page.locator('.selection-actions>div').first()).toContainText('X 0 · Y 0 · Z 0');
  const toolbar=page.getByRole('toolbar',{name:'CAD 編輯工具',exact:true});
  await toolbar.getByRole('button',{name:'放置',exact:true}).click();
  await expect(toolbar.getByRole('button',{name:'放置',exact:true})).toHaveAttribute('aria-pressed','true');
  const target=await pixel(page,[4.5,.5,.5]);await page.mouse.click(target.x,target.y,{button:'right'});
  await expect(page.getByRole('menuitem',{name:'刪除選取',exact:true})).toBeVisible();
  await expect(canvas).toHaveAttribute('data-selection-count','1');
  await expect(page.locator('.selection-actions>div').first()).toContainText('X 4 · Y 0 · Z 0');
  await expect(page.getByTestId('cell-count')).toHaveText('3');
  await expect(page.locator('.selection-preview')).toHaveCount(0);
  await expect(toolbar.getByRole('button',{name:'復原上一步',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'返回建築庫',exact:true}).click();
  await expect(page.getByRole('heading',{name:'獨立建築收藏',exact:true})).toBeVisible({timeout:120000});
  expect(await exportedBuilding(page)).toEqual(project);
});
