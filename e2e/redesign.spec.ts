import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Project } from '../src/core/contracts.ts';
import type { WorkspaceRecord } from '../src/features/projects/storage.ts';
import { clickWorld } from './helpers.ts';

async function section(page:Page, text:string, open=true){const summary=page.locator('summary').filter({hasText:new RegExp('^'+text+'$')});if((await summary.locator('..').getAttribute('open')!==null)!==open)await summary.click();}
async function instances(page:Page):Promise<number>{return JSON.parse((await page.locator('.viewer-canvas').getAttribute('data-renderer-stats'))!).visibleInstances;}
async function downloaded<T>(page:Page,label:string):Promise<T>{await section(page,'專案與備份');const event=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const file=await(await event).path();if(!file)throw new Error('Missing download');const data=JSON.parse(await readFile(file,'utf8')) as T;await section(page,'專案與備份',false);return data;}

function csvRows(text:string):string[][]{
  const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i]!;
    if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(value);value='';}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote');if(row.length||value){row.push(value);rows.push(row);}return rows;
}
async function constructionCsv(page:Page):Promise<string[][]>{await section(page,'專案與備份');const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載玩家施工 CSV',exact:true}).click();const file=await(await event).path();if(!file)throw new Error('Missing construction CSV');const rows=csvRows(await readFile(file,'utf8'));await section(page,'專案與備份',false);return rows;}

async function start(page:Page){await page.goto('/');await expect(page.getByTestId('cell-count')).toHaveText('6137');await expect.poll(()=>instances(page)).toBeGreaterThanOrEqual(6137);}

test('default reference atrium has real signed coordinates and honest estimated provenance; view filters never change exported design',async({page})=>{
  test.setTimeout(60000);await page.setViewportSize({width:1600,height:1050});await start(page);
  await expect(page.locator('.studio-summary')).toContainText('33 × 19 × 45');await expect(page.locator('.estimated-badge')).toContainText('AI Estimated Area');
  const original=await downloaded<Project>(page,'下載模型 JSON');expect(original.blocks).toHaveLength(6137);
  const sheet=await constructionCsv(page);expect(sheet[0]).toEqual(['Block ID','Block Name','X','Y','Z','Category','Placement State','AI Estimated Area']);expect(sheet).toHaveLength(6138);
  const rows=sheet.slice(1);expect(rows.every(row=>row.length===8&&row[1]!.length>0)).toBe(true);
  const decoded=rows.map(row=>({id:row[0],pos:{x:Number(row[2]),y:Number(row[3]),z:Number(row[4])},category:row[5],state:JSON.parse(row[6]!),estimated:row[7]}));
  expect(new Set(decoded.map(row=>[row.pos.x,row.pos.y,row.pos.z].join(','))).size).toBe(6137);
  const order=(a:{pos:{x:number;y:number;z:number}},b:{pos:{x:number;y:number;z:number}})=>a.pos.x-b.pos.x||a.pos.y-b.pos.y||a.pos.z-b.pos.z;
  expect(decoded.sort(order)).toEqual(original.blocks.map(block=>({id:block.id,pos:block.pos,category:block.category,state:block.state,estimated:'true'})).sort(order));
  expect(sheet.some(row=>row[0]==='minecraft:smooth_quartz'&&row[1]==='平滑石英')).toBe(true);
  expect(original.blocks.every(b=>b.source.origin==='ai_estimated'&&b.source.confidence===0.35)).toBe(true);
  await page.getByRole('button',{name:'正面',exact:true}).click();await clickWorld(page,[-15.5,.5,-22]);
  await expect(page.locator('.block-inspector')).toContainText('atrium:-16,0,-22');await expect(page.locator('.block-inspector')).toContainText('ai_estimated');
  const full=await instances(page);await section(page,'剖面、材質與推估區域');
  await page.getByRole('checkbox',{name:'隱藏屋頂',exact:true}).check();await expect.poll(()=>instances(page)).toBeLessThan(full);
  await page.getByRole('checkbox',{name:'隱藏屋頂',exact:true}).uncheck();await expect.poll(()=>instances(page)).toBe(full);
  await page.getByRole('combobox',{name:'剖面軸',exact:true}).selectOption('x');await expect.poll(()=>instances(page)).toBeLessThan(full);
  const cut=page.getByRole('slider',{name:'剖面位置',exact:true});await cut.focus();await cut.press('End');await expect.poll(()=>instances(page)).toBe(full);
  await page.getByRole('combobox',{name:'剖面軸',exact:true}).selectOption('');
  await page.getByRole('checkbox',{name:'cyan_stained_glass',exact:true}).uncheck();await expect.poll(()=>instances(page)).toBeLessThan(full);
  await page.getByRole('checkbox',{name:'cyan_stained_glass',exact:true}).check();await page.getByRole('textbox',{name:'高亮方塊',exact:true}).fill('quartz');
  await page.getByRole('checkbox',{name:'高亮 AI Estimated Area',exact:true}).check();
  expect(await downloaded<Project>(page,'下載模型 JSON')).toEqual(original);await expect(page.getByTestId('cell-count')).toHaveText('6137');
  await page.getByRole('textbox',{name:'高亮方塊',exact:true}).fill('');await section(page,'剖面、材質與推估區域',false);
  await page.getByRole('button',{name:'等角視角',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'evidence/redesign-desktop.png'});await page.screenshot({path:'evidence/redesign-desktop-full.png',fullPage:true});
});

test('construction preview runs forward and backward independently of Y and persisted actual layer completion',async({page})=>{
  test.setTimeout(60000);await start(page);const full=await instances(page);
  await section(page,'剖面、材質與推估區域');await page.getByRole('checkbox',{name:'Ghost Completed House',exact:true}).uncheck();
  await page.getByRole('button',{name:'施工模式',exact:true}).click();await expect.poll(()=>instances(page)).toBe(0);
  const progress=page.getByRole('slider',{name:'施工順序進度',exact:true});await progress.focus();await progress.press('End');await expect.poll(()=>instances(page)).toBe(full);
  await progress.press('Home');await expect.poll(()=>instances(page)).toBe(0);await expect(page.locator('.progress-dock')).toContainText('已完成 0 / 6137 格');
  await page.getByRole('button',{name:'編輯模式',exact:true}).click();await expect.poll(()=>instances(page)).toBe(full);
  await page.getByRole('spinbutton',{name:'施工檢視樓層',exact:true}).fill('1');await page.getByRole('combobox',{name:'施工顯示方式',exact:true}).selectOption('through');await expect.poll(()=>instances(page)).toBe(2990);
  await page.getByRole('checkbox',{name:'本層已完成',exact:true}).check();
  const backup=await downloaded<WorkspaceRecord>(page,'下載完整備份');expect(backup.completed).toHaveLength(1485);expect(backup.completed.every(uid=>backup.project.blocks.find(b=>b.uid===uid)?.pos.y===1)).toBe(true);
  await section(page,'專案與備份');await page.getByRole('button',{name:'立即儲存',exact:true}).click();await expect(page.locator('.project-panel').getByRole('status').first()).toHaveText('已儲存於此瀏覽器');
  await page.reload();await expect(page.getByTestId('cell-count')).toHaveText('6137');await expect(page.getByRole('checkbox',{name:'本層已完成',exact:true})).toBeChecked();
  expect((await downloaded<WorkspaceRecord>(page,'下載完整備份')).completed).toEqual(backup.completed);
  await page.getByRole('checkbox',{name:'本層已完成',exact:true}).uncheck();await expect(page.locator('.progress-dock')).toContainText('已完成 0 / 6137 格');
});

test('mobile default atrium supports touch camera, material preparation and a separate blueprint without document overflow',async({browser})=>{
  test.setTimeout(60000);const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  try{const page=await context.newPage();await start(page);const canvas=page.locator('.viewer-canvas');await canvas.scrollIntoViewIfNeeded();
    const before=await canvas.getAttribute('data-camera'),box=(await canvas.boundingBox())!;expect(box.height).toBeGreaterThan(250);
    const client=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y:y+15,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(canvas).not.toHaveAttribute('data-camera',before!);
    await section(page,'材料清單');await page.getByRole('searchbox',{name:'材料搜尋',exact:true}).fill('quartz');
    const ready=page.getByRole('checkbox',{name:'minecraft:smooth_quartz 已備齊',exact:true});await expect(ready).not.toBeChecked();await ready.locator('..').scrollIntoViewIfNeeded();await ready.locator('..').tap();await expect(ready).toBeChecked();await expect(page.getByRole('spinbutton',{name:'minecraft:smooth_quartz 已備數量',exact:true})).toHaveValue('1256');
    await section(page,'2D 逐層藍圖');await expect(page.locator('.blueprint-canvas')).toBeVisible();await page.getByRole('spinbutton',{name:'藍圖樓層 Y',exact:true}).fill('1');await expect(page.locator('.blueprint-summary')).toContainText('本層 1485 格');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('searchbox',{name:'材料搜尋',exact:true}).fill('');await section(page,'2D 逐層藍圖',false);await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:'evidence/redesign-mobile.png'});await page.screenshot({path:'evidence/redesign-mobile-full.png',fullPage:true});
  }finally{await context.close();}
});
