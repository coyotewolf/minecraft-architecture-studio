import { test, expect, type Page } from '@playwright/test';
import { clickWorld } from './helpers.ts';

async function preview(page: Page) {
  await page.getByRole('button', { name: '預覽批次操作', exact: true }).click();
}
async function commit(page: Page) {
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽有效');
  await page.getByRole('button', { name: '套用變更', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await page.getByText('編輯工具與方塊', { exact: true }).click();
  await page.getByText('批次編輯', { exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('0');
});

test('27-cell box preview and cancellation are read-only; commit undo and redo are atomic', async ({ page }) => {
  await page.getByRole('combobox', { name: '批次操作', exact: true }).selectOption('box');
  for (const axis of ['X', 'Y', 'Z']) {
    await page.getByRole('spinbutton', { name: '範圍起點 ' + axis, exact: true }).fill('0');
    await page.getByRole('spinbutton', { name: '範圍終點 ' + axis, exact: true }).fill('2');
  }
  await preview(page);
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('27 格');
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByRole('button', { name: '取消預覽', exact: true }).click();
  await expect(page.getByRole('region', { name: '變更預覽' })).toHaveCount(0);
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await preview(page); await commit(page);
  await expect(page.getByTestId('cell-count')).toHaveText('27');
  await page.getByRole('button', { name: '重設視角', exact: true }).click();
  await page.getByRole('button', { name: '俯視', exact: true }).click();
  await clickWorld(page, [1.5, 3, 1.5]);
  await expect(page.locator('.block-inspector')).toContainText('minecraft:stone');
  const xyz = page.locator('.inspector-grid');
  await expect(xyz.locator('dt', { hasText: 'X（東西）' }).locator('+ dd')).toHaveText('1');
  await expect(xyz.locator('dt', { hasText: 'Y（高度）' }).locator('+ dd')).toHaveText('2');
  await expect(xyz.locator('dt', { hasText: 'Z（南北）' }).locator('+ dd')).toHaveText('1');
  await page.getByRole('button', { name: '復原', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('27');
});

test('copy creates a separate offset volume; collisions cannot partially mutate it', async ({ page }) => {
  await preview(page); await commit(page);
  await expect(page.getByTestId('cell-count')).toHaveText('27');
  await page.getByRole('combobox', { name: '批次操作', exact: true }).selectOption('copy');
  await page.getByRole('spinbutton', { name: '位移 X', exact: true }).fill('4');
  await preview(page);
  await expect(page.getByTestId('cell-count')).toHaveText('27');
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('27 格');
  await commit(page);
  await expect(page.getByTestId('cell-count')).toHaveText('54');
  await page.getByRole('button', { name: '俯視', exact: true }).click();
  await clickWorld(page, [5.5, 3, 1.5]);
  await expect(page.locator('.block-inspector')).toContainText('minecraft:stone');
  await expect(page.locator('.inspector-grid dt', { hasText: 'X（東西）' }).locator('+ dd')).toHaveText('5');
  await preview(page);
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽無效');
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('已有方塊');
  await expect(page.getByRole('button', { name: '套用變更', exact: true })).toBeDisabled();
  await expect(page.getByTestId('cell-count')).toHaveText('54');
  await page.getByRole('button', { name: '取消預覽', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('54');
  await page.getByRole('button', { name: '復原', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('27');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('54');
});
