import type { MinecraftId } from '../../core/contracts.ts';
import { DistrictBuilder, type District } from './builder.ts';
const white:MinecraftId='minecraft:white_concrete',glass:MinecraftId='minecraft:cyan_stained_glass',gold:MinecraftId='minecraft:gold_block',dark:MinecraftId='minecraft:deepslate_tiles';
function foundation(b:DistrictBuilder,x:number,z:number){b.floor(-x,-z,x,z,0,'minecraft:stone_bricks');b.floor(-x,-z,x,z);}
function stair(b:DistrictBuilder,x:number,z:number,start:number,rise:number,direction=-1){for(let i=0;i<rise;i++)for(let w=0;w<3;w++){b.box(x+w,start,z+direction*i,x+w,start+i,z+direction*i,white,'Structure');b.set(x+w,start+i+1,z+direction*i,'minecraft:quartz_stairs','Stairs',{facing:direction===-1?'north':'south'});for(const h of [2,3])b.clear(x+w,start+i+h,z+direction*i);}}
function console(b:DistrictBuilder,x:number,y:number,z:number){b.set(x,y,z,'minecraft:polished_blackstone','Workstations');b.set(x,y+1,z,'minecraft:sea_lantern','Workstations');b.set(x+1,y,z,'minecraft:crafting_table','Workstations');}
function entrance(b:DistrictBuilder,x:number,y:number,z:number,width=3){for(let dx=-Math.floor(width/2);dx<=Math.floor(width/2);dx++)for(let h=1;h<=4;h++)b.clear(x+dx,y+h,z);}
/** Horizontal ribbed opaque shell; narrow glazing rather than greenhouse envelopes. */
function industrialHall(b:DistrictBuilder,x0:number,z0:number,x1:number,z1:number,base:number,top:number){
 b.floor(x0,z0,x1,z1,base);b.box(x0,top,z0,x1,top,z1,dark,'Roof');
 for(let y=base+1;y<top;y++){
  for(let x=x0;x<=x1;x++)for(const z of [z0,z1])b.set(x,y,z,(x-x0)%9<2||y<base+3||y>top-3?white:y>=base+4&&y<=base+6?glass:dark);
  for(let z=z0;z<=z1;z++)for(const x of [x0,x1])b.set(x,y,z,y>=base+4&&y<=base+6?glass:white);
 }
 for(let x=x0;x<=x1;x+=9){b.box(x,base,z0,x+1,top,z0,white);b.box(x,base,z1,x+1,top,z1,white);b.box(x,top,z0,x+1,top,z1,white,'Roof');}
 entrance(b,Math.floor((x0+x1)/2),base,z1);
}
function factory():District{
 const b=new DistrictBuilder({id:'campus-industry',title:'階層工業長廊與高架鐵道',origin:[-100,38,-100],references:['reference-10'],features:['雙層白色肋骨長廠房與深灰窄窗帶','四組傾斜屋頂太陽能板造型','廠外高架列車、月台與支柱','熔爐機械列、原料架及上層操作廊'],notes:'依第十張圖的橫向懸挑工廠、斜面板與高架鐵道重作輪廓；沒有加入圖中未見的煙囪。面板、機械、列車皆為 Vanilla 靜態裝飾，尺寸與設備功能未經實測。'});
 foundation(b,40,24);industrialHall(b,-38,-22,35,-3,1,11);industrialHall(b,-35,-23,30,-9,13,24);
 for(const x of [-33,-12,9,28])for(const z of [-21,-10])b.box(x,2,z,x+2,12,z+2,white);
 for(const x0 of [-30,-15,0,15])for(let x=x0;x<x0+11;x++)for(let z=-21;z<=-13;z++){
  const y=25+Math.floor((z+21)/2);b.set(x,y,z,x===x0||x===x0+10||z===-21||z===-13?white:'minecraft:black_concrete','Solar panels');
  if((x-x0)%4===0)b.set(x,y+1,z,'minecraft:light_gray_concrete','Solar panel grid');
 }
 for(const y of [2,14])for(const x of [-28,-16,-4,8,20]){b.box(x,y,-19,x+3,y+2,-16,'minecraft:iron_block','Machinery');b.set(x+1,y+3,-17,'minecraft:blast_furnace','Workstations');console(b,x,y,-13);}
 b.floor(-38,10,38,20,8,dark);for(let x=-36;x<=36;x+=12)for(const z of [11,19])b.box(x,2,z,x+1,7,z+1,white);
 for(let x=-38;x<=38;x++){for(const z of [13,16])b.set(x,9,z,'minecraft:rail','Rail',{shape:'east_west'});b.set(x,8,20,gold,'Floor');}
 for(let x=-30;x<=25;x++){b.box(x,10,13,x,10,16,dark,'Train');for(const z of [13,16]){b.set(x,11,z,'minecraft:blue_concrete','Train');b.set(x,12,z,x%9===0?white:glass,'Train');b.set(x,13,z,white,'Train');}b.box(x,14,13,x,14,16,white,'Train');}
 for(const x of [-18,0,18])for(const y of [11,12])b.clear(x,y,16);
 stair(b,35,2,1,7,1);b.floor(35,9,37,9,8,dark);
 // Side flight joins the upper factory floor outside its glazed front wall.
 stair(b,-39,10,1,12);b.floor(-39,-9,-35,-2,13);entrance(b,-35,13,-9,3);
 return b.finish();
}
function plane(b:DistrictBuilder,cx:number,z:number,y:number,category:string){
 b.box(cx-1,y,z-7,cx+1,y+2,z+7,white,category);b.box(cx-9,y,z-1,cx+9,y,z+3,white,category);b.box(cx-1,y+3,z-5,cx+1,y+3,z-1,glass,category);b.box(cx,y+3,z+5,cx,y+6,z+7,dark,category);
 for(const x of [cx-3,cx+3])b.box(x,y,z+3,x,y+1,z+7,dark,category);b.set(cx-3,y+1,z+8,'minecraft:sea_lantern',category);b.set(cx+3,y+1,z+8,'minecraft:sea_lantern',category);
}
function roundedHangar(b:DistrictBuilder,cx:number,z0:number,z1:number,radius:number){
 for(let x=-radius;x<=radius;x++){
  const roof=6+Math.floor(Math.sqrt(radius*radius-x*x));
  for(let z=z0;z<=z1;z++)b.set(cx+x,roof,z,(z-z0)%5===0||Math.abs(x)>=radius-1?white:dark,'Roof');
  for(let y=2;y<roof;y++){b.set(cx+x,y,z0,y>5&&Math.abs(x)<radius-2?glass:dark);if(Math.abs(x)>=radius-1)b.box(cx+x,y,z0,cx+x,y,z1,white);}
 }
 for(const x of [cx-radius,cx+radius])b.box(x,2,z1,x,6,z1,gold);
 b.floor(cx-radius+2,z0+1,cx+radius-2,z0+3,5);console(b,cx+2,2,z0+5);b.box(cx-radius+2,2,z0+4,cx-radius+3,3,z0+6,'minecraft:barrel','Storage');
 stair(b,cx-radius+2,z0+8,1,4); // upper tread at z0+5; landing extends to z0+4
 b.floor(cx-radius+2,z0+4,cx-radius+4,z0+4,5);
}
function airport():District{
 const b=new DistrictBuilder({id:'campus-airport',title:'懸架立方空港與太空船泊位',origin:[55,36,-105],references:['reference-02'],features:['金框白灰封閉立方空港高架於四柱上','下方開放泊位與懸吊太空船雕塑','南向高空玻璃廊橋與內部雙層操作台','後方三座小機庫、寬停機坪與停放飛機'],notes:'依第二張圖的巨大高架方形機庫、垂直金框及下懸太空船重建主要輪廓；所有高度、支撐與航行淨空為設計推估。飛機與太空船不會飛行，無真實模組機械功能。'});
 foundation(b,56,34);b.floor(-54,-15,54,2,1,'minecraft:gray_concrete');
 for(let x=-52;x<=52;x++){if(x%8<4)b.set(x,1,-7,white,'Floor');for(const z of [-14,1])b.set(x,1,z,gold,'Floor');}
 for(const x of [-39,-13,13])roundedHangar(b,x,-33,-18,10);
 plane(b,-33,-7,2,'Parked aircraft');plane(b,34,-7,2,'Parked aircraft');
 for(const x of [-23,22])for(const z of [6,25]){b.box(x,2,z,x+2,19,z+2,white);b.box(x+1,2,z,x+1,19,z,gold);}
 b.floor(-25,5,25,28,20,dark);b.box(-25,55,5,25,55,28,white,'Roof');
 for(let y=21;y<55;y++){
  for(let x=-25;x<=25;x++)for(const z of [5,28]){const rib=Math.abs(x)>=21||Math.abs(x)===13;b.set(x,y,z,rib?white:'minecraft:black_stained_glass');if(Math.abs(x)===20||Math.abs(x)===14)b.set(x,y,z,gold);}
  for(let z=5;z<=28;z++)for(const x of [-25,25])b.set(x,y,z,z%9<3?white:z%9===3?gold:'minecraft:gray_stained_glass');
 }
 for(const y of [20,54]){b.box(-25,y,5,25,y,5,gold);b.box(-25,y,28,25,y,28,gold);b.box(-25,y,5,-25,y,28,gold);b.box(25,y,5,25,y,28,gold);}
 // Open docking well under the shell; spaceship remains visible below its belly.
 for(let x=-10;x<=10;x++)for(let z=10;z<=23;z++)b.clear(x,20,z);
 plane(b,0,16,10,'Suspended spacecraft');for(const x of [-7,7])b.box(x,11,17,x,19,17,'minecraft:iron_bars','Dock supports');
 b.floor(-24,6,24,10,30);b.floor(-24,23,24,27,30);for(const x of [-20,-10,0,10,20]){console(b,x,21,7);console(b,x,31,25);}
 b.floor(-4,28,4,34,20);b.box(-4,25,28,4,25,34,white,'Roof');for(let z=29;z<=34;z++)for(const x of [-4,4])b.box(x,21,z,x,24,z,glass);
 entrance(b,0,20,28,5);
 stair(b,27,34,1,19);b.floor(25,15,29,16,20);for(let y=21;y<=24;y++)for(let z=15;z<=17;z++)b.clear(25,y,z);
 stair(b,-23,22,20,10);b.floor(-23,11,-21,12,30);
 return b.finish();
}
function dragonSculpture(b:DistrictBuilder,cx:number,color:MinecraftId){
 b.box(cx-2,4,5,cx+2,7,12,color,'Dragon sculpture');b.box(cx-1,6,12,cx+1,9,14,color,'Dragon sculpture');b.box(cx-2,8,14,cx+2,10,17,color,'Dragon sculpture');
 for(const side of [-1,1]){
  for(const z of [6,11])b.box(cx+side*2,2,z,cx+side*2,4,z+1,color,'Dragon sculpture');
  for(let i=1;i<=8;i++){const x=cx+side*i;b.box(x,7+Math.floor(i/2),6,x,7+Math.floor(i/2),11-Math.floor(i/2),color,'Dragon sculpture');b.set(x,8+Math.floor(i/2),6,'minecraft:bone_block','Dragon sculpture');}
  b.set(cx+side*2,10,16,'minecraft:sea_lantern','Dragon sculpture');b.set(cx+side*2,11,14,'minecraft:bone_block','Dragon sculpture');
 }
 for(let i=0;i<7;i++)b.set(cx+Math.floor(i/3),5-Math.floor(i/3),4-i,color,'Dragon sculpture');
}
function dragons():District{
 const b=new DistrictBuilder({id:'campus-dragons',title:'六連棲舍與三龍展示停機坪',origin:[105,8,145],references:['reference-03'],features:['六座白色分節圓拱棲舍與深灰屋面','室外紅、黑、白三龍雕塑與展翼長尾','灰色寬停機坪、金色分隔線與照護槽','每座棲舍後方儲物夾層與操作台'],notes:'依第三張圖的六連白灰機庫及室外龍群重作；屋頂不再使用溫室型青玻璃。三龍均為 Vanilla 靜態雕塑；藍玻璃水槽沒有實際流體，尺寸及馴龍機制未驗證。'});
 foundation(b,44,27);b.floor(-43,-6,43,25,1,'minecraft:gray_concrete');
 for(const cx of [-35,-21,-7,7,21,35]){roundedHangar(b,cx,-25,-8,6);for(let z=-6;z<=25;z++)b.set(cx-7,1,z,gold,'Floor');b.floor(cx-4,-23,cx-2,-21,1,'minecraft:blue_stained_glass');b.box(cx+2,2,-23,cx+4,3,-21,'minecraft:hay_block','Feed');}
 for(const [i,x] of [-28,0,28].entries())dragonSculpture(b,x,['minecraft:red_concrete','minecraft:black_concrete','minecraft:white_concrete'][i] as MinecraftId);
 b.box(-43,2,26,43,2,26,white,'Railings');for(let x=-42;x<=42;x+=7)b.set(x,3,26,'minecraft:lantern','Lighting');
 return b.finish();
}
function workshop():District{
 const b=new DistrictBuilder({id:'campus-workshop',title:'階梯斜撐玻璃工坊塔',origin:[132,12,40],references:['reference-07'],features:['窄高階梯輪廓、粗白色對角外骨骼','三層退台花園與金色頂緣','五層鍛造、製圖及附魔工作室','內部分離樓梯與寬入口'],notes:'第七張圖的窄高玻璃工坊、外露斜撐及退台植栽以合法整數格近似。室內及尺寸為設計推估，附魔機制未作遊戲驗證。'});
 foundation(b,20,23);
 for(let y=2;y<=41;y++){
  const r=y<17?14:y<33?11:8;
  for(let x=-r;x<=r;x++)for(const z of [-15,15])b.set(x,y,z,glass);
  for(let z=-15;z<=15;z++)for(const x of [-r,r])b.set(x,y,z,glass);
  const diagonal=-14+Math.floor((y-2)*22/39);
  for(const z of [-16,16])for(let w=0;w<2;w++)b.set(diagonal+w,y,z,white);
  for(const x of [-r,r])for(const z of [-15,15])b.box(x,y,z,x+1,y,z,white);
 }
 for(const y of [1,9,17,25,33]){
  const r=y<17?14:y<33?11:8;b.floor(-r,-15,r,15,y);
  for(let x=-r;x<=r;x++)for(const z of [-15,15])b.set(x,y+1,z,white);
  for(const x of [-5,0,5])console(b,x,y+1,-11);
 }
 for(const [y,r] of [[16,14],[32,11],[42,8]] as const){b.box(-r,y,-15,r,y,15,white,'Roof');for(let x=-r;x<=r;x++)b.set(x,y+1,-15,gold);for(const x of [-r+1,r-1])b.box(x,y+1,-12,x,y+1,12,'minecraft:oak_leaves','Planters',{persistent:'true',distance:'1'});}
 // Each terrace roof is also the next landing; flights cut their own headroom last.
 for(const y of [1,9,17,25])stair(b,y===9||y===25?4:-7,8,y,8);
 entrance(b,0,1,15,5);b.set(2,2,5,'minecraft:anvil','Workstations');b.set(4,2,5,'minecraft:smithing_table','Workstations');b.set(2,10,5,'minecraft:cartography_table','Workstations');b.set(2,34,3,'minecraft:enchanting_table','Workstations');b.box(-4,34,-4,4,35,-4,'minecraft:bookshelf','Workstations');
 return b.finish();
}
export function createIndustryDistricts():District[]{return [factory(),airport(),dragons(),workshop()];}
