import { test, expect, type Page } from '@playwright/test';
import { pixel } from './helpers.ts';
import type { BlueprintGrid } from '../src/features/blueprint/BlueprintPanel.tsx';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
async function touchBlueprint(page: Page, x: number, z: number) {
  const canvas = page.locator('.blueprint-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (JSON.parse((await canvas.getAttribute('data-grid'))!) as BlueprintGrid).columns).toBeGreaterThan(5);
  const grid = JSON.parse((await canvas.getAttribute('data-grid'))!) as BlueprintGrid;
  const rect = (await canvas.boundingBox())!;
  expect(x).toBeGreaterThanOrEqual(grid.originX); expect(x).toBeLessThan(grid.originX + grid.columns);
  expect(z).toBeGreaterThanOrEqual(grid.originZ); expect(z).toBeLessThan(grid.originZ + grid.rows);
  await page.touchscreen.tap(rect.x + (grid.offsetX + (x - grid.originX + .5) * grid.cellSize) * rect.width / grid.width,
    rect.y + (grid.offsetY + (z - grid.originZ + .5) * grid.cellSize) * rect.height / grid.height);
}
async function confirm(page: Page) {
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽有效');
  await page.getByRole('button', { name: '套用變更', exact: true }).tap();
}

test('touch editing in 3D and negative 2D cells supports confirmation, undo, removal and saved reload', async ({ page }) => {
  test.setTimeout(60_000);
  page.on('dialog', dialog => void dialog.accept());
  await page.goto('/');
  await expect(page.getByTestId('cell-count')).toHaveText('288');
  await page.getByRole('button', { name: '空白專案', exact: true }).tap();
  await page.locator('summary').filter({ hasText: /^編輯工具與方塊$/ }).tap();
  await page.getByRole('radio', { name: '放置', exact: true }).tap();
  await expect(page.getByRole('radio', { name: '放置', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '俯視', exact: true }).tap();
  const first = await pixel(page, [.5, 0, .5]);
  await page.touchscreen.tap(first.x, first.y);
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await confirm(page); await expect(page.getByTestId('cell-count')).toHaveText('1');
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByRole('button', { name: '重做', exact: true }).tap();
  await expect(page.getByTestId('cell-count')).toHaveText('1');

  await page.locator('summary').filter({ hasText: /^2D 逐層藍圖$/ }).tap();
  await touchBlueprint(page, -2, -2);
  await expect(page.locator('.blueprint-target')).toContainText('X -2，Y 0，Z -2');
  await expect(page.getByTestId('cell-count')).toHaveText('1');
  await confirm(page); await expect(page.getByTestId('cell-count')).toHaveText('2');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 2 格');
  await page.getByRole('radio', { name: '移除', exact: true }).tap();
  await touchBlueprint(page, -2, -2);
  await expect(page.locator('.block-inspector')).toContainText('minecraft:stone');
  await expect(page.getByTestId('cell-count')).toHaveText('2');
  await confirm(page); await expect(page.getByTestId('cell-count')).toHaveText('1');
  await expect(page.locator('.blueprint-target')).toContainText('空氣（空格）');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('summary').filter({ hasText: /^專案與備份$/ }).tap();
  await page.getByRole('button', { name: '立即儲存', exact: true }).tap();
  await expect(page.locator('.project-panel').getByRole('status').first()).toHaveText('已儲存於此瀏覽器', { timeout: 10_000 });
  await page.screenshot({ path: 'evidence/m9-mobile-editor.png', fullPage: true });
  await page.reload();
  await expect(page.getByTestId('cell-count')).toHaveText('1');
  await page.getByRole('button', { name: '俯視', exact: true }).tap();
  const restored = await pixel(page, [.5, 1, .5]);
  await page.touchscreen.tap(restored.x, restored.y);
  await expect(page.locator('.block-inspector')).toContainText('minecraft:stone');
  for (const label of ['X（東西）', 'Y（高度）', 'Z（南北）']) {
    await expect(page.locator('.inspector-grid dt', { hasText: label }).locator('+ dd')).toHaveText('0');
  }
  await page.locator('summary').filter({ hasText: /^2D 逐層藍圖$/ }).tap();
  await touchBlueprint(page, -2, -2);
  await expect(page.locator('.blueprint-target')).toContainText('空氣（空格）');
  await expect(page.getByTestId('cell-count')).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
