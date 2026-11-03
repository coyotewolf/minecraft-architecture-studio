import type {District} from '../campus/builder.ts';
import {HighDetailBuilder} from '../campus/high-detail.ts';
import type {MinecraftId, Project} from '../../core/contracts.ts';
import {parseProject} from '../../core/model.ts';

/** V13 refines the canonical 100-block design without overwriting earlier collections. */
export const GOLDEN_LEAF_DESIGN={id:'golden-leaf-tower',revision:'golden-leaf-100-v13',front:'negative-z',nominalTowerDiameter:48,nominalTowerHeight:88,towerBaseY:11,highestY:99,floorPitch:3,floorCount:26,floorLevels:Array.from({length:26},(_,i)=>11+i*3),referenceInspiredAspect:1090/620,chosenAspect:88/48,proportionNote:'全棟含基座與尖頂 Y0–99，共100格；塔身最大直徑48、膠囊形基座71×47、中央直段24格接左右半圓；裙樓57×33、屋頂Y8，比側亭Y14低6格，左右附樓與屋頂花園採朝內凹的月牙足跡。26道樓板以3格層距排列，半磚保留至少2格淨高；最上兩道隨雙葉收窄；前圖26道層帶、背圖約13道，兩圖可見層帶不完全對應；本設計保留26個通行樓層，後窗以13道外露半磚層帶呼應參考，其餘內樓板退至玻璃後。隱藏結構、尺寸均為 AI Estimated Area。'} as const;
const WHITE:MinecraftId='minecraft:smooth_quartz',GOLD:MinecraftId='minecraft:gold_block',GLASS:MinecraftId='minecraft:blue_stained_glass',SLAB:MinecraftId='minecraft:smooth_stone_slab',LAMP:MinecraftId='minecraft:glowstone';
const leafState={persistent:'true',distance:'1'};
const floorSet=new Set<number>(GOLDEN_LEAF_DESIGN.floorLevels);
const rearLedgeLevels=new Set(Array.from({length:13},(_,i)=>38+i*4));
// Traced width ratios from the reference: a broad lower bowl and a progressively curving shoulder.
const profile=[[11,16.8],[14.5,18.72],[26,22.56],[38.3,24],[50.6,22.56],[66.4,18.72],[83.2,11.4],[87,8.5],[91,4.7],[95,2.4],[98,1.1],[99,.2]] as const;
const ribProfile=[[11,-5.5],[18,-3.2],[25,0],[35,3.6],[42,5.9],[49,7],[55,7.4],[66.4,6.64],[75,5.5],[78,3.9],[87,2],[94,.4]] as const;
const smooth=(t:number)=>t*t*(3-2*t);
function sampleProfile(y:number,profile:readonly (readonly [number,number])[]){
 const slope=(i:number)=>{const segment=(j:number)=>(profile[j+1]![1]-profile[j]![1])/(profile[j+1]![0]-profile[j]![0]);if(i===0)return segment(0);if(i===profile.length-1)return segment(i-1);const a=segment(i-1),b=segment(i);return a*b<=0?0:2*a*b/(a+b);};
 for(let i=1;i<profile.length;i++){const [a,ra]=profile[i-1]!,[z,rz]=profile[i]!;if(y<=z){const t=Math.max(0,(y-a)/(z-a)),h=z-a;return (2*t**3-3*t*t+1)*ra+(t**3-2*t*t+t)*h*slope(i-1)+(-2*t**3+3*t*t)*rz+(t**3-t*t)*h*slope(i);}}
 return profile[profile.length-1]![1];
}
function bodyRadius(y:number){return y>99?0:sampleProfile(y,profile);}
// A single pair of nested circular envelopes closes both crowns without added disks.
function shortSection(y:number){const t=smooth(Math.max(0,Math.min(1,(y-68)/22)));return {cx:10*t,r:y>90?0:sampleProfile(y,[[68,18.2],[76,14],[82,9.2],[86,5.2],[89,2],[90,.6]])};}
function crownRadius(y:number,theta=0){
 const tall=bodyRadius(y);if(y<=68||Math.sin(theta)<1e-6)return tall;
 const s=shortSection(y),discriminant=s.r*s.r-s.cx*s.cx*Math.cos(theta)**2;
 return discriminant<0||s.r===0?tall:Math.max(tall,s.cx*Math.sin(theta)+Math.sqrt(discriminant));
}
// The lower rear bowl expands mainly across X; its depth changes only two blocks.
// This keeps one broad gold panel instead of many concentric horizontal terraces.
function rearDepth(y:number){return y<=38?22+2*smooth(Math.max(0,(y-11)/27)):bodyRadius(y);}
function radius(y:number,theta=0){const r=crownRadius(y,theta);if(Math.cos(theta)>=0||y>38)return r;const depth=rearDepth(y);return r*depth/Math.hypot(depth*Math.sin(theta),r*Math.cos(theta));}
function rearSurface(y:number,x:number){const r=bodyRadius(y);return Math.floor(rearDepth(y)*Math.sqrt(Math.max(0,1-(x/r)**2)));}
function aperture(y:number,rear=false){return rear?(y<35||y>89?0:.48*Math.pow(Math.sin(Math.PI*(y-35)/54),.8)):.48+.27*Math.sin(Math.PI*Math.min(1,(y-11)/88*1.08));}
function windowFacade(y:number,rear=false){
 const angle=Math.asin(aperture(y,rear)),leftRadius=radius(y,rear?-Math.PI+angle:-angle),rightRadius=radius(y,rear?Math.PI-angle:angle),left=-Math.floor(Math.max(0,leftRadius-2)*Math.sin(angle)),right=rightRadius>=4?Math.floor((rightRadius-2)*Math.sin(angle)):0;
 const leftZ=-(leftRadius-2)*Math.cos(angle),rightZ=rightRadius>=4?-(rightRadius-2)*Math.cos(angle):-(leftRadius-2);
 return {left,right,z:(x:number)=>{const t=Math.max(0,Math.min(1,(x-left)/Math.max(1,right-left)));return (rear?-1:1)*Math.round(leftZ+(rightZ-leftZ)*t-2*4*t*(1-t));}};
}
const frontFacade=(y:number)=>windowFacade(y);
const capsuleDistance=(x:number,z:number)=>Math.hypot(Math.max(Math.abs(x)-12,0),z);
const crescent=(x:number,z:number,side:number)=>Math.hypot((x-side*23)/11,z/13)<=1&&Math.hypot((x-side*18)/10,z/11)>1;
const nearCrescent=(x:number,z:number)=>[-1,1].some(side=>crescent(x,z,side));
const boundary=(x:number,z:number,inside:(x:number,z:number)=>boolean)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!inside(x+dx!,z+dz!));
function capsule(b:HighDetailBuilder,y:number,r:number,id:MinecraftId,category:string){for(let x=-12-r;x<=12+r;x++)for(let z=-r;z<=r;z++)if(capsuleDistance(x,z)<=r)b.set(x,y,z,id,category);}
function stairs(b:HighDetailBuilder){
 const levels=[3,7,...GOLDEN_LEAF_DESIGN.floorLevels];
 for(let floor=0;floor<levels.length-1;floor++){const base=levels[floor]!,rise=levels[floor+1]!-base,reverse=floor%2===1,x=reverse?-1:-3;
  for(let i=0;i<rise;i++){const z=reverse?rise-2-i:i-(rise-2),y=base+i+1;for(let h=1;h<=3;h++)b.clear(x,y+h,z);b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south'});}
  for(let xx=-3;xx<=-1;xx++)b.set(xx,base+rise,reverse?-2:2,WHITE,'Stair landing');
 }
}
function buildGoldenLeaf(){

 const b=new HighDetailBuilder({id:GOLDEN_LEAF_DESIGN.revision,title:'金色葉塔・百格重建',origin:[0,0,0],references:['golden-leaf-front','golden-leaf-rear'],features:['百格內完整金葉塔、灰色外架與內退深藍窗','26道半磚樓板、前X與後窄葉窗、雙金葉覆疊','雙月牙附樓、膠囊基座與主入口、暖螢石與多層花園'],notes:GOLDEN_LEAF_DESIGN.proportionNote});
 // An actual stadium footprint: straight front/rear runs and circular end caps.
 capsule(b,0,23,'minecraft:stone_bricks','Foundation');capsule(b,1,23,WHITE,'Base terrace');capsule(b,3,16,WHITE,'Lobby floor');
 for(let x=-28;x<=28;x++)for(let z=-16;z<=16;z++)if(capsuleDistance(x,z)<=16&&boundary(x,z,(xx,zz)=>capsuleDistance(xx,zz)<=16))for(let y=2;y<=7;y++)b.set(x,y,z,y<=3||y===7||x%5===0?WHITE:GLASS,'Podium facade');
 capsule(b,8,16,WHITE,'Podium roof');
 for(let x=-4;x<=1;x++)for(let z=-3;z<=3;z++)b.clear(x,8,z);
 const neckFacade=frontFacade(11);
 for(let y=9;y<=10;y++){
  for(let x=-17;x<=17;x++)for(let z=-17;z<=17;z++){const d=Math.hypot(x,z),r=y===9?15.6:16.2,opening=z<0&&x>=neckFacade.left&&x<=neckFacade.right;if(!opening&&d>=r-1.25&&d<=r)b.set(x,y,z,GOLD,'Inset tower neck');}
  for(let x=neckFacade.left;x<=neckFacade.right;x++)b.set(x,y,neckFacade.z(x),GLASS,'Front neck glazing');
  for(const x of [neckFacade.left-1,neckFacade.right+1])b.set(x,y,neckFacade.z(x),WHITE,'Front neck return');
 }
 for(let y=11;y<=99;y++){
  const r=bodyRadius(y),frontAngle=Math.asin(aperture(y)),rearAngle=Math.asin(aperture(y,true)),floor=floorSet.has(y),cap=shortSection(y),facade=frontFacade(y),backFacade=windowFacade(y,true);
  for(let x=-Math.ceil(r+4);x<=Math.ceil(Math.max(r+4,cap.cx+cap.r));x++)for(let z=-Math.ceil(r+4);z<=Math.ceil(Math.max(r+4,rearDepth(y)));z++){
   const theta=Math.atan2(x,-z),a=Math.abs(theta),rr=radius(y,theta),d=Math.hypot(x,z);if(rr<.2)continue;
   const front=a<frontAngle,rear=Math.PI-a<rearAngle,window=front||rear;
   if((!window||rr<3.2)&&d>=Math.max(0,y===11&&z>0?Math.min(rr-1.5,r-1.25):rr-1.5)&&d<=rr)b.set(x,y,z,GOLD,'Golden petal shell');
   if(y>=85&&cap.r>0&&x>=7&&Math.hypot(x-cap.cx,z)<=cap.r)b.set(x,y,z,GOLD,'Golden petal shell');
   const inside=x<=0||y<=68||Math.hypot(x-cap.cx,z)<cap.r-3;
   if(floor&&inside&&(!front||z>=facade.z(x)+1)&&(!rear||z<=backFacade.z(x)-1)&&d<rr-3)b.set(x,y,z,SLAB,'Floor',{type:'top'});
  }
  if(r>=4)for(let x=facade.left;x<=facade.right;x++){
   const z=facade.z(x);b.set(x,y,z,GLASS,'Front recessed glazing');
   if(floor){for(let zz=z-1;zz<=0;zz++)b.set(x,y,zz,zz<=z?'minecraft:smooth_quartz_slab':SLAB,zz<=z?'Front slab ledge':'Floor',{type:'top'});}

  }
  if(rearAngle>0&&r>=4)for(let x=backFacade.left;x<=backFacade.right;x++){
   const z=backFacade.z(x);b.set(x,y,z,GLASS,'Rear recessed glazing');
   if(floor)for(let zz=0;zz<z;zz++)b.set(x,y,zz,SLAB,'Floor',{type:'top'});
   if(rearLedgeLevels.has(y))b.set(x,y,z+1,'minecraft:smooth_quartz_slab','Rear slab ledge',{type:'top'});
  }
  // White returns line the gold edge; the gray structure is separate and further forward.
  for(const rear of [false,true]){const angle=rear?rearAngle:frontAngle;if(angle<=0)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-angle):side*angle,rr=radius(y,theta);if(rr<4)continue;
    for(let depth=0;depth<=1;depth++)for(let width=0;width<=0;width++)b.set(Math.round((rr-depth)*Math.sin(theta))+side*width,y,-Math.round((rr-depth)*Math.cos(theta)),WHITE,rear?'Rear white leaf reveal':'Front white leaf reveal');
   }
  }

  if(r>=4)for(const x of [facade.left-1,facade.right+1]){const z=facade.z(x);b.set(x,y,z,WHITE,'Front facade side return');}
  if(rearAngle>0&&r>=4)for(const x of [backFacade.left-1,backFacade.right+1])b.set(x,y,backFacade.z(x),WHITE,'Rear facade side return');
  if(y>=36&&y<=89)b.set(0,y,backFacade.z(0)+1,WHITE,'Rear central spine');
  if(floor){for(const rear of [false,true]){if(rear)continue;const angle=rear?rearAngle:frontAngle;if(angle<=.03)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-angle*.7):side*angle*.86,rr=radius(y,theta);if(rr<7)continue;const lampX=rear?Math.round((side<0?backFacade.left:backFacade.right)*.8):Math.round((side<0?facade.left:facade.right)*.85),lampZ=rear?backFacade.z(lampX)+1:facade.z(lampX)-1;b.set(lampX,y,lampZ,LAMP,'Facade ledge light');}}
   if(r>=10){b.set(4,y+1,0,'minecraft:bookshelf','Interior');b.set(0,y+1,4,'minecraft:lantern','Interior light');}}
 }
 // Rear ornamental shelves have their own four-block pitch, independent of occupied floors.
 for(const y of rearLedgeLevels){
  const facade=windowFacade(y,true);
  for(const side of [-1,1]){
   const x=side*Math.max(1,Math.round(Math.abs(side<0?facade.left:facade.right)*.8)),z=facade.z(x)+1;
   b.set(x,y,z,'minecraft:smooth_quartz_slab','Rear slab ledge',{type:'top'});
   b.set(x,y+1,z,LAMP,'Facade ledge light');
  }
 }
 const rearTip=b.finishProject().blocks.filter(block=>block.category==='Rear white leaf reveal').sort((a,b)=>a.pos.y-b.pos.y||Math.abs(a.pos.x)-Math.abs(b.pos.x)||b.pos.z-a.pos.z||a.pos.x-b.pos.x)[0]!.pos;
 // One diagonal lap is raised by just one voxel and feathers into the same shell.
 // Limiting it to three columns avoids translating a whole rear hemisphere.
 for(let y=11;y<rearTip.y;y++){
  const seam=Math.round(-15+(y-11)*(rearTip.x+15)/(rearTip.y-12));
  for(let x=seam;x<=seam+3;x++){
   const back=rearSurface(y,x);
   for(let z=back-1;z<=back+(x<=seam+1?1:0);z++)b.set(x,y,z,GOLD,x===seam&&z===back+1?'Rear overlap lip':x===seam?'Rear diagonal petal overlap':'Rear overlapping petal');
  }
 }
 // Follow the two envelopes with a single pale trace, ending before each golden tip.
 for(let y=90;y<=97;y++)for(const rear of [false,true]){
  const r=bodyRadius(y),x=-Math.round(r*.48),z=(rear?1:-1)*Math.round(Math.sqrt(Math.max(0,r*r-x*x)));
  b.set(x,y,z,'minecraft:quartz_stairs',rear?'Rear apex white return':'Front apex white return',{facing:'west',half:'bottom',shape:'straight'});
 }
 b.set(0,99,0,GOLD,'Tall leaf tip');
 // Crown material is classified from the very same envelope used by the lower shell.
 for(const cell of b.finishProject().blocks.filter(block=>block.id===GOLD&&block.pos.y>=85&&block.pos.x>=7))b.set(cell.pos.x,cell.pos.y,cell.pos.z,GOLD,cell.pos.y===90?'Short leaf tip':'Short leaf crown');
 // Both pavilion volumes, roof decks and planting use the same inward-facing crescent mask.
 for(const side of [-1,1]){
  const inside=(x:number,z:number)=>crescent(x,z,side);
  for(let x=side*23-11;x<=side*23+11;x++)for(let z=-13;z<=13;z++)if(inside(x,z)){
   b.set(x,3,z,WHITE,'Annex floor');for(let y=4;y<=12;y++)b.clear(x,y,z);
   const edge=boundary(x,z,inside);
   if(edge)for(let y=4;y<=12;y++)b.set(x,y,z,y===12&&(x+z)%4===0?LAMP:(y===4||y===11||x%4===0||z%5===0?WHITE:GLASS),y===12&&(x+z)%4===0?'Annex eave light':'Annex glazing');
   b.set(x,13,z,WHITE,'Annex cornice');b.set(x,14,z,WHITE,'Annex roof');
   const walk=Math.abs(x)>=30&&Math.abs(x)<=31&&z>=-6&&z<=6;
   const innerEdge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>Math.hypot((x+dx!-side*18)/10,(z+dz!)/11)<=1),innerPlant=Math.hypot((x-side*18)/10,z/11)<=1.15;
   if(!walk){if(edge){if(innerEdge){b.set(x,15,z,'minecraft:smooth_quartz_slab','Annex inner parapet',{type:'double'});}else b.set(x,15,z,'minecraft:smooth_quartz_slab','Annex garden curb',{type:'double'});}
    else{b.set(x,15,z,'minecraft:dirt','Annex garden soil');b.set(x,16,z,'minecraft:oak_leaves','Annex garden shrub',leafState);if(!innerPlant&&(x+z)%4===0)b.set(x,17,z,'minecraft:oak_leaves','Annex garden shrub',leafState);if(!innerPlant&&(x+z)%8===0)b.set(x,18,z,'minecraft:oak_leaves','Annex garden shrub',leafState);if(!innerPlant&&(x-z)%11===0){b.set(x,16,z,'minecraft:pink_tulip','Garden flower');b.clear(x,17,z);b.clear(x,18,z);}}
   }
  }
  // A two-block-wide lobby passage reaches the first stair from inside the capsule.
  for(let xx=16;xx<=33;xx++)for(let z=-7;z<=-6;z++){const x=side*xx;b.set(x,3,z,WHITE,'Annex connector');for(let y=4;y<=7;y++)b.clear(x,y,z);}
  for(let i=0;i<11;i++){const reverse=i>=6,x=side*(reverse?30:32),z=reverse?-(i-6):-5+i,y=4+i;for(let h=1;h<=3;h++)b.clear(x,y+h,z);b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south'});}
  for(let xx=30;xx<=32;xx++){const x=side*xx;for(let y=10;y<=12;y++)b.clear(x,y,1);b.set(x,9,1,WHITE,'Stair landing');}
 }
 // Short, supported tree groups occupy the broad front and rear crescent lobes.
 for(const side of [-1,1])for(const z of [-9,9]){
  const x=side*29;b.set(x,15,z,'minecraft:dirt','Annex tree soil');b.set(x,16,z,'minecraft:oak_log','Annex tree trunk',{axis:'y'});b.set(x,17,z,'minecraft:oak_log','Annex tree trunk',{axis:'y'});
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(crescent(x+dx,z+dz,side)){b.set(x+dx,18,z+dz,'minecraft:oak_leaves','Annex tree crown',leafState);if(Math.abs(dx)+Math.abs(dz)<=1)b.set(x+dx,19,z+dz,'minecraft:oak_leaves','Annex tree crown',leafState);}
 }
 const groundSoil:{x:number;z:number}[]=[],gardenPath=(x:number,z:number)=>(Math.abs(x)<=5&&z<0)||(x>=4&&x<=11&&z>0);
 // Ground and podium beds are generated from capsule distance; no old circular garden remnants remain.
 for(let x=-35;x<=35;x++)for(let z=-23;z<=23;z++){
  const d=capsuleDistance(x,z),path=(Math.abs(x)<=5&&z<0)||(x>=4&&x<=11&&z>0);
  if(d>=20&&d<=22.8&&!path&&!nearCrescent(x,z)){
   if(d<20.4||d>22.5||x%9===0||z%9===0||[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>capsuleDistance(x+dx!,z+dz!)>23||gardenPath(x+dx!,z+dz!)))b.set(x,2,z,WHITE,'Garden curb');
   else{groundSoil.push({x,z});b.set(x,2,z,'minecraft:dirt','Ground garden soil');b.set(x,3,z,'minecraft:oak_leaves','Grouped garden hedge',leafState);b.set(x,4,z,'minecraft:oak_leaves','Garden shrub crown',leafState);if((x-z)%11===0){b.set(x,3,z,'minecraft:pink_tulip','Garden flower');b.clear(x,4,z);}}
  }
  if(d>=14&&d<=15.8&&!nearCrescent(x,z)&&Math.hypot(x,z)>=17){
   if(x%8===0||z%8===0)b.set(x,9,z,'minecraft:smooth_quartz_slab','Podium planter divider',{type:'double'});
   else{b.set(x,9,z,'minecraft:dirt','Podium grouped soil');b.set(x,10,z,'minecraft:oak_leaves','Podium grouped hedge',leafState);if((x+z)%4===0)b.set(x,11,z,'minecraft:oak_leaves','Podium shrub crown',leafState);if((x-z)%13===0){b.set(x,10,z,'minecraft:pink_tulip','Garden flower');b.clear(x,11,z);}}
  }
 }
 const soilCells=new Set(groundSoil.map(p=>p.x+','+p.z));
 for(const {x,z} of groundSoil)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const xx=x+dx!,zz=z+dz!;
  if(!soilCells.has(xx+','+zz)&&capsuleDistance(xx,zz)<=23&&!gardenPath(xx,zz))b.set(xx,2,zz,WHITE,'Garden curb');
 }
 stairs(b);
 // Three broad entrance rises meet the lobby floor, with a tall blue-glass surround and gold light piers.
 for(let i=0;i<3;i++)for(let x=-4;x<=4;x++){const z=-23+i;b.box(x,0,z,x,i,z,WHITE,'Entrance support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 for(let x=-3;x<=3;x++)for(let z=-20;z<=-4;z++){b.set(x,3,z,WHITE,'Entrance landing');for(let y=4;y<=7;y++)b.clear(x,y,z);}
 for(const x of [-4,4])for(let y=4;y<=6;y++)b.set(x,y,-15,LAMP,'Entrance light pier');
 for(let x=-3;x<=3;x++)for(let y=4;y<=6;y++)if(x!==-1&&x!==0||y>=6)b.set(x,y,-15,GLASS,'Entrance blue surround');
 for(const x of [-5,5])for(let y=4;y<=7;y++)b.set(x,y,-15,WHITE,'Entrance white frame');
 // Rear access is offset to the right as in the rear reference.
 for(let i=0;i<3;i++)for(let x=5;x<=10;x++){const z=23-i;b.box(x,0,z,x,i,z,WHITE,'Rear entrance support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'north'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 for(let x=5;x<=10;x++)for(let z=4;z<=20;z++){b.set(x,3,z,WHITE,'Rear entrance landing');for(let y=4;y<=7;y++)b.clear(x,y,z);}
 for(const x of [5,10])for(let y=4;y<=6;y++)b.set(x,y,15,LAMP,'Rear entrance light pier');
 for(let x=6;x<=9;x++)for(let y=4;y<=6;y++)if(x!==7&&x!==8||y>=6)b.set(x,y,15,GLASS,'Rear entrance blue surround');
 for(let x=-5;x<=5;x++)for(let y=4;y<=6;y++)b.clear(x,y,-16);
 for(let x=5;x<=10;x++)for(let y=4;y<=6;y++)b.clear(x,y,16);
 for(const x of [-4,4])for(let y=4;y<=6;y++)b.set(x,y,-16,LAMP,'Entrance light pier');
 for(const x of [-5,5])for(let y=4;y<=7;y++)b.set(x,y,-16,WHITE,'Entrance white frame');
 for(const x of [5,10])for(let y=4;y<=6;y++)b.set(x,y,16,LAMP,'Rear entrance light pier');
 for(const [x,z]of[[-1,-15],[0,-15],[7,15],[8,15]]as const)for(const dz of [-1,1]){b.set(x,3,z+dz,WHITE,'Door threshold');b.set(x,4,z+dz,'minecraft:stone_pressure_plate','Door control',{powered:'false'});}
 b.door(-1,4,-15,'north');b.door(0,4,-15,'north');b.door(7,4,15,'south');b.door(8,4,15,'south');
 for(const y of GOLDEN_LEAF_DESIGN.floorLevels){const r=bodyRadius(y);if(r>=7)b.set(0,y+1,frontFacade(y+1).z(0)+1,LAMP,'Front interior window light');}
 // Supported lamp pedestals are placed after planting, clearing only their own canopy cells.
 const finalLamp=(x:number,y:number,z:number,category:string)=>{for(let yy=category.includes('ground')?2:category.startsWith('Annex')?15:9;yy<=y;yy++)b.set(x,yy,z,WHITE,'Lamp pedestal');b.set(x,y+1,z,LAMP,category);for(let yy=y+2;yy<=(category.startsWith('Podium')?11:18);yy++)b.clear(x,yy,z);};
 for(const x of [-16,-8,8,16])finalLamp(x,3,-22,'Front ground garden lamp');
 for(const x of [-16,-8,14,16])finalLamp(x,3,22,'Rear ground garden lamp');
 for(const x of [-18,-11,11,18])for(const side of [-1,1])finalLamp(x,10,side*(Math.abs(x)===18?14:15),'Podium roof garden lamp');
 for(const side of [-1,1])for(const [x,z]of [[32,-5],[32,5],[28,-10],[28,10]]as const)finalLamp(side*x,15,z,'Annex roof garden lamp');
 // Close exposed soil sides at soil height; preserve the two-block roof circulation strip.
 const gardenSnapshot=b.finishProject().blocks,gardenCells=new Map(gardenSnapshot.map(block=>[[block.pos.x,block.pos.y,block.pos.z].join(','),block]));
 for(const soil of gardenSnapshot.filter(block=>['Podium grouped soil','Annex garden soil'].includes(block.category??''))){
  const {x,y,z}=soil.pos,annex=y===15;
  const besideWalk=annex&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>Math.abs(x+dx!)>=30&&Math.abs(x+dx!)<=31&&Math.abs(z+dz!)<=6);
  if(besideWalk){b.set(x,y,z,WHITE,'Low planter rim');for(let yy=y+1;yy<=y+3;yy++)b.clear(x,yy,z);continue;}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx!,zz=z+dz!,neighbor=gardenCells.get([xx,y,zz].join(','));
   if(neighbor){if(neighbor.id==='minecraft:smooth_quartz_slab')b.set(xx,y,zz,neighbor.id,neighbor.category!,{type:'double'});continue;}
   if(annex||capsuleDistance(xx,zz)>17)continue;
   b.set(xx,y-1,zz,WHITE,'Planter bracket');b.set(xx,y,zz,WHITE,'Low planter rim');
  }
 }
 // Full-cube smooth-stone ribs contrast with the quartz reveals. Half slabs bridge only actual grid turns.
 const ribRows=new Map<number,{x:number;y:number;z:number}[]>(),mainCells=new Set<string>();
 for(const side of [-1,1]){
  const rows:{x:number;y:number;z:number}[]=[];ribRows.set(side,rows);
  for(let y=11;y<=94;y++){
   const desired=Math.round(side*sampleProfile(y,ribProfile));
   // The positive-X trunk follows the tall crown once the short leaf closes its own window.
   const x=side>0&&y>=78?Math.min(desired,Math.max(0,frontFacade(y).right-1)):desired,theta=Math.asin(Math.max(-1,Math.min(1,x/bodyRadius(y)))),rr=side>0&&y>=78?bodyRadius(y):radius(y,theta);
   if(rr<4||Math.abs(x)>rr-1||x<frontFacade(y).left||x>frontFacade(y).right)continue;
   const z=(side>0&&y>=78?Math.min(frontFacade(y).z(x),-Math.round(bodyRadius(y)-2)):frontFacade(y).z(x))-2;rows.push({x,y,z});mainCells.add([x,y,z].join(','));b.set(x,y,z,'minecraft:smooth_stone','Front curved rib');
  }
 }
 // The two shoulder trunks split into inner crossing ribs and outer curved legs.
 // Straight outer legs terminate against the intact leaf return where the blue opening closes.
 const outerRibProfile=[[11,10],[29,10],[36,9],[49,7]] as const;
 const supportCells=new Map(b.finishProject().blocks.map(block=>[[block.pos.x,block.pos.y,block.pos.z].join(','),block]));
 for(const side of [-1,1]){
  const rows:{x:number;y:number;z:number}[]=[];ribRows.set(side*2,rows);
  for(let y=49;y>=11;y--){
   const facade=frontFacade(y),x=side*Math.ceil(sampleProfile(y,outerRibProfile));
   let ends=x<=facade.left+1||x>=facade.right-1,z=facade.z(x)-2;
   if(ends){
    // Join the front face of an existing solid leaf cell without replacing its material.
    let contact=z;
    while(contact<=0&&!['minecraft:gold_block','minecraft:smooth_quartz'].includes(supportCells.get([x,y,contact].join(','))?.id??''))contact++;
    if(contact>0)ends=false;else z=contact-1;
   }
   const key=[x,y,z].join(',');rows.push({x,y,z});
   if(!mainCells.has(key)){mainCells.add(key);b.set(x,y,z,'minecraft:smooth_stone','Front outer branch');}
   if(ends)break;
  }
  rows.reverse();
 }
 for(const rows of ribRows.values())for(let i=0;i<rows.length-1;i++){
  const from=rows[i]!,to=rows[i+1]!;if(to.y!==from.y+1)continue;
  let x=from.x,z=from.z;
  const bridge=()=>{if(!mainCells.has([x,from.y,z].join(',')))b.set(x,from.y,z,SLAB,'Front rib half-step',{type:'top'});};
  while(x!==to.x){x+=Math.sign(to.x-x);bridge();}
  while(z!==to.z){z+=Math.sign(to.z-z);bridge();}
 }
 return b;
}
function finalProject(project:Project):Project{return parseProject({...project,id:'golden-leaf-100-complete-v13',designRevision:GOLDEN_LEAF_DESIGN.revision,blocks:project.blocks.map(block=>({...block,constructionPhaseId:'golden-leaf:'+block.category!.toLowerCase().replace(/[^a-z0-9]+/g,'-'),...(block.category==='Doors'?{id:'minecraft:iron_door' as const,state:{...block.state,hinge:block.pos.x===0||block.pos.x===8?'right':'left'}}:{})}))});}
export function createGoldenLeafProject():Project{return finalProject(buildGoldenLeaf().finishProject());}
/** Legacy export callers still receive complete canonical chunks, never the editing workspace. */
export function createGoldenLeafParts():District[]{return buildGoldenLeaf().finishParts().map(part=>({...part,project:{...finalProject(part.project),id:part.project.id}}));}
