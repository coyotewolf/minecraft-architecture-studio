import type {District} from '../campus/builder.ts';
import {HighDetailBuilder} from '../campus/high-detail.ts';
import type {MinecraftId, Project} from '../../core/contracts.ts';
import {parseProject} from '../../core/model.ts';

/** V8 refines the canonical 100-block design without overwriting earlier collections. */
export const GOLDEN_LEAF_DESIGN={id:'golden-leaf-tower',revision:'golden-leaf-100-v8',front:'negative-z',nominalTowerDiameter:48,nominalTowerHeight:88,towerBaseY:11,highestY:99,floorPitch:3,floorCount:26,floorLevels:Array.from({length:26},(_,i)=>11+i*3),referenceInspiredAspect:1090/620,chosenAspect:88/48,proportionNote:'全棟含基座與尖頂 Y0–99，共100格；塔身最大直徑48、膠囊形基座83×59、中央直段24格接左右半圓；裙樓73×49，左右附樓與屋頂花園採朝內凹的月牙足跡。26道樓板以3格層距排列，半磚保留至少2格淨高；最上兩道隨雙葉收窄；前圖26道層帶、背圖約13道，兩圖可見層帶不完全對應；本設計保留26個通行樓層，後窗可見層帶不是逐道復刻。隱藏結構、尺寸均為 AI Estimated Area。'} as const;
const WHITE:MinecraftId='minecraft:smooth_quartz',GOLD:MinecraftId='minecraft:gold_block',GLASS:MinecraftId='minecraft:blue_stained_glass',SLAB:MinecraftId='minecraft:smooth_stone_slab',LAMP:MinecraftId='minecraft:glowstone';
const leafState={persistent:'true',distance:'1'};
const floorSet=new Set<number>(GOLDEN_LEAF_DESIGN.floorLevels);
// Traced width ratios from the reference: a broad lower bowl and a progressively curving shoulder.
const profile=[[11,16.8],[14.5,18.72],[26,22.56],[38.3,24],[50.6,22.56],[66.4,18.72],[83.2,10.8],[87,8.1],[91,4.7],[95,1.5],[98,.4],[99,.2]] as const;
const ribProfile=[[11,-5.5],[18,-3.2],[25,0],[34,3.7],[44,6.8],[50.6,6.6],[66.4,5.64],[78,3.9],[87,2],[94,.4]] as const;
const smooth=(t:number)=>t*t*(3-2*t);
function sampleProfile(y:number,profile:readonly (readonly [number,number])[]){
 const slope=(i:number)=>{const segment=(j:number)=>(profile[j+1]![1]-profile[j]![1])/(profile[j+1]![0]-profile[j]![0]);if(i===0)return segment(0);if(i===profile.length-1)return segment(i-1);const a=segment(i-1),b=segment(i);return a*b<=0?0:2*a*b/(a+b);};
 for(let i=1;i<profile.length;i++){const [a,ra]=profile[i-1]!,[z,rz]=profile[i]!;if(y<=z){const t=Math.max(0,(y-a)/(z-a)),h=z-a;return (2*t**3-3*t*t+1)*ra+(t**3-2*t*t+t)*h*slope(i-1)+(-2*t**3+3*t*t)*rz+(t**3-t*t)*h*slope(i);}}
 return profile[profile.length-1]![1];
}
function bodyRadius(y:number){return y>99?0:sampleProfile(y,profile);}
function shortSection(y:number){const t=smooth(Math.max(0,Math.min(1,(y-68)/22)));return {cx:6*t,r:y>90?0:bodyRadius(y+9*t)};}
function radius(y:number,theta=0){
 if(y<=68||Math.sin(theta)<1e-6)return bodyRadius(y);
 const s=shortSection(y),discriminant=s.r*s.r-s.cx*s.cx*Math.cos(theta)**2;
 return discriminant<0||s.r===0?0:s.cx*Math.sin(theta)+Math.sqrt(discriminant);
}
function aperture(y:number,rear=false){return rear?(y<35||y>89?0:.50*Math.pow(Math.sin(Math.PI*(y-35)/54),.8)):.48+.27*Math.sin(Math.PI*Math.min(1,(y-11)/88*1.08));}
function disk(b:HighDetailBuilder,x0:number,z0:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(x0-r);x<=Math.floor(x0+r);x++)for(let z=Math.ceil(z0-r);z<=Math.floor(z0+r);z++)if(Math.hypot(x-x0,z-z0)<=r)b.set(x,y,z,id,category);}
const capsuleDistance=(x:number,z:number)=>Math.hypot(Math.max(Math.abs(x)-12,0),z);
const crescent=(x:number,z:number,side:number)=>Math.hypot(x-side*28,z)<=11&&Math.hypot(x-side*22,z)>10.5;
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
 capsule(b,0,29,'minecraft:stone_bricks','Foundation');capsule(b,1,29,WHITE,'Base terrace');capsule(b,3,24,WHITE,'Lobby floor');
 for(let x=-36;x<=36;x++)for(let z=-24;z<=24;z++)if(capsuleDistance(x,z)<=24&&boundary(x,z,(xx,zz)=>capsuleDistance(xx,zz)<=24))for(let y=2;y<=10;y++)b.set(x,y,z,y<=3||y>=9||x%6===0?WHITE:GLASS,'Podium facade');
 capsule(b,11,24,WHITE,'Podium roof');
 for(let y=11;y<=99;y++){
  const r=bodyRadius(y),frontAngle=Math.asin(aperture(y)),rearAngle=Math.asin(aperture(y,true)),floor=floorSet.has(y),cap=shortSection(y);
  for(let x=-Math.ceil(r+2);x<=Math.ceil(r+2);x++)for(let z=-Math.ceil(r+2);z<=Math.ceil(r+2);z++){
   const theta=Math.atan2(x,-z),a=Math.abs(theta),rr=radius(y,theta),d=Math.hypot(x,z);if(rr<.2)continue;
   const front=a<frontAngle,rear=Math.PI-a<rearAngle,window=front||rear;
   const seam=-12+(y-11)*12/24,lap=z>0&&x>seam?1.25*(z/rr)**2:0;
   if((!window||rr<3.2)&&d>=Math.max(0,rr-1.25)&&d<=rr+lap)b.set(x,y,z,GOLD,lap?'Rear overlapping petal':'Golden petal shell');
   if(window&&rr>=4&&d>=rr-3.6&&d<=rr-2.6)b.set(x,y,z,GLASS,front?'Front recessed glazing':'Rear recessed glazing');
   // Real 1/8-block iron mullions sit in front of the blue glazing, at three-block bays.
   if(window&&!floor&&rr>=7&&x%3===0&&d>=rr-2.6&&d<rr-1.6)b.set(x,y,z,'minecraft:iron_bars',front?'Front window mullion':'Rear window mullion');
   const inside=x<=0||y<=68||Math.hypot(x-cap.cx,z)<cap.r-3;
   if(floor&&inside&&d<rr-3)b.set(x,y,z,SLAB,'Floor',{type:'top'});
   if(floor&&window&&rr>=6&&d>=rr-3.3&&d<=rr-.8)b.set(x,y,z,SLAB,front?'Front slab ledge':'Rear slab ledge',{type:'top'});
  }
  // White returns line the gold edge; the gray structure is separate and further forward.
  for(const rear of [false,true]){const angle=rear?rearAngle:frontAngle;if(angle<=0)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-angle):side*angle,rr=radius(y,theta);if(rr<4)continue;
    for(let depth=0;depth<=2;depth++)for(let width=0;width<=(rear&&y>=87?0:1);width++)b.set(Math.round((rr-depth)*Math.sin(theta))+side*width,y,-Math.round((rr-depth)*Math.cos(theta)),WHITE,rear?'Rear white leaf reveal':'Front white leaf reveal');
   }
  }

  if(y>=36&&y<=89)b.set(0,y,Math.round(bodyRadius(y))+.0,WHITE,'Rear central spine');
  if(floor){for(const rear of [false,true]){const angle=rear?rearAngle:frontAngle;if(angle<=.03)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-angle*.7):side*angle*.86,rr=radius(y,theta);if(rr<7)continue;const lampRadius=rr+(rear?.8:-.2);b.set(Math.round(lampRadius*Math.sin(theta)),y,-Math.round(lampRadius*Math.cos(theta)),LAMP,'Facade ledge light');}}
   if(r>=10){b.set(4,y+1,0,'minecraft:bookshelf','Interior');b.set(0,y+1,4,'minecraft:lantern','Interior light');}}
 }
 for(let y=11;y<=35;y++){const x=Math.round(-12+(y-11)*12/24),r=bodyRadius(y),z=Math.round(Math.sqrt(Math.max(0,r*r-x*x)))+1;b.set(x,y,z,WHITE,'Rear diagonal petal overlap');b.set(x+1,y,z,GOLD,'Rear diagonal petal overlap');}
 // The white return bends into the tall gold petal instead of continuing as an empty vertical pole.
 for(let y=90;y<=98;y++){const r=bodyRadius(y),x=-Math.round(r*.2),z=Math.round(Math.sqrt(Math.max(0,r*r-x*x)));b.set(x,y,z,'minecraft:quartz_stairs','Rear apex white return',{facing:'west',half:'bottom',shape:'straight'});if(y===90)b.set(0,y,z,WHITE,'Rear apex return junction');}
 // Stair-shaped white edges soften the two upper leaf shoulders with legal block geometry.
 for(let y=80;y<=94;y++)for(const side of [-1,1]){const theta=side*Math.asin(aperture(y)),r=radius(y,theta);if(r<4)continue;const x=Math.round(r*Math.sin(theta))+side,z=-Math.round(r*Math.cos(theta));b.set(x,y,z,'minecraft:quartz_stairs','Upper leaf stepped reveal',{facing:side<0?'west':'east',half:'bottom',shape:'straight'});}
 b.set(0,99,0,GOLD,'Tall leaf tip');
 for(let y=88;y<=90;y++)disk(b,6,0,y,Math.max(.4,(91-y)*.5),GOLD,'Short leaf tip');
 for(let y=80;y<=90;y++){const cap=shortSection(y),theta=Math.asin(aperture(y)),r=radius(y,theta);{const x=y===90?5:r>=2?Math.round(r*Math.sin(theta)):Math.round(cap.cx-cap.r*.6),z=r>=2?-Math.round(r*Math.cos(theta)):-Math.round(cap.r*.8);b.set(x,y,z,'minecraft:quartz_stairs','Short leaf return',{facing:'east',half:'bottom',shape:'straight'});}if(y>=86&&y<90){const x=Math.ceil(cap.cx-cap.r);if(x>0)b.set(x,y,0,'minecraft:quartz_stairs','Short leaf return',{facing:'west',half:'bottom',shape:'straight'});}}
 // Both pavilion volumes, roof decks and planting use the same inward-facing crescent mask.
 for(const side of [-1,1]){
  const inside=(x:number,z:number)=>crescent(x,z,side);
  for(let x=side*28-11;x<=side*28+11;x++)for(let z=-11;z<=11;z++)if(inside(x,z)){
   b.set(x,3,z,WHITE,'Annex floor');for(let y=4;y<=12;y++)b.clear(x,y,z);
   const edge=boundary(x,z,inside);
   if(edge)for(let y=4;y<=12;y++)b.set(x,y,z,y===12&&(x+z)%4===0?LAMP:(x%4===0||z%5===0?WHITE:GLASS),y===12&&(x+z)%4===0?'Annex eave light':'Annex glazing');
   b.set(x,13,z,WHITE,'Annex cornice');b.set(x,14,z,WHITE,'Annex roof');
   const walk=Math.abs(x)>=35&&Math.abs(x)<=36&&z>=-6&&z<=6;
   const innerEdge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>Math.hypot(x+dx!-side*22,z+dz!)<=10.5),innerPlant=Math.hypot(x-side*22,z)<=12.5;
   if(!walk){if(edge){if(innerEdge){b.set(x,15,z,WHITE,'Annex inner parapet');b.set(x,16,z,'minecraft:smooth_quartz_slab','Annex inner parapet cap',{type:'bottom'});}else b.set(x,15,z,'minecraft:smooth_quartz_slab','Annex garden curb',{type:'bottom'});}
    else{b.set(x,15,z,'minecraft:dirt','Annex garden soil');b.set(x,16,z,'minecraft:oak_leaves','Annex garden shrub',leafState);if(!innerPlant&&(x+z)%4===0)b.set(x,17,z,'minecraft:oak_leaves','Annex garden shrub',leafState);if(!innerPlant&&(x+z)%8===0)b.set(x,18,z,'minecraft:oak_leaves','Annex garden shrub',leafState);if(!innerPlant&&(x-z)%11===0){b.set(x,16,z,'minecraft:pink_tulip','Garden flower');b.clear(x,17,z);b.clear(x,18,z);}}
   }
  }
  // A two-block-wide lobby passage reaches the first stair from inside the capsule.
  for(let xx=16;xx<=38;xx++)for(let z=-7;z<=-6;z++){const x=side*xx;b.set(x,3,z,WHITE,'Annex connector');for(let y=4;y<=7;y++)b.clear(x,y,z);}
  for(let i=0;i<11;i++){const reverse=i>=6,x=side*(reverse?35:37),z=reverse?-(i-6):-5+i,y=4+i;for(let h=1;h<=3;h++)b.clear(x,y+h,z);b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south'});}
  for(let xx=35;xx<=37;xx++){const x=side*xx;for(let y=10;y<=12;y++)b.clear(x,y,1);b.set(x,9,1,WHITE,'Stair landing');}
 }
 // Ground and podium beds are generated from capsule distance; no old circular garden remnants remain.
 for(let x=-41;x<=41;x++)for(let z=-29;z<=29;z++){
  const d=capsuleDistance(x,z),path=(Math.abs(x)<=5&&z<0)||(x>=4&&x<=11&&z>0);
  if(d>=26&&d<=28.5&&!path&&!nearCrescent(x,z)){
   if(d<26.6||d>28||x%9===0||z%9===0)b.set(x,2,z,'minecraft:smooth_quartz_slab','Garden curb',{type:'bottom'});
   else{b.set(x,2,z,'minecraft:dirt','Ground garden soil');b.set(x,3,z,'minecraft:oak_leaves','Grouped garden hedge',leafState);if((x+z)%3===0)b.set(x,4,z,'minecraft:oak_leaves','Garden shrub crown',leafState);if((x-z)%11===0){b.set(x,3,z,'minecraft:pink_tulip','Garden flower');b.clear(x,4,z);}}
  }
  if(d>=21&&d<=23&&!nearCrescent(x,z)&&Math.hypot(x,z)>=21.5){
   if(x%8===0||z%8===0)b.set(x,12,z,'minecraft:smooth_quartz_slab','Podium planter divider',{type:'bottom'});
   else{b.set(x,12,z,'minecraft:dirt','Podium grouped soil');b.set(x,13,z,'minecraft:oak_leaves','Podium grouped hedge',leafState);if((x+z)%4===0)b.set(x,14,z,'minecraft:oak_leaves','Podium shrub crown',leafState);if((x-z)%13===0){b.set(x,13,z,'minecraft:pink_tulip','Garden flower');b.clear(x,14,z);}}
  }
 }
 stairs(b);
 // Three broad entrance rises meet the lobby floor, with a tall blue-glass surround and gold light piers.
 for(let i=0;i<3;i++)for(let x=-4;x<=4;x++){const z=-28+i;b.box(x,0,z,x,i,z,WHITE,'Entrance support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 for(let x=-3;x<=3;x++)for(let z=-25;z<=-4;z++){b.set(x,3,z,WHITE,'Entrance landing');for(let y=4;y<=7;y++)b.clear(x,y,z);}
 for(const x of [-4,4])for(let y=4;y<=8;y++)b.set(x,y,-24,LAMP,'Entrance light pier');
 for(let x=-3;x<=3;x++)for(let y=4;y<=8;y++)if(x!==-1&&x!==0||y>=6)b.set(x,y,-24,GLASS,'Entrance blue surround');
 for(const x of [-5,5])for(let y=4;y<=9;y++)b.set(x,y,-24,WHITE,'Entrance white frame');
 // Rear access is offset to the right as in the rear reference.
 for(let i=0;i<3;i++)for(let x=5;x<=10;x++){const z=28-i;b.box(x,0,z,x,i,z,WHITE,'Rear entrance support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'north'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 for(let x=5;x<=10;x++)for(let z=4;z<=25;z++){b.set(x,3,z,WHITE,'Rear entrance landing');for(let y=4;y<=7;y++)b.clear(x,y,z);}
 for(const x of [5,10])for(let y=4;y<=8;y++)b.set(x,y,23,LAMP,'Rear entrance light pier');
 for(let x=6;x<=9;x++)for(let y=4;y<=8;y++)if(x!==7&&x!==8||y>=6)b.set(x,y,23,GLASS,'Rear entrance blue surround');
 for(const [x,z]of[[-1,-24],[0,-24],[7,23],[8,23]]as const)for(const dz of [-1,1]){b.set(x,3,z+dz,WHITE,'Door threshold');b.set(x,4,z+dz,'minecraft:stone_pressure_plate','Door control',{powered:'false'});}
 b.door(-1,4,-24,'north');b.door(0,4,-24,'north');b.door(7,4,23,'south');b.door(8,4,23,'south');
 for(const y of GOLDEN_LEAF_DESIGN.floorLevels){const r=bodyRadius(y);if(r>=7)b.set(0,y+1,-Math.floor(r-4.6),LAMP,'Front interior window light');}
 // Supported lamp pedestals are placed after planting, clearing only their own canopy cells.
 const finalLamp=(x:number,y:number,z:number,category:string)=>{for(let yy=category.includes('ground')?2:category.startsWith('Annex')?15:12;yy<=y;yy++)b.set(x,yy,z,WHITE,'Lamp pedestal');b.set(x,y+1,z,LAMP,category);for(let yy=y+2;yy<=18;yy++)b.clear(x,yy,z);};
 for(const x of [-22,-11,11,22])finalLamp(x,3,-26,'Front ground garden lamp');
 for(const x of [-22,-11,15,22])finalLamp(x,3,26,'Rear ground garden lamp');
 for(const x of [-16,-7,7,16])for(const z of [-22,22])finalLamp(x,13,z,'Podium roof garden lamp');
 for(const side of [-1,1])for(const [x,z]of [[34,-7],[34,7],[31,-9],[31,9]]as const)finalLamp(side*x,15,z,'Annex roof garden lamp');
 // Full-cube quartz ribs keep a continuous pale face distinct from the gray floor bands. Half slabs bridge only actual grid turns.
 const ribRows=new Map<number,{x:number;y:number;z:number}[]>(),mainCells=new Set<string>();
 for(const side of [-1,1]){
  const rows:{x:number;y:number;z:number}[]=[];ribRows.set(side,rows);
  for(let y=11;y<=94;y++){
   const x=Math.round(side*sampleProfile(y,ribProfile)),theta=Math.asin(Math.max(-1,Math.min(1,x/bodyRadius(y)))),rr=radius(y,theta);
   if(rr<4||Math.abs(x)>rr-1)continue;
   const z=-Math.round(Math.sqrt((rr+1.4)**2-x*x));rows.push({x,y,z});mainCells.add([x,y,z].join(','));b.set(x,y,z,WHITE,'Front curved rib');
  }
 }
 for(const rows of ribRows.values())for(let i=0;i<rows.length-1;i++){
  const from=rows[i]!,to=rows[i+1]!;if(to.y!==from.y+1)continue;
  let x=from.x,z=from.z;
  const bridge=()=>{if(!mainCells.has([x,from.y,z].join(',')))b.set(x,from.y,z,'minecraft:smooth_quartz_slab','Front rib half-step',{type:'top'});};
  while(x!==to.x){x+=Math.sign(to.x-x);bridge();}
  while(z!==to.z){z+=Math.sign(to.z-z);bridge();}
 }
 // A narrow front return reaches one row below the golden apex, leaving the tip itself gold.
 for(let y=90;y<=98;y++){
  const r=bodyRadius(y),x=-Math.round(r*.48),z=-Math.max(1,Math.round(Math.sqrt(Math.max(0,r*r-x*x))));
  b.set(x,y,z,'minecraft:quartz_stairs','Front apex white return',{facing:'west',half:'bottom',shape:'straight'});
 }
 return b;
}
function finalProject(project:Project):Project{return parseProject({...project,id:'golden-leaf-100-complete-v8',designRevision:GOLDEN_LEAF_DESIGN.revision,blocks:project.blocks.map(block=>({...block,constructionPhaseId:'golden-leaf:'+block.category!.toLowerCase().replace(/[^a-z0-9]+/g,'-'),...(block.category==='Doors'?{id:'minecraft:iron_door' as const,state:{...block.state,hinge:block.pos.x===0||block.pos.x===8?'right':'left'}}:{})}))});}
export function createGoldenLeafProject():Project{return finalProject(buildGoldenLeaf().finishProject());}
/** Legacy export callers still receive complete canonical chunks, never the editing workspace. */
export function createGoldenLeafParts():District[]{return buildGoldenLeaf().finishParts().map(part=>({...part,project:{...finalProject(part.project),id:part.project.id}}));}


