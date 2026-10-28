import { REFERENCE_ORIGINS } from './reference-layout.ts';
import type { District, DistrictSpec } from './builder.ts';
import { HighDetailBuilder } from './high-detail.ts';

const white='minecraft:white_concrete', glass='minecraft:cyan_stained_glass', gold='minecraft:gold_block', dark='minecraft:gray_concrete';
function builder(id:string,title:string,origin:DistrictSpec['origin'],reference:string,features:string[]){return new HighDetailBuilder({id,title,origin,references:[reference],features,notes:'依概念圖重建的高解析度方塊設計；所有 XYZ 尺寸為推估，樓層與樓梯為可施工的設計解讀，未宣稱原圖精確尺寸或模組功能。'});}
function ellipse(b:HighDetailBuilder,cx:number,y:number,cz:number,rx:number,rz:number,id:typeof white|string,filled=false,category='Structure'){
  for(let x=Math.ceil(cx-rx);x<=Math.floor(cx+rx);x++)for(let z=Math.ceil(cz-rz);z<=Math.floor(cz+rz);z++){
    const q=((x-cx)/rx)**2+((z-cz)/rz)**2;
    if(q<=1&&(filled||((x-cx)/Math.max(.1,rx-1))**2+((z-cz)/Math.max(.1,rz-1))**2>=1))b.set(x,y,z,id as `minecraft:${string}`,category);
  }
}
/** Six-rise alternating flights, two blocks wide; carve headroom after floors and furnishings. */
function stairs(b:HighDetailBuilder,cx:number,cz:number,top:number){
  for(let base=1;base+6<=top;base+=6){const reverse=((base-1)/6)%2===1;
    for(let i=0;i<6;i++){const z=cz+(reverse?2-i:i-3),x=cx+(reverse?1:-2),y=base+i;
      for(let dx=0;dx<2;dx++){for(let h=1;h<=4;h++)b.clear(x+dx,y+h,z);b.set(x+dx,y,z,'minecraft:quartz_stairs','Stairs',{facing:reverse?'north':'south',half:'bottom',shape:'straight',waterlogged:'false'});}}
    b.floor(cx-2,cz+(reverse?-4:3),cx+2,cz+(reverse?-4:3),base+6);
  }
}
function furnishings(b:HighDetailBuilder,cx:number,cz:number,top:number){for(let y=1;y<=top;y+=6){b.box(cx-8,y+1,cz-6,cx-5,y+2,cz-6,'minecraft:bookshelf','Interior');b.set(cx+7,y+1,cz-5,'minecraft:crafting_table','Interior');b.set(cx+8,y+1,cz-5,'minecraft:furnace','Interior',{facing:'south',lit:'false'});b.set(cx+7,y+1,cz+6,'minecraft:sea_lantern','Lighting');}}
function ring():District[]{
 const b=builder('ring-control-spire','環形控制塔',REFERENCE_ORIGINS.ring,'reference-08',['130 格寬白色薄橢圓環','115 格深色刀鋒塔與細金肋','19 層樓板與連續折返樓梯']);
 // Five staggered facets break the face into rising shafts; the left stair core remains continuous.
 for(let x=-32;x<=34;x++){
  const segment=Math.min(4,Math.floor((x+32)/14)),local=(x+32)%14;
  const top=segment===0?115-Math.floor(local*.9):Math.max(30,115-segment*21-Math.floor(local*.45));
  const front=[15,11,14,10,13][segment]!,back=-15;
  for(let y=0;y<=top;y++)for(let z=back;z<=front;z++){
   const edge=local===0||local===12||x===34,face=z===back||z===front;
   if(y===0||y===top||edge||face){let material:string=dark;
    if(edge)material=local===0?gold:white;
    else if(face&&local>=4&&local<=6&&y%6!==1&&y>2)material=glass;
    else if(face&&y%6===1)material='minecraft:light_gray_concrete';
    b.set(x,y,z,material as `minecraft:${string}`);
   }
   if(y>=1&&y%6===1&&y<top&&z>back&&z<front)b.set(x,y,z,'minecraft:smooth_quartz','Floor');
  }
 }
 for(let x=-65;x<=65;x++)for(let y=4;y<=106;y++){const outer=(x/65)**2+((y-55)/51)**2,inner=(x/62.5)**2+((y-55)/48.5)**2;if(outer<=1&&inner>=1)for(let z=18;z<=20;z++)b.set(x,y,z,white);} for(const x of [-36,36])b.box(x-1,0,17,x+1,18,20,white);
 for(let y=1;y<=67;y+=6)b.box(-29,y+1,-10,-27,y+2,-10,'minecraft:bookshelf','Interior');stairs(b,-29,0,109);for(let x=-31;x<=-27;x++)for(let y=2;y<=5;y++)b.clear(x,y,15);
 return b.finishParts();
}
function command():District[]{
 const b=builder('teardrop-command','中央水滴指揮塔',REFERENCE_ORIGINS.command,'reference-11',['71 × 48 × 155 水滴透鏡外形','25 層六格層高','細窗框、金色主肋與兩道 X 型支撐']);
 const skyFloor=117-REFERENCE_ORIGINS.command[1];
 for(let y=0;y<=155;y++){
  const rx=Math.max(1,35.5*Math.sin(Math.PI*(y+8)/164)),rz=rx*24/35.5;
  ellipse(b,0,y,0,rx,rz,glass);
  if(y===0||y===155||(y>=1&&y<=145&&y%6===1&&Math.abs(y-skyFloor)>=4)||y===skyFloor)ellipse(b,0,y,0,rx,rz,white,true,'Floor');
  for(let x=Math.ceil(-rx);x<=Math.floor(rx);x++){const zz=Math.round(rz*Math.sqrt(Math.max(0,1-(x/rx)**2)));if(x%6===0||y%6===1)for(const z of [-zz,zz])b.set(x,y,z,y%6===1?white:dark);}
  for(const side of [-1,1]){const x=Math.round(side*rx*.72),z=Math.round(rz*Math.sqrt(1-.72**2));for(let dx=-1;dx<=1;dx++)for(const front of [-1,1])b.set(x+dx,y,front*z,dx===0?gold:white);}
  const brace=Math.round((1-Math.abs(2*y/155-1))*31);for(const x of [-brace,brace]){const z=Math.round(rz*Math.sqrt(Math.max(0,1-(x/rx)**2)));if(Math.abs(x)<=rx)for(let dx=-1;dx<=1;dx++)b.set(x+dx,y,z+1,dark);}
 }
 furnishings(b,0,0,133);stairs(b,0,0,145);
 // This dedicated access floor stays at world Y117 when the reference origin changes.
 b.floor(-3,-26,3,-12,skyFloor);for(let x=-3;x<=3;x++)for(let y=skyFloor+1;y<=skyFloor+5;y++)for(let z=-32;z<=-12;z++)b.clear(x,y,z);
b.floor(-3,0,3,24,1);for(let x=-2;x<=2;x++)for(let y=2;y<=5;y++)for(let z=5;z<=24;z++)b.clear(x,y,z);
 return b.finishParts();
}
function twins():District[]{
 const b=builder('twin-residential-library','雙子玻璃居住塔',REFERENCE_ORIGINS.twins,'reference-09',['34 / 38 格曲面雙塔','95 / 80 格玻璃圓頂','白色經線細肋、15 / 12 層與室內樓梯']);
 for(const [cx,rx,height,floorTop] of [[-22,17,95,85],[22,19,80,67]] as const){
  for(let y=0;y<=height;y++){const capStart=height-18;const body=.78+.22*Math.sin(Math.PI*Math.min(y,capStart)/(height-8));const cap=y<=capStart?1:Math.sqrt(Math.max(.003,1-((y-capStart)/19)**2));const ax=rx!*body*cap,az=20*body*cap;
   ellipse(b,cx!,y,0,ax,az,glass);
   if(y===0||(y>=1&&y<=floorTop!&&y%6===1))ellipse(b,cx!,y,0,ax,az,white,true,'Floor');
   if(y>capStart){for(let a=0;a<12;a++){const angle=a*Math.PI/6;b.set(Math.round(cx!+ax*Math.cos(angle)),y,Math.round(az*Math.sin(angle)),white);}}
   else {
    for(let a=0;a<6;a++){const angle=(a+.5)*Math.PI/3;b.set(Math.round(cx!+ax*Math.cos(angle)),y,Math.round(az*Math.sin(angle)),y%6===1?white:dark);}
    for(let a=0;a<4;a++){const angle=a*Math.PI/2;b.set(Math.round(cx!+ax*Math.cos(angle)),y,Math.round(az*Math.sin(angle)),y%12===1?gold:white);}
   }
  }
  furnishings(b,cx!,0,floorTop!-6);stairs(b,cx!,0,floorTop!);for(let x=cx!-2;x<=cx!+2;x++)for(let y=2;y<=5;y++)for(let z=14;z<=20;z++)b.clear(x,y,z);
 }
 for(let x=-10;x<=10;x++)for(let y=8;y<=10;y++)for(let z=-3;z<=3;z++)b.clear(x,y,z);
 b.floor(-10,-4,10,4,7);b.box(-10,11,-4,10,11,4,white);for(const z of [-4,4])b.box(-10,8,z,10,10,z,glass);
 return b.finishParts();
}
function sphere():District[]{
 const b=builder('sphere-observatory','白色天文球與玻璃展廊',REFERENCE_ORIGINS.sphere,'reference-06',['38 格細階白色天文球','60 格環形靜態水景','22 × 50 玻璃展覽廊與室內展台']);
 ellipse(b,0,0,0,30,30,white,true,'Floor');ellipse(b,0,1,0,29,29,'minecraft:blue_stained_glass',true,'Landscape');
 for(let y=3;y<=41;y++){const r=Math.sqrt(Math.max(0,19**2-(y-22)**2));if(r<.5){b.set(0,y,0,white);continue;}
 ellipse(b,0,y,0,r,r,white);
 if([7,13,19,25,31].includes(y))ellipse(b,0,y,0,Math.max(1,r-1),Math.max(1,r-1),white,true,'Floor');
 for(let x=-Math.floor(r);x<=Math.floor(r);x++){const z=Math.round(Math.sqrt(Math.max(0,r*r-x*x)));if((y===17||y===27)&&x%8<3)for(const side of [-1,1])b.set(x,y,side*z,glass);if(y%9===0&&x%11===0)b.set(x,y,z,gold);}
 }
 b.floor(23,-25,45,25,1);for(let z=-25;z<=25;z++)for(let x=23;x<=45;x++){const roof=8+Math.round(6*Math.sqrt(Math.max(0,1-((x-34)/11)**2)));b.set(x,roof,z,z%5===0?white:glass);if(x===23||x===45)for(let y=2;y<roof;y++)b.set(x,y,z,z%5===0?white:glass);}
 for(const z of [-25,25])for(let x=23;x<=45;x++)for(let y=2;y<=8;y++)b.set(x,y,z,glass);
 for(let z=-18;z<=18;z+=9){b.box(28,2,z,30,2,z+2,white,'Interior');b.set(29,3,z+1,'minecraft:amethyst_block','Interior');b.set(39,2,z,'minecraft:sea_lantern','Lighting');}
 // Gallery and sphere share a clear four-block-wide entrance bridge.
 b.floor(16,-2,25,2,7);for(let x=16;x<=25;x++)for(let y=8;y<=11;y++)for(let z=-2;z<=2;z++)b.clear(x,y,z);
 stairs(b,0,0,31);for(let x=-2;x<=2;x++)for(let y=8;y<=11;y++)for(let z=14;z<=19;z++)b.clear(x,y,z);
 return b.finishParts();
}
export function createLandmarkDistrictsV3():District[]{return [...ring(),...command(),...twins(),...sphere()];}










