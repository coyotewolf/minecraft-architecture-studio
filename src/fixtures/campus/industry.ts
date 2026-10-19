import type { MinecraftId } from '../../core/contracts.ts';
import { DistrictBuilder, type District } from './builder.ts';

const white: MinecraftId = 'minecraft:white_concrete', glass: MinecraftId = 'minecraft:cyan_stained_glass';
const gold: MinecraftId = 'minecraft:gold_block', dark: MinecraftId = 'minecraft:deepslate_tiles';
function foundation(b:DistrictBuilder,x:number,z:number){b.floor(-x,-z,x,z,0,'minecraft:stone_bricks');b.floor(-x,-z,x,z);}
/** Hollow stepped shell with open three-wide, four-high front entrance. */
function hall(b:DistrictBuilder,x0:number,z0:number,x1:number,z1:number,h:number){
  for(let y=2;y<=h;y++){
    for(let x=x0;x<=x1;x++)for(const z of [z0,z1])b.set(x,y,z,y===h?gold:((x-x0)%5===0||y<4?white:glass));
    for(let z=z0;z<=z1;z++)for(const x of [x0,x1])b.set(x,y,z,y===h?gold:((z-z0)%5===0||y<4?white:glass));
  }
  const middle=Math.floor((x0+x1)/2);
  for(let x=x0;x<=x1;x++){
    const rise=Math.min(4,Math.min(x-x0,x1-x));
    for(let z=z0;z<=z1;z++)b.set(x,h+1+rise,z,(z-z0)%5===0?white:glass,'Roof');
  }
  b.box(middle-1,2,z1,middle+1,5,z1,white);
  for(let x=middle-1;x<=middle+1;x++)for(let y=2;y<=5;y++)b.clear(x,y,z1);
}
function stair(b:DistrictBuilder,x:number,z:number,start:number,rise:number,direction=-1){
  for(let i=0;i<rise;i++)for(let w=0;w<3;w++){
    b.box(x+w,start,z+direction*i,x+w,start+i,z+direction*i,white,'Structure');
    b.set(x+w,start+i+1,z+direction*i,'minecraft:quartz_stairs','Stairs',{facing:direction===-1?'north':'south'});
    for(let head=2;head<=3;head++)b.clear(x+w,start+i+head,z+direction*i);
  }
}
function console(b:DistrictBuilder,x:number,y:number,z:number){b.set(x,y,z,'minecraft:polished_blackstone','Workstations');b.set(x,y+1,z,'minecraft:sea_lantern','Workstations');b.set(x+1,y,z,'minecraft:crafting_table','Workstations');}
function factory():District{
  const b=new DistrictBuilder({id:'campus-industry',title:'工業工坊與高架鐵道',origin:[-70,0,-65],references:['reference-10'],features:['主廠房玻璃鋸齒屋頂與金色肋骨','熔爐工作列、原料堆、雙煙囪','高架月台、軌道與靜態列車','工廠夾層及三格寬樓梯'],notes:'參考第十張外觀與室內概念；尺寸、設備與高架結構為 AI 設計推估。列車與機械為 Vanilla 裝飾，不宣稱實際運轉。'});
  foundation(b,32,20);hall(b,-30,-18,6,7,16);hall(b,13,-18,30,5,11);
  for(const x of [-25,-15,-5])for(const z of [-13,-6]){b.box(x,2,z,x+3,3,z+2,'minecraft:iron_block','Machinery');b.set(x+1,4,z+1,'minecraft:blast_furnace','Workstations');b.set(x+2,4,z+1,'minecraft:hopper','Machinery');console(b,x,2,z+4);}
  b.floor(-28,-17,4,-9,8);for(let x=-28;x<=4;x++)b.set(x,9,-11,'minecraft:iron_bars','Railings');
  stair(b,-28,-2,1,7);for(let x=-28;x<=-26;x++)b.clear(x,9,-11);console(b,-20,9,-15);console(b,17,2,-12);b.box(24,2,-14,28,4,-10,'minecraft:barrel','Storage');
  for(const x of [17,26]){b.box(x,2,0,x+2,29,2,'minecraft:stone_bricks');b.box(x,28,0,x+2,28,2,gold);b.clear(x+1,29,1);}
  b.floor(-31,10,31,19,7,dark);
  for(let x=-30;x<=30;x+=10)for(const z of [11,18])b.box(x,2,z,x+1,6,z+1,white);
  for(let x=-31;x<=31;x++)for(const z of [13,16])b.set(x,8,z,'minecraft:rail','Rail',{shape:'east_west'});
  for(let x=-26;x<=18;x++){
    b.box(x,9,13,x,9,16,dark,'Train');b.box(x,10,13,x,12,16,white,'Train');
    for(const z of [13,16])if(x%8!==0)b.set(x,11,z,glass,'Train');
    for(let z=13;z<=16;z++)b.set(x,13,z,'minecraft:smooth_quartz_slab','Train');
  }
  for(let x=-25;x<=17;x++)for(let y=10;y<=11;y++)for(const z of [14,15])b.clear(x,y,z);
  for(const x of [-16,0,16])for(let y=10;y<=11;y++)b.clear(x,y,16);
  stair(b,25,3,1,6,1);b.floor(25,9,27,9,7,dark);return b.finish();
}
function airport():District{
  const b=new DistrictBuilder({id:'campus-airport',title:'空港跑道與高架發射機庫',origin:[35,0,-75],references:['reference-02'],features:['三座地面機庫與前庭滑行區','長條跑道、中心線及邊燈','玻璃控制塔與內部指揮台','高架發射機庫、靜態太空船與登艦階梯'],notes:'第二張概念圖的機庫、空港、控制塔及發射平台皆有獨立區域。跑道尺寸及航行淨空未實測；太空船為 Vanilla 方塊雕塑，不能飛行。'});
  foundation(b,52,25);
  b.floor(-50,12,50,23,1,'minecraft:gray_concrete');
  for(let x=-48;x<=48;x++){if(Math.floor(x/3)%2===0)b.set(x,1,17,white,'Floor');if(x%5===0)for(const z of [12,23])b.set(x,1,z,'minecraft:sea_lantern','Lighting');}
  for(const x of [-48,-24,0]){hall(b,x,-23,x+20,-2,11);console(b,x+3,2,-19);b.box(x+15,2,-20,x+17,3,-17,'minecraft:barrel','Storage');
    b.box(x+8,3,-16,x+10,4,-7,'minecraft:iron_block','Aircraft');b.box(x+3,3,-12,x+15,3,-10,white,'Aircraft');b.set(x+9,5,-14,glass,'Aircraft');}
  b.box(39,2,-19,47,29,-11,white); // hollow tower shaft and glazing
  for(let y=2;y<=28;y++)for(let x=40;x<=46;x++)for(let z=-18;z<=-12;z++)b.clear(x,y,z);
  b.floor(36,-22,50,-8,30);hall(b,36,-22,50,-8,35);
  // Hall helper starts at ground; clear its lower walls to preserve raised observation cabin.
  for(let y=2;y<30;y++){for(let x=36;x<=50;x++)for(const z of [-22,-8])b.clear(x,y,z);for(let z=-22;z<=-8;z++)for(const x of [36,50])b.clear(x,y,z);}
  for(let y=2;y<=30;y++)b.set(40,y,-18,'minecraft:ladder','Stairs',{facing:'east'});
  for(let y=2;y<=4;y++)b.clear(43,y,-11);b.clear(40,30,-18);console(b,40,31,-12);console(b,45,31,-12);
  b.floor(4,-23,29,4,17,dark);for(const x of [5,28])for(const z of [-22,3])b.box(x,2,z,x+1,16,z+1,white);
  for(let z=-23;z<=4;z+=5){b.box(4,18,z,4,27,z,white);b.box(29,18,z,29,27,z,white);b.box(4,28,z,29,28,z,white,'Roof');}
  b.box(4,29,-23,29,29,4,glass,'Roof');
  for(let z=-19;z<=0;z++){const w=z<-15?1:z>-3?2:3;b.box(16-w,19,z,16+w,21,z,'minecraft:iron_block','Spacecraft');}
  b.box(7,19,-11,25,19,-6,white,'Spacecraft');b.box(15,22,-16,17,23,-12,glass,'Spacecraft');b.box(15,22,-1,17,26,1,white,'Spacecraft');
  b.set(14,20,1,'minecraft:sea_lantern','Spacecraft');b.set(18,20,1,'minecraft:sea_lantern','Spacecraft');
  stair(b,30,8,1,16);console(b,6,18,1);return b.finish();
}
function dragonSculpture(b:DistrictBuilder,cx:number,color:MinecraftId){
  b.box(cx-2,4,-11,cx+2,7,-4,color,'Dragon sculpture');b.box(cx-1,6,-4,cx+1,9,-2,color,'Dragon sculpture');b.box(cx-2,8,-2,cx+2,10,1,color,'Dragon sculpture');
  for(const side of [-1,1]){
    b.box(cx+side*2,2,-10,cx+side*2,4,-9,color,'Dragon sculpture');b.box(cx+side*2,2,-5,cx+side*2,4,-4,color,'Dragon sculpture');
    for(let i=1;i<=6;i++){const x=cx+side*i;b.box(x,7+Math.floor(i/2),-10,x,7+Math.floor(i/2),-5-Math.floor(i/2),color,'Dragon sculpture');b.set(x,8+Math.floor(i/2),-10,'minecraft:bone_block','Dragon sculpture');}
    b.set(cx+side*2,10,0,'minecraft:sea_lantern','Dragon sculpture');b.set(cx+side*2,11,-2,'minecraft:bone_block','Dragon sculpture');
  }
  for(let i=0;i<6;i++)b.set(cx+Math.floor(i/3),5-Math.floor(i/3),-12-i,color,'Dragon sculpture');
}
function dragons():District{
  const b=new DistrictBuilder({id:'campus-dragons',title:'三龍棲舍與照護圍場',origin:[75,0,75],references:['reference-03'],features:['紅、黑、白三座可辨識龍雕塑','三座玻璃棲舍與後方觀察夾層','藍玻璃靜態水槽、乾草餵食區與戶外圍場','翼、角、四足與長尾的方塊造型'],notes:'第三張概念圖的龍、機庫和照護空間轉為估計尺寸。三龍全是 Vanilla 靜態裝飾，沒有使用模組生物，也不代表可用的馴龍機制。水槽使用藍色玻璃表現水面，不含實際流體。'});
  foundation(b,32,22);
  for(const [i,cx] of [-21,0,21].entries()){
    hall(b,cx-9,-20,cx+9,6,17);dragonSculpture(b,cx,['minecraft:red_concrete','minecraft:black_concrete','minecraft:white_concrete'][i] as MinecraftId);
    b.floor(cx-8,-19,cx+8,-16,12);stair(b,cx-8,-5,1,11);console(b,cx+5,13,-19);
    for(let x=cx-8;x<=cx+8;x++)for(const z of [10,21])b.set(x,2,z,'minecraft:oak_fence','Enclosure');
    for(let z=10;z<=21;z++)for(const x of [cx-8,cx+8])b.set(x,2,z,'minecraft:oak_fence','Enclosure');
    b.floor(cx-7,12,cx-3,16,1,'minecraft:blue_stained_glass');b.box(cx+3,2,12,cx+6,3,15,'minecraft:hay_block','Feed');
    for(let x=cx-1;x<=cx+1;x++)b.clear(x,2,10);
  }
  return b.finish();
}
function workshop():District{
  const b=new DistrictBuilder({id:'campus-workshop',title:'斜撐玻璃工坊與附魔塔',origin:[105,0,10],references:['reference-07'],features:['四層玻璃塔、交叉斜撐與金色水平線','鐵砧、鍛造台、製圖與木作工作站','頂層附魔台、書架與環形走道','各層三格寬樓梯與入口通道'],notes:'第七張外觀及室內概念的斜向玻璃以整數格階梯肋骨近似。附魔配置與書架效力未作遊戲驗證；全部尺寸與內部安排為設計推估。'});
  foundation(b,15,16);
  for(let y=2;y<=31;y++){
    for(let x=-12;x<=12;x++)for(const z of [-13,13])b.set(x,y,z,glass);
    for(let z=-13;z<=13;z++)for(const x of [-12,12])b.set(x,y,z,glass);
    const diagonal=-12+Math.min(24,Math.floor((y-2)*24/29));
    for(const x of [diagonal,-diagonal])for(const z of [-13,13])b.set(x,y,z,white);
    for(const z of [-13+Math.floor((y-2)*26/29),13-Math.floor((y-2)*26/29)])for(const x of [-12,12])b.set(x,y,z,white);
  }
  for(const y of [1,9,17,25]){
    b.floor(-12,-13,12,13,y);for(let x=-12;x<=12;x++)for(const z of [-13,13])b.set(x,y+1,z,gold);for(let z=-13;z<=13;z++)for(const x of [-12,12])b.set(x,y+1,z,gold);

    for(let x=-6;x<=6;x+=4)console(b,x,y+1,-9);
  }
  // Alternate stair banks; build after floors and keep both headroom cells clear.
  for(const y of [1,9,17])stair(b,y===9?8:-10,8,y,8);
  b.box(-12,32,-13,12,32,13,white,'Roof');
  for(let x=-1;x<=1;x++)for(let y=2;y<=5;y++)b.clear(x,y,13);
  b.set(5,2,4,'minecraft:anvil','Workstations');b.set(7,2,4,'minecraft:smithing_table','Workstations');b.set(5,10,4,'minecraft:cartography_table','Workstations');b.set(7,10,4,'minecraft:stonecutter','Workstations');
  b.set(2,26,2,'minecraft:enchanting_table','Workstations');for(let x=-2;x<=6;x++)b.box(x,26,-2,x,27,-2,'minecraft:bookshelf','Workstations');
  return b.finish();
}
export function createIndustryDistricts():District[]{return [factory(),airport(),dragons(),workshop()];}
