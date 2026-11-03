import { REFERENCE_ORIGINS } from './reference-layout.ts';
import type { MinecraftId } from '../../core/contracts.ts';
import type { District } from './builder.ts';
import { HighDetailBuilder as B } from './high-detail.ts';
const W:MinecraftId='minecraft:white_concrete', Q:MinecraftId='minecraft:smooth_quartz', G:MinecraftId='minecraft:cyan_stained_glass', D:MinecraftId='minecraft:deepslate_tiles', A:MinecraftId='minecraft:gold_block';
function stair(b:B,x:number,z:number,y:number,rise:number,dir=1,width=3){for(let i=0;i<rise;i++)for(let w=0;w<width;w++){b.set(x+w,y+i,z+dir*i,Q,'Stair support');b.set(x+w,y+i+1,z+dir*i,'minecraft:quartz_stairs','Circulation',{facing:dir>0?'south':'north'});for(let h=2;h<=4;h++)b.clear(x+w,y+i+h,z+dir*i);}b.floor(x,z+dir*rise,x+width-1,z+dir*rise,y+rise);}
function lamp(b:B,x:number,y:number,z:number){b.set(x,y,z,A,'Lighting');b.set(x,y+1,z,'minecraft:lantern','Lighting');}
function machine(b:B,x:number,y:number,z:number){b.box(x,y,z,x+2,y+1,z+2,'minecraft:iron_block','Machinery');b.set(x+1,y+2,z+1,'minecraft:blast_furnace','Machinery');b.set(x+1,y,z+3,'minecraft:crafting_table','Furniture');b.set(x+3,y,z,'minecraft:barrel','Storage');}
function hall(b:B,cx:number,z0:number,z1:number,r:number,base:number,height:number){
 b.floor(cx-r,z0,cx+r,z1,base,Q);
 for(let x=-r;x<=r;x++){
  const roof=base+height+Math.round(Math.sqrt(Math.max(0,r*r-x*x))*.38);
  for(let z=z0;z<=z1;z++){const frame=(z-z0)%7===0||Math.abs(x)>=r-1;b.set(cx+x,roof,z,frame?W:D,'Roof');if(frame&&z%2===0)b.set(cx+x,roof+1,z,'minecraft:quartz_slab','Roof',{type:'bottom'});}
  for(let y=base+1;y<roof;y++){
   b.set(cx+x,y,z0,(Math.abs(x)%6===0||y<base+3)?W:y>base+4&&y<base+8?G:D,'Walls');
   if(Math.abs(x)>=r-1)for(let z=z0;z<=z1;z++)b.set(cx+x,y,z,(z-z0)%7<2?W:D,'Walls');
  }
 }
 for(const x of [cx-r+2,cx+r-2]){b.box(x,base+1,z1,x,base+height-1,z1,A,'Hangar trim');lamp(b,x,base+height,z1);}
 for(let x=cx-r+2;x<=cx+r-2;x+=5)lamp(b,x,base+2,z0+1);
 b.floor(cx-r+2,z0+1,cx+r-2,z0+5,base+6);for(let x=cx-r+2;x<=cx+r-2;x++)b.set(x,base+7,z0+5,'minecraft:iron_bars','Railing');
 machine(b,cx-2,base+1,z0+2);stair(b,cx-r+3,z0+12,base,6,-1,2);
}
function aircraft(b:B,cx:number,cy:number,cz:number,large=false){
 const length=large?39:25,wing=large?20:14;
 for(let i=0;i<=length;i++){
  const z=cz+i-Math.floor(length/2),radius=i<7?Math.max(1,Math.ceil(i/2)):i>length-6?2:3;
  for(let x=-radius;x<=radius;x++)for(let y=0;y<4;y++)if(Math.abs(x)<radius||y===1||y===2)b.set(cx+x,cy+y,z,(y===3&&i<12)?'minecraft:black_stained_glass':W,'Aircraft');
 }
 for(let x=-wing;x<=wing;x++){const sweep=Math.round(Math.abs(x)*.6);for(let z=cz+sweep-2;z<=cz+sweep+3;z++)b.set(cx+x,cy+1,z,Math.abs(x)%6===0?D:W,'Aircraft wings');}
 for(const side of [-1,1]){const x=cx+side*(large?7:5);b.box(x-1,cy,cz+5,x+1,cy+3,cz+Math.floor(length/2),D,'Engine');b.box(x-1,cy+1,cz+Math.floor(length/2)+1,x+1,cy+2,cz+Math.floor(length/2)+1,'minecraft:sea_lantern','Engine glow');}
 for(let y=1;y<=7;y++)b.box(cx,cy+y,cz+Math.floor(length/2)-5,cx,cy+y,cz+Math.floor(length/2)-Math.floor(y/2),D,'Aircraft tail');
}
function industry():District[]{
 const b=new B({id:'campus-industry',title:'高密度分節工廠與跨山鐵道',origin:REFERENCE_ORIGINS.industry,references:['reference-10'],features:['八段圓角白肋長廠房與雙層控制廊','四組斜面細網格太陽能板','高架月台、八節列車與支撐橋墩','機械、工作台與原料倉列'],notes:'依照片可見分節與窗帶重建；機械與列車為靜態原版方塊模型，尺寸、背面及室內均為 AI Estimated Area。'});
 b.floor(-59,-36,59,36,0,'minecraft:stone_bricks');
 for(const base of [1,18]){
  for(let x=-55;x<=55;x++){
   const rib=(x+55)%14<2;
   for(let z=-31;z<=-2;z++)b.set(x,base+14,z,rib?W:D,'Roof');
   for(let y=base;y<=base+13;y++)for(const z of [-31,-2])b.set(x,y,z,rib||y<base+3||y>base+10?W:y<base+8?G:D,'Walls');
   if(rib)for(let z=-32;z<=-1;z++)b.set(x,base+15,z,W,'Roof ribs');
  }
  b.floor(-55,-31,55,-2,base);for(const x of [-55,55])b.box(x,base,-31,x,base+13,-2,W,'End walls');
  for(let x=-48;x<=45;x+=12){machine(b,x,base+1,-24);b.set(x,base+1,-8,'minecraft:chest','Storage');lamp(b,x,base+4,-3);}
 }
 // Chamfered cross-sections and projecting white ribs replace the flat box roof silhouette.
 for(const base of [1,18])for(let x=-55;x<=55;x++){
  for(let z=-31;z<=-2;z++){const shoulder=Math.max(0,Math.ceil(Math.abs(z+16.5)-11.5)),roof=base+14-shoulder;
   for(let y=roof+1;y<=base+15;y++)b.clear(x,y,z);
   b.set(x,roof,z,(x+55)%14<2?W:D,'Rounded roof');
  }
  if((x+55)%14<2){
   for(let z=-33;z<=0;z++){const shoulder=Math.max(0,Math.ceil(Math.abs(z+16.5)-12.5));b.set(x,base+16-shoulder,z,W,'Projecting rounded frame');b.set(x,base+15-shoulder,z,Q,'Projecting rounded frame');}
   for(const z of [-33,0])for(let y=base+3;y<=base+11;y++)b.set(x,y,z,W,'Projecting rounded frame');
   for(const z of [-32,-1])for(let y=base+1;y<=base+3;y++)b.set(x,y,z,W,'Projecting rounded frame');
  }else if((x+55)%14===3){for(const z of [-32,-1])for(let y=base+5;y<=base+8;y++)b.set(x,y,z,A,'Factory accent');}
 } for(let p=0;p<4;p++)for(let x=-47+p*25;x<=-28+p*25;x++)for(let z=-30;z<=-14;z++){
  const y=34+Math.floor((z+30)*.55),border=x===-47+p*25||x===-28+p*25||z===-30||z===-14;
  b.set(x,y,z,border?W:(x+47-p*25)%5===0||z%4===0?'minecraft:light_gray_concrete':'minecraft:black_concrete','Solar panels');
 }
 b.floor(-70,10,100,26,12,D);
 for(let x=-70;x<=100;x++){for(const z of [14,21])b.set(x,13,z,'minecraft:rail','Rail',{shape:'east_west'});for(const z of [10,26])b.set(x,13,z,'minecraft:iron_bars','Railing');if(x%16===0)for(let y=0;y<12;y++)b.box(x,y,12,x+1,y,24,W,'Viaduct');}
 for(let carriage=0;carriage<8;carriage++){
  const x0=-62+carriage*19;for(let x=x0;x<x0+17;x++)for(let z=13;z<=17;z++){b.set(x,14,z,D,'Train');b.set(x,19,z,W,'Train');for(let y=15;y<=18;y++)if(z===13||z===17)b.set(x,y,z,y>=17&&x%5!==0?G:y===16?'minecraft:blue_concrete':W,'Train');}
 }
 stair(b,-58,-1,1,17,1);stair(b,56,0,0,12,1);return b.finishParts();
}
function airport():District[]{
 const b=new B({id:'campus-airport',title:'高架空港與延伸飛船泊位',origin:REFERENCE_ORIGINS.airport,references:['reference-02'],features:['58格封閉艙體、細白金分節與四支長柱','向前突出39格飛船與發光引擎','屋頂設備、細格窗帶與雙層觀景操作廊','後方機庫群、停機坪與飛機'],notes:'懸空艙體、飛船和操作設備皆為可施工靜態造型；航行與機械功能未驗證。'});
 b.floor(-88,-60,70,4,0,'minecraft:stone_bricks');b.floor(-87,-59,69,3,1,'minecraft:gray_concrete');
 for(let x=-86;x<=68;x++)for(const z of [-25,-3])if(x%9<5)b.set(x,1,z,A,'Apron markings');
 for(const cx of [-66,-30,6])hall(b,cx,-57,-33,15,1,12);
 aircraft(b,-54,2,-15);aircraft(b,35,2,-17);
 for(const x of [-28,25])for(const z of [8,49]){b.box(x,0,z,x+3,44,z+3,W,'Load-bearing legs');b.box(x+1,0,z,x+1,42,z,A,'Leg trim');}
 b.floor(-29,5,29,53,45,D);b.floor(-29,5,29,53,93,W);
 for(let y=46;y<=92;y++){
  for(let x=-29;x<=29;x++)for(const z of [5,53]){const border=Math.abs(x)>=25||x%13===0,band=y%9===0;b.set(x,y,z,border?W:band?D:'minecraft:black_stained_glass','Hangar envelope');if(Math.abs(x)===22||Math.abs(x)===16)b.set(x,y,z,A,'Vertical gold trim');if(y%7===0&&x%6===0)b.set(x,y,z,'minecraft:iron_bars','Window frames');}
  for(let z=5;z<=53;z++)for(const x of [-29,29])b.set(x,y,z,(z-5)%12<2?W:(z-5)%12===2?A:y%8===0?D:'minecraft:gray_stained_glass','Hangar envelope');
 }
 for(const y of [45,92])for(let x=-29;x<=29;x++){b.set(x,y,5,A,'Horizontal gold trim');b.set(x,y,53,A,'Horizontal gold trim');}
 // External mechanical ribs wrap the suspended volume, with recessed narrow glazing.
 for(let y=46;y<=92;y++){
  for(let x=-24;x<=24;x++)for(const z of [5,53]){const module=((x+24)%12),floorBand=y%12===9;
   b.set(x,y,z,module<4?W:floorBand?D:'minecraft:black_stained_glass','Hangar envelope');
   if(module===4&&y%12!==0)b.set(x,y,z,'minecraft:gray_concrete','Window frames');
  }
  for(const side of [-1,1])for(const ribX of [13,27]){
   const inset=y<50?50-y:y>88?y-88:0,x=side*(ribX-Math.min(3,inset));
   for(const z of [3,55]){b.set(x,y,z,W,'Mechanical facade rib');b.set(x+side,y,z,W,'Mechanical facade rib');if(y<55||y>83)b.set(x-side,y,z,A,'Gold corner fittings');}
  }
  for(const x of [-30,30])for(const z of [9,23,37,49]){b.set(x,y,z,W,'Side mechanical rib');if(y<53||y>85)b.set(x,y,z+1,A,'Gold corner fittings');}
 }
 for(const y of [46,92])for(let x=-25;x<=25;x++)for(const z of [3,55])b.set(x,y,z,W,'Wrapped cornice');
 for(let x=-21;x<=21;x+=14)for(const z of [4,54]){b.box(x-2,94,z-1,x+2,95,z+1,D,'Roof service pod');b.box(x-1,96,z,x+1,96,z,'minecraft:iron_bars','Roof service vent');}
 // Small apron tractors and cargo stands distinguish ground activity from the large spacecraft.
 for(const [cx,cz]of[[-18,-17],[58,-35],[-80,-5]]as const){b.box(cx-2,2,cz-1,cx+2,3,cz+1,'minecraft:yellow_concrete','Apron tractor');b.set(cx+1,4,cz,'minecraft:black_stained_glass','Apron tractor');for(const dx of [-2,2])for(const dz of [-1,1])b.set(cx+dx,1,cz+dz,'minecraft:black_concrete','Tractor wheels');b.box(cx-3,2,cz+4,cx+3,2,cz+6,'minecraft:iron_block','Cargo stand');b.box(cx-2,3,cz+4,cx,4,cz+5,'minecraft:barrel','Cargo');} for(let x=-12;x<=12;x++)for(let z=28;z<=53;z++)b.clear(x,45,z);
 aircraft(b,0,30,53,true);
 for(const x of [-8,8])b.box(x,34,40,x,44,40,'minecraft:iron_bars','Dock supports');
 for(const y of [45,57,69,81]){b.floor(-27,7,27,12,y);b.floor(-27,46,27,51,y);for(let x=-26;x<=26;x++)for(const z of [13,45])b.set(x,y+1,z,'minecraft:iron_bars','Railing');for(let x=-22;x<=22;x+=11){machine(b,x,y+1,8);lamp(b,x,y+3,50);}}
 for(let x=-24;x<=24;x+=12){b.box(x,94,12,x+7,96,22,D,'Roof equipment');b.box(x,97,14,x+7,97,20,'minecraft:iron_bars','Vents');}
 for(const z of [8,50])for(let x=-27;x<=27;x++){b.set(x,94,z,'minecraft:iron_bars','Rooftop railing');if(x%5===0)b.set(x,94,z+1,'minecraft:oak_leaves','Roof garden',{persistent:'true',distance:'1'});}
 for(const y of [45,57,69,81]){b.floor(-27,12,-26,46,y);b.floor(-25,28,-23,29,y);b.floor(-25,42,-23,46,y);b.floor(-27,28,-23,29,y);}
 for(const y of [45,57,69])stair(b,-25,30,y,12,1,3);
 // Entrance deck faces the command tower; terrain creates the connecting high bridge.
 b.floor(-5,53,5,65,45);for(const x of [-5,5])b.box(x,46,53,x,51,65,G,'Skywalk');b.floor(-5,53,5,65,52,W);
 for(let x=-3;x<=3;x++)for(let y=46;y<=51;y++)for(let z=53;z<=56;z++)b.clear(x,y,z);
 return b.finishParts();
}
function dragon(b:B,cx:number,cz:number,color:MinecraftId,span:number){
 for(let z=-9;z<=10;z++){const r=Math.max(1,Math.round(4*Math.sin((z+10)/21*Math.PI)));b.box(cx-r,5,cz+z,cx+r,9,cz+z,color,'Dragon torso');}
 for(let i=0;i<11;i++)b.box(cx-1,8+Math.floor(i*.55),cz+10+i,cx+1,10+Math.floor(i*.55),cz+10+i,color,'Dragon neck');
 b.box(cx-3,14,cz+18,cx+3,17,cz+23,color,'Dragon head');
 for(const s of [-1,1]){b.set(cx+s*3,17,cz+22,'minecraft:sea_lantern','Dragon eyes');for(let h=0;h<4;h++)b.set(cx+s*(2+Math.floor(h/2)),18+h,cz+18-h,'minecraft:bone_block','Dragon horns');
  for(const z of [-6,6]){b.box(cx+s*3,2,cz+z,cx+s*3,6,cz+z+2,color,'Dragon legs');for(let k=0;k<3;k++)b.set(cx+s*(3+k),1,cz+z+3,'minecraft:bone_block','Dragon claws');}
  for(let x=1;x<=span;x++){const y=9+Math.round(x*.42),back=7-Math.floor(x*.5);for(let z=-7;z<=back;z++)b.set(cx+s*x,y,cz+z,(z===-7||z===back||x%7===0)?'minecraft:bone_block':color,'Dragon wings');}
 }
 for(let i=0;i<23;i++){const x=cx+Math.round(5*Math.sin(i*.17)),y=Math.max(2,6-Math.floor(i/6));b.set(x,y,cz-10-i,color,'Dragon tail');if(i<12)b.set(x+1,y,cz-10-i,color,'Dragon tail');}
}
function dragons():District[]{
 const b=new B({id:'campus-dragons',title:'六連精細龍舍與多龍停機坪',origin:REFERENCE_ORIGINS.dragons,references:['reference-03'],features:['六座分節拱形龍舍、前後維護夾層','分離翼膜、四肢、頸部與長尾的龍雕塑','細金停機坪網格、飼料區、觀景欄杆','照護工作台與機庫照明'],notes:'龍為靜態原版雕塑；停機坪及機庫比例放大以容納細節，非模組生物或可操作機械。'});
 b.floor(-74,-42,74,56,0,'minecraft:stone_bricks');b.floor(-73,-41,73,55,1,'minecraft:gray_concrete');
 for(const cx of [-60,-36,-12,12,36,60]){hall(b,cx,-40,-10,11,1,14);for(let z=-8;z<=54;z++)b.set(cx-12,1,z,A,'Apron markings');b.box(cx-7,2,-35,cx-3,3,-31,'minecraft:hay_block','Feed');b.floor(cx+3,-34,cx+7,-30,1,'minecraft:blue_stained_glass');}
 for(const [x,z,c,span]of[[-46,17,'minecraft:red_concrete',17],[0,19,'minecraft:black_concrete',19],[46,20,'minecraft:white_concrete',16]] as const)dragon(b,x,z,c,span);
 for(const [x,z,c]of[[-22,46,'minecraft:blue_concrete'],[23,46,'minecraft:cyan_concrete']]as const){b.box(x-1,2,z-3,x+1,4,z+3,c,'Small dragon');b.box(x-6,4,z,x+6,4,z+1,c,'Small dragon wings');}
 for(let x=-73;x<=73;x++){b.set(x,2,56,W,'Apron edge');b.set(x,3,56,'minecraft:iron_bars','Railing');if(x%10===0)lamp(b,x,4,56);}
 return b.finishParts();
}
function workshop():District[]{
 const b=new B({id:'campus-workshop',title:'多層斜撐玻璃工坊塔',origin:REFERENCE_ORIGINS.workshop,references:['reference-07'],features:['十二層玻璃工坊與兩次大退台','白色斜撐、細密窗框與金色外緣','連續工作層、鍛造製圖與附魔區','每層陽台欄杆及露台綠化'],notes:'以90格塔高保留照片的樓層與斜撐細節；隱藏室內為推估，工作站功能需另行遊戲驗證。'});
 b.floor(-25,-27,25,27,0,'minecraft:stone_bricks');
 for(let y=1;y<=88;y++){const left=-19+Math.floor((y-1)/30)*5,right=19;
  for(let x=left;x<=right;x++)for(const z of [-21,21])b.set(x,y,z,x%6===0||y%7===1?D:G,'Facade');
  for(let z=-21;z<=21;z++)for(const x of [left,right])b.set(x,y,z,z%6===0||y%7===1?D:G,'Facade');
  for(const x of [left,right])for(const z of [-22,22])b.set(x,y,z,W,'Frame');
  const diagonal=-19+Math.round((y-1)*38/87);for(const z of [-23,23])for(let w=0;w<3;w++)b.set(diagonal-w,y,z,W,'Diagonal exoskeleton');
 }
 for(let y=1;y<=85;y+=7){const left=-19+Math.floor((y-1)/30)*5;b.floor(left,-21,19,21,y);for(const z of [-22,22])for(let x=left;x<=19;x++){b.set(x,y,z,W,'Balcony');b.set(x,y+1,z,'minecraft:iron_bars','Railing');}for(let x=-5;x<15;x+=8)machine(b,x,y+1,-16);}
 for(const [y,left]of[[30,-19],[60,-14],[89,-9]]as const){b.floor(left-3,-25,22,25,y,W);for(let z=-24;z<=24;z++)for(const x of [left-3,22]){b.set(x,y+1,z,A,'Terrace edge');if(z%3!==0)b.set(x+1,y+1,z,'minecraft:oak_leaves','Garden',{persistent:'true',distance:'1'});}}
 // Separate return flights so their supports cannot obstruct the previous flight.
 for(let y=1;y<85;y+=7){const z=y%14===1?3:-4;b.floor(2,z,9,z,y+7);for(let x=2;x<=9;x++)for(let h=1;h<=3;h++)b.clear(x,y+7+h,z);}
 for(let y=1;y<85;y+=7){const forward=y%14===1;stair(b,forward?2:7,forward?-4:3,y,7,forward?1:-1,3);}
 b.set(10,2,9,'minecraft:anvil','Workstations');b.set(12,2,9,'minecraft:smithing_table','Workstations');b.set(10,9,9,'minecraft:cartography_table','Workstations');b.set(10,79,9,'minecraft:enchanting_table','Workstations');
 for(let x=-2;x<=2;x++)for(let y=2;y<=5;y++)b.clear(x,y,21);b.door(0,2,21,'south');return b.finishParts();
}
export function createIndustryDistrictsV3():District[]{return [...industry(),...airport(),...dragons(),...workshop()];}

