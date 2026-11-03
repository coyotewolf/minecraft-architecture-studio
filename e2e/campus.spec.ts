import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Project } from '../src/core/contracts.ts';
import { coordinate, clickWorld } from './helpers.ts';

type DistrictDownload = { id:string; parentGroupId?:string; references:string[]; project:Project };
const buildingIds=['ring-control-spire','teardrop-command','twin-residential-library','sphere-observatory','campus-industry','campus-airport','campus-dragons','campus-workshop','garden-greenhouses','garden-apartments','garden-pavilions','garden-temples'];
const groupId=(d:DistrictDownload)=>(d.parentGroupId??d.id).replace(/-v3$/,'');
type CampusDownload = { schema:string; districts:DistrictDownload[] };
async function stats(page:Page):Promise<{visibleCells:number;triangles:number;drawCalls:number}>{return JSON.parse((await page.locator('.campus-canvas').getAttribute('data-renderer-stats'))!);}
async function ready(page:Page){await expect(page.locator('.campus-canvas')).toHaveAttribute('data-renderer-stats',/visibleCells/,{timeout:180000});await expect(page.getByRole('button',{name:'開始施工',exact:true})).toBeEnabled({timeout:60000});}
async function download(page:Page):Promise<CampusDownload>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'下載完整基地 JSON',exact:true}).click();const file=await(await event).path();if(!file)throw new Error('Missing campus download');return readCampusDownload(file);}

// The complete V3 file can exceed JavaScript's maximum string length. Parse one bounded district at a time.
async function readCampusDownload(file:string):Promise<CampusDownload>{
 const districts:DistrictDownload[]=[];let header='',schema='',started=false,depth=0,quoted=false,escaped=false;let pieces:string[]=[];
 for await(const raw of createReadStream(file,{encoding:'utf8'})){
  let text=String(raw);
  if(!started){header+=text;const marker=header.indexOf(',"districts":[');if(marker<0)continue;schema=(JSON.parse(header.slice(0,marker)+'}')as{schema:string}).schema;text=header.slice(marker+14);header='';started=true;}
  let begin=depth>0?0:-1;
  for(let i=0;i<text.length;i++){
   const ch=text[i];if(depth===0){if(ch==='{'){depth=1;begin=i;}continue;}
   if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
   if(ch==='"')quoted=true;else if(ch==='{'||ch==='[')depth++;else if(ch==='}'||ch===']'){depth--;if(depth===0){pieces.push(text.slice(begin,i+1));districts.push(JSON.parse(pieces.join('')) as DistrictDownload);pieces=[];begin=-1;}}
  }
  if(begin>=0)pieces.push(text.slice(begin));
 }
 expect(started).toBe(true);expect(depth).toBe(0);expect(pieces).toHaveLength(0);return{schema,districts};
}
async function clickOverviewWorld(page:Page,position:[number,number,number]){
 const canvas=page.locator('.campus-canvas');await canvas.scrollIntoViewIfNeeded();const rect=(await canvas.boundingBox())!;
 const c=JSON.parse((await canvas.getAttribute('data-camera'))!)as{projection:string;span:number;fov:number;target:[number,number,number];yaw:number;pitch:number;distance:number};
 const aspect=rect.width/rect.height,yaw=c.yaw*Math.PI/180,pitch=c.pitch*Math.PI/180,q=position.map((v,i)=>v-c.target[i]!);
 const right=Math.cos(yaw)*q[0]!-Math.sin(yaw)*q[2]!,up=-Math.sin(pitch)*(Math.sin(yaw)*q[0]!+Math.cos(yaw)*q[2]!)+Math.cos(pitch)*q[1]!;
 const depth=c.distance-(Math.cos(pitch)*(Math.sin(yaw)*q[0]!+Math.cos(yaw)*q[2]!)+Math.sin(pitch)*q[1]!);
 const half=c.projection==='orthographic'?c.span/2:depth*Math.tan(c.fov*Math.PI/360);await canvas.click({position:{x:(right/(half*aspect)+1)*rect.width/2,y:(1-up/half)*rect.height/2}});
}

async function ring(page:Page){await page.getByRole('button',{name:/^環形控制塔/}).click();await expect(page.locator('.campus-stage h2')).toHaveText('環形控制塔');await expect(page.locator('.campus-canvas')).toHaveAttribute('data-renderer-stats',/visibleCells/);}
async function openSection(page:Page,text:string){const summary=page.locator('summary').filter({hasText:new RegExp('^'+text+'$')});if(await summary.locator('..').getAttribute('open')===null)await summary.click();}

