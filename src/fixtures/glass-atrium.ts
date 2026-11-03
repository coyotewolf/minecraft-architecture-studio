import type { BlockRecord, BlockState, MinecraftId, Project } from '../core/contracts.ts';
import { parseProject } from '../core/model.ts';
import { createEmptyProject } from '../core/project.ts';
import { normalizeBlockState } from '../core/versioned-registry.ts';

/** Hand-authored stepped interpretation of concept art; dimensions are estimates, not a measured reconstruction. */
export function createAtriumProject(): Project {
  const cells = new Map<string, BlockRecord>();
  function add(x: number, y: number, z: number, id: MinecraftId, category: string, state: BlockState = {}, replace = false) {
    const key = [x, y, z].join(',');
    if (cells.has(key) && !replace) throw new Error('Duplicate atrium cell: ' + key);
    cells.set(key, { uid: 'atrium:' + key, id, pos: { x, y, z }, state: normalizeBlockState(id, state),
      category, constructionPhaseId: category,
      source: { origin: 'ai_estimated', confidence: 0.35, referenceRegionId: 'reference-greenhouse' },
      edits: { createdByTransactionId: 'reference-atrium', lastModifiedByTransactionId: 'reference-atrium', userModified: false } });
  }
  for (let x = -16; x <= 16; x++) for (let z = -22; z <= 22; z++) {
    add(x, 0, z, 'minecraft:stone_bricks', 'Foundation');
    add(x, 1, z, Math.abs(x) <= 2 ? 'minecraft:polished_deepslate' : 'minecraft:smooth_quartz', 'Floor');
  }
  // Four small skylight-like floor insets, with a luminous solid foundation immediately below.
  for (const x of [-5, 5]) for (const z of [-15, 15]) {
    add(x, 0, z, 'minecraft:sea_lantern', 'Foundation', {}, true);
    add(x, 1, z, 'minecraft:cyan_stained_glass', 'Floor', {}, true);
  }
  // Steps face inward and sit on the foundation; they deliberately replace edge floor cells.
  for (const z of [-22, 22]) for (let x = -2; x <= 2; x++) {
    add(x, 1, z, 'minecraft:quartz_stairs', 'Floor', { facing: z < 0 ? 'south' : 'north', half: 'bottom', shape: 'straight' }, true);
  }
  for (const x of [-14, 14]) for (let z = -20; z <= 20; z++) for (let y = 2; y <= 7; y++) {
    add(x, y, z, z % 5 === 0 ? 'minecraft:white_concrete' : 'minecraft:cyan_stained_glass', z % 5 === 0 ? 'Structure' : 'Windows');
  }
  function roofY(x: number): number { return 8 + Math.floor(10 * Math.sqrt(Math.max(0, 1 - (x / 14) ** 2))); }
  for (const z of [-20, 20]) for (let x = -13; x <= 13; x++) {
    for (let y = 2; y < roofY(x); y++) {
      if (Math.abs(x) <= 1 && y <= 4) continue;
      const pillar = x % 7 === 0 && Math.abs(x) > 1;
      add(x, y, z, pillar ? 'minecraft:white_concrete' : 'minecraft:light_blue_stained_glass', pillar ? 'Structure' : 'Windows');
    }
  }
  // Horizontal glass treads joined by vertical risers: no slanted glass or filled roof volume.
  for (let x = -14; x <= 14; x++) for (let z = -20; z <= 20; z++) {
    const top = roofY(x);
    const outward = Math.abs(x) === 14 ? 7 : roofY(x + (x < 0 ? -1 : 1));
    const bottom = Math.min(top, outward + 1);
    const rib = z % 10 === 0;
    for (let y = bottom; y <= top; y++) {
      const accent = rib && (x === 0 || Math.abs(x) === 14) && y === top;
      // Facade and roof risers meet in the same cells; the shell intentionally owns the seam.
      add(x, y, z, accent ? 'minecraft:yellow_terracotta' : rib ? 'minecraft:white_concrete' : 'minecraft:cyan_stained_glass', 'Roof', {}, cells.has([x,y,z].join(',')));
    }
  }
  for (const side of [-1, 1]) for (let distance = 7; distance <= 11; distance++) {
    for (let z = -16; z <= 16; z++) {
      if (Math.abs(z) <= 2 || Math.abs(z) === 9) continue;
      const x = side * distance;
      add(x, 2, z, 'minecraft:dirt', 'Landscape');
      add(x, 3, z, 'minecraft:oak_leaves', 'Landscape', { persistent: 'true', distance: '1' });
    }
  }
  for (const x of [-4, 4]) for (const center of [-12, 0, 12]) for (let z = center - 1; z <= center + 1; z++) {
    add(x, 2, z, 'minecraft:oak_stairs', 'Decoration', { facing: x < 0 ? 'west' : 'east', half: 'bottom', shape: 'straight' });
  }
  return parseProject({ ...createEmptyProject('atrium-reference', '玻璃拱廊・參考建築'), designRevision: 'atrium-reference-v1', blocks: [...cells.values()], logicalStructures: [] });
}
