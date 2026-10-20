import type {District} from '../campus/builder.ts';
import {HighDetailBuilder} from '../campus/high-detail.ts';
import type {MinecraftId} from '../../core/contracts.ts';

export const GOLDEN_LEAF_DESIGN={id:'golden-leaf-tower',front:'negative-z',nominalTowerDiameter:90,nominalTowerHeight:190,towerBaseY:13,highestY:202,floorPitch:6,floorCount:28,referenceInspiredAspect:1090/620,chosenAspect:190/90,proportionNote:'參考圖塔身約 620×1090 像素，高寬比約 1.76；本設計 190/90≈2.11，塔身比例約修長 20%。含基座約 203/129≈1.57，相對參考整體約 1250/880≈1.42 修長約 11%。像素比例為粗略比較，並非原圖實際尺寸。'} as const;
const W:MinecraftId='minecraft:white_concrete',Q:MinecraftId='minecraft:smooth_quartz',G:MinecraftId='minecraft:gold_block',C:MinecraftId='minecraft:cyan_stained_glass';
const leaves={persistent:'true',distance:'1'};
/** A circular section, not a thin front/back extrusion. Radius changes continuously with height. */
function radius(y:number){const t=Math.max(0,Math.min(1,(y-13)/189));return Math.max(1,45*Math.pow(Math.sin(Math.PI*(.14+.86*Math.pow(t,.8))),.8));}
function section(y:number,positive:boolean){const t=Math.max(0,Math.min(1,(y-145)/39));return positive&&y>145?{r:y>184?0:Math.max(.5,radius(145)*Math.pow(1-t,.7)),cx:12*t}:{r:radius(y),cx:0};}
function disk(b:HighDetailBuilder,cx:number,cz:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(cx-r);x<=Math.floor(cx+r);x++)for(let z=Math.ceil(cz-r);z<=Math.floor(cz+r);z++)if((x-cx)**2+(z-cz)**2<=r*r)b.set(x,y,z,id,category);}
function ring(b:HighDetailBuilder,cx:number,cz:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(cx-r);x<=Math.floor(cx+r);x++)for(let z=Math.ceil(cz-r);z<=Math.floor(cz+r);z++){const d=Math.hypot(x-cx,z-cz);if(d<=r&&d>r-1.3)b.set(x,y,z,id,category);}}
function stairCore(b:HighDetailBuilder){
 for(let base=1;base<175;base+=6){const reverse=((base-1)/6)%2===1;
  for(let i=0;i<6;i++){const x=reverse?1:-2,z=reverse?2-i:i-3,y=base+i;
   for(let w=0;w<2;w++){for(let h=1;h<=4;h++)b.clear(x+w,y+h,z);b.set(x+w,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south',half:'bottom',shape:'straight'});}}
  b.floor(-2,reverse?-4:3,2,reverse?-4:3,base+6);
 }
}
export function createGoldenLeafParts():District[]{
 const b=new HighDetailBuilder({id:GOLDEN_LEAF_DESIGN.id,title:'金色葉塔',origin:[0,0,0],references:['golden-leaf-front','golden-leaf-rear'],features:['圓形塔身、前寬玻璃與後窄尖窗','金色重疊葉瓣、前方下段 X 撐、後方白色中脊','28 層可用樓板、連續樓梯、雙圓形附樓與花園'],notes:'參考葉子前視圖與葉子後視圖，所有隱藏面、室內與 XYZ 尺寸均為 AI Estimated Area。'+GOLDEN_LEAF_DESIGN.proportionNote});
 // Circular garden podium, with a real glazed lobby beneath the tower.
 disk(b,0,0,0,64,'minecraft:stone_bricks','Foundation');disk(b,0,0,1,64,Q,'Floor');
 for(let y=2;y<=11;y++){ring(b,0,0,y,46,y===11?W:C,'Podium facade');for(let a=0;a<16;a++){const angle=a*Math.PI/8;b.set(Math.round(46*Math.cos(angle)),y,Math.round(46*Math.sin(angle)),a%2===0?W:G,'Podium ribs');}}
 disk(b,0,0,12,48,Q,'Floor');ring(b,0,0,13,48,W,'Podium ledge');
 for(let y=13;y<=202;y++){
  const r=radius(y),t=(y-13)/189;
  const frontAngle=(23+24*Math.sin(Math.PI*t)) *Math.PI/180;
  const rearWidth=t>.23?.36*Math.sin(Math.PI*(t-.23)/.77):0;
  for(let x=-Math.ceil(r+2);x<=Math.ceil(r+12);x++)for(let z=-Math.ceil(r+2);z<=Math.ceil(r+2);z++){
   const shell=section(y,x>0),d=Math.hypot(x-shell.cx,z);if(shell.r===0||d<shell.r-1.7||d>shell.r+.5)continue;
   const front=Math.abs(Math.atan2(x-shell.cx,-z))<frontAngle;
   const rear=z>0&&Math.abs(x)<r*rearWidth;
   const boundary=front?Math.abs(Math.abs(Math.atan2(x,-z))-frontAngle)<.08:rear?Math.abs(Math.abs(x)-r*rearWidth)<1.3:false;
   b.set(x,y,z,boundary?W:front||rear?C:G,front?'Front glazing':rear?'Rear opening':'Golden petal shell');
  }
  // Separate projecting petal seams curl around the back; their crossing is gold, never a rear X brace.
  for(const side of [-1,1]){const angle=side*(.25+1.1*t),x=Math.round((r+1)*Math.sin(angle)),z=Math.round((r+1)*Math.cos(angle));if(!(x>0&&y>145))b.set(x,y,z,G,'Overlapping rear petal seam');}
  if(y>=58&&y<=190)b.set(0,y,Math.round(r)+1,W,'Rear central spine');
  if((y-13)%6===0&&y<=175){
   for(let x=-Math.ceil(r);x<=Math.ceil(r+10);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){const floor=section(y,x>0);if(Math.hypot(x-floor.cx,z)<=floor.r-1.5)b.set(x,y,z,Q,'Floor');}
   for(let x=-Math.floor(r);x<=Math.floor(r);x++){const slice=section(y,x>0);if(Math.abs(x-slice.cx)>slice.r)continue;const zz=-Math.round(Math.sqrt(Math.max(0,slice.r*slice.r-(x-slice.cx)**2)));if(Math.abs(Math.atan2(x,-zz))<frontAngle)b.set(x,y,zz-1,W,'Front floor ledge');
    const zr=-zz;if(t>.23&&Math.abs(x)<r*rearWidth)b.set(x,y,zr+1,W,'Rear window ledge');}
   for(const x of [-8,8]){b.set(x,y+1,-7,'minecraft:bookshelf','Interior');b.set(x,y+1,7,'minecraft:sea_lantern','Interior lighting');}
   b.set(7,y+1,0,'minecraft:crafting_table','Interior');
  }
  // Broad front window edged by white curving structural ribbons.
  for(const side of [-1,1]){const petal=section(y,side>0),x=Math.round(petal.cx+side*petal.r*Math.sin(frontAngle)),z=-Math.round(petal.r*Math.cos(frontAngle));if(petal.r>0)for(let w=0;w<2;w++)b.set(x+side*w,y,z,W,'Front leaf edge');}
  for(const fraction of [-.44,0,.44])if(y<=181){const rib=section(y,fraction>0),x=Math.round(rib.cx+rib.r*fraction),z=-Math.round(Math.sqrt(Math.max(0,rib.r*rib.r-(x-rib.cx)**2)))-1;b.set(x,y,z,W,'Front vertical rib');}
 }
 // Two crossing structural diagonals belong exclusively to the lower FRONT glazing.
 for(let y=14;y<=82;y++){const r=radius(y);for(const side of [-1,1]){const x=Math.round(side*(y-48)*.58),z=-Math.round(Math.sqrt(Math.max(0,r*r-x*x)))-2;for(let w=0;w<2;w++)b.set(x+w,y,z,W,'Front lower X brace');}}
 // Asymmetric terminal petals are individually built rather than mirrored caps.
 for(let y=185;y<=202;y++){const x=-Math.max(0,Math.round((202-y)*.12));b.set(x,y,0,G,'Tall leaf tip');if(y<199)b.set(x-1,y,0,G,'Tall leaf tip');}
 for(let y=176;y<=184;y++)b.set(Math.round(section(y,true).cx),y,0,G,'Short leaf tip');
 // A single raised diagonal lap edge crosses the lower rear petal toward its pointed window.
 for(let y=15;y<=67;y++){const r=radius(y),x=Math.round(-r*.82*(1-(y-15)/52)),z=Math.round(Math.sqrt(Math.max(0,r*r-x*x)))+2;for(let w=-1;w<=1;w++)b.set(x+w,y,z,w===0?W:G,'Rear diagonal petal overlap');}
 // Twin cylindrical annexes, each with a planted roof and an accessible inside connection.
 for(const cx of [-48,48]){
  disk(b,cx,-20,1,16,Q,'Floor');
  for(let y=2;y<=16;y++){ring(b,cx,-20,y,15,C,'Annex glazing');for(let a=0;a<10;a++){const angle=a*Math.PI/5;b.set(cx+Math.round(15*Math.cos(angle)),y,-20+Math.round(15*Math.sin(angle)),W,'Annex column');}}
  disk(b,cx,-20,17,16,Q,'Annex roof');ring(b,cx,-20,18,16,W,'Annex roof rim');
  for(let dx=-8;dx<=8;dx+=4)for(let dz=-7;dz<=7;dz+=4)if(dx*dx+dz*dz<75){b.set(cx+dx,18,-20+dz,'minecraft:dirt','Planter');b.set(cx+dx,19,-20+dz,'minecraft:oak_leaves','Roof garden',leaves);}
  b.tree(cx,18,-20);
  // Short interior annex stair, with a supported six-wide approach at ground level.
  for(let step=0;step<16;step++){const z=-28+step,x=cx+5;for(let w=0;w<2;w++){b.set(x+w,1+step,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x+w,1+step+h,z);}}
  const from=cx<0?cx+13:33,to=cx<0?-33:cx-13;b.floor(from,-23,to,-17,1);for(let x=from;x<=to;x++)for(let z=-22;z<=-18;z++)for(let y=2;y<=5;y++)b.clear(x,y,z);
 }
 // Ring gardens leave front and rear entrance axes clear.
 for(let angle=0;angle<360;angle+=6){const a=angle*Math.PI/180,x=Math.round(58*Math.sin(a)),z=Math.round(58*Math.cos(a));if(Math.abs(x)<6||Math.hypot(x-48,z+20)<19||Math.hypot(x+48,z+20)<19)continue;b.set(x,2,z,'minecraft:dirt','Planter');b.set(x,3,z,angle%18===0?'minecraft:pink_tulip':'minecraft:oak_leaves','Garden',angle%18===0?{}:leaves);if(angle%30===0)b.set(x,3,z,'minecraft:sea_lantern','Garden lighting');}
 // Dense planted beds, clipped hedges and warm lights make the base a garden rather than isolated cubes.
 for(let x=-61;x<=61;x++)for(let z=-61;z<=61;z++){
  const d=Math.hypot(x,z);if(d<52||d>61||Math.abs(x)<7||Math.hypot(x-48,z+20)<19||Math.hypot(x+48,z+20)<19)continue;
  b.set(x,2,z,'minecraft:dirt','Dense planted bed');
  if(d>59||d<53)b.set(x,3,z,'minecraft:oak_leaves','Clipped hedge',leaves);
  else if((x+2*z)%5!==0)b.set(x,3,z,'minecraft:oak_leaves','Dense groundcover',leaves);
  else b.set(x,3,z,'minecraft:pink_tulip','Garden flowers');
 }
 for(const [x,z]of[[-36,39],[36,39],[-43,-37],[43,-37]]as const){b.set(x,2,z,'minecraft:dirt','Tree bed');b.tree(x,3,z);}
 for(const cx of [-48,48])for(let dx=-14;dx<=14;dx++)for(let dz=-14;dz<=14;dz++){
  const d=Math.hypot(dx,dz);if(d<8||d>14||(dx>=4&&dx<=7&&dz>=-8))continue;
  b.set(cx+dx,18,-20+dz,'minecraft:dirt','Annex planted bed');b.set(cx+dx,19,-20+dz,(dx+dz)%7===0?'minecraft:pink_tulip':'minecraft:oak_leaves','Annex hedge',(dx+dz)%7===0?{}:leaves);
 }
 for(let angle=15;angle<360;angle+=30){const a=angle*Math.PI/180,x=Math.round(51*Math.sin(a)),z=Math.round(51*Math.cos(a));if(Math.abs(x)<7)continue;b.set(x,2,z,Q,'Garden lamp pedestal');b.set(x,3,z,'minecraft:lantern','Warm garden lamp');}
 for(const cx of [-48,48])for(const [dx,dz]of[[-12,0],[12,0],[0,-12],[0,12]]as const){b.set(cx+dx,18,-20+dz,Q,'Roof lamp pedestal');b.set(cx+dx,19,-20+dz,'minecraft:lantern','Warm roof lamp');} stairCore(b);
 // Open the podium and lower tower at ground level; retain the central stair flights.
 for(const side of [-1,1]){b.floor(-4,side<0?-64:5,4,side<0?-5:64,1);for(let x=-3;x<=3;x++)for(let z=side<0?-64:5;z<=(side<0?-5:64);z++)for(let y=2;y<=5;y++)b.clear(x,y,z);}
 // Logical pairs are placed only after all geometric carving.
 b.floor(-6,-69,6,-60,0,'minecraft:stone_bricks');
 for(let i=0;i<4;i++)for(let x=-5;x<=5;x++){const z=-68+i;for(let y=1;y<=i;y++)b.set(x,y,z,Q,'Entrance stair support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 b.floor(-5,-64,5,-30,4);for(let x=-4;x<=4;x++)for(let z=-64;z<=-27;z++)for(let y=5;y<=8;y++)b.clear(x,y,z);
 for(let i=0;i<3;i++)for(let x=-4;x<=4;x++){b.set(x,3-i,-29+i,'minecraft:quartz_stairs','Circulation',{facing:'north'});for(let h=1;h<=3;h++)b.clear(x,3-i+h,-29+i);}
 b.door(-1,5,-46,'north');b.door(1,5,-46,'north');
 // Friendly labels remain categories; persistence identifiers use deterministic ASCII slugs.
 return b.finishParts().map(part=>({...part,project:{...part.project,blocks:part.project.blocks.map(block=>({...block,constructionPhaseId:'golden-leaf:'+block.constructionPhaseId!.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}))}}));
}





