import { parseProject } from '../../core/model.ts';
import type { MinecraftId } from '../../core/contracts.ts';
import { DistrictBuilder, type District } from './builder.ts';

const white: MinecraftId = 'minecraft:white_concrete';
const glass: MinecraftId = 'minecraft:cyan_stained_glass';
const gold: MinecraftId = 'minecraft:gold_block';
const dark: MinecraftId = 'minecraft:gray_concrete';

function ellipse(b: DistrictBuilder, cx: number, y: number, rx: number, rz: number, floor: boolean) {
  for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) for (let z = -Math.ceil(rz); z <= Math.ceil(rz); z++) {
    const q = x * x / (rx * rx) + z * z / (rz * rz);
    if (q > 1) continue;
    const edge = (Math.abs(x) + 1) ** 2 / (rx * rx) + z * z / (rz * rz) > 1 || x * x / (rx * rx) + (Math.abs(z) + 1) ** 2 / (rz * rz) > 1;
    if (floor || edge) b.set(cx + x, y, z, floor ? 'minecraft:smooth_quartz' : x % 5 === 0 ? white : glass, floor ? 'Floor' : 'Envelope');
  }
}

/** Alternating two-wide flights with a landing at each end. Carve AFTER furnishing. */
function stairs(b: DistrictBuilder, cx: number, bottom: number, top: number) {
  for (let y = bottom; y < top; y += 6) {
    const forward = (y - bottom) / 6 % 2 === 0;
    for (let i = 0; i < 6; i++) {
      const z = forward ? i - 3 : 2 - i;
      for (const x of forward ? [cx - 2, cx - 1] : [cx + 1, cx + 2]) {
        for (let h = 1; h <= 3; h++) b.clear(x, y + i + 1 + h, z);
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

function ringSpire(): District {
  const b = new DistrictBuilder({ id: 'ring-control-spire', title: '環門控制尖塔', origin: [-75, 0, 0], references: ['reference-08'], features: ['左上：白色環門、金色尖頂與深色控制塔', '右上：多層環景控制台', '左下：植栽柱廊與庭院', '右下：折返樓梯與入口'], notes: '依參考圖推估比例；控制台與環門為原版裝飾，不模擬機械或傳送功能。' });
  b.floor(-25, -20, 25, 20, 0, 'minecraft:stone_bricks');
  for (let y = 1; y <= 49; y++) {
    const r = y > 37 ? 9 - Math.floor((y - 37) / 6) : 10;
    ellipse(b, 0, y, r, 9, (y - 1) % 6 === 0 || y % 6 === 0);
    if (y % 6 === 1) room(b, 0, y, 'control');
  }
  for (let y = 4; y <= 52; y++) for (let x = -25; x <= 25; x++) {
    const d = Math.hypot(x, y - 28);
    if (d >= 22 && d <= 24.5) b.box(x, y, 12, x, y, 14, Math.abs(x) > 22 ? gold : white, 'Ring');
  }
  for (let y = 2; y <= 55; y++) {
    const x = Math.max(0, 12 - Math.floor(y / 4));
    b.box(-x, y, -1, -x, y, 1, y > 49 ? gold : white, 'Fin');
    b.box(x, y, -1, x, y, 1, y > 49 ? gold : white, 'Fin');
  }
  for (const x of [-19, 19]) for (const z of [-14, 1, 15]) b.tree(x, 1, z);
  for (const x of [-15, 15]) for (let z = -16; z <= 16; z += 8) b.box(x, 1, z, x, 5, z, white, 'Colonnade');
  b.floor(-15, -17, -13, 17, 6); b.floor(13, -17, 15, 17, 6);
  stairs(b, 0, 1, 49);
  b.box(-1, 1, -12, 1, 1, -8, 'minecraft:smooth_quartz', 'Entry');
  for (let x = -1; x <= 1; x++) for (let y = 2; y <= 4; y++) for (let z = -9; z <= -7; z++) b.clear(x, y, z);
  b.door(0, 2, -9);
  return b.finish();
}

function commandTower(): District {
  const b = new DistrictBuilder({ id: 'teardrop-command', title: '淚滴中央指揮塔', origin: [0, 0, 0], references: ['reference-11'], features: ['左上：金邊淚滴輪廓、玻璃樓層與交叉支架', '右上：挑高中央中庭與折返樓梯', '左下：指揮休息室與地圖牆', '右下：裝飾伺服器列'], notes: '淚滴曲面採整數體素階梯近似；伺服器與地圖牆是裝飾。頂部尖冠不作可居住樓層。' });
  b.floor(-18, -18, 18, 18, 0, 'minecraft:stone_bricks');
  for (let y = 1; y <= 61; y++) {
    const r = y <= 13 ? 12 + y / 4 : y <= 49 ? 16 - (y - 13) / 4 : Math.max(1, 7 * (62 - y) / 13);
    ellipse(b, 0, y, r, r, y <= 49 && ((y - 1) % 6 === 0 || y % 6 === 0));
    const edge = Math.floor(r);
    b.set(-edge, y, 0, gold, 'Rib'); b.set(edge, y, 0, gold, 'Rib');
    if (y <= 43 && y % 6 === 1) room(b, 0, y, y === 31 || y === 37 ? 'library' : 'control');
    if (y <= 37) {
      const x = Math.round(Math.sin(y / 8) * (r - 1));
      const z = -Math.floor(Math.sqrt(Math.max(0, r * r - x * x)));
      b.set(x, y, z, dark, 'Brace'); b.set(-x, y, z, dark, 'Brace');
    }
  }
  b.set(0, 62, 0, gold, 'Crown');
  for (const x of [-9, 9]) for (const z of [-4, 0, 4]) b.box(x, 8, z, x + 1, 10, z, 'minecraft:purple_concrete', 'Server');
  b.box(-4, 3, 10, 4, 5, 10, 'minecraft:cyan_concrete', 'MapWall');
  stairs(b, 0, 1, 49);
  for (let z = -14; z <= -5; z++) { b.set(0, 1, z, 'minecraft:smooth_quartz', 'Entry'); b.clear(0, 2, z); b.clear(0, 3, z); }
  b.door(0, 2, -12);
  return b.finish();
}

function twinTowers(): District {
  const b = new DistrictBuilder({ id: 'twin-residential-library', title: '雙橢圓住宅與圖書塔', origin: [55, 0, 0], references: ['reference-09'], features: ['左上：雙橢圓玻璃塔與空橋', '右上：實驗／展示工作區', '左下：住宅套房、床與收納', '右下：書架閱覽室與植栽交誼區'], notes: '室內樓層及房間按圖推估，左右塔以共享底座及高架空橋連通。' });
  b.floor(-23, -14, 23, 14, 0, 'minecraft:stone_bricks');
  for (const cx of [-12, 12]) {
    const height = cx < 0 ? 44 : 38;
    for (let y = 1; y <= height; y++) {
      const rx = y <= height - 8 ? 10 : Math.max(1, 10 - (y - (height - 8)) * 1.1);
      const rz = y <= height - 8 ? 13 : Math.max(1, 13 - (y - (height - 8)) * 1.4);
      ellipse(b, cx, y, rx, rz, (y - 1) % 6 === 0 || y % 6 === 0);
      if (y <= 31 && y % 6 === 1) room(b, cx, y, cx > 0 ? 'library' : 'home');
    }
    stairs(b, cx, 1, cx < 0 ? 37 : 31);
  }
  for (const y of [1, 19]) {
    b.floor(-4, -2, 4, 2, y);
    for (const z of [-2, 2]) b.box(-4, y + 1, z, 4, y + 2, z, glass, 'Bridge');
    for (let x = -5; x <= 5; x++) for (let h = 1; h <= 3; h++) b.clear(x, y + h, 0);
  }
  for (const x of [-19, 19]) b.tree(x, 1, 9);
  for (const cx of [-12, 12]) for (let z = -14; z <= -5; z++) { b.set(cx, 1, z, 'minecraft:smooth_quartz', 'Entry'); b.clear(cx, 2, z); b.clear(cx, 3, z); }
  for (const y of [1, 7, 13, 19, 25, 31]) { b.bed(-16, y + 1, 4); b.bed(-8, y + 1, 4); }
  b.door(-12, 2, -13); b.door(12, 2, -13);
  return b.finish();
}

function observatory(): District {
  const b = new DistrictBuilder({ id: 'sphere-observatory', title: '球形天文館與玻璃展廊', origin: [-35, 0, 34], references: ['reference-06'], features: ['左上：白金球形天文館與拱頂玻璃廊', '右上：星球展示牆與環形觀景層', '左下：閱覽角及樓梯剖面', '右下：對稱植栽展示廊'], notes: '球面與拱頂為體素近似；星球壁畫及望遠鏡控制台為靜態裝飾。' });
  b.floor(-16, -12, 16, 12, 0, 'minecraft:stone_bricks');
  for (let y = 1; y <= 30; y++) {
    const r = y < 7 ? 8 : Math.max(1, Math.sqrt(Math.max(0, 12 * 12 - (y - 18) ** 2)));
    ellipse(b, -4, y, r, Math.min(11, r), [1, 7, 13, 19, 25].includes(y));
    if ([7, 13, 19].includes(y)) room(b, -4, y, y === 13 ? 'library' : 'control');
    if ([10, 23].includes(y)) for (let x = -Math.floor(r); x <= Math.floor(r); x++) b.set(x - 4, y, -Math.floor(Math.min(11, r) * Math.sqrt(Math.max(0, 1 - x * x / (r * r)))), gold, 'Band');
  }
  b.floor(7, -11, 16, 11, 1);
  for (let z = -11; z <= 11; z++) for (let x = 7; x <= 16; x++) {
    const y = 5 + Math.round(4 * Math.sqrt(Math.max(0, 1 - ((x - 11.5) / 4.5) ** 2)));
    b.set(x, y, z, z % 4 === 0 ? white : glass, 'Gallery');
    if (x === 7 || x === 16) b.box(x, 2, z, x, y - 1, z, glass, 'Gallery');
  }
  for (let z = -8; z <= 8; z += 4) for (const x of [9, 14]) { b.set(x, 2, z, 'minecraft:grass_block', 'Planter'); b.set(x, 3, z, 'minecraft:oak_leaves', 'Planter', { persistent: 'true', distance: '1' }); }
  b.box(-9, 15, 7, 1, 17, 7, 'minecraft:black_concrete', 'PlanetWall');
  for (const [x, id] of [[-7, 'minecraft:blue_concrete'], [-3, 'minecraft:gold_block'], [0, 'minecraft:red_concrete']] as const) b.set(x, 16, 6, id, 'PlanetWall');
  stairs(b, -4, 1, 25);
  for (let x = -4; x <= 12; x++) { b.set(x, 1, 0, 'minecraft:smooth_quartz', 'Entry'); b.clear(x, 2, 0); b.clear(x, 3, 0); }
  for (let z = -12; z <= 0; z++) { b.set(11, 1, z, 'minecraft:smooth_quartz', 'Entry'); b.clear(11, 2, z); b.clear(11, 3, z); }
  b.door(11, 2, -11);
  return b.finish();
}

export function createLandmarkDistricts(): District[] {
  const sphere=observatory();
  const whiteSphere={...sphere,project:parseProject({...sphere.project,blocks:sphere.project.blocks.map(block=>block.category==='Envelope'&&block.pos.y%6!==0?{...block,id:'minecraft:white_concrete',state:{},category:'Walls'}:block)})};
  return [ringSpire(), commandTower(), twinTowers(), whiteSphere];
}
