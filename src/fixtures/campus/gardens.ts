import { DistrictBuilder, type District } from './builder.ts';

function greenhouses(): District {
  const b=new DistrictBuilder({id:'garden-greenhouses',title:'雙拱農牧溫室',origin:[-10,0,80],references:['reference-04'],features:['雙筒玻璃拱頂','種植床與示意灌溉渠','牲畜分欄','牧場閣樓與實體樓梯'],notes:'概念圖比例推估；作物使用成熟小麥狀態，灌溉以藍色玻璃表示；若要實際耕作，玩家須另行設置水源並在遊戲中確認保濕與生長條件。此處為靜態建築模型，未驗證作物生長、水流或動物生成。'});
  b.floor(-32,-23,32,23,0,'minecraft:stone_bricks');b.floor(-32,-23,32,23);
  for(const cx of [-16,16]) {
    for(const x of [cx-13,cx+13])b.box(x,2,-21,x,8,21,'minecraft:cyan_stained_glass','Windows');
    for(let x=cx-13;x<=cx+13;x++) {
      const roof=9+Math.floor(12*Math.sqrt(Math.max(0,1-((x-cx)/13)**2)));
      const n=Math.min(13,Math.abs(x-cx)+1),low=9+Math.floor(12*Math.sqrt(Math.max(0,1-(n/13)**2)));
      for(let z=-21;z<=21;z++)for(let y=Math.min(roof,low+1);y<=roof;y++)b.set(x,y,z,z%7===0?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Roof');
      for(const z of [-21,21])for(let y=2;y<roof;y++)if(!(Math.abs(x-cx)<=1&&y<=4))b.set(x,y,z,'minecraft:light_blue_stained_glass','Windows');
    }
  }
  for(const x of [-25,-21,-11,-7])for(let z=-17;z<=15;z++) {
    b.set(x,2,z,'minecraft:farmland','Landscape',{moisture:'7'});b.set(x,3,z,'minecraft:wheat','Landscape',{age:'7'});
    b.set(x+1,2,z,'minecraft:blue_stained_glass','Landscape');
  }
  for(const x of [7,25])for(const z of [-14,-3,8]) {
    b.floor(x-3,z-3,x+3,z+3,2,'minecraft:dirt');
    for(let d=-3;d<=3;d++)for(const edge of [-3,3]) {
      b.set(x+d,3,z+edge,'minecraft:oak_fence','Landscape');b.set(x+edge,3,z+d,'minecraft:oak_fence','Landscape');
    }
    b.clear(x,3,z+3);b.set(x,3,z+3,'minecraft:oak_fence_gate','Landscape',{facing:'south',open:'true'});
    b.set(x-2,3,z-2,'minecraft:hay_block','Decoration',{axis:'y'});
  }
  b.floor(5,15,27,19,8,'minecraft:oak_planks');
  for(const x of [5,27])b.box(x,2,19,x,7,19,'minecraft:oak_log','Structure',{axis:'y'});
  for(let step=0;step<7;step++)for(let x=14;x<=16;x++) {
    b.box(x,2,8+step,x,2+step,8+step,'minecraft:oak_planks');
    b.set(x,2+step,8+step,'minecraft:oak_stairs','Structure',{facing:'south'});
  }
  return b.finish();
}
function apartments(): District {
  const b=new DistrictBuilder({id:'garden-apartments',title:'退台住宅與寵物居所',origin:[-80,0,65],references:['reference-05'],features:['雙塔退台公寓','六層連續實體樓梯','臥室與成對床','廚房餐桌','寵物櫃與露台植栽'],notes:'每層入口與樓梯留設淨空；床與門最後建立為原子成對結構。寵物櫃為空間配置，不含動物或機器功能。'});
  b.floor(-23,-22,23,22,0,'minecraft:stone_bricks');b.floor(-23,-22,23,22);
  const beds:[number,number,number][]=[];const doors:[number,number,number][]=[];
  for(const cx of [-12,12])for(let level=0;level<6;level++) {
    const floor=1+level*6, back=-18+level*2;
    b.floor(cx-9,back,cx+9,18,floor);
    for(let y=floor+1;y<=floor+5;y++)for(let x=cx-9;x<=cx+9;x++)for(const z of [back,18])b.set(x,y,z,y===floor+5?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Windows');
    for(const x of [cx-9,cx+9])for(let y=floor+1;y<=floor+5;y++)b.box(x,y,back,x,y,18,y===floor+5?'minecraft:white_concrete':'minecraft:white_stained_glass','Windows');
    for(let x=cx-1;x<=cx+1;x++)for(let y=floor+1;y<=floor+3;y++)b.clear(x,y,18);
    doors.push([cx,floor+1,18]);beds.push([cx-6,floor+1,back+5]);
    for(let x=cx+3;x<=cx+6;x++)b.set(x,floor+1,back+2,x===cx+3?'minecraft:furnace':'minecraft:barrel','Decoration');
    b.set(cx+4,floor+1,back+6,'minecraft:oak_fence','Decoration');b.set(cx+4,floor+2,back+6,'minecraft:oak_pressure_plate','Decoration');
    for(const x of [cx+3,cx+5])b.set(x,floor+1,back+7,'minecraft:oak_stairs','Decoration',{facing:'south'});
    for(let x=cx-7;x<=cx-5;x++)b.set(x,floor+1,12,'minecraft:barrel','Decoration');
    if(level<5)for(let step=0;step<6;step++)for(let x=cx-1;x<=cx+1;x++) {
      const z=5+step;b.box(x,floor+1,z,x,floor+1+step,z,'minecraft:smooth_quartz');
      b.set(x,floor+1+step,z,'minecraft:quartz_stairs','Structure',{facing:'south'});
    }
  }
  for(const cx of [-12,12])for(let x=cx-9;x<=cx+9;x++)for(let z=-8;z<=18;z++)b.set(x,36,z,'minecraft:smooth_quartz','Roof');
  // Rebuild after floors so stair treads replace landing cells; clear actual headroom.
  for(const cx of [-12,12])for(let level=0;level<5;level++)for(let step=0;step<6;step++)for(let x=cx-1;x<=cx+1;x++) {
    const y=2+level*6+step,z=5+step;
    b.set(x,y,z,'minecraft:quartz_stairs','Structure',{facing:'south'});
    b.clear(x,y+1,z);b.clear(x,y+2,z);
  }
  for(const cx of [-12,12])for(let level=0;level<6;level++)for(const x of [cx-8,cx+8]) {
    const y=2+level*6,z=16;b.set(x,y,z,'minecraft:dirt','Landscape');b.set(x,y+1,z,'minecraft:oak_leaves','Landscape',{persistent:'true',distance:'1'});
  }
  for(const [x,y,z] of beds)b.bed(x,y,z);
  for(const [x,y,z] of doors)b.door(x,y,z,'south');
  return b.finish();
}
function pavilions(): District {
  const b=new DistrictBuilder({id:'garden-pavilions',title:'五座粉晶穹頂會客亭',origin:[-75,0,120],references:['reference-05'],features:['五座粉色階梯穹頂','橢圓廣場與步道','環形座椅','地圖閱覽桌'],notes:'穹頂以原版整數方塊階梯殼構成；製圖台作為閱圖家具，不含預填地圖。'});
  b.floor(-30,-17,30,17,0,'minecraft:stone_bricks');b.floor(-30,-17,30,17);
  for(let x=-30;x<=30;x++)for(let z=-17;z<=17;z++)if(Math.abs((x/24)**2+(z/12)**2-1)<.16)b.set(x,1,z,'minecraft:pink_concrete','Floor');
  for(const [cx,cz] of [[-22,0],[-11,-9],[11,-9],[22,0],[0,9]] as const) {
    for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++) {
      const d=Math.sqrt(x*x+z*z);if(d>6)continue;
      const top=6+Math.floor(8*Math.sqrt(Math.max(0,1-(d/6)**2)));
      const lower=6+Math.floor(8*Math.sqrt(Math.max(0,1-(Math.min(6,d+1)/6)**2)));
      for(let y=Math.min(top,lower+1);y<=top;y++)b.set(cx+x,y,cz+z,'minecraft:pink_stained_glass','Roof');
      if(d>5)for(let y=2;y<=6;y++)if(!(Math.abs(x)<=1&&z>0&&y<=4))b.set(cx+x,y,cz+z,'minecraft:white_concrete','Walls');
    }
    b.set(cx,2,cz,'minecraft:cartography_table','Decoration');
    for(const x of [-3,3])for(let z=-2;z<=2;z++)b.set(cx+x,2,cz+z,'minecraft:quartz_stairs','Decoration',{facing:x<0?'west':'east'});
  }
  return b.finish();
}
function temples(): District {
  const b=new DistrictBuilder({id:'garden-temples',title:'雙金字塔附魔與鍊金殿',origin:[40,0,35],references:['reference-07'],features:['雙座金色階梯金字塔','中空附魔殿與書牆','鍊金工作台','入口階梯與雙格淨空'],notes:'金色屋面為黃陶土與金方塊；附魔與鍊金家具使用原版工作台，不保證最佳書櫃效能或模組鍊金配方。'});
  b.floor(-24,-12,24,12,0,'minecraft:stone_bricks');b.floor(-24,-12,24,12);
  for(const cx of [-12,12]) {
    for(let y=2;y<=18;y++) {
      const r=Math.max(0,9-Math.floor((y-2)/2));
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.abs(x)===r||Math.abs(z)===r) {
        if(Math.abs(x)<=1&&z===r&&y<=5)continue;
        b.set(cx+x,y,z,y%4===0?'minecraft:gold_block':'minecraft:yellow_terracotta','Roof');
      }
    }
    for(let x=-5;x<=5;x++)for(let y=2;y<=3;y++)b.set(cx+x,y,-5,'minecraft:bookshelf','Decoration');
    for(const x of [-5,5])for(let z=-4;z<=1;z++)b.box(cx+x,2,z,cx+x,3,z,'minecraft:bookshelf','Decoration');
    b.set(cx,2,-1,cx<0?'minecraft:enchanting_table':'minecraft:brewing_stand','Decoration');
    b.set(cx-3,2,3,'minecraft:crafting_table','Decoration');b.set(cx+3,2,3,'minecraft:cauldron','Decoration');
    for(let x=-1;x<=1;x++)b.set(cx+x,1,10,'minecraft:quartz_stairs','Floor',{facing:'north'});
  }
  return b.finish();
}
export function createGardenDistricts(): District[] { return [greenhouses(),apartments(),pavilions(),temples()]; }