test('complete campus exports all real districts and retains exact picking through overview filters and camera presets',async({page})=>{
 test.setTimeout(360000);await page.setViewportSize({width:1600,height:1050});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await ready(page);
 await expect(page.getByRole('heading',{name:'群島未來基地',exact:true})).toBeVisible();
 await expect(page.getByTestId('campus-items')).not.toContainText('待確認');
 const referenceCamera=JSON.parse((await page.locator('.campus-canvas').getAttribute('data-camera'))!);expect(referenceCamera.projection).toBe('orthographic');expect(referenceCamera.yaw).toBeCloseTo(35,6);expect(referenceCamera.pitch).toBeCloseTo(32,6);const frame=(await page.locator('.model-frame .comparison-frame').boundingBox())!;expect(Math.abs(frame.width/frame.height-1.5)).toBeLessThan(.01);
 const total=Number((await page.getByTestId('campus-cells').innerText()).replaceAll(',','')),fullStats=await stats(page);expect(total).toBeGreaterThan(1000000);expect(fullStats.visibleCells).toBeGreaterThan(10000);expect(fullStats.drawCalls).toBeLessThan(200);
 const original=await download(page);expect(original.schema).toBe('minecraft-campus-1');await expect(page.locator('.campus-district-button')).toHaveCount(new Set(original.districts.map(d=>d.parentGroupId??d.id)).size+1);
 expect([...new Set(original.districts.filter(d=>buildingIds.includes(groupId(d))).map(groupId))].sort()).toEqual([...buildingIds].sort());expect(original.districts.filter(d=>!buildingIds.includes(groupId(d))).length).toBeGreaterThanOrEqual(3);for(const d of original.districts){expect(d.project.blocks.length,d.id).toBeGreaterThan(0);expect(d.project.blocks.length,d.id).toBeLessThan(50000);}
 const blocks=original.districts.flatMap(d=>d.project.blocks);expect(blocks).toHaveLength(total);expect(new Set(blocks.map(b=>[b.pos.x,b.pos.y,b.pos.z].join(','))).size).toBe(total);expect(new Set(blocks.map(b=>b.uid)).size).toBe(total);
 const references=new Set(original.districts.flatMap(d=>d.references));for(let i=1;i<=11;i++)expect(references.has('reference-'+String(i).padStart(2,'0'))).toBe(true);
 expect(blocks.every(b=>b.source.origin==='ai_estimated')).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/reference-v3-regression-desktop.png'});await page.screenshot({path:'evidence/reference-v3-regression-desktop-full.png',fullPage:true});
 await ring(page);const ringStats=await stats(page);expect(ringStats.visibleCells).toBeLessThan(fullStats.visibleCells);
 for(const name of ['等角','俯視','正面','側面'])await page.getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'正面',exact:true}).click();const canvas=page.locator('.campus-canvas');await canvas.scrollIntoViewIfNeeded();const ringBlocks=original.districts.filter(d=>groupId(d)==='ring-control-spire').flatMap(d=>d.project.blocks);const face=ringBlocks.reduce((a,b)=>b.pos.z>a.pos.z||b.pos.z===a.pos.z&&b.pos.y<a.pos.y?b:a);await clickOverviewWorld(page,[face.pos.x+.5,face.pos.y+.5,face.pos.z+1]);
 const info=page.getByLabel('總覽方塊資訊');await expect(info).toContainText('AI Estimated Area');const coords=(await info.innerText()).match(/X (-?\d+) \/ Y (-?\d+) \/ Z (-?\d+)/);expect(coords).not.toBeNull();
 const picked=blocks.find(b=>b.pos.x===Number(coords![1])&&b.pos.y===Number(coords![2])&&b.pos.z===Number(coords![3]));expect(picked?.uid).toBe(face.uid);expect(picked?.componentId).toBe('ring-control-spire');await expect(info).toContainText(picked!.id);
 await page.getByRole('checkbox',{name:'切開前半部看室內',exact:true}).check();await expect.poll(async()=>(await stats(page)).visibleCells).toBeLessThan(ringStats.visibleCells);
 const digest=(value:CampusDownload)=>value.districts.reduce((hash,d)=>hash.update(JSON.stringify(d)),createHash('sha256').update(value.schema)).digest('hex');expect(digest(await download(page))).toBe(digest(original));expect(errors).toEqual([]);
});

