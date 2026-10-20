import type {District} from '../campus/builder.ts';
import {HighDetailBuilder} from '../campus/high-detail.ts';
import type {MinecraftId, Project} from '../../core/contracts.ts';

export const GOLDEN_LEAF_DESIGN={id:'golden-leaf-tower',front:'negative-z',nominalTowerDiameter:100,nominalTowerHeight:200,towerBaseY:13,highestY:213,floorPitch:7,floorCount:26,referenceInspiredAspect:1090/620,chosenAspect:200/100,proportionNote:'以兩張參考圖估計塔身約 1090/620≈1.76，本設計 200/100=2.0，稍微加高收窄約14%。基座直徑140格。尺寸、隱藏面與內部均為 AI Estimated Area。'} as const;
const W:MinecraftId='minecraft:white_concrete',Q:MinecraftId='minecraft:smooth_quartz',G:MinecraftId='minecraft:gold_block',C:MinecraftId='minecraft:blue_stained_glass';
const FRAME:MinecraftId='minecraft:light_gray_concrete',SLAB:MinecraftId='minecraft:smooth_stone_slab';
const leaves={persistent:'true',distance:'1'};
const profile=[[13,30],[40,43],[75,50],[105,48],[140,40],[170,27],[190,15],[206,5],[213,.7]] as const;
function smooth(t:number){return t*t*(3-2*t);}
/** Round sections with a smoothly lowered right petal crown, not an extruded lens. */
function profileRadius(y:number){
 if(y>213)return 0;
 const slope=(i:number)=>{if(i===0)return (profile[1]![1]-profile[0]![1])/(profile[1]![0]-profile[0]![0]);if(i===profile.length-1)return (profile[i]![1]-profile[i-1]![1])/(profile[i]![0]-profile[i-1]![0]);const left=(profile[i]![1]-profile[i-1]![1])/(profile[i]![0]-profile[i-1]![0]),right=(profile[i+1]![1]-profile[i]![1])/(profile[i+1]![0]-profile[i]![0]);return left*right<=0?0:2*left*right/(left+right);};
 for(let i=1;i<profile.length;i++){const [a,ra]=profile[i-1]!,[z,rz]=profile[i]!;if(y<=z){const t=Math.max(0,(y-a)/(z-a)),h=z-a;return (2*t**3-3*t*t+1)*ra+(t**3-2*t*t+t)*h*slope(i-1)+(-2*t**3+3*t*t)*rz+(t**3-t*t)*h*slope(i);}}
 return .7;
}
function radius(y:number,angle=0){
 if(y<=145||Math.sin(angle)<1e-6)return profileRadius(y);
 const t=smooth(Math.max(0,Math.min(1,(y-145)/48))),cx=12*t,r=profileRadius(y+20*t);
 if(y>193)return 0;
 const discriminant=r*r-cx*cx*Math.cos(angle)**2;
 return discriminant<0?0:cx*Math.sin(angle)+Math.sqrt(discriminant);
}
function opening(y:number,rear=false){const t=(y-13)/200;return rear?(y<63?0:.48*Math.pow(Math.sin(Math.PI*Math.min(1,(y-63)/147)),.85)):.48+.34*Math.sin(Math.PI*Math.min(1,t*1.13));}
function disk(b:HighDetailBuilder,cx:number,cz:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(cx-r);x<=Math.floor(cx+r);x++)for(let z=Math.ceil(cz-r);z<=Math.floor(cz+r);z++)if((x-cx)**2+(z-cz)**2<=r*r)b.set(x,y,z,id,category);}
function ring(b:HighDetailBuilder,cx:number,cz:number,y:number,r:number,id:MinecraftId,category:string){for(let x=Math.ceil(cx-r);x<=Math.floor(cx+r);x++)for(let z=Math.ceil(cz-r);z<=Math.floor(cz+r);z++){const d=Math.hypot(x-cx,z-cz);if(d<=r&&d>r-1.3)b.set(x,y,z,id,category);}}
function stairCore(b:HighDetailBuilder){
 for(let step=0;step<5;step++)for(let x=1;x<=2;x++){const y=step+1,z=1-step;for(let h=1;h<=4;h++)b.clear(x,y+h,z);b.set(x,y,z,'minecraft:quartz_stairs','Circulation',{facing:'north'});}
 b.floor(-2,-4,2,-4,6);
 for(let base=6;base<188;base+=7){const reverse=((base-6)/7)%2===1;
  for(let i=0;i<7;i++){const x=reverse?1:-2,z=reverse?3-i:i-3,y=base+i;
   for(let w=0;w<2;w++){for(let h=1;h<=4;h++)b.clear(x+w,y+h,z);b.set(x+w,y,z,'minecraft:quartz_stairs','Circulation',{facing:reverse?'north':'south',half:'bottom',shape:'straight'});}}
  b.floor(-2,reverse?-4:4,2,reverse?-4:4,base+7);
 }
}
function buildGoldenLeaf(){
 const b=new HighDetailBuilder({id:GOLDEN_LEAF_DESIGN.id,title:'金色葉塔',origin:[0,0,0],references:['golden-leaf-front','golden-leaf-rear'],features:['灰色外骨架、內退五格藍玻璃、半磚露台及白色葉緣','圓形截面、前方下段 X 撐、後方立體覆疊金葉與窄窗','26層樓板、連續樓梯、雙圓形附樓與花園'],notes:GOLDEN_LEAF_DESIGN.proportionNote});
 disk(b,0,0,0,70,'minecraft:stone_bricks','Foundation');disk(b,0,0,1,70,Q,'Floor');
 for(let y=2;y<=17;y++){ring(b,0,0,y,48,y===17?W:C,'Podium facade');for(let a=0;a<20;a++){const angle=a*Math.PI/10;for(let w=-1;w<=1;w++)b.set(Math.round(48*Math.cos(angle))+w,y,Math.round(48*Math.sin(angle)),a%2===0?Q:'minecraft:glowstone','Podium ribs');}}
 disk(b,0,0,18,50,Q,'Floor');ring(b,0,0,19,50,W,'Podium ledge');
 for(let y=13;y<=213;y++){
  const r=radius(y),frontAngle=Math.asin(opening(y)),rearAngle=Math.asin(opening(y,true));
  const isFloor=(y-13)%7===0&&y<=188;
  for(let x=-Math.ceil(r+3);x<=Math.ceil(r+3);x++)for(let z=-Math.ceil(r+3);z<=Math.ceil(r+3);z++){
   const theta=Math.atan2(x,-z),a=Math.abs(theta),outer=radius(y,theta),d=Math.hypot(x,z);
   if(outer<.5)continue;
   const front=a<frontAngle,rear=Math.PI-a<rearAngle,window=front||rear;
   // The lower rear petal is a volumetric overlapping shell, displaced outward on one side of its diagonal lap.
   const seam=-28+(y-13)*.55;
   const lap=z>0&&x>seam?2.5:0;
   if((!window||outer<5)&&d>=Math.max(0,outer-2)&&d<=outer+lap)b.set(x,y,z,G,lap?'Rear overlapping petal':'Golden petal shell');
   if(window&&outer>=6&&d>=outer-6&&d<=outer-5)b.set(x,y,z,C,front?'Front recessed glazing':'Rear recessed glazing');
   const capT=smooth(Math.max(0,Math.min(1,(y-145)/48))),capInside=x<=0||y<=145||Math.hypot(x-12*capT,z)<profileRadius(y+20*capT)-5.5;
   if(isFloor&&d<outer-5.5&&capInside)b.set(x,y,z,Q,'Floor');
   // Slabs span the deep reveal from the glass to the projecting exterior frame.
   if(isFloor&&window&&outer>=10&&d>=outer-5.8&&d<=outer+1.5)b.set(x,y,z,SLAB,front?'Front slab ledge':'Rear slab ledge',{type:'top'});
  }
  // Thick white quartz reveals line the gold aperture, distinct from the gray external frame.
  for(const rear of [false,true]){const a=rear?rearAngle:frontAngle;if(a<=0)continue;
   for(const side of [-1,1]){const theta=rear?side*(Math.PI-a):side*a,rr=radius(y,theta);
    if(rr<5)continue;
    for(let depth=0;depth<=Math.min(5,Math.floor(rr-2));depth++)for(let width=-1;width<=1;width++){
     const x=Math.round((rr-depth)*Math.sin(theta))+width,z=-Math.round((rr-depth)*Math.cos(theta));
     b.set(x,y,z,Q,rear?'Rear white leaf reveal':'Front white leaf reveal');
    }
   }
  }
  // Two exterior uprights, on a larger radius than the glazing. They merge gradually toward the apex.
  if(y<=188)for(const f of [-.43,.43]){const theta=Math.asin(opening(y)*f),rr=radius(y,theta)+1;
   for(let w=-1;w<=1;w++)b.set(Math.round(rr*Math.sin(theta))+w,y,-Math.round(rr*Math.cos(theta)),FRAME,'Front exterior upright');
  }
  if(y>=64&&y<=205)b.set(0,y,Math.round(radius(y))+1,Q,'Rear central spine');
  if(isFloor){
   for(const rear of [false,true]){const a=rear?rearAngle:frontAngle;if(a<=.02)continue;
    for(const side of [-1,1]){const theta=rear?side*(Math.PI-a*.83):side*a*.91,rr=radius(y,theta)+.7;if(rr<10)continue;
     b.set(Math.round(rr*Math.sin(theta)),y,-Math.round(rr*Math.cos(theta)),'minecraft:glowstone','Facade ledge light');
    }
   }
   if(r>10){b.set(-7,y+1,0,'minecraft:bookshelf','Interior');b.set(7,y+1,0,'minecraft:crafting_table','Interior');b.set(0,y+1,8,'minecraft:lantern','Interior lighting');}
  }
 }
 // Front lower X sits outside both glass and floor edges and joins the uprights at its shoulders.
 for(let y=14;y<=84;y++)for(const side of [-1,1]){
  const x=Math.round(side*(y-48)*.45),theta=Math.asin(Math.max(-.95,Math.min(.95,x/radius(y)))),z=-Math.round(Math.sqrt(Math.max(0,(radius(y,theta)+2)**2-x*x)));
  for(let w=-1;w<=1;w++)b.set(x+w,y,z,FRAME,'Front lower X brace');
 }
 // Raised diagonal lap: an actual displaced gold shell above, with a narrow white seam tracing its edge.
 for(let y=13;y<=64;y++){const x=Math.round(-28+(y-13)*.55),r=radius(y),z=Math.round(Math.sqrt(Math.max(0,r*r-x*x)))+2;
  b.set(x,y,z,Q,'Rear diagonal petal overlap');b.set(x+1,y,z,G,'Rear diagonal petal overlap');
 }
 b.set(0,213,0,G,'Tall leaf tip');
 for(let y=190;y<=193;y++)disk(b,12,0,y,Math.max(.7,(194-y)*.8),G,'Short leaf tip');
 // Twin cylindrical annexes, each with a planted roof and an accessible inside connection.
 for(const cx of [-54,54]){
  disk(b,cx,-20,1,16,Q,'Floor');
  for(let y=2;y<=23;y++){ring(b,cx,-20,y,15,C,'Annex glazing');for(let a=0;a<10;a++){const angle=a*Math.PI/5;b.set(cx+Math.round(15*Math.cos(angle)),y,-20+Math.round(15*Math.sin(angle)),W,'Annex column');}}
  disk(b,cx,-20,24,16,Q,'Annex roof');ring(b,cx,-20,25,16,W,'Annex roof rim');
  for(let dx=-8;dx<=8;dx+=4)for(let dz=-7;dz<=7;dz+=4)if(dx*dx+dz*dz<75){b.set(cx+dx,25,-20+dz,'minecraft:dirt','Planter');b.set(cx+dx,26,-20+dz,'minecraft:oak_leaves','Roof garden',leaves);}
  b.tree(cx,25,-20);
  // Short interior annex stair, with a supported six-wide approach at ground level.
  for(let step=0;step<23;step++){const z=-28+step,x=cx+5;for(let w=0;w<2;w++){b.set(x+w,1+step,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x+w,1+step+h,z);}}
  const from=cx<0?cx+13:33,to=cx<0?-33:cx-13;b.floor(from,-23,to,-17,1);for(let x=from;x<=to;x++)for(let z=-22;z<=-18;z++)for(let y=2;y<=5;y++)b.clear(x,y,z);
 }
 // Ring gardens leave front and rear entrance axes clear.
 for(let angle=0;angle<360;angle+=6){const a=angle*Math.PI/180,x=Math.round(64*Math.sin(a)),z=Math.round(64*Math.cos(a));if(Math.abs(x)<6||Math.hypot(x-54,z+20)<19||Math.hypot(x+54,z+20)<19)continue;b.set(x,2,z,'minecraft:dirt','Planter');b.set(x,3,z,angle%18===0?'minecraft:pink_tulip':'minecraft:oak_leaves','Garden',angle%18===0?{}:leaves);if(angle%30===0)b.set(x,3,z,'minecraft:sea_lantern','Garden lighting');}
 // Dense planted beds, clipped hedges and warm lights make the base a garden rather than isolated cubes.
 for(let x=-67;x<=67;x++)for(let z=-67;z<=67;z++){
  const d=Math.hypot(x,z);if(d<57||d>67||Math.abs(x)<7||Math.hypot(x-54,z+20)<19||Math.hypot(x+54,z+20)<19)continue;
  b.set(x,2,z,'minecraft:dirt','Dense planted bed');
  if(d>65||d<59)b.set(x,3,z,'minecraft:oak_leaves','Clipped hedge',leaves);
  else if((x+2*z)%5!==0)b.set(x,3,z,'minecraft:oak_leaves','Dense groundcover',leaves);
  else b.set(x,3,z,'minecraft:pink_tulip','Garden flowers');
 }
 for(const [x,z]of[[-36,39],[36,39],[-43,-37],[43,-37]]as const){b.set(x,2,z,'minecraft:dirt','Tree bed');b.tree(x,3,z);}
 for(const cx of [-54,54])for(let dx=-14;dx<=14;dx++)for(let dz=-14;dz<=14;dz++){
  const d=Math.hypot(dx,dz);if(d<8||d>14||(dx>=4&&dx<=7&&dz>=-8))continue;
  b.set(cx+dx,25,-20+dz,'minecraft:dirt','Annex planted bed');b.set(cx+dx,26,-20+dz,(dx+dz)%7===0?'minecraft:pink_tulip':'minecraft:oak_leaves','Annex hedge',(dx+dz)%7===0?{}:leaves);
 }
 for(let angle=15;angle<360;angle+=30){const a=angle*Math.PI/180,x=Math.round(56*Math.sin(a)),z=Math.round(56*Math.cos(a));if(Math.abs(x)<7)continue;b.set(x,2,z,Q,'Garden lamp pedestal');b.set(x,3,z,'minecraft:lantern','Warm garden lamp');}
 for(const cx of [-54,54])for(const [dx,dz]of[[-12,0],[12,0],[0,-12],[0,12]]as const){b.set(cx+dx,25,-20+dz,Q,'Roof lamp pedestal');b.set(cx+dx,26,-20+dz,'minecraft:lantern','Warm roof lamp');} stairCore(b);
 // The broad podium roof is a planted terrace, visible between the gold petals and annexes.
 for(let angle=0;angle<360;angle+=30){const a=angle*Math.PI/180,x=Math.round(41*Math.sin(a)),z=Math.round(41*Math.cos(a));
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){b.set(x+dx,19,z+dz,'minecraft:dirt','Podium roof planter');b.set(x+dx,20,z+dz,'minecraft:oak_leaves','Podium roof shrub',leaves);if(Math.abs(dx)+Math.abs(dz)<3)b.set(x+dx,21,z+dz,'minecraft:oak_leaves','Podium roof shrub',leaves);}
  b.set(x+3,19,z,Q,'Roof lamp pedestal');b.set(x+3,20,z,'minecraft:lantern','Warm roof lamp');
 }
 for(let angle=15;angle<360;angle+=30){const a=angle*Math.PI/180,x=Math.round(63*Math.sin(a)),z=Math.round(63*Math.cos(a));if(Math.hypot(x-54,z+20)<18||Math.hypot(x+54,z+20)<18)continue;
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){b.set(x+dx,2,z+dz,'minecraft:dirt','Garden shrub bed');b.set(x+dx,3,z+dz,'minecraft:oak_leaves','Garden shrub',leaves);if(Math.abs(dx)+Math.abs(dz)<3)b.set(x+dx,4,z+dz,'minecraft:oak_leaves','Garden shrub',leaves);}
 }
 // Open the podium and lower tower at ground level; retain the central stair flights.
 for(const side of [-1,1]){b.floor(-4,side<0?-64:5,4,side<0?-5:64,1);for(let x=-3;x<=3;x++)for(let z=side<0?-64:5;z<=(side<0?-5:64);z++)for(let y=2;y<=5;y++)b.clear(x,y,z);}
 // Logical pairs are placed only after all geometric carving.
 b.floor(-6,-69,6,-60,0,'minecraft:stone_bricks');
 for(let i=0;i<4;i++)for(let x=-5;x<=5;x++){const z=-68+i;for(let y=1;y<=i;y++)b.set(x,y,z,Q,'Entrance stair support');b.set(x,i+1,z,'minecraft:quartz_stairs','Circulation',{facing:'south'});for(let h=1;h<=3;h++)b.clear(x,i+1+h,z);}
 b.floor(-5,-64,5,-30,4);for(let x=-4;x<=4;x++)for(let z=-64;z<=-27;z++)for(let y=5;y<=8;y++)b.clear(x,y,z);
 for(let i=0;i<3;i++)for(let x=-4;x<=4;x++){b.set(x,3-i,-29+i,'minecraft:quartz_stairs','Circulation',{facing:'north'});for(let h=1;h<=3;h++)b.clear(x,3-i+h,-29+i);}
 b.door(-1,5,-46,'north');b.door(1,5,-46,'north');
 return b;
}
function phaseIds(project:Project):Project{return {...project,blocks:project.blocks.map(block=>({...block,constructionPhaseId:'golden-leaf:'+block.category!.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}))};}
/** One complete building is the editable project; parts are only a legacy export bridge. */
export function createGoldenLeafProject():Project{return phaseIds(buildGoldenLeaf().finishProject());}
export function createGoldenLeafParts():District[]{return buildGoldenLeaf().finishParts().map(part=>({...part,project:phaseIds(part.project)}));}




