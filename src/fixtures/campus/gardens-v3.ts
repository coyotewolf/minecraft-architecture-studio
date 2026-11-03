import { REFERENCE_ORIGINS } from './reference-layout.ts';
import { HighDetailBuilder } from './high-detail.ts';
import type { District } from './builder.ts';
import type { MinecraftId } from '../../core/contracts.ts';
const white: MinecraftId='minecraft:white_concrete';
const glass: MinecraftId='minecraft:light_blue_stained_glass';
const gold: MinecraftId='minecraft:gold_block';
const leaves={persistent:'true',distance:'1'};

function greenhouse():District[]{
 const b=new HighDetailBuilder({id:'garden-greenhouses-v3',title:'細框雙拱農牧溫室',origin:REFERENCE_ORIGINS.greenhouses,references:['reference-04'],features:['兩座42×101格細框筒拱、每5格一道白色拱肋','金色次框與縱向細框','成熟作物床、靜態灌溉渠與牲畜分欄','有樓梯的牧場觀察閣樓'],notes:'高細節人工參考設計，尺寸仍屬推估。藍玻璃灌溉非水源，實際耕作須補水、驗證光照與生長；沒有動物實體。'});
 b.floor(-48,-54,48,54,0,'minecraft:stone_bricks');b.floor(-48,-54,48,54);
 for(const cx of [-22,22]){
  for(const x of [cx-21,cx+20])for(let z=-50;z<=50;z++)for(let y=2;y<=8;y++)b.set(x,y,z,z%5===0||y===8?white:glass,z%5===0?'Structure':'Windows');
  const top=(x:number)=>8+Math.round(20*Math.sqrt(Math.max(0,1-((x+.5)/21)**2)));
  for(let dx=-21;dx<=20;dx++)for(let z=-50;z<=50;z++){
   const roof=top(dx),outer=dx<0?top(dx-1):top(dx+1);
   for(let y=Math.min(roof,outer+1);y<=roof;y++){
    const rib=(z+40)%5===0, longitudinal=[-21,-14,-7,-1,0,6,13,20].includes(dx);
    b.set(cx+dx,y,z,rib?white:longitudinal?gold:glass,'Roof');
   }
  }
  for(const z of [-50,50])for(let dx=-20;dx<=19;dx++)for(let y=2;y<top(dx);y++){
   if(Math.abs(dx)<=2&&y<=5)continue;
   b.set(cx+dx,y,z,dx%5===0||y%6===1?white:glass,'Windows');
  }
 }
 // Crop rows are separated by readable narrow channels and a seven-cell central aisle.
 for(const x of [-35,-31,-15,-11])for(let z=-44;z<=38;z++)if(Math.abs(z)%14>1){
  for(let dx=0;dx<2;dx++){b.set(x+dx,2,z,'minecraft:farmland','Landscape',{moisture:'7'});b.set(x+dx,3,z,'minecraft:wheat','Landscape',{age:'7'});}
  b.set(x+2,2,z,'minecraft:blue_stained_glass','Landscape');
 }
 for(const cx of [11,32])for(const cz of [-29,-12,5,22]){
  b.floor(cx-4,cz-5,cx+4,cz+5,2,'minecraft:dirt');
  for(let x=cx-4;x<=cx+4;x++)for(const z of [cz-5,cz+5])b.set(x,3,z,'minecraft:oak_fence','Landscape');
  for(const x of [cx-4,cx+4])for(let z=cz-5;z<=cz+5;z++)b.set(x,3,z,'minecraft:oak_fence','Landscape');
  b.set(cx,3,cz+5,'minecraft:oak_fence_gate','Landscape',{facing:'south',open:'true'});
  b.box(cx-3,3,cz-4,cx-2,3,cz-3,'minecraft:hay_block','Decoration');
 }
 b.floor(7,33,36,44,10,'minecraft:oak_planks');
 for(const x of [7,36])for(const z of [33,44])b.box(x,2,z,x,9,z,'minecraft:oak_log','Structure',{axis:'y'});
 for(let step=0;step<9;step++)for(let x=20;x<=22;x++){
  const z=25+step,y=2+step;b.set(x,y-1,z,'minecraft:oak_planks','Structure');b.set(x,y,z,'minecraft:oak_stairs','Circulation',{facing:'south'});b.clear(x,y+1,z);b.clear(x,y+2,z);
 }
 for(let x=7;x<=36;x++)if(x<19||x>23)b.set(x,11,33,'minecraft:oak_fence','Railing');
 for(let z=-36;z<=36;z+=12)for(const x of [-34,33]){b.set(x,2,z,'minecraft:dirt','Landscape');b.set(x,3,z,'minecraft:oak_leaves','Landscape',leaves);}
 // Continuous outer planting ribbons leave both central entry axes open.
 for(const x of [-46,-45,44,45])for(let z=-49;z<=49;z++){
  b.set(x,2,z,'minecraft:dirt','Planters');b.set(x,3,z,z%7===0?'minecraft:allium':'minecraft:oak_leaves','Planters',z%7===0?{}:leaves);
 }
 for(const z of [-53,-52,52,53])for(let x=-43;x<=42;x++)if(Math.abs(x+22)>3&&Math.abs(x-22)>3){
  b.set(x,2,z,'minecraft:dirt','Planters');b.set(x,3,z,x%6===0?'minecraft:pink_tulip':'minecraft:oak_leaves','Planters',x%6===0?{}:leaves);
 }
 return b.finishParts();
}

