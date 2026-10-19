import type { Page } from '@playwright/test';
export async function pixel(page:Page,world:number[]){
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const c=JSON.parse((await page.locator('canvas').getAttribute('data-camera'))!);
  const r=(await page.locator('canvas').boundingBox())!;
  const sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]!);
  const dot=(a:number[],b:number[])=>a.reduce((n,v,i)=>n+v*b[i]!,0);
  const norm=(a:number[])=>{const n=Math.hypot(...a);return a.map(v=>v/n)};
  const cross=(a:number[],b:number[])=>[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!];
  const f=norm(sub(c.target,c.position)),right=norm(cross(f,[0,1,0])),up=cross(right,f);
  const delta=sub(sub(world,c.origin),c.position),depth=dot(delta,f),t=Math.tan(c.fov*Math.PI/360);
  return {x:r.x+r.width*(.5+dot(delta,right)/(2*depth*t*c.aspect)),y:r.y+r.height*(.5-dot(delta,up)/(2*depth*t))};
}
export async function clickWorld(page:Page,world:number[]){const p=await pixel(page,world);await page.mouse.click(p.x,p.y);}
export async function coordinate(page:Page,x:number,y:number,z:number){for(const [key,value] of [['X',x],['Y',y],['Z',z]] as const)await page.getByRole('spinbutton',{name:'目標 '+key,exact:true}).fill(String(value));await page.getByRole('button',{name:'預覽座標操作',exact:true}).click();}

