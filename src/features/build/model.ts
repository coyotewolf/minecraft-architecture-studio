import type { BlockRecord, InventorySummary, MinecraftId, Project } from '../../core/contracts.ts';
import { parseProject, stableJson } from '../../core/model.ts';
import { getRegistryEntry, itemStackSize } from '../../core/versioned-registry.ts';

export function inventory(project: Project): InventorySummary {
  const valid = parseProject(project);
  const counts = new Map<MinecraftId, number>();
  const counted = new Set<string>();
  const unresolved: { blockUids: string[]; reason: string }[] = [];
  for (const b of valid.blocks) {
    const rule = getRegistryEntry(b.id).inventory;
    if (rule.kind === 'unresolved') { unresolved.push({ blockUids: [b.uid], reason: '此方塊的放置物品或狀態用量尚未確認：' + b.id }); continue; }
    let quantity = 1;
    if (rule.kind === 'logical_structure') {
      if (!b.logicalStructureId) throw new Error('Missing logical structure');
      if (counted.has(b.logicalStructureId)) continue;
      counted.add(b.logicalStructureId);
    } else if (rule.kind === 'slab') quantity = b.state.type === 'double' ? 2 : 1;
    else quantity = rule.count;
    counts.set(rule.itemId, (counts.get(rule.itemId) ?? 0) + quantity);
  }
  const items = [...counts].sort(([a], [b]) => compare(a, b)).map(([itemId, required]) => {
    const maxStack = itemStackSize(itemId);
    return { itemId, required, maxStack, fullStacks: Math.floor(required / maxStack), remainder: required % maxStack };
  });
  return { designRevision: valid.designRevision, occupiedCells: valid.blocks.length,
    totalInventoryItems: unresolved.length ? null : items.reduce((sum, item) => sum + item.required, 0), items, unresolved };
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function positionOrder(a: BlockRecord, b: BlockRecord): number { return a.pos.y - b.pos.y || a.pos.z - b.pos.z || a.pos.x - b.pos.x || compare(a.uid, b.uid); }
function key(b: BlockRecord, below = false): string { return `${b.pos.x},${b.pos.y - (below ? 1 : 0)},${b.pos.z}`; }
function phase(b: BlockRecord, minimumY: number): [number, string] {
  const category = b.constructionPhaseId ?? b.category ?? '';
  if (/foundation|基礎/i.test(category) || b.pos.y === minimumY) return [0, '基礎'];
  if (/floor|樓板|地板/i.test(category)) return [1, '樓板'];
  if (/roof|屋頂/i.test(category)) return [5, '屋頂'];
  if (/decor|landscape|裝飾|景觀/i.test(category)) return [6, '裝飾與景觀'];
  if (/_door$|_glass|glass|_trapdoor$/.test(b.id)) return [3, '門窗'];
  if (/_stairs$/.test(b.id)) return [4, '樓梯'];
  return [2, '結構'];
}
export interface ConstructionStep { readonly id: string; readonly label: string; readonly blockUids: readonly string[]; readonly warnings: readonly string[] }

/** Conservative occupied-below dependency graph, not a Minecraft physics simulator. */
export function constructionSteps(project: Project): readonly ConstructionStep[] {
  const valid = parseProject(project);
  if (!valid.blocks.length) return [];
  let minimumY = Infinity;
  for (const b of valid.blocks) minimumY = Math.min(minimumY, b.pos.y);
  const units = new Map<string, BlockRecord[]>();
  const owners = new Map<string, string>();
  for (const b of valid.blocks) {
    const id = b.logicalStructureId ? `structure:${b.logicalStructureId}` : `block:${b.uid}`;
    const members = units.get(id) ?? [];
    members.push(b); units.set(id, members); owners.set(key(b), id);
  }
  const nodes = [...units].map(([id, blocks]) => {
    blocks.sort(positionOrder);
    const anchor = blocks[0]!;
    const [rank, label] = phase(anchor, minimumY);
    return { id, blocks, anchor, rank, label, dependencies: new Set<string>(), dependents: [] as string[], warnings: new Set<string>() };
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) for (const b of node.blocks) {
    const support = owners.get(key(b, true));
    if (support && support !== node.id) node.dependencies.add(support);
    if (!support && b.pos.y > minimumY) node.warnings.add('下方沒有設計方塊；可能需要臨時鷹架或側向支撐。');
    if (b.pos.y === minimumY) node.warnings.add('底層地形與承托面尚未驗證。');
    if (/:(sand|red_sand|gravel|.*concrete_powder|.*anvil|dragon_egg|suspicious_sand|suspicious_gravel)$/.test(b.id)) node.warnings.add('受重力影響的方塊：請確認下方為有效承托面。');
    if (/_torch$|:torch$|_button$|_rail$|:rail$|_carpet$|_flower$|_sapling$|_door$|_bed$/.test(b.id)) node.warnings.add('附著面、空間與放置條件需在遊戲中確認。');
  }
  for (const node of nodes) for (const id of node.dependencies) byId.get(id)!.dependents.push(node.id);
  const less = (a: typeof nodes[number], b: typeof nodes[number]) => a.rank - b.rank || positionOrder(a.anchor, b.anchor) || compare(a.id, b.id);
  const heap: typeof nodes = [];
  function push(node: typeof nodes[number]) {
    heap.push(node); let i = heap.length - 1;
    while (i > 0) { const parent = Math.floor((i - 1) / 2); if (less(heap[parent]!, node) <= 0) break; heap[i] = heap[parent]!; i = parent; }
    heap[i] = node;
  }
  function pop() {
    const first = heap[0]!; const last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && less(heap[child + 1]!, heap[child]!) < 0) child++;
        if (less(last, heap[child]!) <= 0) break;
        heap[i] = heap[child]!; i = child;
      }
      heap[i] = last;
    }
    return first;
  }
  for (const node of nodes) if (!node.dependencies.size) push(node);
  const steps: ConstructionStep[] = [];
  while (heap.length) {
    const node = pop();
    steps.push({ id: node.id, label: `${node.label} · Y ${node.anchor.pos.y} · X ${node.anchor.pos.x} / Z ${node.anchor.pos.z}`,
      blockUids: node.blocks.map(b => b.uid), warnings: [...node.warnings].sort(compare) });
    for (const id of node.dependents) { const next = byId.get(id)!; next.dependencies.delete(node.id); if (!next.dependencies.size) push(next); }
  }
  if (steps.length !== nodes.length) throw new Error('Construction dependency cycle');
  return steps;
}
export function reconcileBuild(approved: Project, current: Project, completed: readonly string[]): { added: string[]; changed: string[]; removed: string[]; retainedCompleted: string[] } {
  const before = new Map(approved.blocks.map(b => [b.uid, b]));
  const after = new Map(current.blocks.map(b => [b.uid, b]));
  const added: string[] = [], changed: string[] = [], removed: string[] = [];
  for (const b of current.blocks) {
    const old = before.get(b.uid);
    if (!old) added.push(b.uid);
    else if (old.id !== b.id || key(old) !== key(b) || stableJson(old.state) !== stableJson(b.state)) changed.push(b.uid);
  }
  for (const b of approved.blocks) if (!after.has(b.uid)) removed.push(b.uid);
  const altered = new Set([...changed, ...removed]);
  return { added: added.sort(compare), changed: changed.sort(compare), removed: removed.sort(compare),
    retainedCompleted: [...new Set(completed)].filter(uid => before.has(uid) && after.has(uid) && !altered.has(uid)).sort(compare) };
}
