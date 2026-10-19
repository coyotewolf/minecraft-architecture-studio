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

export function EditorPanel(props: EditorPanelProps): ReactElement {
  const [search, setSearch] = useState('');
  const [workYText, setWorkYText] = useState(String(props.workY));
  useEffect(() => { setWorkYText(String(props.workY)); }, [props.workY]);
  const tools: readonly { value: EditorTool; label: string }[] = [
    { value: 'select', label: '選取' }, { value: 'place', label: '放置' },
    { value: 'remove', label: '移除' }, { value: 'replace', label: '替換' },
    { value: 'eyedropper', label: '吸取' },
  ];
  const query = search.trim().toLowerCase();
  const matches = BLOCK_IDS.filter(id => id.includes(query) || id.replaceAll('_', ' ').includes(query));
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
        <input type="search" value={search} placeholder="輸入方塊 ID，例如 oak"
          onChange={event => setSearch(event.currentTarget.value)} />
      </label>
      <label>方塊種類
        <select value={props.blockId} onChange={event => props.onBlockId(event.currentTarget.value as MinecraftId)}>
          {!matches.includes(props.blockId) && <option value={props.blockId}>{props.blockId}（目前選用）</option>}
          {matches.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <p role="status">{matches.length ? '符合搜尋：' + matches.length + ' 種方塊' : '找不到符合的方塊；仍保留目前選用的種類。'}</p>
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