function apartments():District[]{
 const b=new HighDetailBuilder({id:'garden-apartments-v3',title:'錯落折線花園住宅',origin:REFERENCE_ORIGINS.apartments,references:['reference-05'],features:['75×60格相互咬合折線玻璃量體','十、十二、八層錯落樓高與細窗框','每三層深植栽露台及窄陽台欄杆','三座實體樓梯、臥室廚房餐桌與寵物收納'],notes:'原版整數建築設計，不是均勻放大舊模型；每層步行淨空與成對門床由測試檢查，未做遊戲內驗收。'});
 b.floor(-37,-30,37,30,0,'minecraft:stone_bricks');b.floor(-37,-30,37,30);
 const beds:[number,number,number][]=[];const doors:[number,number,number][]=[];
 for(const [cx,floors,shift]of [[-24,10,8],[0,12,-6],[24,8,2]] as const){
 for(let level=0;level<floors;level++){
  const y=1+level*6,terrace=Math.floor(level/3)*4;
   const back=-24+shift,front=24+shift-terrace;
   b.floor(cx-12,back,cx+12,front,y);
   for(let h=y+1;h<=y+5;h++){
    for(let x=cx-12;x<=cx+12;x++)for(const z of [back,front])b.set(x,h,z,x%6===0?'minecraft:deepslate_tiles':'minecraft:cyan_stained_glass','Windows');
    for(const x of [cx-12,cx+12])for(let z=back;z<=front;z++)b.set(x,h,z,z%6===0?'minecraft:deepslate_tiles':'minecraft:cyan_stained_glass','Windows');
   }
   // Thin balconies every floor; three-level garden bands alternate front and rear edges.
   for(let x=cx-11;x<=cx+11;x++)for(const z of [back-1,front+1]){
    b.set(x,y,z,'minecraft:smooth_quartz','Balcony');
    b.set(x,y+1,z,'minecraft:glass_pane','Railing');
   }
   if(level%3===0&&level>0)for(let x=cx-11;x<=cx+11;x++)for(let dz=1;dz<=3;dz++){
    const z=front+dz;b.set(x,y,z,'minecraft:smooth_quartz','Terrace');b.set(x,y+1,z,'minecraft:dirt','Landscape');b.set(x,y+2,z,(x+dz)%7===0?'minecraft:allium':'minecraft:oak_leaves','Landscape',(x+dz)%7===0?{}:leaves);if(dz===3)b.set(x,y,z,gold,'Terrace trim');
   }
   beds.push([cx-7,y+1,back+7]);
   b.box(cx-10,y+1,back+5,cx-4,y+3,back+5,'minecraft:smooth_quartz','Bedroom screen');
   for(let x=cx+6;x<=cx+9;x++)b.set(x,y+1,back+3,x===cx+6?'minecraft:furnace':'minecraft:barrel','Decoration');
   b.set(cx+7,y+1,back+8,'minecraft:oak_fence','Decoration');b.set(cx+7,y+2,back+8,'minecraft:oak_pressure_plate','Decoration');
   b.set(cx+7,y+1,back+9,'minecraft:oak_stairs','Decoration',{facing:'south'});
   for(let x=cx-9;x<=cx-6;x++)b.set(x,y+1,front-4,'minecraft:barrel','Decoration');
   for(let x=cx-1;x<=cx+1;x++)for(let h=y+1;h<=y+3;h++)b.clear(x,h,front);
   doors.push([cx,y+1,front]);
  }
 }
 // Each wing retains a full-height stair and a separately planted roof.
 for(const [cx,floors,shift]of [[-24,10,8],[0,12,-6],[24,8,2]] as const){
  const back=-24+shift,front=24+shift-Math.floor((floors-1)/3)*4,roof=1+floors*6;
  b.floor(cx-12,back,cx+12,front,roof);
  for(let x=cx-11;x<=cx+11;x++)for(let dz=0;dz<3;dz++)for(const z of [back+dz,front-dz]){b.set(x,roof+1,z,'minecraft:dirt','Landscape');b.set(x,roof+2,z,(x+dz)%8===0?'minecraft:pink_tulip':'minecraft:oak_leaves','Landscape',(x+dz)%8===0?{}:leaves);}
  for(let level=0;level<floors-1;level++)for(let step=0;step<6;step++)for(let x=cx-1;x<=cx+1;x++){
   const y=2+level*6+step,z=-8+step;b.set(x,y-1,z,'minecraft:smooth_quartz','StairSupport');b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});b.clear(x,y+1,z);b.clear(x,y+2,z);
  }
 }
 // Open only connections shared by two occupied wings.
 for(let level=0;level<10;level++)for(const x of level<8?[-12,12]:[-12])for(let z=-2;z<=2;z++)for(let h=2+level*6;h<=4+level*6;h++)b.clear(x,h,z);
 for(const [x,y,z]of beds)b.bed(x,y,z);
 for(const [x,y,z]of doors)b.door(x,y,z,'south');
 return b.finishParts();
}

