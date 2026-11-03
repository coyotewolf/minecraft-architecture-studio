import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { coordinate } from './helpers.ts';
import type { Project } from '../src/core/contracts.ts';
import type { WorkspaceRecord } from '../src/features/projects/storage.ts';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFhQAAAAASUVORK5CYII=', 'base64');
const consent = '我同意傳送這些圖片與設計，並承擔已設定服務的費用';
function proposal(project: Project, mode = 'valid') {
  const pos = { x: mode === 'outside' ? 20 : mode === 'second' ? 1 : 0, y: 0, z: 0 };
  return { kind: 'proposal', minecraftVersion: '1.20.1', baseRevision: mode === 'stale' ? 'stale' : project.designRevision,
    summary: 'TEST-ONLY synthetic proposal', uncertainties: ['Test fixture; not a real provider result'],
    transaction: { id: 'test-ai-' + crypto.randomUUID(), baseRevision: project.designRevision, cause: 'ai_approved', collisionPolicy: 'cancel', structures: [], changes: [{ pos, before: null,
      after: { uid: 'ai-test-block-' + mode, id: 'minecraft:stone', pos, state: mode === 'invalid' ? { bogus: 'value' } : {},
        source: { origin: 'ai_estimated', confidence: 0.65 }, edits: { createdByTransactionId: 'proposal', lastModifiedByTransactionId: 'proposal', userModified: false } } }] } };
}
async function configured(page: Page) {
  await page.route('**/api/ai/capabilities', route => route.fulfill({ json: { enabled: true, model: 'TEST-ONLY-ROUTED-PROVIDER', reason: 'Synthetic browser test, no billed service' } }));
}
async function closeDrawers(page: Page) { for(const drawer of await page.locator('details.utility-drawer[open]').all())await drawer.locator('summary').click(); }
async function openAi(page: Page) { await closeDrawers(page); await page.locator('summary').filter({hasText:/^AI 圖片分析與編輯$/}).click(); }
async function blank(page: Page) { await closeDrawers(page); await page.getByRole('button', { name: '空白專案', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('0'); }
async function backup(page: Page): Promise<WorkspaceRecord> {
  await closeDrawers(page);
  const details = page.locator('details').filter({ has: page.locator('summary', { hasText: /^專案與備份$/ }) });
  if (!(await details.evaluate(node => (node as HTMLDetailsElement).open))) await details.locator('summary').click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '下載完整備份', exact: true }).click();
  const path = await (await pending).path(); if (!path) throw new Error('No backup download'); return JSON.parse(await readFile(path, 'utf8')) as WorkspaceRecord;
}
test('real unconfigured capability disables paid actions; local image selection makes no POST and manual editing works', async ({ page }) => {
  let posts = 0; page.on('request', req => { if (req.url().endsWith('/api/ai/propose')) posts++; });
  await page.goto('/?sample=house'); const capability = await page.request.get('/api/ai/capabilities'); expect(await capability.json()).toMatchObject({ enabled: false });
  await openAi(page); const panel = page.locator('.ai-panel'); await expect(panel).toContainText('AI 已停用');
  await panel.locator('input[type=file]').setInputFiles({ name: 'local-only.png', mimeType: 'image/png', buffer: png });
  await expect(panel.getByRole('img')).toHaveCount(1); await panel.getByRole('textbox', { name: '需求' }).fill('Local-only test');
  await panel.getByRole('checkbox', { name: consent }).check(); await expect(panel.getByRole('button', { name: '傳送並取得提案' })).toBeDisabled(); expect(posts).toBe(0);
  await blank(page); await page.getByText('編輯工具與方塊', { exact: true }).click(); await page.getByRole('radio', { name: '放置', exact: true }).check();
  await coordinate(page, 0, 0, 0); await page.getByRole('button', { name: '套用變更', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('1'); expect(posts).toBe(0);
});

test('TEST-ONLY routed analysis requires consent, displays estimates and permits dimension adjustment', async ({ page }) => {
  await configured(page); let calls = 0;
  await page.route('**/api/ai/propose', route => { calls++; const data = route.request().postDataJSON(); expect(data.consent).toBe(true); expect(data.images).toHaveLength(1);
    return route.fulfill({ json: { kind: 'analysis', summary: 'TEST-ONLY estimated facade', dimensions: { x: 8, y: 6, z: 9 }, uncertainties: ['背面未知，非真實測量'] } }); });
  await page.goto('/?sample=house'); await openAi(page); const panel = page.locator('.ai-panel');
  await panel.locator('input[type=file]').setInputFiles({ name: 'test-only.png', mimeType: 'image/png', buffer: png });
  await panel.getByRole('textbox', { name: '需求' }).fill('Estimate this test image');
  await expect(panel.getByRole('button', { name: '傳送並取得提案' })).toBeDisabled(); expect(calls).toBe(0);
  await panel.getByRole('checkbox', { name: consent }).check(); await panel.getByRole('button', { name: '傳送並取得提案' }).click();
  await expect(panel.getByRole('heading', { name: 'AI 估計分析（非實測）' })).toBeVisible(); await expect(panel).toContainText('背面未知');
  await expect(panel.getByRole('spinbutton', { name: '寬', exact: true })).toHaveValue('8');
  await panel.getByRole('spinbutton', { name: '寬', exact: true }).fill('10'); await expect(panel.getByRole('spinbutton', { name: '寬', exact: true })).toHaveValue('10');
  await expect(panel.getByRole('checkbox', { name: consent })).not.toBeChecked(); await expect(page.getByTestId('cell-count')).toHaveText('288'); expect(calls).toBe(1);
});

test('TEST-ONLY accepted proposal requires preview confirmation and keeps full audit plus original AI through undo', async ({ page }) => {
  await configured(page);
  let acceptedCalls = 0;
  await page.route('**/api/ai/propose', route => route.fulfill({ json: proposal((route.request().postDataJSON() as { project: Project }).project, ++acceptedCalls === 1 ? 'valid' : 'second') }));
  await page.goto('/?sample=house'); await blank(page); await openAi(page); const panel = page.locator('.ai-panel');
  await panel.getByRole('combobox', { name: '操作', exact: true }).selectOption('generate');
  const prompt = '完整使用者需求'.repeat(200) + 'END-OF-FULL-PROMPT'; await panel.getByRole('textbox', { name: '需求' }).fill(prompt);
  await panel.getByRole('checkbox', { name: consent }).check(); await panel.getByRole('button', { name: '傳送並取得提案' }).click();
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('TEST-ONLY synthetic proposal'); await expect(page.getByTestId('cell-count')).toHaveText('0');
  await closeDrawers(page); await page.getByRole('button', { name: '套用變更', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('1');
  const accepted = await backup(page); const event = accepted.revisionLog.find(entry => entry.transaction?.cause === 'ai_approved')!;
  expect(event.detail).toContain(prompt); expect(event.detail).toContain('TEST-ONLY-ROUTED-PROVIDER'); expect(event.detail).toContain('"min"');
  expect(event.transaction!.changes).toHaveLength(1); expect(accepted.original.blocks).toEqual(accepted.project.blocks);
  expect(accepted.project.blocks[0]!.source).toEqual({ origin: 'ai_estimated', confidence: 0.65 });
  await closeDrawers(page); await page.getByRole('button', { name: '復原', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('0');
  const undone = await backup(page); expect(undone.original.blocks).toEqual(accepted.original.blocks); expect(undone.revisionLog.find(r => r.id === event.id)).toEqual(event);
  expect(undone.originalAi).toBe(true);
  // Simulate legitimate bounded-log pruning through the actual backup importer.
  page.once('dialog', dialog => void dialog.accept());
  await page.getByLabel('匯入完整備份', { exact: true }).setInputFiles({ name: 'pruned-history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...undone, revisionLog: [] })) });
  await expect(page.locator('.project-panel')).toContainText('匯入完成');
  await openAi(page);
  await panel.getByRole('checkbox', { name: consent }).check(); await panel.getByRole('button', { name: '傳送並取得提案' }).click();
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽有效');
  await closeDrawers(page); await page.getByRole('button', { name: '套用變更', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('1');
  const second = await backup(page); expect(second.project.blocks[0]!.pos.x).toBe(1);
  expect(second.original).toEqual(accepted.original); expect(second.originalAi).toBe(true);
});

test('TEST-ONLY invalid, out-of-scope and stale proposals never publish canonical changes', async ({ page }) => {
  await configured(page); let mode = 'invalid';
  await page.route('**/api/ai/propose', route => route.fulfill({ json: proposal((route.request().postDataJSON() as { project: Project }).project, mode) }));
  await page.goto('/?sample=house'); await blank(page); await openAi(page); const panel = page.locator('.ai-panel');
  await panel.getByRole('combobox', { name: '操作', exact: true }).selectOption('edit'); await panel.getByRole('textbox', { name: '需求' }).fill('Test-only rejection');
  for (const next of ['invalid', 'outside', 'stale']) {
    mode = next; await panel.getByRole('checkbox', { name: consent }).check();
    const response = page.waitForResponse('**/api/ai/propose'); await panel.getByRole('button', { name: '傳送並取得提案' }).click(); await response;
    await expect(page.locator('.viewer-status')).toContainText('無法完成操作'); await expect(page.getByRole('region', { name: '變更預覽' })).toHaveCount(0);
    await expect(page.getByTestId('cell-count')).toHaveText('0'); await expect(panel.getByRole('button', { name: '傳送並取得提案' })).toBeEnabled();
  }
  const result = await backup(page); expect(result.project.blocks).toHaveLength(0); expect(result.revisionLog.filter(r => r.transaction?.cause === 'ai_approved')).toHaveLength(0);
});

