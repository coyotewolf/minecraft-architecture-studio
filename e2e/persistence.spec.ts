import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { coordinate } from './helpers.ts';
import type { WorkspaceRecord } from '../src/features/projects/storage.ts';
function deserializeWorkspace(text: string): WorkspaceRecord { return JSON.parse(text) as WorkspaceRecord; }
import type { Project } from '../src/core/contracts.ts';
async function csvToModel(page: Page, text: string): Promise<Project> { return page.evaluate(async text => { const path = '/src/features/projects/exports.ts'; const module = await import(path); return module.csvToModel(text); }, text) as Promise<Project>; }

async function openPanel(page: Page) { const details = page.locator('details').filter({ has: page.locator('summary', { hasText: /^專案與備份$/ }) }); if (!(await details.getAttribute('open'))) await details.locator('summary').click(); }
async function saved(page: Page) { await expect(page.locator('.project-panel').getByRole('status').first()).toHaveText('已儲存於此瀏覽器', { timeout: 10_000 }); }
async function download(page: Page, name: string): Promise<Buffer> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
  const file = await pending; const path = await file.path(); if (!path) throw new Error('Download unavailable'); return readFile(path);
}
async function edit(page: Page) { const details = page.locator('details').filter({ has: page.locator('summary', { hasText: /^編輯工具與方塊$/ }) }); if (!(await details.getAttribute('open'))) await details.locator('summary').click(); }
async function place(page: Page, x: number) { await page.getByRole('radio', { name: '放置', exact: true }).check(); await coordinate(page, x, 0, 0); await page.getByRole('button', { name: '套用變更', exact: true }).click(); }
test.beforeEach(async ({ page }) => { page.on('dialog', dialog => void dialog.accept()); await page.goto('/'); await expect(page.getByTestId('cell-count')).toHaveText('288'); await openPanel(page); });

test('native IndexedDB reload preserves edited design, preparation, completion and view', async ({ page }) => {
  await edit(page); await place(page, 10); await expect(page.getByTestId('cell-count')).toHaveText('289');
  await page.getByText('材料與施工引導', { exact: true }).click();
  await page.getByRole('button', { name: '確認施工設計變更' }).click();
  await page.getByRole('button', { name: '標記此步完成', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'minecraft:oak_slab 已備數量', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: '施工檢視樓層' }).fill('2');
  await page.getByRole('combobox', { name: '施工顯示方式' }).selectOption('ghost');
  await page.getByRole('slider', { name: '施工順序進度', exact: true }).focus(); await page.keyboard.press('End');
  const before = deserializeWorkspace((await download(page, '下載完整備份')).toString());
  await saved(page); await page.reload(); await expect(page.getByTestId('cell-count')).toHaveText('289'); await openPanel(page);
  const after = deserializeWorkspace((await download(page, '下載完整備份')).toString());
  expect(after.project).toEqual(before.project); expect(after.approvedDesign).toEqual(before.approvedDesign);
  expect(after.prepared).toEqual(before.prepared); expect(after.completed).toEqual(before.completed); expect(after.completed).toHaveLength(1);
  expect(after.view).toEqual({ layer: 2, mode: 'ghost', progress: 100 });
  expect(after.revisionLog).toEqual(before.revisionLog);
});