function pavilions():District[]{
 const b=new HighDetailBuilder({id:'garden-pavilions-v3',title:'六座粉晶亭與放射圓廣場',origin:REFERENCE_ORIGINS.pavilions,references:['reference-05'],features:['直徑90格白色圓廣場與金色放射線','六座直徑21格低粉色半球亭','細白肋、透明窗與環形座椅','中央靜態噴泉、閱圖桌及花園'],notes:'噴泉以藍色玻璃示意；六亭配置對應整體參考圖可辨識數量，非隱藏部分的實測還原。'});
 for(let x=-58;x<=58;x++)for(let z=-58;z<=58;z++){
  if(x*x+z*z>58*58)continue;
  b.set(x,0,z,'minecraft:stone_bricks','Foundation');b.set(x,1,z,'minecraft:grass_block','Landscape');
  if(x*x+z*z<=45*45){b.set(x,1,z,Math.abs(x)<=1||Math.abs(z)<=1||Math.abs(Math.abs(x)-Math.abs(z))<=1?gold:'minecraft:smooth_quartz','Floor');}
  if(x*x+z*z>=44*44&&x*x+z*z<=45*45)b.set(x,2,z,white,'Railing');
 }
 const centers=[[-46,0],[-24,-40],[24,-40],[46,0],[24,40],[-24,40]] as const;
 for(const [cx,cz]of centers){
  b.floor(cx-10,cz-10,cx+10,cz+10,0,'minecraft:stone_bricks');
  for(let x=-10;x<=10;x++)for(let z=-10;z<=10;z++){
   const d=Math.hypot(x,z);if(d>10.5)continue;
   b.set(cx+x,1,cz+z,'minecraft:smooth_quartz','Floor');
   const top=6+Math.floor(10*Math.sqrt(Math.max(0,1-(d/10.5)**2))),near=6+Math.floor(10*Math.sqrt(Math.max(0,1-(Math.min(10.5,d+1)/10.5)**2)));
   for(let y=Math.min(top,near+1);y<=top;y++)b.set(cx+x,y,cz+z,x===0||z===0?white:'minecraft:pink_stained_glass','Roof');
   if(d>9.5)for(let y=2;y<=6;y++)b.set(cx+x,y,cz+z,white,'Walls');
  }
  for(let x=-1;x<=1;x++)for(let z=7;z<=11;z++){
   b.set(cx+x,1,cz+z,'minecraft:smooth_quartz','Entry');for(let y=2;y<=4;y++)b.clear(cx+x,y,cz+z);
  }
  b.set(cx,2,cz,'minecraft:cartography_table','Decoration');
  for(const x of [-5,5])for(let z=-3;z<=3;z++)b.set(cx+x,2,cz+z,'minecraft:quartz_stairs','Decoration',{facing:x<0?'west':'east'});
 }
 for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)if(x*x+z*z<=25)b.set(x,2,z,x*x+z*z>16?white:glass,'Fountain');
 b.box(0,3,0,0,6,0,glass,'Fountain');
 return b.finishParts();
}

