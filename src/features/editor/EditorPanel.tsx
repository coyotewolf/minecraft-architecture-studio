import { useEffect, useState, type ReactElement } from 'react';
import type { BlockState, MinecraftId } from '../../core/contracts.ts';
import { BLOCK_IDS, getRegistryEntry } from '../../core/versioned-registry.ts';

export type EditorTool = 'select' | 'place' | 'remove' | 'replace' | 'eyedropper';

interface EditorPanelProps {
  tool: EditorTool;
  onTool: (tool: EditorTool) => void;
  blockId: MinecraftId;
  onBlockId: (id: MinecraftId) => void;
  state: BlockState;
  onState: (state: BlockState) => void;
  workY: number;
  onWorkY: (y: number) => void;
  collision: 'cancel' | 'replace' | 'skip';
  onCollision: (policy: 'cancel' | 'replace' | 'skip') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  preview: { valid: boolean; message: string; cells: number } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const paletteNames: Readonly<Record<string, string>> = {
  'minecraft:stone': '石頭', 'minecraft:stone_bricks': '石磚', 'minecraft:oak_planks': '橡木材',
  'minecraft:glass': '玻璃', 'minecraft:oak_door': '橡木門', 'minecraft:red_bed': '紅色床',
  'minecraft:oak_stairs': '橡木階梯', 'minecraft:oak_slab': '橡木半磚',
  'minecraft:white_concrete': '白色混凝土', 'minecraft:oak_log': '橡木原木',
};
const paletteCategories = ['木材', '石材', '玻璃', '門', '階梯', '半磚', '其他'] as const;
type PaletteCategory = typeof paletteCategories[number];
const paletteIdSet = new Set<string>(BLOCK_IDS);
function paletteCategory(id: string): PaletteCategory {
  if (id.endsWith('_stairs')) return '階梯';
  if (id.endsWith('_slab')) return '半磚';
  if (id.endsWith('_door') || id.endsWith('_trapdoor')) return '門';
  if (id.includes('glass')) return '玻璃';
  if (/_(planks|log|wood|stem|hyphae)$/.test(id)) return '木材';
  if (/(stone|bricks|granite|diorite|andesite|deepslate|tuff|calcite|basalt|quartz)/.test(id)) return '石材';
  return '其他';
}
function paletteLabel(id: MinecraftId): string {
  return paletteNames[id] ? paletteNames[id] + ' · ' + id : id;
}
function readPaletteIds(key: string, limit: number): MinecraftId[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? [...new Set(stored.filter((id): id is MinecraftId => typeof id === 'string' && paletteIdSet.has(id)))].slice(0, limit) : [];
  } catch { return []; }
}
function savePaletteIds(key: string, ids: readonly MinecraftId[]): void {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* Palette remains usable when browser storage is unavailable. */ }
}

