import { test, expect, type Page } from '@playwright/test';
import { clickWorld, coordinate } from './helpers.ts';
import type { BlueprintGrid } from '../src/features/blueprint/BlueprintPanel.tsx';

async function grid(page: Page): Promise<BlueprintGrid> {
  return JSON.parse((await page.locator('.blueprint-canvas').getAttribute('data-grid'))!) as BlueprintGrid;
}
async function blueprintClick(page: Page, x: number, z: number) {
  const canvas = page.locator('.blueprint-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await grid(page)).columns).toBeGreaterThan(5);
  const g = await grid(page); const rect = (await canvas.boundingBox())!;
  expect(x).toBeGreaterThanOrEqual(g.originX); expect(x).toBeLessThan(g.originX + g.columns);
  expect(z).toBeGreaterThanOrEqual(g.originZ); expect(z).toBeLessThan(g.originZ + g.rows);
  await page.mouse.click(rect.x + (g.offsetX + (x - g.originX + .5) * g.cellSize) * rect.width / g.width,
    rect.y + (g.offsetY + (z - g.originZ + .5) * g.cellSize) * rect.height / g.height);
}
async function confirm(page: Page) {
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽有效');
  await page.getByRole('button', { name: '套用變更', exact: true }).click();
}
async function expectPosition(page: Page, x: number, y: number, z: number) {
  for (const [label, value] of [['X（東西）', x], ['Y（高度）', y], ['Z（南北）', z]] as const) {
    await expect(page.locator('.inspector-grid dt', { hasText: label }).locator('+ dd')).toHaveText(String(value));
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByText('編輯工具與方塊', { exact: true }).click();
  await page.getByText('2D 逐層藍圖', { exact: true }).click();
});

test('negative 2D placement reaches real 3D picking with exact state and shared selection', async ({ page }) => {
  await page.getByRole('radio', { name: '放置', exact: true }).check();
  await page.getByRole('combobox', { name: '方塊種類', exact: true }).selectOption('minecraft:oak_stairs');
  await page.getByRole('combobox', { name: '方塊狀態 facing', exact: true }).selectOption('west');
  await page.getByRole('combobox', { name: '方塊狀態 half', exact: true }).selectOption('top');
  await blueprintClick(page, -2, -3);
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 0 格');
  await confirm(page);
  await expect(page.getByTestId('cell-count')).toHaveText('1');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 1 格');
  await expect(page.locator('.blueprint-target')).toContainText('minecraft:oak_stairs');
  await page.getByRole('radio', { name: '選取', exact: true }).check();
  await page.getByRole('button', { name: '俯視', exact: true }).click();
  await clickWorld(page, [-1.5, 1, -2.5]);
  await expectPosition(page, -2, 0, -3);
  await expect(page.locator('.state-list')).toContainText('west');
  await expect(page.locator('.state-list')).toContainText('top');
  const uid = await page.locator('.inspector-grid dt', { hasText: '識別碼 UID' }).locator('+ dd').innerText();
  await page.locator('.blueprint-canvas').scrollIntoViewIfNeeded();
  const selectedPixel = await page.locator('.blueprint-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const g = JSON.parse(canvas.dataset.grid!) as BlueprintGrid;
    const ratio = canvas.width / g.width;
    return Array.from(canvas.getContext('2d')!.getImageData(
      Math.floor((g.offsetX + (-2 - g.originX) * g.cellSize + 2) * ratio),
      Math.floor((g.offsetY + (-3 - g.originZ + .5) * g.cellSize) * ratio), 1, 1).data).slice(0, 3);
  });
  expect(selectedPixel).toEqual([241, 255, 198]);
  await blueprintClick(page, -2, -3);
  await expect(page.locator('.inspector-grid dt', { hasText: '識別碼 UID' }).locator('+ dd')).toHaveText(uid);
  await expectPosition(page, -2, 0, -3);
});

test('3D command edits update other blueprint layers and deleting upper door removes pair with undo', async ({ page }) => {
  await page.getByRole('radio', { name: '放置', exact: true }).check();
  await page.getByRole('combobox', { name: '方塊種類', exact: true }).selectOption('minecraft:oak_door');
  await coordinate(page, -4, 2, -4); await confirm(page);
  await expect(page.getByTestId('cell-count')).toHaveText('2');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 0 格');
  await page.getByRole('radio', { name: '選取', exact: true }).check();
  await blueprintClick(page, -4, -4);
  await expect(page.locator('.blueprint-target')).toContainText('空氣（空格）');
  await page.getByRole('spinbutton', { name: '藍圖樓層 Y', exact: true }).fill('2');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 1 格');
  await blueprintClick(page, -4, -4);
  await expectPosition(page, -4, 2, -4);
  await expect(page.locator('.state-list')).toContainText('lower');
  await page.getByRole('spinbutton', { name: '藍圖樓層 Y', exact: true }).fill('3');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 1 格');
  await blueprintClick(page, -4, -4);
  await expectPosition(page, -4, 3, -4);
  await expect(page.locator('.state-list')).toContainText('upper');
  await page.getByRole('radio', { name: '移除', exact: true }).check();
  await blueprintClick(page, -4, -4);
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('2 格');
  await expect(page.getByTestId('cell-count')).toHaveText('2');
  await confirm(page);
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 0 格');
  await page.getByRole('button', { name: '復原', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('2');
  await expect(page.locator('.blueprint-summary')).toContainText('本層 1 格');
  await expect(page.locator('.blueprint-target')).toContainText('minecraft:oak_door');
});

test('keyboard targeting and responsive zoom retain exact signed coordinates', async ({ page }) => {
  await page.getByRole('radio', { name: '放置', exact: true }).check();
  await page.getByRole('spinbutton', { name: '藍圖中心 X', exact: true }).fill('-1');
  await page.getByRole('spinbutton', { name: '藍圖中心 Z', exact: true }).fill('-1');
  const canvas = page.locator('.blueprint-canvas');
  await canvas.scrollIntoViewIfNeeded(); await canvas.focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(page.locator('.blueprint-target')).toContainText('X -2，Y 0，Z -2');
  await confirm(page);
  await page.getByRole('radio', { name: '選取', exact: true }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('slider', { name: '藍圖縮放', exact: true }).fill('8');
  await blueprintClick(page, -2, -2);
  await expectPosition(page, -2, 0, -2);
  await expect(page.getByTestId('cell-count')).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
