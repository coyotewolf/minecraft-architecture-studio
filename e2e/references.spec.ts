import { test, expect, type Page } from '@playwright/test';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFhQAAAAASUVORK5CYII=', 'base64');
async function openReferences(page: Page) {
  const summary = page.locator('summary').filter({ hasText: /^設計參考$/ });
  if (!(await summary.locator('..').evaluate(node => (node as HTMLDetailsElement).open))) await summary.click();
  await expect(page.locator('.reference-panel').getByLabel('加入本機參考圖片')).toBeEnabled();
}
async function storedBoards(page: Page): Promise<{ projectId: string; selectedId: string | null; notes: Record<string, string>; uploads: { id: string; name: string; size: number; type: string }[] }[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('minecraft-architecture-studio-references', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('boards')) { db.close(); resolve([]); return; }
      const tx = db.transaction('boards', 'readonly'); const get = tx.objectStore('boards').getAll();
      tx.oncomplete = () => { db.close(); resolve(get.result.map((record: { projectId: string; selectedId: string | null; notes: Record<string, string>; uploads: { id: string; name: string; blob: Blob }[] }) => ({
        projectId: record.projectId, selectedId: record.selectedId, notes: record.notes,
        uploads: record.uploads.map(image => ({ id: image.id, name: image.name, size: image.blob.size, type: image.blob.type })),
      }))); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}
async function ready(page: Page) {
  await page.goto('/?sample=atrium'); await expect(page.getByTestId('cell-count')).toHaveText('6137');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('architecture-studio:last-project'))).not.toBeNull();
  await openReferences(page);
}

test('all eleven actual local references render with greenhouse featured and exhibition selectable', async ({ page }) => {
  await ready(page); const panel = page.locator('.reference-panel');
  await expect(panel.getByRole('tab')).toHaveCount(11);
  await expect(panel.getByRole('tab').nth(3)).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('.reference-panel__image')).toHaveAttribute('src', '/local-references/reference-04.png');
  await expect.poll(() => panel.locator('.reference-panel__image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1536);
  await expect(panel).toContainText('非實測'); await expect(panel).toContainText('XYZ');
  for (let i = 0; i < 11; i++) {
    await panel.getByRole('tab').nth(i).click();
    await expect(panel.locator('.reference-panel__image')).toHaveAttribute('src', `/local-references/reference-${String(i + 1).padStart(2, '0')}.png`);
    await expect.poll(() => panel.locator('.reference-panel__image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024)).toBe(true);
  }
  await panel.getByRole('tab').nth(5).click(); await expect(panel.getByRole('tab').nth(5)).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('.reference-panel__caption')).toContainText(/展示|展廊|展覽|星象/);
  await expect(page.locator('.reference-card img')).toHaveAttribute('src', '/local-references/reference-06.png');
  await expect(page.locator('.reference-card')).toContainText(/展廊|星象/);
  await panel.getByRole('tab').nth(5).press('ArrowLeft'); await expect(panel.getByRole('tab').nth(4)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('cell-count')).toHaveText('6137');
  await panel.getByRole('tab').nth(3).click();
  await panel.locator('.reference-panel__viewer').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'evidence/reference-board.png', fullPage: true });
});

test('per-image analysis notes autosave to native IndexedDB and selected reference survives reload', async ({ page }) => {
  await ready(page); const panel = page.locator('.reference-panel');
  await panel.getByRole('tab').nth(5).click();
  const notes = '觀察：透明展示廊。推估：通道寬度未測量；XYZ 仍待設計。';
  await panel.getByRole('textbox', { name: '參考圖片分析筆記' }).fill(notes);
  // Poll committed native data rather than accepting an earlier Saved label.
  await expect.poll(async () => (await storedBoards(page)).find(board => board.selectedId === 'reference-06')?.notes['reference-06']).toBe(notes);
  await page.reload(); await expect(page.getByTestId('cell-count')).toHaveText('6137'); await openReferences(page);
  await expect(panel.getByRole('tab').nth(5)).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('textbox', { name: '參考圖片分析筆記' })).toHaveValue(notes);
  await panel.getByRole('tab').nth(3).click(); await expect(panel.getByRole('textbox', { name: '參考圖片分析筆記' })).toHaveValue('');
  await panel.getByRole('tab').nth(5).click(); await expect(panel.getByRole('textbox', { name: '參考圖片分析筆記' })).toHaveValue(notes);
});

