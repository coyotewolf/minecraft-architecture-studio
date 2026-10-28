import type { BlockPos, BlockRecord, BlockState, EditTransaction, MinecraftId, Project } from '../../core/contracts.ts';
import { coordinateKey } from '../../core/coordinates.ts';
import { MAX_TRANSACTION_CHANGES, parsePosition } from '../../core/model.ts';
import { createPlacement, designDiff } from '../editor/commands.ts';

export const GENERATOR_PALETTES = {
  timber: { label: '木石樓閣', wall: 'minecraft:oak_planks', floor: 'minecraft:spruce_planks', foundation: 'minecraft:stone_bricks', roof: 'minecraft:dark_oak_planks', stair: 'minecraft:spruce_stairs' },
  stone: { label: '石磚塔樓', wall: 'minecraft:stone_bricks', floor: 'minecraft:oak_planks', foundation: 'minecraft:polished_andesite', roof: 'minecraft:deepslate_tiles', stair: 'minecraft:oak_stairs' },
  modern: { label: '現代石英樓閣', wall: 'minecraft:white_concrete', floor: 'minecraft:smooth_quartz', foundation: 'minecraft:stone_bricks', roof: 'minecraft:smooth_quartz_slab', stair: 'minecraft:quartz_stairs' },
} as const;
export interface BuildingRequest {
  width: number; depth: number; floors: number; floorHeight: number;
  origin: BlockPos; palette: keyof typeof GENERATOR_PALETTES;
}
export const DEFAULT_BUILDING: BuildingRequest = { width: 13, depth: 11, floors: 2, floorHeight: 5, origin: { x: 0, y: 0, z: 0 }, palette: 'timber' };
export interface BuildingPreview {
  transaction: EditTransaction;
  dimensions: { width: number; height: number; depth: number };
  materials: { id: MinecraftId; count: number }[];
  blockCount: number;
}

/** Original offline geometry. All coordinates describe a single canonical building. */
export function generateBuilding(project: Project, request: BuildingRequest): BuildingPreview {
  const { width, depth, floors, floorHeight, origin, palette } = request;
  for (const [label, value, min, max] of [['寬度', width, 8, 31], ['深度', depth, 7, 31], ['樓層', floors, 1, 20], ['層高', floorHeight, 4, 8]] as const) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}須為 ${min}–${max} 的整數。`);
  }
  const height = floors * floorHeight + 1;
  if (height > 100) throw new Error('含地基與屋頂的總高度不得超過 100 格。');
  if (floors > 1 && width < floorHeight + 4) throw new Error(`樓梯與平台需要至少 ${floorHeight + 4} 格寬度。`);
  if (!Object.hasOwn(GENERATOR_PALETTES, palette)) throw new Error('請選擇有效的建築材質。');
  parsePosition(origin);
  parsePosition({ x: origin.x + width - 1, y: origin.y + height - 1, z: origin.z + depth - 1 });
  // Reserve the interior too: existing blocks must not obstruct the entrance or stairs.
  if (project.blocks.some(({ pos }) => pos.x >= origin.x && pos.x < origin.x + width && pos.y >= origin.y && pos.y < origin.y + height && pos.z >= origin.z && pos.z < origin.z + depth)) {
    throw new Error('建築範圍內已有方塊；請移動原點，整棟不會覆蓋現有內容。');
  }
  const material = GENERATOR_PALETTES[palette];
  const cells = new Map<string, { pos: BlockPos; id: MinecraftId; state: BlockState }>();
  const put = (x: number, y: number, z: number, id: MinecraftId, state: BlockState = {}) => {
    const pos = { x: origin.x + x, y: origin.y + y, z: origin.z + z };
    cells.set(coordinateKey(pos), { pos, id, state });
    if (cells.size > 5000) throw new Error('整棟超過單次 5,000 個新增方塊限制；請縮小尺寸或減少樓層。');
  };
  const entranceX = Math.floor(width / 2);
  for (let level = 0; level < floors; level++) {
    const base = level * floorHeight;
    for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
      // One open stairwell per floor, with two clear cells above every stair tread.
      if (!(level > 0 && z === 2 && x >= 2 && x <= floorHeight)) put(x, base, z, level ? material.floor : material.foundation);
      if (x !== 0 && z !== 0 && x !== width - 1 && z !== depth - 1) continue;
      for (let dy = 1; dy < floorHeight; dy++) {
        if (level === 0 && z === 0 && x === entranceX && dy <= 2) continue;
        const window = dy === 2 && ((z === 0 || z === depth - 1) ? x > 1 && x < width - 2 && x % 3 === 0 : z > 1 && z < depth - 2 && z % 3 === 0);
        put(x, base + dy, z, window ? 'minecraft:glass' : material.wall);
      }
    }
  }
  for (let level = 0; level < floors - 1; level++) for (let step = 1; step <= floorHeight; step++) {
    put(step + 1, level * floorHeight + step, 2, material.stair, { facing: 'east', half: 'bottom', shape: 'straight', waterlogged: 'false' });
  }
  const roofState: BlockState = palette === 'modern' ? { type: 'bottom', waterlogged: 'false' } : {};
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) put(x, height - 1, z, material.roof, roofState);
  const transactionId = crypto.randomUUID();
  const blocks: BlockRecord[] = [...cells.values()].flatMap(cell => createPlacement(cell.pos, cell.id, cell.state, transactionId).blocks);
  const transaction = designDiff(project, [...project.blocks, ...blocks], project.logicalStructures, 'user', transactionId);
  if (transaction.changes.length + transaction.structures.length > MAX_TRANSACTION_CHANGES) throw new Error('變更超過單次交易限制。');
  const counts = new Map<MinecraftId, number>();
  blocks.forEach(block => counts.set(block.id, (counts.get(block.id) ?? 0) + 1));
  return { transaction, dimensions: { width, height, depth }, blockCount: blocks.length,
    materials: [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id)) };
}
