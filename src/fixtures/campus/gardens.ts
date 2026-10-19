import { DistrictBuilder, type District } from './builder.ts';

function greenhouses(): District {
  const b=new DistrictBuilder({id:'garden-greenhouses',title:'雙拱農牧溫室',origin:[-8,8,150],references:['reference-04'],features:['雙筒玻璃拱頂','種植床與示意灌溉渠','牲畜分欄','牧場閣樓與實體樓梯'],notes:'概念圖比例推估；作物使用成熟小麥狀態，灌溉以藍色玻璃表示；若要實際耕作，玩家須另行設置水源並在遊戲中確認保濕與生長條件。此處為靜態建築模型，未驗證作物生長、水流或動物生成。'});
  b.floor(-34,-25,34,25,0,'minecraft:stone_bricks');b.floor(-34,-25,34,25);
  for(const cx of [-16,16]) {
    for(const x of [cx-13,cx+13])b.box(x,2,-21,x,6,21,'minecraft:light_blue_stained_glass','Windows');
    for(let x=cx-13;x<=cx+13;x++) {
      const roof=7+Math.floor(9*Math.sqrt(Math.max(0,1-((x-cx)/13)**2)));
      const n=Math.min(13,Math.abs(x-cx)+1),low=7+Math.floor(9*Math.sqrt(Math.max(0,1-(n/13)**2)));
      for(let z=-21;z<=21;z++)for(let y=Math.min(roof,low+1);y<=roof;y++)b.set(x,y,z,z%7===0?(Math.abs(x-cx)===0?'minecraft:gold_block':'minecraft:white_concrete'):'minecraft:light_blue_stained_glass','Roof');
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
  const b=new DistrictBuilder({id:'garden-apartments',title:'退台住宅與寵物居所',origin:[-112,12,85],references:['reference-05'],features:['三組不等高退台玻璃住宅','最高六層連續實體樓梯','臥室與成對床','廚房餐桌','寵物櫃與露台植栽'],notes:'每層入口與樓梯留設淨空；床與門最後建立為原子成對結構。寵物櫃為空間配置，不含動物或機器功能。'});
  b.floor(-25,-26,25,26,0,'minecraft:stone_bricks');b.floor(-25,-26,25,26);
  const beds:[number,number,number][]=[];const doors:[number,number,number][]=[];
  const volumes=[{cx:-16,levels:4,back:-22,front:19},{cx:0,levels:6,back:-19,front:22},{cx:16,levels:3,back:-24,front:15}];
  for(const v of volumes) {
    for(let level=0;level<v.levels;level++) {
      const y=1+level*5,back=v.back+level*3;
      b.floor(v.cx-7,back,v.cx+7,v.front,y);
      for(let h=y+1;h<=y+4;h++) {
        for(const x of [v.cx-7,v.cx+7])b.box(x,h,back,x,h,v.front,'minecraft:cyan_stained_glass','Windows');
        for(const z of [back,v.front])b.box(v.cx-7,h,z,v.cx+7,h,z,'minecraft:cyan_stained_glass','Windows');
      }
      b.floor(v.cx-7,back,v.cx+7,v.front,y+5);
      // Front terrace and two long roof-edge planting ribbons make the stepped silhouette legible.
      for(let x=v.cx-7;x<=v.cx+7;x++)for(let z=back;z<back+3;z++) {
        b.set(x,y+5,z,'minecraft:white_concrete','Roof');
        if(Math.abs(x-v.cx)>2){b.set(x,y+6,z,'minecraft:dirt','Landscape');b.set(x,y+7,z,'minecraft:oak_leaves','Landscape',{persistent:'true',distance:'1'});}
      }
      for(const x of [v.cx-7,v.cx+7])for(let z=back+3;z<=v.front;z++)b.set(x,y+5,z,'minecraft:oak_leaves','Landscape',{persistent:'true',distance:'1'});
      for(let x=v.cx-1;x<=v.cx+1;x++)for(let h=y+1;h<=y+3;h++)b.clear(x,h,v.front);
      doors.push([v.cx,y+1,v.front]);beds.push([v.cx-4,y+1,back+6]);
      b.set(v.cx+4,y+1,back+3,'minecraft:furnace','Decoration');b.set(v.cx+5,y+1,back+3,'minecraft:barrel','Decoration');
      b.set(v.cx+4,y+1,back+7,'minecraft:oak_fence','Decoration');b.set(v.cx+4,y+2,back+7,'minecraft:oak_pressure_plate','Decoration');
      b.set(v.cx+4,y+1,back+8,'minecraft:oak_stairs','Decoration',{facing:'south'});
      b.set(v.cx-5,y+1,v.front-4,'minecraft:barrel','Decoration');
    }
    // Successive flights rise southward; the next floor is reached at z10 with two-cell headroom.
    for(let level=0;level<v.levels-1;level++)for(let step=0;step<5;step++)for(let x=v.cx-1;x<=v.cx+1;x++) {
      const y=2+level*5+step,z=6+step;b.set(x,y-1,z,'minecraft:smooth_quartz','Structure');
      b.set(x,y,z,'minecraft:quartz_stairs','Structure',{facing:'south'});b.clear(x,y+1,z);b.clear(x,y+2,z);
    }
  }
  for(const [x,y,z] of beds)b.bed(x,y,z);
  for(const [x,y,z] of doors)b.door(x,y,z,'south');
  return b.finish();
}
function pavilions(): District {
  const b=new DistrictBuilder({id:'garden-pavilions',title:'五座粉晶穹頂會客亭',origin:[-99,8,173],references:['reference-05'],features:['五座粉色階梯穹頂','橢圓廣場與步道','環形座椅','地圖閱覽桌'],notes:'穹頂以原版整數方塊階梯殼構成；製圖台作為閱圖家具，不含預填地圖。'});
  b.floor(-32,-20,32,20,0,'minecraft:stone_bricks');b.floor(-32,-20,32,20);
  for(let x=-16;x<=16;x++)for(let z=-16;z<=16;z++)if(x*x+z*z<=16*16) {
    b.set(x,1,z,'minecraft:white_concrete','Floor');
    if(x===0||z===0||Math.abs(x)===Math.abs(z))b.set(x,1,z,'minecraft:gold_block','Floor');
  }
  for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if(x*x+z*z<=9)b.set(x,2,z,x*x+z*z>=5?'minecraft:quartz_slab':'minecraft:light_blue_stained_glass','Decoration');
  b.box(0,3,0,0,5,0,'minecraft:light_blue_stained_glass','Decoration');
  for(const [cx,cz] of [[-25,0],[-13,-13],[13,-13],[25,0],[0,13]] as const) {
    for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++) {
      const d=Math.sqrt(x*x+z*z);if(d>6)continue;
      const top=3+Math.floor(5*Math.sqrt(Math.max(0,1-(d/6)**2)));
      const lower=3+Math.floor(5*Math.sqrt(Math.max(0,1-(Math.min(6,d+1)/6)**2)));
      for(let y=Math.min(top,lower+1);y<=top;y++)b.set(cx+x,y,cz+z,x===0||z===0?'minecraft:white_concrete':'minecraft:pink_stained_glass','Roof');
      if(d>5)for(let y=2;y<=3;y++)if(!(Math.abs(x)<=1&&z>0&&y<=4))b.set(cx+x,y,cz+z,'minecraft:white_concrete','Walls');
    }
    for(let x=-1;x<=1;x++)for(let z=4;z<=6;z++)for(let y=2;y<=4;y++)b.clear(cx+x,y,cz+z);
    b.set(cx,2,cz,'minecraft:cartography_table','Decoration');
    for(const x of [-3,3])for(let z=-2;z<=2;z++)b.set(cx+x,2,cz+z,'minecraft:quartz_stairs','Decoration',{facing:x<0?'west':'east'});
  }
  return b.finish();
}
function temples(): District {
  const b=new DistrictBuilder({id:'garden-temples',title:'雙金字塔附魔與鍊金殿',origin:[52,10,83],references:['reference-07'],features:['雙座金色階梯金字塔','中空附魔殿與書牆','鍊金工作台','入口階梯與雙格淨空'],notes:'金色屋面為黃陶土與金方塊；附魔與鍊金家具使用原版工作台，不保證最佳書櫃效能或模組鍊金配方。'});
  b.floor(-26,-15,26,15,0,'minecraft:stone_bricks');b.floor(-26,-15,26,15);
  for(const cx of [-12,12]) {
    for(let y=2;y<=8;y++)for(let x=-9;x<=9;x++)for(let z=-9;z<=9;z++)if(Math.abs(x)===9||Math.abs(z)===9) {
      if(Math.abs(x)<=1&&z===9&&y<=4)continue;
      const pillar=Math.abs(x)===9&&z%3===0||Math.abs(z)===9&&x%3===0;
      b.set(cx+x,y,z,pillar||y===8?'minecraft:white_concrete':'minecraft:light_blue_stained_glass',pillar?'Structure':'Windows');
    }
    for(const x of [-10,10])for(let z=-10;z<=10;z++) {b.set(cx+x,2,z,'minecraft:dirt','Landscape');b.set(cx+x,3,z,'minecraft:oak_leaves','Landscape',{persistent:'true',distance:'1'});}
    for(let y=9;y<=22;y++) {
      const r=Math.max(0,9-Math.floor((y-9)*9/13));
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