export function EditorPanel(props: EditorPanelProps): ReactElement {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PaletteCategory | '全部'>('全部');
  const [favorites, setFavorites] = useState<MinecraftId[]>(() => readPaletteIds('studio.palette.favorites', 1000));
  const [recent, setRecent] = useState<MinecraftId[]>(() => readPaletteIds('studio.palette.recent', 8));
  useEffect(() => {
    setRecent(previous => {
      const next = [props.blockId, ...previous.filter(id => id !== props.blockId)].slice(0, 8);
      savePaletteIds('studio.palette.recent', next);
      return next;
    });
  }, [props.blockId]);
  function toggleFavorite() {
    const next = favorites.includes(props.blockId) ? favorites.filter(id => id !== props.blockId) : [...favorites, props.blockId];
    setFavorites(next);
    savePaletteIds('studio.palette.favorites', next);
  }
  const [workYText, setWorkYText] = useState(String(props.workY));
  useEffect(() => { setWorkYText(String(props.workY)); }, [props.workY]);
  const tools: readonly { value: EditorTool; label: string }[] = [
    { value: 'select', label: '選取' }, { value: 'place', label: '放置' },
    { value: 'remove', label: '移除' }, { value: 'replace', label: '替換' },
    { value: 'eyedropper', label: '吸取' },
  ];
  const query = search.trim().toLowerCase();
  const matches = BLOCK_IDS.filter(id => (category === '全部' || paletteCategory(id) === category)
    && (id.includes(query) || id.replaceAll('_', ' ').includes(query) || (paletteNames[id] ?? '').includes(query)));
  const entry = getRegistryEntry(props.blockId);
  const validWorkY = (text: string) => text.trim() !== '' && Number.isInteger(Number(text)) && Math.abs(Number(text)) <= 30_000_000;

  return (
    <section className="editor-panel" aria-label="方塊編輯">
      <h2>方塊編輯</h2>
      <fieldset className="editor-tools">
        <legend>編輯工具</legend>
        {tools.map(({ value, label }) => (
          <label key={value}>
            <input type="radio" name="editor-tool" value={value} checked={props.tool === value}
              onChange={() => props.onTool(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label>方塊搜尋
        <input type="search" value={search} placeholder="輸入中文名稱或 ID，例如 橡木、oak"
          onChange={event => setSearch(event.currentTarget.value)} />
      </label>
      <label>材質分類（依 ID 推定）
        <select aria-label="材質分類" value={category} onChange={event => setCategory(event.currentTarget.value as PaletteCategory | '全部')}>
          <option value="全部">全部</option>
          {paletteCategories.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>方塊種類
        <select aria-label="方塊種類" value={props.blockId} onChange={event => props.onBlockId(event.currentTarget.value as MinecraftId)}>
          {!matches.includes(props.blockId) && <option value={props.blockId}>{paletteLabel(props.blockId)}（目前選用）</option>}
          {matches.map(id => <option key={id} value={id}>{paletteLabel(id)}</option>)}
        </select>
      </label>
      <p role="status">{matches.length ? '符合搜尋：' + matches.length + ' 種方塊' : '找不到符合的方塊；仍保留目前選用的種類。'}</p>
      <div className="palette-shortcuts">
        <p><span className="palette-swatch" data-category={paletteCategory(props.blockId)} aria-hidden="true" />目前選用：{paletteLabel(props.blockId)}</p>
        <button type="button" aria-pressed={favorites.includes(props.blockId)} onClick={toggleFavorite}>{favorites.includes(props.blockId) ? '取消收藏目前方塊' : '收藏目前方塊'}</button>
        <label>收藏方塊<select aria-label="收藏方塊" value="" onChange={event => { if (event.currentTarget.value) props.onBlockId(event.currentTarget.value as MinecraftId); }}>
          <option value="">{favorites.length ? '從收藏選用' : '尚未收藏方塊'}</option>
          {favorites.map(id => <option key={id} value={id}>{paletteLabel(id)}</option>)}
        </select></label>
        <label>最近使用<select aria-label="最近使用方塊" value="" onChange={event => { if (event.currentTarget.value) props.onBlockId(event.currentTarget.value as MinecraftId); }}>
          <option value="">從最近使用選用</option>
          {recent.map(id => <option key={id} value={id}>{paletteLabel(id)}</option>)}
        </select></label>
        <p>色塊僅為材質分類示意，並非遊戲貼圖。中文名稱目前涵蓋常用方塊，其餘顯示完整 ID。</p>
      </div>
      <fieldset className="editor-states">
        <legend>放置方塊狀態</legend>
        {Object.entries(entry.properties).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, values]) => {
          const anchor = key === 'half' && values.includes('lower') && values.includes('upper') ? 'lower'
            : key === 'part' && values.includes('foot') && values.includes('head') ? 'foot' : null;
          return (
            <label key={key}>{key}
              <select aria-label={'方塊狀態 ' + key} value={anchor ?? props.state[key] ?? entry.defaults[key]} disabled={anchor !== null}
                onChange={event => props.onState({ ...props.state, [key]: event.currentTarget.value })}>
                {(anchor ? [anchor] : values).map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              {anchor && <span>成對方塊由下半部或床尾放置，另一部分由編輯器一併建立。</span>}
            </label>
          );
        })}
        {Object.keys(entry.properties).length === 0 && <p>此方塊沒有可調整的狀態。</p>}
      </fieldset>
      <label>工作平面 Y
        <input type="number" min={-30_000_000} max={30_000_000} step={1} value={workYText}
          aria-invalid={!validWorkY(workYText)}
          onChange={event => {
            const text = event.currentTarget.value;
            setWorkYText(text);
            if (validWorkY(text)) props.onWorkY(Number(text));
          }}
          onBlur={() => setWorkYText(String(props.workY))} />
      </label>
      {!validWorkY(workYText) && <p role="status">請輸入 −30000000 至 30000000 的整數。</p>}
      <label>碰撞處理
        <select value={props.collision} onChange={event => props.onCollision(event.currentTarget.value as EditorPanelProps['collision'])}>
          <option value="cancel">取消：不覆蓋既有方塊</option>
          <option value="replace">替換：覆蓋既有方塊</option>
          <option value="skip">跳過：保留既有方塊</option>
        </select>
      </label>
      <div className="editor-history" role="group" aria-label="編輯歷程">
        <button type="button" onClick={props.onUndo} disabled={!props.canUndo}>復原</button>
        <button type="button" onClick={props.onRedo} disabled={!props.canRedo}>重做</button>
      </div>
      {props.preview && (
        <section className="editor-preview" aria-label="變更預覽">
          <p role="status">{props.preview.valid ? '預覽有效' : '預覽無效'} · {props.preview.cells} 格：{props.preview.message}</p>
          <button type="button" onClick={props.onConfirm} disabled={!props.preview.valid}>套用變更</button>
          <button type="button" onClick={props.onCancel}>取消預覽</button>
        </section>
      )}
    </section>
  );
}
