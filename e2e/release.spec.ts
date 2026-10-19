import { test, expect, type Page } from '@playwright/test';
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { Project } from '../src/core/contracts.ts';
import type { WorkspaceRecord } from '../src/features/projects/storage.ts';
import type { BlueprintGrid } from '../src/features/blueprint/BlueprintPanel.tsx';
import { clickWorld } from './helpers.ts';

async function panel(page: Page, name: string, open = true) {
  const summary = page.locator('summary').filter({ hasText: new RegExp('^' + name + '$') });
  const expanded = await summary.locator('..').getAttribute('open') !== null;
  if (expanded !== open) await summary.click();
}
async function download(page: Page, label: string): Promise<Buffer> {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const downloaded = await event; const file = await downloaded.path();
  if (!file) throw new Error('Downloaded file unavailable');
  return readFile(file);
}
async function confirm(page: Page) {
  await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽有效');
  await page.getByRole('button', { name: '套用變更', exact: true }).click();
}
async function saved(page: Page) {
  await panel(page, '專案與備份');
  await page.getByRole('button', { name: '立即儲存', exact: true }).click();
  await expect(page.locator('.project-panel').getByRole('status').first()).toHaveText('已儲存於此瀏覽器', { timeout: 10_000 });
}
async function blueprintClick(page: Page, x: number, z: number) {
  const canvas = page.locator('.blueprint-canvas'); await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (JSON.parse((await canvas.getAttribute('data-grid'))!) as BlueprintGrid).columns).toBeGreaterThan(5);
  const grid = JSON.parse((await canvas.getAttribute('data-grid'))!) as BlueprintGrid;
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + (grid.offsetX + (x - grid.originX + .5) * grid.cellSize) * box.width / grid.width,
    box.y + (grid.offsetY + (z - grid.originZ + .5) * grid.cellSize) * box.height / grid.height);
}
function canonical(project: Project) {
  return { ...project, blocks: [...project.blocks].sort((a, b) => a.uid.localeCompare(b.uid)),
    logicalStructures: [...project.logicalStructures].sort((a, b) => a.uid.localeCompare(b.uid)) };
}
/** Independent decoder for this downloaded quoted-CSV fixture; JSON escapes embedded line breaks. */
function downloadedCsv(buffer: Buffer): Project {
  const rows = buffer.toString('utf8').trimEnd().split(/\r?\n/).map(line =>
    [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match => match[1]!.replaceAll('""', '"')));
  expect(rows[0]).toEqual(['record', 'x', 'y', 'z', 'json']);
  expect(rows[1]?.[0]).toBe('project');
  const metadata = JSON.parse(rows[1]![4]!) as Omit<Project, 'blocks'>;
  const blocks = rows.slice(2).map(row => {
    expect(row).toHaveLength(5); expect(row[0]).toBe('block');
    const block = JSON.parse(row[4]!) as Project['blocks'][number];
    expect([Number(row[1]), Number(row[2]), Number(row[3])]).toEqual([block.pos.x, block.pos.y, block.pos.z]);
    return block;
  });
  return { ...metadata, blocks };
}

