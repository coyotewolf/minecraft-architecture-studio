import console from 'node:console';
import process from 'node:process';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';import {createServer} from 'vite';
const destination=process.env.LEAF_EVIDENCE_DIR||'evidence';await mkdir(destination,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5183,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1000,height:1200}});page.on('pageerror',console.error);await page.goto('http://127.0.0.1:5183/scripts/golden-leaf-review.html');await page.waitForFunction(()=>globalThis.ready,undefined,{timeout:90000});
for(const [name,yaw,pitch,span]of [['front',180,14,116],['rear',0,14,116],['top',180,90,90],['side',90,6,116]]){await page.evaluate(({yaw,pitch,span})=>globalThis.viewer.setCamera({projection:'orthographic',yaw,pitch,fov:30,distance:200,span,target:[.5,46,.5]}),{yaw,pitch,span});await page.waitForFunction(({yaw,pitch})=>{const camera=JSON.parse(globalThis.document.querySelector('canvas').dataset.camera||'{}');return Math.abs(camera.yaw-yaw)<.01&&Math.abs(camera.pitch-pitch)<.01;},{yaw,pitch});await page.screenshot({path:destination+'/golden-leaf-'+name+'.png'});} }finally{await browser.close();await server.close();}

