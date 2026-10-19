import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Project } from '../src/core/contracts.ts';
import { coordinate, clickWorld } from './helpers.ts';

type DistrictDownload = { id:string; references:string[]; project:Project };
type CampusDownload = { schema:string; districts:DistrictDownload[] };
async function stats(page:Page):Promise<{visibleCells:number;triangles:number;drawCalls:number}>{return JSON.parse((await page.locator('.campus-canvas').getAttribute('data-renderer-stats'))!);}
async function ready(page:Page){await expect(page.locator('.campus-canvas')).toHaveAttribute('data-renderer-stats',/visibleCells/,{timeout:60000});await expect(page.getByRole('button',{name:'開始施工',exact:true})).toBeEnabled({timeout:60000});}
async function download(page:Page):Promise<CampusDownload>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載完整基地 JSON',exact:true}).click();const file=await(await event).path();if(!file)throw new Error('Missing campus download');return JSON.parse(await readFile(file,'utf8')) as CampusDownload;}
async function ring(page:Page){await page.getByRole('button',{name:/^環門控制尖塔/}).click();await expect(page.locator('.campus-stage h2')).toHaveText('環門控制尖塔');await expect(page.locator('.campus-canvas')).toHaveAttribute('data-renderer-stats',/visibleCells/);}
async function openSection(page:Page,text:string){const summary=page.locator('summary').filter({hasText:new RegExp('^'+text+'$')});if(await summary.locator('..').getAttribute('open')===null)await summary.click();}

test('complete campus exports all real districts and retains exact picking through overview filters and camera presets',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1600,height:1050});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await ready(page);
 await expect(page.getByRole('heading',{name:'群島未來基地',exact:true})).toBeVisible();await expect(page.locator('.campus-district-button')).toHaveCount(16);
 await expect(page.getByTestId('campus-items')).not.toContainText('待確認');
 const total=Number((await page.getByTestId('campus-cells').innerText()).replaceAll(',','')),fullStats=await stats(page);expect(total).toBeGreaterThan(170000);expect(fullStats.visibleCells).toBeGreaterThan(10000);expect(fullStats.drawCalls).toBeLessThan(200);
 const original=await download(page);expect(original.schema).toBe('minecraft-campus-1');expect(original.districts).toHaveLength(15);
 const blocks=original.districts.flatMap(d=>d.project.blocks);expect(blocks).toHaveLength(total);expect(new Set(blocks.map(b=>[b.pos.x,b.pos.y,b.pos.z].join(','))).size).toBe(total);expect(new Set(blocks.map(b=>b.uid)).size).toBe(total);
 const references=new Set(original.districts.flatMap(d=>d.references));for(let i=1;i<=11;i++)expect(references.has('reference-'+String(i).padStart(2,'0'))).toBe(true);
 expect(blocks.every(b=>b.source.origin==='ai_estimated')).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/campus-desktop.png'});await page.screenshot({path:'evidence/campus-desktop-full.png',fullPage:true});
 await ring(page);const ringStats=await stats(page);expect(ringStats.visibleCells).toBeLessThan(fullStats.visibleCells);
 for(const name of ['等角','俯視','正面','側面'])await page.getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'正面',exact:true}).click();const canvas=page.locator('.campus-canvas');await canvas.scrollIntoViewIfNeeded();await canvas.click();
 const info=page.getByLabel('總覽方塊資訊');await expect(info).toContainText('AI Estimated Area');const coords=(await info.innerText()).match(/X (-?\d+) \/ Y (-?\d+) \/ Z (-?\d+)/);expect(coords).not.toBeNull();
 const picked=blocks.find(b=>b.pos.x===Number(coords![1])&&b.pos.y===Number(coords![2])&&b.pos.z===Number(coords![3]));expect(picked?.componentId).toBe('ring-control-spire');await expect(info).toContainText(picked!.id);
 await page.getByRole('checkbox',{name:'切開前半部看室內',exact:true}).check();await expect.poll(async()=>(await stats(page)).visibleCells).toBeLessThan(ringStats.visibleCells);
 expect(await download(page)).toEqual(original);expect(errors).toEqual([]);
});

test('district studio preserves global coordinates, edits and construction completion across return and reopening',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await ready(page);await ring(page);const label=await page.getByRole('button',{name:/^環門控制尖塔/}).innerText(),initial=Number(label.match(/([\d,]+) 格/)![1]!.replaceAll(',',''));
 await page.getByRole('button',{name:'進入此區逐層施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(initial));await expect(page.locator('.studio-summary')).toContainText('環門控制尖塔');
 await page.getByRole('button',{name:'正面',exact:true}).click();await clickWorld(page,[-99.5,.5,-20]);await expect(page.locator('.block-inspector')).toContainText('ring-control-spire:-100,0,-20');
 await openSection(page,'編輯工具與方塊');await page.getByRole('radio',{name:'放置',exact:true}).check();await page.getByRole('combobox',{name:'方塊種類',exact:true}).selectOption('minecraft:stone');await coordinate(page,-101,0,-20);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(initial+1));
 await page.getByRole('button',{name:'確認施工設計變更',exact:true}).click();await page.getByRole('spinbutton',{name:'施工檢視樓層',exact:true}).fill('0');await page.getByRole('checkbox',{name:'本層已完成',exact:true}).check();const progress=await page.locator('.progress-dock').innerText();expect(progress).toContain('已完成');
 await page.getByRole('button',{name:'返回全基地',exact:true}).click();await ready(page);await ring(page);await page.getByRole('button',{name:'進入此區逐層施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(initial+1));await expect(page.getByRole('checkbox',{name:'本層已完成',exact:true})).toBeChecked();await expect(page.locator('.progress-dock')).toHaveText(progress,{useInnerText:true});
 await page.getByRole('button',{name:'返回全基地',exact:true}).click();await ready(page);const saved=(await download(page)).districts.find(d=>d.id==='ring-control-spire')!;expect(saved.project.blocks).toHaveLength(initial+1);expect(saved.project.blocks.find(b=>b.pos.x===-101&&b.pos.y===0&&b.pos.z===-20)?.id).toBe('minecraft:stone');
});

test('mobile campus fits 390px and accepts real touch camera gestures',async({browser})=>{
 test.setTimeout(120000);const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 try{const page=await context.newPage();await page.goto('/');await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const canvas=page.locator('.campus-canvas');await canvas.scrollIntoViewIfNeeded();const rect=(await canvas.boundingBox())!;expect(rect.width).toBeGreaterThan(300);expect(rect.height).toBeGreaterThan(250);
 const before=await canvas.screenshot(),client=await context.newCDPSession(page),x=rect.x+rect.width/2,y=rect.y+rect.height/2;await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45,y:y+20,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>Buffer.compare(await canvas.screenshot(),before)).not.toBe(0);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/campus-mobile.png'});await page.screenshot({path:'evidence/campus-mobile-full.png',fullPage:true});await ring(page);await expect(page.getByRole('button',{name:'進入此區逐層施工',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