test('rename keeps undo history; snapshot restoration is confirmed and undoable', async ({ page }) => {
  await page.getByRole('button', { name: '空白專案', exact: true }).click(); await edit(page);
  await place(page, 0); await place(page, 1);
  await page.getByRole('textbox', { name: '專案名稱', exact: true }).fill('Rename keeps history');
  await page.getByRole('button', { name: '重新命名', exact: true }).click();
  await page.getByRole('button', { name: '復原', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('1');
  await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('2');
  await page.getByRole('button', { name: '保存版本快照', exact: true }).click(); await place(page, 2);
  await expect(page.getByTestId('cell-count')).toHaveText('3');
  await page.locator('.project-panel').getByRole('button', { name: '還原', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('2');
  await page.getByRole('button', { name: '復原', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('3');
  await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('2');
  await saved(page);
});

test('downloaded backup and XYZ CSV preserve groups and provenance on real UI reimport; corrupt model is atomic', async ({ page }) => {
  const backup = await download(page, '下載完整備份'); const workspace = deserializeWorkspace(backup.toString());
  const csv = await download(page, '下載完整 XYZ CSV'); const model = await csvToModel(page, csv.toString());
  expect(model).toEqual(workspace.project); expect(model.logicalStructures).toHaveLength(2);
  expect(model.blocks.some(b => b.pos.x < 0)).toBe(true);
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByLabel('匯入完整 XYZ CSV', { exact: true }).setInputFiles({ name: 'model.csv', mimeType: 'text/csv', buffer: csv });
  await expect(page.getByTestId('cell-count')).toHaveText('288');
  const csvRestored = deserializeWorkspace((await download(page, '下載完整備份')).toString());
  expect(csvRestored.project).toEqual(workspace.project);
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByLabel('匯入完整備份', { exact: true }).setInputFiles({ name: 'workspace.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByTestId('cell-count')).toHaveText('288');
  const restored = deserializeWorkspace((await download(page, '下載完整備份')).toString()); expect(restored).toEqual(workspace);
  await page.getByLabel('匯入模型 JSON', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(page.locator('.project-panel').getByRole('alert')).toContainText('匯入失敗');
  const unchanged = deserializeWorkspace((await download(page, '下載完整備份')).toString()); expect(unchanged.project).toEqual(workspace.project);
  const canonical = await download(page, '下載模型 JSON');
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByLabel('匯入模型 JSON', { exact: true }).setInputFiles({ name: 'model.json', mimeType: 'application/json', buffer: canonical });
  await expect(page.getByTestId('cell-count')).toHaveText('288'); await saved(page);
});

test('stored other project deletes through native IndexedDB with confirmation', async ({ page }) => {
  await page.getByRole('textbox', { name: '專案名稱', exact: true }).fill('Delete target'); await page.getByRole('button', { name: '重新命名', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: '空白專案', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: '重新整理已儲存專案' }).click();
  const target = page.locator('.project-panel li').filter({ hasText: 'Delete target' }); await expect(target).toHaveCount(1);
  await target.getByRole('button', { name: '刪除', exact: true }).click(); await expect(target).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId('cell-count')).toHaveText('0'); await openPanel(page);
  await page.getByRole('button', { name: '重新整理已儲存專案' }).click(); await expect(page.locator('.project-panel li').filter({ hasText: 'Delete target' })).toHaveCount(0);
});

test('injected IndexedDB failure is visible and never prevents manual editing', async ({ page }) => {
  await page.evaluate(() => { indexedDB.open = () => { throw new DOMException('Test-only blocked storage', 'SecurityError'); }; });
  await page.getByRole('button', { name: '立即儲存', exact: true }).click();
  await expect(page.locator('.project-panel').getByRole('status').first()).toContainText('儲存失敗');
  await page.getByRole('button', { name: '空白專案', exact: true }).click(); await edit(page); await place(page, -1);
  await expect(page.getByTestId('cell-count')).toHaveText('1');
  await expect(page.locator('.project-panel').getByRole('status').first()).toContainText('儲存失敗');
  const backup = deserializeWorkspace((await download(page, '下載完整備份')).toString()); expect(backup.project.blocks).toHaveLength(1);
});


test('immediate edit then new project saves the previous design before switching', async ({ page }) => {
  await page.getByRole('textbox', { name: '專案名稱', exact: true }).fill('Immediate-switch design');
  await page.getByRole('button', { name: '重新命名', exact: true }).click();
  await edit(page); await place(page, 12);
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByRole('button', { name: '重新整理已儲存專案' }).click();
  const previous = page.locator('.project-panel li').filter({ hasText: 'Immediate-switch design' });
  await expect(previous).toHaveCount(1);
  await previous.getByRole('button', { name: '開啟', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('289');
  const backup = deserializeWorkspace((await download(page, '下載完整備份')).toString());
  expect(backup.project.blocks.some(block => block.pos.x === 12 && block.pos.y === 0 && block.pos.z === 0)).toBe(true);
  await saved(page);
});

async function delayNextNativeOpen(page: Page, delay = 400) {
  await page.evaluate(delay => {
    const original = indexedDB.open.bind(indexedDB); let delayed = false;
    indexedDB.open = (...args) => {
      const request = original(...args); if (delayed) return request; delayed = true;
      return new Proxy(request, {
        get(target, property) { return Reflect.get(target, property, target); },
        set(target, property, value: unknown) {
          if (property === 'onsuccess') target.onsuccess = event => setTimeout(() => (value as (event: Event) => void)(event), delay);
          else Reflect.set(target, property, value, target);
          return true;
        },
      });
    };
  }, delay);
}

test('edits committed during a delayed native save are flushed before project switch', async ({ page }) => {
  await page.getByRole('textbox', { name: '專案名稱', exact: true }).fill('Mid-save edit survives');
  await page.getByRole('button', { name: '重新命名', exact: true }).click(); await saved(page);
  await edit(page); await page.getByRole('radio', { name: '放置', exact: true }).check(); await coordinate(page, 12, 0, 0);
  await delayNextNativeOpen(page);
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await expect(page.getByRole('button', { name: '空白專案', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '套用變更', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('289');
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByRole('button', { name: '重新整理已儲存專案' }).click();
  await page.locator('.project-panel li').filter({ hasText: 'Mid-save edit survives' }).getByRole('button', { name: '開啟', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('289');
  const record = deserializeWorkspace((await download(page, '下載完整備份')).toString());
  expect(record.project.blocks.some(block => block.pos.x === 12 && block.pos.y === 0 && block.pos.z === 0)).toBe(true);
});

test('two header switches dispatched in one event turn cannot race to replace the project', async ({ page }) => {
  await saved(page); await delayNextNativeOpen(page);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.project-actions button')];
    buttons.find(button => button.textContent === '空白專案')!.click();
    buttons.find(button => button.textContent === '載入示範木屋')!.click();
  });
  await expect(page.getByTestId('cell-count')).toHaveText('0'); await saved(page);
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await expect(page.getByRole('button', { name: '空白專案', exact: true })).toBeEnabled();
});

test('opening a replacement workspace during save cancels the old header transition even with the same project ID', async ({ page }) => {
  await saved(page);
  const record = deserializeWorkspace((await download(page, '下載完整備份')).toString());
  const imported = { ...record, project: { ...record.project, title: 'Imported while switching' } };
  await delayNextNativeOpen(page, 1000);
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByLabel('匯入完整備份', { exact: true }).setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(page.getByRole('textbox', { name: '專案名稱', exact: true })).toHaveValue('Imported while switching');
  await expect(page.getByRole('button', { name: '空白專案', exact: true })).toBeEnabled();
  await expect(page.getByTestId('cell-count')).toHaveText('288'); await saved(page);
  const current = deserializeWorkspace((await download(page, '下載完整備份')).toString()); expect(current.project).toEqual(imported.project);
});
