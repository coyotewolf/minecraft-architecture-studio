import type { Project } from '../../core/contracts.ts';
import { getRegistryEntry } from '../../core/versioned-registry.ts';

/** A layer action includes every member of any logical structure it touches. */
export function layerMembers(project: Project, layer: number): string[] {
  const selected = new Set(project.blocks.filter(b => b.pos.y === layer).map(b => b.uid));
  for (const group of project.logicalStructures) if (group.memberUids.some(uid => selected.has(uid)))
    for (const uid of group.memberUids) selected.add(uid);
  return [...selected].sort();
}
export function toggleLayerCompletion(project: Project, layer: number, completed: readonly string[]): string[] {
  const members = layerMembers(project, layer), next = new Set(completed);
  const remove = members.length > 0 && members.every(uid => next.has(uid));
  for (const uid of members) { if (remove) next.delete(uid); else next.add(uid); }
  return [...next].sort();
}
/** Inventory ownership follows the canonical logical anchor, even across categories. */
export function materialCategories(project: Project): Map<string, { category: string; count: number }[]> {
  const anchors = new Map(project.logicalStructures.map(group => [group.uid, group.anchorUid]));
  const totals = new Map<string, Map<string, number>>();
  for (const block of project.blocks) {
    const rule = getRegistryEntry(block.id).inventory;
    if (rule.kind === 'unresolved') continue;
    if (rule.kind === 'logical_structure' && anchors.get(block.logicalStructureId ?? '') !== block.uid) continue;
    const count = rule.kind === 'slab' ? (block.state.type === 'double' ? 2 : 1) : rule.kind === 'per_cell' ? rule.count : 1;
    const category = block.category || '未分類', categories = totals.get(rule.itemId) ?? new Map<string, number>();
    categories.set(category, (categories.get(category) ?? 0) + count); totals.set(rule.itemId, categories);
  }
  return new Map([...totals].map(([id, categories]) => [id, [...categories].map(([category, count]) => ({ category, count }))
    .sort((a,b) => b.count-a.count || a.category.localeCompare(b.category))]));
}
const names: Readonly<Record<string,string>> = { 'minecraft:smooth_quartz':'平滑石英','minecraft:quartz_stairs':'石英階梯','minecraft:cyan_stained_glass':'青色玻璃','minecraft:light_blue_stained_glass':'淺藍色玻璃','minecraft:polished_deepslate':'拋光深板岩','minecraft:white_concrete':'白色混凝土','minecraft:oak_leaves':'橡木樹葉','minecraft:sea_lantern':'海燈籠','minecraft:yellow_terracotta':'黃色陶土','minecraft:stone':'石頭','minecraft:stone_bricks':'石磚','minecraft:cobblestone':'鵝卵石','minecraft:oak_planks':'橡木材','minecraft:oak_log':'橡木原木','minecraft:oak_stairs':'橡木階梯','minecraft:oak_slab':'橡木半磚','minecraft:oak_door':'橡木門','minecraft:glass':'玻璃','minecraft:red_bed':'紅色床','minecraft:dirt':'泥土','minecraft:grass_block':'草地','minecraft:bricks':'紅磚','minecraft:torch':'火把' };
export function materialName(id: string): string { return names[id] ?? id.replace('minecraft:', '').replaceAll('_', ' '); }
const categories: Readonly<Record<string,string>> = { foundation:'基礎',floor:'樓板',roof:'屋頂',wall:'牆面',walls:'牆面',structure:'結構',decoration:'裝飾',decor:'裝飾',window:'窗戶',windows:'窗戶',door:'門',stairs:'樓梯',landscape:'植栽景觀' };
export function categoryName(category: string): string { return categories[category.toLowerCase()] ?? category; }
