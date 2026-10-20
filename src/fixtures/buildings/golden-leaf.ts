import type {District} from '../campus/builder.ts';
import {HighDetailBuilder} from '../campus/high-detail.ts';
import type {MinecraftId, Project} from '../../core/contracts.ts';
import {parseProject} from '../../core/model.ts';

/** V5 is designed on a new 100-block grid; it is not a resampled V4 model. */
export const GOLDEN_LEAF_DESIGN={id:'golden-leaf-tower',revision:'golden-leaf-100-v5',front:'negative-z',nominalTowerDiameter:48,nominalTowerHeight:88,towerBaseY:11,highestY:99,floorPitch:3.5,floorCount:23,floorLevels:Array.from({length:23},(_,i)=>11+Math.floor(i*3.5)),referenceInspiredAspect:1090/620,chosenAspect:88/48,proportionNote:'全棟含基座與尖頂 Y0–99，共100格；塔身最大直徑48、基座直徑70。23道樓板以3/4格交替，半磚保留至少2格淨高。原圖約26道樓板，為百格限制取捨；隱藏結構、尺寸均為 AI Estimated Area。'} as const;
const WHITE:MinecraftId='minecraft:smooth_quartz',GOLD:MinecraftId='minecraft:gold_block',GLASS:MinecraftId='minecraft:blue_stained_glass',GRAY:MinecraftId='minecraft:light_gray_concrete',SLAB:MinecraftId='minecraft:smooth_stone_slab',LAMP:MinecraftId='minecraft:glowstone';
const leafState={persistent:'true',distance:'1'};
const floorSet=new Set<number>(GOLDEN_LEAF_DESIGN.floorLevels);
const profile=[[11,14],[23,21],[36,23.8],[48,23.6],[63,20],[76,14],[87,8],[95,2.7],[99,.2]] as const;
const smooth=(t:number)=>t*t*(3-2*t);
function bodyRadius(y:number){
 if(y>99)return 0;
 const slope=(i:number)=>{const segment=(j:number)=>(profile[j+1]![1]-profile[j]![1])/(profile[j+1]![0]-profile[j]![0]);if(i===0)return segment(0);if(i===profile.length-1)return segment(i-1);const a=segment(i-1),b=segment(i);return a*b<=0?0:2*a*b/(a+b);};
 for(let i=1;i<profile.length;i++){const [a,ra]=profile[i-1]!,[z,rz]=profile[i]!;if(y<=z){const t=Math.max(0,(y-a)/(z-a)),h=z-a;return (2*t**3-3*t*t+1)*ra+(t**3-2*t*t+t)*h*slope(i-1)+(-2*t**3+3*t*t)*rz+(t**3-t*t)*h*slope(i);}}
 return .2;
}
function shortSection(y:number){const t=smooth(Math.max(0,Math.min(1,(y-68)/22)));return {cx:6*t,r:y>90?0:bodyRadius(y+9*t)};}
function radius(y:number,theta=0){
 if(y<=68||Math.sin(theta)<1e-6)return bodyRadius(y);
 const s=shortSection(y),discriminant=s.r*s.r-s.cx*s.cx*Math.cos(theta)**2;
 return discriminant<0||s.r===0?0:s.cx*Math.sin(theta)+Math.sqrt(discriminant);
}
function aperture(y:number,rear=false){return rear?(y<39||y>89?0:.48*Math.pow(Math.sin(Math.PI*(y-39)/50),.8)):.44+.34*Math.sin(Math.PI*Math.min(1,(y-11)/88*1.08));}
function disk(b:HighDetailBuilder,x0:number,z0:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(x0-r);x<=Math.floor(x0+r);x++)for(let z=Math.ceil(z0-r);z<=Math.floor(z0+r);z++)if(Math.hypot(x-x0,z-z0)<=r)b.set(x,y,z,id,category);}
function ring(b:HighDetailBuilder,x0:number,z0:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(x0-r);x<=Math.floor(x0+r);x++)for(let z=Math.ceil(z0-r);z<=Math.floor(z0+r);z++){const d=Math.hypot(x-x0,z-z0);if(d<=r&&d>r-1.1)b.set(x,y,z,id,category);}}
function shrub(b:HighDetailBuilder,x:number,y:number,z:number){for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){b.set(x+dx,y,z+dz,'minecraft:dirt','Garden soil');b.set(x+dx,y+1,z+dz,'minecraft:oak_leaves','Clipped shrub',leafState);}b.set(x,y+2,z,'minecraft:oak_leaves','Clipped shrub',leafState);}
function lamp(b:HighDetailBuilder,x:number,y:number,z:number){b.set(x,y,z,WHITE,'Lamp pedestal');b.set(x,y+1,z,LAMP,'Warm garden lamp');}
function stairs(b:HighDetailBuilder){
 const levels=[3,7,...GOLDEN_LEAF_DESIGN.floorLevels];
 for(let floor=0;floor<levels.length-1;floor++){const base=levels[floor]!,rise=levels[floor+1]!-base,reverse=floor%2===1,x=reverse?-1:-3;
  for(let i=0;i<rise;i++){const z=reverse?rise-2-i:i-(rise-2),y=base+i+1;for(let h=1;h<=3;h++)b.clear(x,y+h,z);b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south'});}
  for(let xx=-3;xx<=-1;xx++)b.set(xx,base+rise,reverse?-2:2,WHITE,'Stair landing');
 }
}
function buildGoldenLeaf(){
 const b=new HighDetailBuilder({id:GOLDEN_LEAF_DESIGN.revision,title:'金色葉塔・百格重建',origin:[0,0,0],references:['golden-leaf-front','golden-leaf-rear'],features:['百格內完整金葉塔、灰色外架與內退深藍窗','23道半磚樓板、前X與後窄葉窗、雙金葉覆疊','雙圓亭、主入口、暖螢石與多層花園'],notes:GOLDEN_LEAF_DESIGN.proportionNote});
 // A broad two-tier white garden base; the lobby has five usable air blocks above its floor.
 disk(b,0,0,0,35,'minecraft:stone_bricks','Foundation');disk(b,0,0,1,35,WHITE,'Base terrace');
 disk(b,0,0,3,24,WHITE,'Lobby floor');
 for(let y=2;y<=10;y++){ring(b,0,0,y,24,y<=3||y>=9?WHITE:GLASS,'Podium facade');
  if(y>=4&&y<=8)for(let a=0;a<16;a++){const t=a*Math.PI/8;b.set(Math.round(24*Math.sin(t)),y,Math.round(24*Math.cos(t)),WHITE,'Podium column');}}
 disk(b,0,0,11,25,WHITE,'Podium roof');
 for(let y=11;y<=99;y++){
  const r=bodyRadius(y),frontAngle=Math.asin(aperture(y)),rearAngle=Math.asin(aperture(y,true)),floor=floorSet.has(y),cap=shortSection(y);
  for(let x=-Math.ceil(r+2);x<=Math.ceil(r+2);x++)for(let z=-Math.ceil(r+2);z<=Math.ceil(r+2);z++){
   const theta=Math.atan2(x,-z),a=Math.abs(theta),rr=radius(y,theta),d=Math.hypot(x,z);if(rr<.2)continue;
   const front=a<frontAngle,rear=Math.PI-a<rearAngle,window=front||rear;
   const seam=-12+(y-11)*12/28,lap=z>0&&x>seam?1.25*(z/rr)**2:0;
   if((!window||rr<3.2)&&d>=Math.max(0,rr-1.25)&&d<=rr+lap)b.set(x,y,z,GOLD,lap?'Rear overlapping petal':'Golden petal shell');
   if(window&&rr>=4&&d>=rr-3.6&&d<=rr-2.6)b.set(x,y,z,GLASS,front?'Front recessed glazing':'Rear recessed glazing');
   const inside=x<=0||y<=68||Math.hypot(x-cap.cx,z)<cap.r-3;
   if(floor&&inside&&d<rr-3)b.set(x,y,z,SLAB,'Floor',{type:'top'});
   if(floor&&window&&rr>=6&&d>=rr-3.3&&d<=rr+.7)b.set(x,y,z,SLAB,front?'Front slab ledge':'Rear slab ledge',{type:'top'});
  }
  // White returns line the gold edge; the gray structure is separate and further forward.
  for(const rear of [false,true]){const angle=rear?rearAngle:frontAngle;if(angle<=0)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-angle):side*angle,rr=radius(y,theta);if(rr<4)continue;
    for(let depth=0;depth<=2;depth++)for(let width=0;width<=(rear&&y>=87?0:1);width++)b.set(Math.round((rr-depth)*Math.sin(theta))+side*width,y,-Math.round((rr-depth)*Math.cos(theta)),WHITE,rear?'Rear white leaf reveal':'Front white leaf reveal');
   }
  }
  if(y<=88)for(const side of [-1,1]){const theta=Math.asin(aperture(y)*side*.43),rr=radius(y,theta);if(rr<6)continue;for(let w=0;w<1;w++)b.set(Math.round((rr+.7)*Math.sin(theta))+side*w,y,-Math.round((rr+.7)*Math.cos(theta)),GRAY,'Front exterior upright');}
  if(y>=40&&y<=89)b.set(0,y,Math.round(bodyRadius(y))+.0,WHITE,'Rear central spine');
  if(floor){for(const rear of [false,true]){const angle=rear?rearAngle:frontAngle;if(angle<=.03)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-angle*.7):side*angle*.86,rr=radius(y,theta);if(rr<7)continue;const lampRadius=rr+(rear?.8:-.2);b.set(Math.round(lampRadius*Math.sin(theta)),y,-Math.round(lampRadius*Math.cos(theta)),LAMP,'Facade ledge light');}}
   if(r>=10){b.set(4,y+1,0,'minecraft:bookshelf','Interior');b.set(0,y+1,4,'minecraft:lantern','Interior light');}}
 }
 // Narrow front X ends join the two external uprights; it never appears on the back.
 for(let y=12;y<=48;y++)for(const side of [-1,1]){const x=Math.round(side*(y-26)*(y>26?.34:.4)),r=bodyRadius(y)+1,z=-Math.round(Math.sqrt(r*r-x*x));b.set(x,y,z,GRAY,'Front lower X brace');}
 for(let y=11;y<=39;y++){const x=Math.round(-12+(y-11)*12/28),r=bodyRadius(y),z=Math.round(Math.sqrt(Math.max(0,r*r-x*x)))+1;b.set(x,y,z,WHITE,'Rear diagonal petal overlap');b.set(x+1,y,z,GOLD,'Rear diagonal petal overlap');}
 // A one-block white return follows the tall rear petal, leaving its last three blocks gold.
 for(let y=90;y<=96;y++)b.set(0,y,Math.round(bodyRadius(y)),WHITE,'Rear apex white return');
 b.set(0,99,0,GOLD,'Tall leaf tip');
 for(let y=88;y<=90;y++)disk(b,6,0,y,Math.max(.4,(91-y)*.5),GOLD,'Short leaf tip');
 for(let y=84;y<=89;y++){const cap=shortSection(y),x=Math.ceil(cap.cx-cap.r);if(x>0)b.set(x,y,0,WHITE,'Short leaf return');}
 // Two raised round pavilions, with thick cornices, warm lamps and planted roofs.
 for(const cx of [-26,26]){
  disk(b,cx,-10,3,8,WHITE,'Annex floor');
  for(let y=4;y<=12;y++){ring(b,cx,-10,y,8,GLASS,'Annex glazing');for(let a=0;a<8;a++){const t=a*Math.PI/4;b.set(cx+Math.round(8*Math.sin(t)),y,-10+Math.round(8*Math.cos(t)),WHITE,'Annex column');}}
  disk(b,cx,-10,13,9,WHITE,'Annex cornice');disk(b,cx,-10,14,9,WHITE,'Annex roof');
  for(let a=0;a<8;a++){const t=(a+.5)*Math.PI/4,x=cx+Math.round(8*Math.sin(t)),z=-10+Math.round(8*Math.cos(t));b.set(x,12,z,LAMP,'Annex eave light');}
  for(const [dx,dz]of[[-5,0],[5,0],[0,-5],[0,5]]as const){shrub(b,cx+dx,15,-10+dz);lamp(b,cx+dx+1,15,-10+dz+2);}
  b.set(cx,15,-10,'minecraft:dirt','Tree soil');b.tree(cx,16,-10);
  for(let x=Math.min(cx,Math.sign(cx)*16);x<=Math.max(cx,Math.sign(cx)*16);x++)for(let z=-12;z<=-8;z++){b.set(x,3,z,WHITE,'Annex connector');for(let y=4;y<=7;y++)b.clear(x,y,z);}
  // A compact two-flight internal stair connects the pavilion roof.
  for(let i=0;i<11;i++){const reverse=i>=6,x=cx+(reverse?2:4),z=reverse?-6-(i-6):-11+i,y=4+i;for(let h=1;h<=3;h++)b.clear(x,y+h,z);b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south'});}
  for(let x=cx+2;x<=cx+4;x++){for(let h=10;h<=12;h++)b.clear(x,h,-5);b.set(x,9,-5,WHITE,'Stair landing');}
 }
 // Dense garden beds use block-size shrubs and warm square lamps, not sparse miniature flowers.
 for(let a=0;a<360;a+=20){const t=a*Math.PI/180,x=Math.round(31*Math.sin(t)),z=Math.round(31*Math.cos(t));if(Math.abs(x)<5||Math.hypot(x-26,z+10)<11||Math.hypot(x+26,z+10)<11)continue;shrub(b,x,2,z);lamp(b,x+2,2,z);}
 for(const [x,z]of[[-12,-26],[12,-26],[-19,18],[19,18],[-9,27],[9,27]]as const){shrub(b,x,2,z);b.set(x+2,2,z-1,'minecraft:dirt','Flower soil');b.set(x+2,3,z-1,'minecraft:pink_tulip','Garden flower');}
 for(let a=0;a<360;a+=45){const t=a*Math.PI/180,x=Math.round(21*Math.sin(t)),z=Math.round(21*Math.cos(t));if(Math.hypot(x-26,z+10)<10||Math.hypot(x+26,z+10)<10)continue;shrub(b,x,12,z);lamp(b,x+2,12,z);}
 // Continuous segmented planted beds and low white curbs unify the garden tiers.
 for(let x=-34;x<=34;x++)for(let z=-34;z<=34;z++){
  const d=Math.hypot(x,z),frontPath=Math.abs(x)<=5&&z<0,rearPath=x>=4&&x<=11&&z>18;
  if(d<27||d>34||frontPath||rearPath||Math.hypot(x-26,z+10)<10||Math.hypot(x+26,z+10)<10)continue;
  if(d<28||d>33){b.set(x,2,z,'minecraft:smooth_quartz_slab','Garden curb',{type:'bottom'});b.clear(x,3,z);}
  else{b.set(x,2,z,'minecraft:dirt','Continuous garden soil');b.set(x,3,z,'minecraft:oak_leaves','Continuous garden hedge',leafState);}
 }
 for(const cx of [-26,26])for(let dx=-8;dx<=8;dx++)for(let dz=-8;dz<=8;dz++){
  const d=Math.hypot(dx,dz);if(d<5||d>8)continue;
  if(d>7.2)b.set(cx+dx,15,-10+dz,'minecraft:smooth_quartz_slab','Annex garden curb',{type:'bottom'});
  else{b.set(cx+dx,15,-10+dz,'minecraft:dirt','Annex continuous soil');b.set(cx+dx,16,-10+dz,'minecraft:oak_leaves','Annex continuous hedge',leafState);}
 }
 for(let x=-23;x<=23;x++)for(let z=-23;z<=23;z++){
  const d=Math.hypot(x,z);if(d<18||d>23||Math.abs(x)<3||Math.hypot(x-26,z+10)<10||Math.hypot(x+26,z+10)<10)continue;
  b.set(x,12,z,'minecraft:dirt','Podium continuous soil');b.set(x,13,z,'minecraft:oak_leaves','Podium continuous hedge',leafState);
 }
 // Staggered higher leaf clusters break the planted rings into the reference's grouped hedges.
 for(const [x,z]of[[-14,-28],[14,-28],[-23,21],[-14,28],[16,26],[25,19]]as const){
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(Math.hypot(x+dx,z+dz)<33)b.set(x+dx,4,z+dz,'minecraft:oak_leaves','Raised ground shrub',leafState);
  b.set(x,5,z,'minecraft:oak_leaves','Raised ground shrub',leafState);
 }
 for(const [x,z]of[[-13,-16],[13,-16],[-19,6],[19,6],[-13,16],[13,16]]as const){for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)b.set(x+dx,14,z+dz,'minecraft:oak_leaves','Raised podium shrub',leafState);b.set(x,15,z,'minecraft:oak_leaves','Raised podium shrub',leafState);}
 for(const cx of [-26,26])for(const [dx,dz]of[[-5,-2],[5,2],[0,-6],[0,6]]as const)for(let xx=-1;xx<=1;xx++)for(let zz=-1;zz<=1;zz++)if(Math.hypot(dx+xx,dz+zz)>=5&&Math.hypot(dx+xx,dz+zz)<7.3)b.set(cx+dx+xx,17,-10+dz+zz,'minecraft:oak_leaves','Raised annex shrub',leafState);
 for(const [x,z]of[[-8,-29],[8,-29],[-8,29],[20,24]]as const){b.set(x,2,z,'minecraft:dirt','Flower soil');b.set(x,3,z,'minecraft:pink_tulip','Garden flower');}
 stairs(b);
 // Three broad entrance rises meet the lobby floor, with a tall blue-glass surround and gold light piers.
 for(let i=0;i<3;i++)for(let x=-4;x<=4;x++){const z=-34+i;b.box(x,0,z,x,i,z,WHITE,'Entrance support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 for(let x=-3;x<=3;x++)for(let z=-31;z<=-4;z++){b.set(x,3,z,WHITE,'Entrance landing');for(let y=4;y<=7;y++)b.clear(x,y,z);}
 for(const x of [-4,4])for(let y=4;y<=8;y++)b.set(x,y,-24,LAMP,'Entrance light pier');
 for(let x=-3;x<=3;x++)for(let y=4;y<=8;y++)if(x!==-1&&x!==0||y>=6)b.set(x,y,-24,GLASS,'Entrance blue surround');
 for(const x of [-5,5])for(let y=4;y<=9;y++)b.set(x,y,-24,WHITE,'Entrance white frame');
 // Rear access is offset to the right as in the rear reference.
 for(let i=0;i<3;i++)for(let x=5;x<=10;x++){const z=34-i;b.box(x,0,z,x,i,z,WHITE,'Rear entrance support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'north'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 for(let x=5;x<=10;x++)for(let z=4;z<=31;z++){b.set(x,3,z,WHITE,'Rear entrance landing');for(let y=4;y<=7;y++)b.clear(x,y,z);}
 for(const x of [5,10])for(let y=4;y<=8;y++)b.set(x,y,23,LAMP,'Rear entrance light pier');
 for(let x=6;x<=9;x++)for(let y=4;y<=8;y++)if(x!==7&&x!==8||y>=6)b.set(x,y,23,GLASS,'Rear entrance blue surround');
 for(const [x,z]of[[-1,-24],[0,-24],[7,23],[8,23]]as const)for(const dz of [-1,1]){b.set(x,3,z+dz,WHITE,'Door threshold');b.set(x,4,z+dz,'minecraft:stone_pressure_plate','Door control',{powered:'false'});}
 b.door(-1,4,-24,'north');b.door(0,4,-24,'north');b.door(7,4,23,'south');b.door(8,4,23,'south');
 for(const y of GOLDEN_LEAF_DESIGN.floorLevels){const r=bodyRadius(y);if(r>=7)b.set(0,y+1,-Math.floor(r-4.6),LAMP,'Front interior window light');}
 // Lights are placed after every hedge, path and tree, so planting cannot erase them.
 const finalLamp=(x:number,y:number,z:number,category:string)=>{b.set(x,y,z,WHITE,'Lamp pedestal');b.set(x,y+1,z,LAMP,category);};
 for(const [x,z]of[[-17,-27],[-8,-30],[8,-30],[17,-27]]as const)finalLamp(x,3,z,'Front ground garden lamp');
 for(const [x,z]of[[-19,25],[-9,30],[15,28],[23,22]]as const)finalLamp(x,3,z,'Rear ground garden lamp');
 for(const [x,z]of[[-7,-21],[7,-21],[-17,13],[17,13],[-7,21],[7,21]]as const)finalLamp(x,13,z,'Podium roof garden lamp');
 for(const cx of [-26,26])for(const [dx,dz]of[[-6,0],[6,0],[0,-6],[0,6]]as const)finalLamp(cx+dx,16,-10+dz,'Annex roof garden lamp');
 return b;
}
function finalProject(project:Project):Project{return parseProject({...project,id:'golden-leaf-100-complete-v5',designRevision:GOLDEN_LEAF_DESIGN.revision,blocks:project.blocks.map(block=>({...block,constructionPhaseId:'golden-leaf:'+block.category!.toLowerCase().replace(/[^a-z0-9]+/g,'-'),...(block.category==='Doors'?{id:'minecraft:iron_door' as const,state:{...block.state,hinge:block.pos.x===0||block.pos.x===8?'right':'left'}}:{})}))});}
export function createGoldenLeafProject():Project{return finalProject(buildGoldenLeaf().finishProject());}
/** Legacy export callers still receive complete canonical chunks, never the editing workspace. */
export function createGoldenLeafParts():District[]{return buildGoldenLeaf().finishParts().map(part=>({...part,project:{...finalProject(part.project),id:part.project.id}}));}


