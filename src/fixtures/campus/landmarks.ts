import type { MinecraftId } from '../../core/contracts.ts';
import { DistrictBuilder, type District } from './builder.ts';
const white: MinecraftId='minecraft:white_concrete',glass: MinecraftId='minecraft:cyan_stained_glass',gold: MinecraftId='minecraft:gold_block',dark: MinecraftId='minecraft:gray_concrete';
function ellipse(b:DistrictBuilder,cx:number,y:number,rx:number,rz:number,floor:boolean,shell:MinecraftId=glass){
 for(let x=-Math.ceil(rx);x<=Math.ceil(rx);x++)for(let z=-Math.ceil(rz);z<=Math.ceil(rz);z++){
  if(x*x/(rx*rx)+z*z/(rz*rz)>1)continue;
  const edge=(Math.abs(x)+2)**2/(rx*rx)+z*z/(rz*rz)>1||x*x/(rx*rx)+(Math.abs(z)+2)**2/(rz*rz)>1;
  if(floor||edge)b.set(cx+x,y,z,floor?'minecraft:smooth_quartz':shell,floor?'Floor':'Envelope');
 }
}
function entrance(b:DistrictBuilder,cx:number,z0:number){for(let z=z0;z<=-4;z++){b.set(cx,1,z,'minecraft:smooth_quartz','Entry');b.clear(cx,2,z);b.clear(cx,3,z);}}
/** Alternating two-wide flights with a landing at each end. Carve AFTER furnishing. */
function stairs(b: DistrictBuilder, cx: number, bottom: number, top: number) {
  for (let y = bottom; y < top; y += 6) {
    const forward = (y - bottom) / 6 % 2 === 0;
    for (let i = 0; i < 6; i++) {
      const z = forward ? i - 3 : 2 - i;
      for (const x of forward ? [cx - 2, cx - 1] : [cx + 1, cx + 2]) {
        for (let h = 1; h <= 3; h++) b.clear(x, y + i + 1 + h, z);
        b.set(x, y + i, z, 'minecraft:smooth_quartz', 'StairSupport');
        b.set(x, y + i + 1, z, 'minecraft:quartz_stairs', 'Circulation', { facing: forward ? 'south' : 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' });
      }
    }
    b.floor(cx - 2, forward ? 3 : -4, cx + 2, forward ? 4 : -4, y + 6);
  }
}

function room(b: DistrictBuilder, cx: number, y: number, kind: 'control' | 'library' | 'home') {
  for (const x of [-6, 6]) {
    for (let z = -5; z <= 5; z += 2) {
      b.set(cx + x, y + 1, z, kind === 'library' ? 'minecraft:bookshelf' : dark, kind === 'library' ? 'Library' : 'Furniture');
      if (kind === 'library') b.set(cx + x, y + 2, z, 'minecraft:bookshelf', 'Library');
      else if (kind === 'control') b.set(cx + x, y + 2, z, 'minecraft:sea_lantern', 'Console');
    }
  }
  b.box(cx - 2, y + 1, 6, cx + 2, y + 1, 6, 'minecraft:cyan_concrete', 'Furniture');
  b.set(cx, y + 1, -6, 'minecraft:crafting_table', 'Furniture');
  b.set(cx + 4, y + 1, -5, 'minecraft:chest', 'Storage');
}

function ringSpire():District{
 const b=new DistrictBuilder({id:'ring-control-spire',title:'環門控制尖塔',origin:[-105,12,0],references:['reference-08'],features:['左上：深色不對稱階梯刀鋒、金色縱肋與大型白環','右上：多層控制台與窄幅玻璃窗','左下：植栽柱廊與庭院','右下：階梯塔身、折返樓梯及入口'],notes:'依概念圖重建輪廓，原版控制台及環門僅為裝飾；尖端為連續結構冠部。'});
 b.floor(-32,-22,32,22,0,'minecraft:stone_bricks');
 for(let y=1;y<=80;y++){
  const left=-10,right=22-Math.floor((y-1)*31/79);
  for(let x=left;x<=right;x++)for(let z=-6;z<=6;z++){
   const edge=x===left||x===right||Math.abs(z)===6;
   if(edge||y<=49&&(y-1)%6===0)b.set(x,y,z,edge?(x===right?gold:x===left?white:(x===-5||x===3)&&y%6!==1?glass:dark):'minecraft:smooth_quartz',edge?'Blade':'Floor');
  }
  if(y<=31&&y%6===1)room(b,0,y,'control');
 }
 for(let y=3;y<=75;y++)for(let x=-32;x<=32;x++){
  const q=x*x/(32*32)+(y-39)**2/(36*36);
  if(q<=1&&q>=.84)b.box(x,y,9,x,y,12,white,'Ring');
 }
 for(const x of [-14,14])b.box(x-1,1,9,x+1,12,12,white,'RingSupport');
 for(const x of [-25,25])for(const z of [-15,15])b.tree(x,1,z);
 for(const x of [-19,19]){for(let z=-17;z<=15;z+=8)b.box(x,1,z,x,6,z,white,'Colonnade');b.floor(x-1,-18,x+1,17,7);}
 stairs(b,0,1,49);entrance(b,0,-8);b.door(0,2,-6);return b.finish();
}
function commandTower():District{
 const b=new DistrictBuilder({id:'teardrop-command',title:'淚滴中央指揮塔',origin:[0,12,0],references:['reference-11'],features:['左上：窄基座、凸透鏡主體、尖頂與寬白金外肋','右上：中庭、薄層樓帶與連續折返梯','左下：指揮廳及地圖牆','右下：原版裝飾伺服器陣列'],notes:'整數方塊近似凸透鏡曲線；兩側白金肋與深色交叉支架為可施工結構，尖冠不作居住層。'});
 b.floor(-23,-20,23,20,0,'minecraft:stone_bricks');
 for(let y=1;y<=89;y++){
  const rx=Math.max(1,22*Math.sin(Math.PI*(y+10)/100)),rz=Math.max(1,rx*.68);
  ellipse(b,0,y,rx,rz,y>=85||y<=79&&(y-1)%6===0);
  // Broad ribs remain bonded to the shell rather than thin detached trim lines.
  for(let x=-Math.floor(rx);x<=Math.floor(rx);x++)for(let z=-Math.floor(rz);z<=Math.floor(rz);z++){
   const q=x*x/(rx*rx)+z*z/(rz*rz);if(q<=1&&Math.abs(x)>=rx*.72)b.set(x,y,z,Math.abs(x)>=rx*.93?gold:white,'OuterRib');
  }
  const xx=Math.round((((y-1)%30)/15-1)*rx*.78);
  for(const sign of [-1,1])for(let dx=-1;dx<=1;dx++){
   const x=sign*xx+dx;if(Math.abs(x)>rx)continue;const depth=Math.floor(rz*Math.sqrt(1-x*x/(rx*rx)));for(const face of [-1,1])b.set(x,y,face*depth,dark,'Brace');
  }
  if(y>=13&&y<=67&&y%6===1)room(b,0,y,y===31||y===37?'library':'control');
 }
 b.set(0,90,0,gold,'Crown');
 for(const x of [-10,10])for(const z of [-5,0,5])b.box(x,20,z,x+1,22,z,'minecraft:purple_concrete','Server');
 b.box(-4,14,8,4,17,8,'minecraft:cyan_concrete','MapWall');
 stairs(b,0,1,79);entrance(b,0,-7);b.door(0,2,-4);return b.finish();
}
function twinTowers():District{
 const b=new DistrictBuilder({id:'twin-residential-library',title:'雙橢圓住宅與圖書塔',origin:[58,12,12],references:['reference-09'],features:['左上：高低雙蛋形塔、圓頂、薄白樓環與透明連橋','右上：實驗及展示工作區','左下：住宅床組、收納與公共樓梯','右下：書架閱覽室與植栽交誼區'],notes:'橢圓塔身及圓頂依概念圖推估；白色樓板僅一格厚，尖端為封閉屋頂結構。'});
 b.floor(-28,-17,28,17,0,'minecraft:stone_bricks');
 for(const cx of [-14,14]){
  const height=cx<0?65:55,top=cx<0?55:43;
  for(let y=1;y<=height;y++){
   const cap=height-16;
   const scale=y<=cap?.88+.12*Math.sin(Math.PI*y/cap):Math.sqrt(Math.max(.006,1-((y-cap)/16)**2));
   const rx=12*scale,rz=16*scale;ellipse(b,cx,y,rx,rz,y>=height-6||y<=top&&(y-1)%6===0);
   if(y<=top-6&&y%6===1)room(b,cx,y,cx>0?'library':'home');
   if(y===height)ellipse(b,cx,y,rx,rz,true);
  }
  stairs(b,cx,1,top);entrance(b,cx,-16);
 }
 for(const y of [1,25]){b.floor(-5,-2,5,2,y);for(const z of [-2,2])b.box(-5,y+1,z,5,y+2,z,glass,'Bridge');for(let x=-6;x<=6;x++)for(let h=1;h<=3;h++)b.clear(x,y+h,0);}
 for(const x of [-25,25])b.tree(x,1,12);
 for(const y of [1,7,13,19,25,31,37,43,49]){b.bed(-18,y+1,4);b.bed(-10,y+1,4);}
 b.door(-14,2,-14);b.door(14,2,-14);return b.finish();
}
function observatory():District{
 const b=new DistrictBuilder({id:'sphere-observatory',title:'球形天文館與玻璃展廊',origin:[-56,8,105],references:['reference-06'],features:['左上：支腳托起白色球體與玻璃展廊','右上：窄幅環形觀景窗與星球壁畫','左下：閱覽角、承重核心及連續樓梯','右下：對稱展示植栽與拱頂玻璃廊'],notes:'半徑14格白色球體採體素階梯近似，窄窗保留球形輪廓；星圖與望遠鏡控制台為裝飾。'});
 b.floor(-20,-17,20,17,0,'minecraft:stone_bricks');
 for(const x of [-11,3])for(const z of [-7,7])b.box(x,1,z,x+1,10,z+1,white,'Support');
 // Enclosed stair core bonds the globe to the foundation and its lower occupied floor.
 b.floor(-8,-5,0,5,1);for(let y=2;y<=7;y++)for(const x of [-8,0])b.box(x,y,-5,x,y,5,white,'Support');
 for(let y=5;y<=33;y++){
  const r=Math.sqrt(Math.max(0,196-(y-19)**2));if(r<1){if(y>19)b.set(-4,y,0,white,'Envelope');continue;}
  ellipse(b,-4,y,r,r,y>=27||[7,13,19,25].includes(y),white);
  // Isolated observation dashes retain a nearly continuous white spherical surface.
  if(y===16||y===22)for(const dx of [-8,0,8])if(Math.abs(dx)<r){const depth=Math.floor(Math.sqrt(r*r-dx*dx));for(const face of [-1,1])b.set(-4+dx,y,face*depth,glass,'Envelope');}
  if(y===19)for(let dx=-3;dx<=3;dx++)b.set(-4+dx,y,Math.floor(Math.sqrt(r*r-dx*dx)),glass,'Envelope');
  if([13,19,25].includes(y))room(b,-4,y,y===13?'library':'control');
 }
 b.floor(10,-15,20,15,1);
 for(let z=-15;z<=15;z++)for(let x=10;x<=20;x++){const y=5+Math.round(5*Math.sqrt(Math.max(0,1-((x-15)/5)**2)));const previous=5+Math.round(5*Math.sqrt(Math.max(0,1-((x-1-15)/5)**2)));b.box(x,Math.min(y,previous),z,x,Math.max(y,previous),z,z%5===0?white:glass,'Gallery');if(x===10||x===20)b.box(x,2,z,x,y-1,z,glass,'Gallery');}
 for(let z=-10;z<=10;z+=5)for(const x of [12,18]){b.set(x,2,z,'minecraft:grass_block','Planter');b.set(x,3,z,'minecraft:oak_leaves','Planter',{persistent:'true',distance:'1'});}
 b.box(-9,14,7,1,17,7,'minecraft:black_concrete','PlanetWall');for(const [x,id]of[[-7,'minecraft:blue_concrete'],[-3,'minecraft:gold_block'],[0,'minecraft:red_concrete']]as const)b.set(x,16,6,id,'PlanetWall');
 stairs(b,-4,1,25);
 for(let x=-4;x<=15;x++){b.set(x,1,0,'minecraft:smooth_quartz','Entry');b.clear(x,2,0);b.clear(x,3,0);}
 entrance(b,15,-16);b.door(15,2,-15);return b.finish();
}
export function createLandmarkDistricts():District[]{return[ringSpire(),commandTower(),twinTowers(),observatory()];}