test('uploaded image persists as a native Blob and produces no AI POST or external request', async ({ page }) => {
  const forbidden: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'POST' || (url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname))) forbidden.push(request.method() + ' ' + request.url());
  });
  await ready(page); const panel = page.locator('.reference-panel');
  await panel.getByLabel('加入本機參考圖片').setInputFiles({ name: 'local-upload.png', mimeType: 'image/png', buffer: tinyPng });
  await expect(panel.getByRole('tab')).toHaveCount(12); await expect(panel.locator('.reference-panel__image')).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => panel.locator('.reference-panel__image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await expect.poll(async () => (await storedBoards(page))[0]?.uploads[0]?.size).toBe(tinyPng.length);
  const before = (await storedBoards(page))[0]!; expect(before.uploads[0]!.type).toBe('image/png'); expect(before.selectedId).toBe(before.uploads[0]!.id);
  await page.reload(); await expect(page.getByTestId('cell-count')).toHaveText('6137'); await openReferences(page);
  await expect(panel.getByRole('tab')).toHaveCount(12); await expect(panel.locator('.reference-panel__image')).toHaveAttribute('src', /^blob:/);
  await expect(panel.locator('.reference-panel__caption')).toContainText('local-upload.png');
  await expect.poll(() => panel.locator('.reference-panel__image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await expect(page.locator('.reference-card img')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('.reference-card')).toContainText('local-upload.png');
  await expect.poll(() => page.locator('.reference-card img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  expect(await storedBoards(page)).toEqual([before]); expect(forbidden).toEqual([]);
});

test('unsupported, oversized and excessive uploads fail without changing references or canonical model', async ({ page }) => {
  await ready(page); const panel = page.locator('.reference-panel'), input = panel.getByLabel('加入本機參考圖片');
  await input.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }); await expect(panel.getByRole('alert')).toContainText('PNG');
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(4 * 1024 * 1024 + 1) }); await expect(panel.getByRole('alert')).toContainText('4 MiB');
  await input.setInputFiles(Array.from({ length: 12 }, (_, i) => ({ name: `too-many-${i}.png`, mimeType: 'image/png', buffer: tinyPng })));
  await expect(panel.getByRole('alert')).toContainText('11'); await expect(panel.getByRole('tab')).toHaveCount(11);
  expect((await storedBoards(page)).flatMap(board => board.uploads)).toEqual([]); await expect(page.getByTestId('cell-count')).toHaveText('6137');
});

test('missing local manifest gives an upload fallback instead of fake seeded images', async ({ page }) => {
  await page.route('**/local-references/manifest.json', route => route.fulfill({ status: 404, body: 'Not found' }));
  await ready(page); const panel = page.locator('.reference-panel');
  await expect(panel).toContainText('此裝置沒有內建參考圖冊'); await expect(panel.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('.reference-card img')).toHaveCount(0);
  await expect(page.locator('.reference-card')).toContainText('加入你的設計照片');
  await panel.getByLabel('加入本機參考圖片').setInputFiles({ name: 'fallback.png', mimeType: 'image/png', buffer: tinyPng });
  await expect(panel.getByRole('tab')).toHaveCount(1); await expect(panel.locator('.reference-panel__caption')).toContainText('fallback.png');
  await expect.poll(async () => (await storedBoards(page))[0]?.uploads.length).toBe(1);
});



test('reference card resets uploaded preview when switching projects', async ({ page }) => {
  await ready(page); const panel = page.locator('.reference-panel');
  await panel.getByLabel('加入本機參考圖片').setInputFiles({ name: 'old-project-only.png', mimeType: 'image/png', buffer: tinyPng });
  await expect(page.locator('.reference-card img')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('.reference-card')).toContainText('old-project-only.png');
  await expect.poll(async () => (await storedBoards(page))[0]?.uploads.length).toBe(1);
  await page.locator('[data-reference-drawer] .drawer-close').click();
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await expect(page.locator('.reference-card img')).toHaveAttribute('src', '/local-references/reference-04.png');
  await expect(page.locator('.reference-card')).not.toContainText('old-project-only.png');
  await openReferences(page);
  await expect(panel.getByRole('tab')).toHaveCount(11);
  await expect(panel.getByRole('tab').nth(3)).toHaveAttribute('aria-selected', 'true');
});

test('broken selected reference offers a visible card fallback and another selection recovers', async ({ page }) => {
  await page.route('**/local-references/reference-06.png', route => route.fulfill({ status: 404, body: 'Missing test image' }));
  await ready(page); const panel = page.locator('.reference-panel');
  await panel.getByRole('tab').nth(5).click();
  await expect(page.locator('.reference-card')).toContainText('圖片無法顯示');
  await expect(page.locator('.reference-card img')).toHaveCount(0);
  await panel.getByRole('tab').nth(3).click();
  await expect(page.locator('.reference-card img')).toHaveAttribute('src', '/local-references/reference-04.png');
  await expect.poll(() => page.locator('.reference-card img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1536);
});
