import { test, expect, type Page } from '@playwright/test';
import { clickWorld, coordinate } from './helpers.ts';
async function stats(page: Page): Promise<{ visibleInstances: number }> { return JSON.parse((await page.locator('canvas.viewer-canvas').getAttribute('data-renderer-stats'))!); }
async function build(page: Page) { const section=page.locator('details.controls-section'); if(await section.getAttribute('open')===null) await section.locator('summary').click(); }
async function apply(page: Page, x: number, y: number, z: number) { await coordinate(page, x, y, z); await page.getByRole('button', { name: '套用變更', exact: true }).click(); }
test.beforeEach(async ({ page }) => { await page.goto('/?sample=house'); await expect(page.locator('canvas.viewer-canvas')).toHaveAttribute('data-renderer-stats', /visibleInstances/); await expect(page.getByTestId('cell-count')).toHaveText('288'); });

test('materials distinguish occupied cells, paired inventory and slab counts; preparation updates missing items', async ({ page }) => {
  await build(page);
  const panel = page.locator('.materials-panel');
  await expect(panel).toContainText('佔用格數 288；放置物品總數 287');
  const door = panel.locator('.material-item').filter({ hasText: 'minecraft:oak_door' });
  const bed = panel.locator('.material-item').filter({ hasText: 'minecraft:red_bed' });
  const slab = panel.locator('.material-item').filter({ hasText: 'minecraft:oak_slab' });
  await expect(door.locator('.material-required')).toHaveText('× 1');
  await expect(bed.locator('.material-required')).toHaveText('× 1');
  await expect(bed).toContainText('1 組＋0（每組 1）');
  await expect(slab.locator('.material-required')).toHaveText('× 4');
  await slab.getByRole('spinbutton').fill('2'); await expect(slab).toContainText('2（部分備齊）');
  await slab.getByRole('spinbutton').fill('4'); await expect(slab).toContainText('已備齊');
  await door.getByRole('spinbutton').fill('1'); await expect(door).toContainText('已備齊');
  await expect(page.getByTestId('cell-count')).toHaveText('288');
});

test('Y and progress remain independent; filtered, ghost and exploded views retain canonical picking', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await build(page);
  const total = (await stats(page)).visibleInstances;
  expect(total).toBeGreaterThanOrEqual(288);
  const y = page.getByRole('slider', { name: '樓層滑桿', exact: true });
  const progress = page.getByRole('slider', { name: '施工順序進度', exact: true });
  await y.focus(); await y.press('Home'); await y.press('ArrowRight'); await y.press('ArrowRight');
  await expect(y).toHaveValue('2'); await expect(progress).toHaveValue('0');
  await progress.focus(); await progress.press('End');
  await expect(progress).toHaveValue('100'); await expect(y).toHaveValue('2');
  await page.getByRole('combobox', { name: '施工顯示方式' }).selectOption('layer');
  await expect.poll(async () => (await stats(page)).visibleInstances).toBeLessThan(total);
  const single = (await stats(page)).visibleInstances;
  await page.getByRole('combobox', { name: '施工顯示方式' }).selectOption('through');
  await expect.poll(async () => (await stats(page)).visibleInstances).toBeGreaterThan(single);
  await expect.poll(async () => (await stats(page)).visibleInstances).toBeLessThan(total);
  await page.getByRole('combobox', { name: '施工顯示方式' }).selectOption('ghost');
  await expect.poll(async () => (await stats(page)).visibleInstances).toBe(total);
  await page.getByRole('button', { name: '施工模式', exact: true }).click();
  await progress.focus(); await progress.press('Home');
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await clickWorld(page, [-3.5, 1.5, -2.5]);
  await expect(page.locator('.block-inspector')).toContainText('demo:-4,1,-3');
  await page.getByRole('checkbox', { name: '樓層分解檢視' }).check();
  await page.getByRole('button', { name: '正面', exact: true }).click();
  // Y=1 is the second anchor level, displaced by 2 for display only.
  await clickWorld(page, [-3.5, 3.5, -2.5]);
  await expect(page.locator('.block-inspector')).toContainText('demo:-4,1,-3');
  await expect(page.getByTestId('cell-count')).toHaveText('288');
  await page.getByRole('checkbox', { name: '樓層分解檢視' }).uncheck();
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await clickWorld(page, [-3.5, 1.5, -2.5]);
  await expect(page.locator('.block-inspector')).toContainText('demo:-4,1,-3');
  expect(errors).toEqual([]);
});

test('completed construction reconciles replacements without silently completing new blocks', async ({ page }) => {
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByText('編輯工具與方塊', { exact: true }).click();
  await page.getByRole('radio', { name: '放置', exact: true }).check();
  await apply(page, 0, 0, 0); await apply(page, 1, 0, 0);
  await build(page);
  await expect(page.getByRole('button', { name: '標記此步完成', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '確認施工設計變更' }).click();
  await page.getByRole('button', { name: '標記此步完成', exact: true }).click();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('button', { name: '標記此步完成', exact: true }).click();
  await expect(page.locator('.progress-dock')).toContainText('已完成 2 / 2 格');
  await page.getByRole('button', { name: '編輯模式', exact: true }).click();
  await page.getByRole('radio', { name: '替換', exact: true }).check();
  await page.getByRole('combobox', { name: '方塊種類', exact: true }).selectOption('minecraft:glass');
  await apply(page, 0, 0, 0);
  const panel = page.locator('.progress-dock');
  await expect(page.locator('.build-controls')).toContainText('新增 1、變更 0、移除 1');
  await expect(panel).toContainText('已完成 1 / 2 格');
  await page.getByRole('button', { name: '確認施工設計變更' }).click();
  await expect(panel).toContainText('已完成 1 / 2 格');
  await page.getByRole('slider', { name: '施工順序進度', exact: true }).focus();
  await page.getByRole('slider', { name: '施工順序進度', exact: true }).press('Home');
  await expect(page.getByRole('button', { name: '標記此步完成', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消此步完成', exact: true })).toBeEnabled();
  await expect(page.getByTestId('cell-count')).toHaveText('2');
});
