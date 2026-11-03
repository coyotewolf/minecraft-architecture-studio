import { Fragment, type ReactElement } from 'react';
import type { BlockRecord } from '../../core/contracts.ts';

export type CameraPreset = 'isometric' | 'top' | 'front' | 'back' | 'left' | 'right';

export function CameraToolbar(props: {
  onPreset: (preset: CameraPreset) => void;
  onReset: () => void;
  onFocus: () => void;
  hasSelection: boolean;
}): ReactElement {
  const presets: readonly { preset: CameraPreset; label: string }[] = [
    { preset: 'isometric', label: '等角視角' },
    { preset: 'top', label: '俯視' },
    { preset: 'front', label: '正面' },
    { preset: 'back', label: '背面' },
    { preset: 'left', label: '左側' },
    { preset: 'right', label: '右側' },
  ];

  return (
    <div className="camera-toolbar" role="group" aria-label="視角控制">
      {presets.map(({ preset, label }) => (
        <button key={preset} type="button" aria-label={label} onClick={() => props.onPreset(preset)}>
          {label}
        </button>
      ))}
      <button type="button" onClick={props.onReset}>重設視角</button>
      <button type="button" onClick={props.onFocus} disabled={!props.hasSelection}>
        聚焦選取
      </button>
    </div>
  );
}

export function BlockInspector(props: {
  block: BlockRecord | null;
  unsupportedCount: number;
}): ReactElement {
  const { block, unsupportedCount } = props;
  const origins: Record<BlockRecord['source']['origin'], string> = {
    observed: '觀察所得',
    inferred: 'AI Estimated Area · 推論所得',
    ai_estimated: 'AI Estimated Area · 推估設計',
    user_created: '使用者建立',
  };
  const stateKeys = block ? Object.keys(block.state).sort() : [];

  return (
    <section className="block-inspector" aria-label="方塊資訊">
      <h2>方塊資訊</h2>
      {block ? (
        <>
          <dl className="inspector-grid">
            <dt>識別碼 UID</dt><dd><code>{block.uid}</code></dd>
            <dt>方塊 ID</dt><dd><code>{block.id}</code></dd>
            <dt>X（東西）</dt><dd>{block.pos.x}</dd>
            <dt>Y（高度）</dt><dd>{block.pos.y}</dd>
            <dt>Z（南北）</dt><dd>{block.pos.z}</dd>
            <dt>分類</dt><dd>{block.category ?? '未分類'}</dd>
            <dt>來源</dt>
            <dd>{origins[block.source.origin]}（<code>{block.source.origin}</code>）</dd>
            <dt>信心值（0–1）</dt><dd>{block.source.confidence ?? '未提供'}</dd>
            <dt>使用者已修改</dt><dd>{block.edits.userModified ? '是' : '否'}</dd>
          </dl>
          <h3>完整方塊狀態</h3>
          {stateKeys.length > 0 ? (
            <dl className="state-list">
              {stateKeys.map((key) => (
                <Fragment key={key}>
                  <dt><code>{key}</code></dt>
                  <dd><code>{block.state[key]}</code></dd>
                </Fragment>
              ))}
            </dl>
          ) : <p>此方塊沒有狀態屬性。</p>}
        </>
      ) : <p>點選模型中的方塊，查看座標、狀態與來源。</p>}
      {unsupportedCount > 0 && (
        <p role="status">
          模型中有 {unsupportedCount} 個方塊尚未支援精確外形；目前的顯示不代表它們在遊戲中的實際形狀。
        </p>
      )}
    </section>
  );
}