test('complete manual release journey preserves design, provenance, materials and construction through backup reimport', async ({ page }) => {
  test.setTimeout(90_000); page.on('dialog', dialog => void dialog.accept());
  await page.goto('/'); await expect(page.getByTestId('cell-count')).toHaveText('288');
  await panel(page, '專案與備份');
  const seedFile = await download(page, '下載模型 JSON');
  const original = JSON.parse(seedFile.toString('utf8')) as Project;
  expect(original.blocks).toHaveLength(288); expect(original.logicalStructures).toHaveLength(2);
  await page.getByRole('button', { name: '空白專案', exact: true }).click();
  await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByLabel('匯入模型 JSON', { exact: true }).setInputFiles({ name: 'seed-model.json', mimeType: 'application/json', buffer: seedFile });
  await expect(page.getByTestId('cell-count')).toHaveText('288');
  await panel(page, '編輯工具與方塊');
  await page.getByRole('radio', { name: '放置', exact: true }).check();
  await page.getByRole('combobox', { name: '方塊種類', exact: true }).selectOption('minecraft:oak_stairs');
  await page.getByRole('button', { name: '俯視', exact: true }).click();
  await clickWorld(page, [.5, 9, .5]);
  await expect(page.getByTestId('cell-count')).toHaveText('288'); await confirm(page);
  await expect(page.getByTestId('cell-count')).toHaveText('289');

  await page.getByRole('radio', { name: '選取', exact: true }).check();
  await panel(page, '2D 逐層藍圖');
  await page.getByRole('spinbutton', { name: '藍圖樓層 Y', exact: true }).fill('9');
  await blueprintClick(page, 0, 0);
  await expect(page.locator('.block-inspector')).toContainText('minecraft:oak_stairs');
  await expect(page.locator('.inspector-grid dt', { hasText: 'Y（高度）' }).locator('+ dd')).toHaveText('9');
  const addedUid = await page.locator('.inspector-grid dt', { hasText: '識別碼 UID' }).locator('+ dd').innerText();
  await page.getByRole('combobox', { name: '方塊狀態 facing', exact: true }).selectOption('west');
  await page.getByRole('combobox', { name: '方塊狀態 half', exact: true }).selectOption('top');
  await page.getByRole('button', { name: '將狀態套用到選取方塊', exact: true }).click(); await confirm(page);
  await expect(page.locator('.inspector-grid dt', { hasText: '識別碼 UID' }).locator('+ dd')).toHaveText(addedUid);
  await expect(page.locator('.state-list')).toContainText('west'); await expect(page.locator('.state-list')).toContainText('top');
  await panel(page, '材料與施工引導');
  await expect(page.getByRole('region', { name: '材料與施工', exact: true })).toContainText('佔用格數 289；放置物品總數 288');
  await page.getByRole('spinbutton', { name: 'minecraft:oak_stairs 已備數量', exact: true }).fill('8');
  await saved(page);
  const beforeReload = JSON.parse((await download(page, '下載完整備份')).toString('utf8')) as WorkspaceRecord;
  const edited = beforeReload.project.blocks.find(block => block.uid === addedUid)!;
  expect(edited.pos).toEqual({ x: 0, y: 9, z: 0 });
  expect(edited.state).toMatchObject({ facing: 'west', half: 'top' });
  expect(edited.source).toEqual({ origin: 'user_created' }); expect(edited.edits.userModified).toBe(true);
  for (const block of original.blocks) expect(beforeReload.project.blocks.find(candidate => candidate.uid === block.uid)).toEqual(block);

  await page.reload(); await expect(page.getByTestId('cell-count')).toHaveText('289');
  await panel(page, '專案與備份');
  const afterReload = JSON.parse((await download(page, '下載完整備份')).toString('utf8')) as WorkspaceRecord;
  expect(afterReload.project).toEqual(beforeReload.project); expect(afterReload.prepared).toEqual(beforeReload.prepared);
  await panel(page, '材料與施工引導');
  await page.getByRole('button', { name: '確認施工設計變更', exact: true }).click();
  await page.getByRole('button', { name: '施工模式', exact: true }).click();
  await page.getByRole('button', { name: '標記此步完成', exact: true }).click();
  const progress = page.getByRole('slider', { name: '施工順序進度', exact: true });
  await progress.focus(); await progress.press('End'); await expect(progress).toHaveValue('100');
  await expect(page.getByRole('region', { name: '材料與施工', exact: true })).toContainText('已完成 1 / 289 格');
  await saved(page);
  const backup = await download(page, '下載完整備份');
  const expected = JSON.parse(backup.toString('utf8')) as WorkspaceRecord;
  expect(expected.completed).toHaveLength(1); expect(expected.prepared['minecraft:oak_stairs']).toBe(8);
  const csv = await download(page, '下載完整 XYZ CSV');
  expect(canonical(downloadedCsv(csv))).toEqual(canonical(expected.project));
  await page.getByRole('button', { name: '空白專案', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('0');
  await page.getByLabel('匯入完整備份', { exact: true }).setInputFiles({ name: 'release-backup.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByTestId('cell-count')).toHaveText('289');
  const restored = JSON.parse((await download(page, '下載完整備份')).toString('utf8')) as WorkspaceRecord;
  expect(restored.project).toEqual(expected.project); expect(restored.original).toEqual(expected.original);
  expect(restored.approvedDesign).toEqual(expected.approvedDesign); expect(restored.completed).toEqual(expected.completed);
  expect(restored.prepared).toEqual(expected.prepared); expect(restored.view).toEqual(expected.view);
  expect(restored.revisionLog).toEqual(expected.revisionLog);
  await panel(page, '專案與備份', false); await panel(page, '編輯工具與方塊', false);
  await page.getByRole('button', { name: '等角視角', exact: true }).click();
  await page.locator('canvas.viewer-canvas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'evidence/m10-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/m10-mobile-layout.png', fullPage: true });
});

test('built production server serves assets with AI disabled and manual editing operational', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  await access('dist/index.html'); await access('dist-server/start.js');
  const origin = 'http://127.0.0.1:5291';
  const server = spawn(process.execPath, ['dist-server/start.js'], {
    cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '5291', STUDIO_AI_URL: '', STUDIO_AI_KEY: '', STUDIO_AI_MODEL: 'disabled-smoke', STUDIO_PUBLIC_ORIGIN: origin },
  });
  let output = '', startupError: Error | null = null;
  server.stdout.on('data', data => { output = (output + String(data)).slice(-4000); });
  server.stderr.on('data', data => { output = (output + String(data)).slice(-4000); });
  server.on('error', error => { startupError = error; });
  try {
    await expect.poll(async () => {
      if (startupError) throw startupError;
      if (server.exitCode !== null) throw new Error('Production process exited: ' + server.exitCode);
      try { return (await fetch(origin, { signal: AbortSignal.timeout(1000) })).status; } catch { return 0; }
    }, { timeout: 10_000 }).toBe(200);
    const capabilities = await fetch(origin + '/api/ai/capabilities');
    expect(capabilities.status).toBe(200);
    expect(await capabilities.json()).toMatchObject({ enabled: false, model: 'disabled-smoke' });
    page.on('dialog', dialog => void dialog.accept());
    await page.goto(origin); await expect(page.getByTestId('cell-count')).toHaveText('288');
    await panel(page, 'AI 圖片分析與編輯');
    await expect(page.locator('.ai-panel').getByRole('status').first()).toContainText('AI 已停用');
    await expect(page.getByRole('button', { name: '傳送並取得提案', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '空白專案', exact: true }).click();
    await panel(page, '編輯工具與方塊');
    await page.getByRole('radio', { name: '放置', exact: true }).check();
    await page.getByRole('button', { name: '俯視', exact: true }).click(); await clickWorld(page, [.5, 0, .5]);
    await confirm(page); await expect(page.getByTestId('cell-count')).toHaveText('1');
    await page.getByRole('button', { name: '復原', exact: true }).click(); await expect(page.getByTestId('cell-count')).toHaveText('0');
  } finally {
    if (server.exitCode === null && server.signalCode === null) await new Promise<void>(resolve => {
      const timeout = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 3000);
      server.once('exit', () => { clearTimeout(timeout); resolve(); }); server.kill();
    });
    await testInfo.attach('production-server-output', { body: output, contentType: 'text/plain' });
  }
});