test('district studio preserves global coordinates, edits and construction completion across return and reopening',async({page})=>{
 // V3 contains over one million canonical cells; allow bounded-part export and three full overview loads.
 test.setTimeout(480000);await page.goto('/');await ready(page);console.info('Studio acceptance: overview ready');const initialCampus=await download(page),ringParts=initialCampus.districts.filter(d=>groupId(d)==='ring-control-spire'),ringBlocks=ringParts.flatMap(d=>d.project.blocks);
 const allOccupied=new Set(initialCampus.districts.flatMap(d=>d.project.blocks).map(b=>[b.pos.x,b.pos.y,b.pos.z].join(',')));
 const frontZ=Math.max(...ringBlocks.map(b=>b.pos.z));
 const foundation=ringBlocks.filter(b=>b.pos.z===frontZ).sort((a,b)=>a.pos.y-b.pos.y||a.pos.x-b.pos.x).find(b=>!allOccupied.has([b.pos.x,b.pos.y+1,b.pos.z].join(',')))!;
 expect(foundation).toBeDefined();console.info('Studio acceptance: canonical exposed surface selected');const groundY=foundation.pos.y;const ringPart=ringParts.find(d=>d.project.blocks.some(b=>b.uid===foundation.uid))!,ringProject=ringPart.project,initial=ringProject.blocks.length;const edit={x:foundation.pos.x,y:foundation.pos.y+1,z:foundation.pos.z};
 await ring(page);await page.getByRole('combobox',{name:'施工分檔',exact:true}).selectOption(ringPart.id);await page.getByRole('button',{name:'進入此區逐層施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(initial));await expect(page.locator('.studio-summary')).toContainText(ringProject.title);
 await page.getByRole('button',{name:'背面',exact:true}).click();await clickWorld(page,[foundation.pos.x+.5,foundation.pos.y+.5,foundation.pos.z+1]);await expect(page.locator('.block-inspector')).toContainText(foundation.uid);console.info('Studio acceptance: exact part pick verified');
 await openSection(page,'編輯工具與方塊');await page.getByRole('radio',{name:'放置',exact:true}).check();await page.getByRole('combobox',{name:'方塊種類',exact:true}).selectOption('minecraft:stone');await coordinate(page,edit.x,edit.y,edit.z);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(initial+1));
 await page.getByRole('button',{name:'確認施工設計變更',exact:true}).click();await page.getByRole('spinbutton',{name:'施工檢視樓層',exact:true}).fill(String(groundY));await page.getByRole('checkbox',{name:'本層已完成',exact:true}).check();console.info('Studio acceptance: edit and completion applied');const progress=await page.locator('.progress-dock').innerText();expect(progress).toContain('已完成');
 await page.getByRole('button',{name:'返回全基地',exact:true}).click();await ready(page);await ring(page);await page.getByRole('combobox',{name:'施工分檔',exact:true}).selectOption(ringPart.id);await page.getByRole('button',{name:'進入此區逐層施工',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText(String(initial+1));await expect(page.getByRole('checkbox',{name:'本層已完成',exact:true})).toBeChecked();await expect(page.locator('.progress-dock')).toHaveText(progress,{useInnerText:true});console.info('Studio acceptance: reopened edit and progress verified');
 await page.getByRole('button',{name:'返回全基地',exact:true}).click();await ready(page);const saved=(await download(page)).districts.find(d=>d.id===ringPart.id)!;expect(saved.project.blocks).toHaveLength(initial+1);expect(saved.project.blocks.find(b=>b.pos.x===edit.x&&b.pos.y===edit.y&&b.pos.z===edit.z)).toMatchObject({id:'minecraft:stone',source:{origin:'user_created'}});

});

test('mobile campus fits 390px and accepts real touch camera gestures',async({browser})=>{
 test.setTimeout(360000);const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 try{const page=await context.newPage();await page.goto('/');await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const canvas=page.locator('.campus-canvas');await canvas.scrollIntoViewIfNeeded();const rect=(await canvas.boundingBox())!;expect(rect.width).toBeGreaterThan(300);expect(Math.abs(rect.width/rect.height-1.5)).toBeLessThan(.01);expect(rect.height).toBeGreaterThan(190);
 const before=await canvas.screenshot(),client=await context.newCDPSession(page),x=rect.x+rect.width/2,y=rect.y+rect.height/2;await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45,y:y+20,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>Buffer.compare(await canvas.screenshot(),before)).not.toBe(0);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/reference-v3-regression-mobile.png'});await page.screenshot({path:'evidence/reference-v3-regression-mobile-full.png',fullPage:true});await ring(page);await expect(page.getByRole('button',{name:'進入此區逐層施工',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