function temples():District[]{
 const b=new HighDetailBuilder({id:'garden-temples-v3',title:'細金階梯雙殿與白柱玻璃廳',origin:REFERENCE_ORIGINS.temples,references:['reference-07'],features:['兩座22×24格白柱玻璃基座高14格','16格高金色階梯金字塔屋頂','細金窗框、書牆與附魔鍊金工作台','植栽庭院、入口樓梯及寬步道'],notes:'金殿為原版方塊設計，附魔效能、釀造配方與生存施工尚未驗證。'});
 b.floor(-28,-16,28,16,0,'minecraft:stone_bricks');b.floor(-28,-16,28,16);
 for(const cx of [-15,15]){
  for(let y=2;y<=14;y++)for(let x=-11;x<=10;x++)for(let z=-12;z<=11;z++)if(x===-11||x===10||z===-12||z===11){
   if(Math.abs(x)<=1&&z===11&&y<=5)continue;
   const pillar=(x===-11||x===10)&&z%5===0||(z===-12||z===11)&&x%5===0;
   b.set(cx+x,y,z,pillar||y===14?white:y===7?gold:glass,pillar?'Structure':'Windows');
  }
  for(let y=15;y<=30;y++){
   const r=Math.max(0,11-Math.floor((y-15)*11/15));
   for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.abs(x)===r||Math.abs(z)===r)b.set(cx+x,y,z,gold,'Roof');
  }
  for(let x=-7;x<=7;x++)b.box(cx+x,2,-8,cx+x,4,-8,'minecraft:bookshelf','Decoration');
  for(const x of [-7,7])b.box(cx+x,2,-7,cx+x,4,2,'minecraft:bookshelf','Decoration');
  b.set(cx,2,-1,cx<0?'minecraft:enchanting_table':'minecraft:brewing_stand','Decoration');
  b.set(cx-4,2,5,'minecraft:crafting_table','Decoration');b.set(cx+4,2,5,'minecraft:cauldron','Decoration');
  for(let x=cx-2;x<=cx+2;x++)b.set(x,1,13,'minecraft:quartz_stairs','Entry',{facing:'north'});
  for(let x=cx-10;x<=cx+10;x++)for(const z of [-14,14]){if(z===14&&Math.abs(x-cx)<=2)continue;b.set(x,2,z,'minecraft:dirt','Landscape');b.set(x,3,z,'minecraft:oak_leaves','Landscape',leaves);}
 }
 return b.finishParts();
}
export function createGardenDistrictsV3():District[]{return[...greenhouse(),...apartments(),...pavilions(),...temples()];}
