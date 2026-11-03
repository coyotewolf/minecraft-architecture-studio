import { test, expect, type Page } from '@playwright/test';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import type { BlockRecord, MinecraftId } from '../src/core/contracts.ts';
import { createEmptyProject } from '../src/core/project.ts';
import { clickWorld, coordinate } from './helpers.ts';

const profileDevelopment = process.env.STUDIO_PROFILE_DEV === '1';
const profileOrigin = profileDevelopment ? 'http://127.0.0.1:5180' : 'http://127.0.0.1:5292';
const buildMode = profileDevelopment ? 'development' : 'production';
let profileServer: ReturnType<typeof spawn> | undefined;

interface RendererStats { drawCalls: number; geometries: number; triangles: number; visibleInstances: number }
const cases = [
  { cells: 1000, dimensions: [10, 10, 10] },
  { cells: 10000, dimensions: [50, 4, 50] },
  { cells: 50000, dimensions: [50, 20, 50] },
] as const;

function fixture(cells: number, dimensions: readonly [number, number, number]) {
  const [width, height, depth] = dimensions;
  const min = { x: -Math.floor(width / 2), y: -2, z: -Math.floor(depth / 2) };
  const blocks: BlockRecord[] = [];
  // Complete Java 1.20.1 states; the real app importer validates every generated record.
  const states = {
    'minecraft:stone': {},
    'minecraft:glass': {},
    'minecraft:oak_stairs': { facing: 'east', half: 'bottom', shape: 'straight', waterlogged: 'false' },
  };
  for (let y = 0; y < height; y++) for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
    const index = blocks.length;
    const id: MinecraftId = index > 0 && index % 20 === 0 ? 'minecraft:glass' : index > 0 && index % 11 === 0 ? 'minecraft:oak_stairs' : 'minecraft:stone';
    blocks.push({ uid: 'profile-' + index, id, pos: { x: x + min.x, y: y + min.y, z: z + min.z },
      state: states[id as keyof typeof states], source: { origin: 'user_created' },
      edits: { createdByTransactionId: 'profile-import', lastModifiedByTransactionId: 'profile-import', userModified: false } });
  }
  expect(blocks).toHaveLength(cells);
  const project = { ...createEmptyProject('profile-' + cells, cells + ' 格效能驗證'), designRevision: 'profile-v1', blocks };
  const buffer = Buffer.from(JSON.stringify(project));
  expect(buffer.byteLength).toBeLessThanOrEqual(32 * 1024 * 1024);
  return { buffer, min };
}
async function painted(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function rendererStats(page: Page): Promise<RendererStats> {
  return JSON.parse((await page.locator('canvas.viewer-canvas').getAttribute('data-renderer-stats'))!) as RendererStats;
}
function distribution(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { samplesMs: samples, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    medianMs: sorted[Math.floor(sorted.length / 2)]!, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1]!, maxMs: sorted[sorted.length - 1]! };
}

test.beforeAll(async ({ browserName }, testInfo) => {
  if (!profileDevelopment) {
    await access('dist/index.html'); await access('dist-server/start.js');
    profileServer = spawn(process.execPath, ['dist-server/start.js'], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore',
      env: { ...process.env, PORT: '5292', STUDIO_AI_URL: '', STUDIO_AI_KEY: '', STUDIO_AI_MODEL: 'disabled-profile', STUDIO_PUBLIC_ORIGIN: profileOrigin } });
    let startupError: Error | undefined; profileServer.on('error', error => { startupError = error; });
    await expect.poll(async () => {
      if (startupError) throw startupError;
      if (profileServer?.exitCode !== null) throw new Error('Production profile server exited');
      try { return (await fetch(profileOrigin, { signal: AbortSignal.timeout(1000) })).status; } catch { return 0; }
    }, { timeout: 10000 }).toBe(200);
    const capability = await fetch(profileOrigin + '/api/ai/capabilities');
    expect(await capability.json()).toMatchObject({ enabled: false, model: 'disabled-profile' });
  }
  await mkdir(testInfo.project.outputDir, { recursive: true });
  // Playwright clears outputDir per run; the marker survives worker restarts after failures.
  try { await writeFile(join(testInfo.project.outputDir, 'performance-initialized'), browserName, { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return; throw error; }
  await mkdir('evidence', { recursive: true });
  await writeFile('evidence/performance.json', JSON.stringify({
    schema: 1, buildMode, appOrigin: profileOrigin, startedAt: new Date().toISOString(),
    methodology: 'Explicit '+buildMode+' build at '+profileOrigin+'. Production excludes React development instrumentation; STUDIO_PROFILE_DEV=1 retains development reproduction. All thresholds and workflows are identical. Public JSON file import and editor UI; driver-observed elapsed times include automation overhead. Two requestAnimationFrame callbacks follow measured interactions. Orbit throughput is effective update throughput, not display FPS. Heap samples are not peak memory. Software GPU launch flags are configured by Playwright.',
    fixtures: [],
  }, null, 2));
});

test.afterAll(async () => {
  const child = profileServer;
  if (child && child.exitCode === null && child.signalCode === null) await new Promise<void>(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill();
  });
  profileServer = undefined;
});

for (const scenario of cases) test('@profile ' + scenario.cells + ' canonical cells: real import, picking, orbit, remove and undo', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  const { buffer, min } = fixture(scenario.cells, scenario.dimensions);
  const report: Record<string, unknown> = {
    buildMode, appOrigin: profileOrigin, cells: scenario.cells, dimensions: scenario.dimensions, origin: min, importBytes: buffer.byteLength,
    browser: browser.version(), viewport: page.viewportSize(), startedAt: new Date().toISOString(), status: 'running',
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => (await cdp.send('Performance.getMetrics')).metrics.find((metric: { name: string; value: number }) => metric.name === 'JSHeapUsedSize')?.value ?? null;
  page.on('dialog', async dialog => { await dialog.accept(); });
  try {
    await page.goto(profileOrigin + '/?sample=house');
    await page.locator('summary').filter({ hasText: /^專案與備份$/ }).click();
    const startImport = performance.now();
    await page.getByLabel('匯入模型 JSON', { exact: true }).setInputFiles({ name: 'profile-' + scenario.cells + '.json', mimeType: 'application/json', buffer });
    await expect(page.getByTestId('cell-count')).toHaveText(String(scenario.cells), { timeout: 60_000 });
    await expect.poll(async () => (await rendererStats(page)).visibleInstances, { timeout: 60_000 }).toBeGreaterThanOrEqual(scenario.cells);
    await painted(page);
    report.importToRenderMs = performance.now() - startImport;
    expect(report.importToRenderMs).toBeLessThan(60_000);
    report.renderer = await rendererStats(page);
    report.heapAfterImportBytes = await heap();
    report.webgl = await page.locator('canvas.viewer-canvas').evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2')!;
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) as string : null,
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : null };
    });
    await page.locator('summary').filter({ hasText: /^專案與備份$/ }).click();
    await page.getByRole('button', { name: '正面', exact: true }).click();
    const pickStart = performance.now();
    await clickWorld(page, [min.x + .5, min.y + .5, min.z]);
    for (const [label, value] of [['X（東西）', min.x], ['Y（高度）', min.y], ['Z（南北）', min.z]] as const) {
      await expect(page.locator('.inspector-grid dt', { hasText: label }).locator('+ dd')).toHaveText(String(value));
    }
    await expect(page.locator('.block-inspector')).toContainText('minecraft:stone');
    await painted(page);
    report.pickRoundTripMs = performance.now() - pickStart;
    expect(report.pickRoundTripMs).toBeLessThan(5000);

    const canvas = page.locator('canvas.viewer-canvas');
    await canvas.scrollIntoViewIfNeeded(); await canvas.focus();
    const previousCamera = await canvas.getAttribute('data-camera');
    const orbitSamples: number[] = [], orbitStart = performance.now();
    for (let index = 0; index < 30; index++) {
      const start = performance.now();
      await page.keyboard.press('ArrowRight'); await painted(page);
      orbitSamples.push(performance.now() - start);
    }
    const orbitDuration = performance.now() - orbitStart;
    expect(await canvas.getAttribute('data-camera')).not.toBe(previousCamera);
    report.orbitInputToPaint = distribution(orbitSamples);
    report.effectiveOrbitUpdatesPerSecond = 30_000 / orbitDuration;
    expect(Math.max(...orbitSamples)).toBeLessThan(5000);
    report.heapAfterOrbitBytes = await heap();

    await page.locator('summary').filter({ hasText: /^編輯工具與方塊$/ }).click();
    await page.getByRole('radio', { name: '移除', exact: true }).check();
    const previewStart = performance.now();
    await coordinate(page, min.x, min.y, min.z);
    await expect(page.getByRole('region', { name: '變更預覽' })).toContainText('預覽有效');
    report.removePreviewRoundTripMs = performance.now() - previewStart;
    expect(report.removePreviewRoundTripMs).toBeLessThan(5000);
    const editStart = performance.now();
    await page.getByRole('button', { name: '套用變更', exact: true }).click({ timeout: 5000 });
    await expect(page.getByTestId('cell-count')).toHaveText(String(scenario.cells - 1), { timeout: 5000 }); await painted(page);
    report.removeCommitToRenderMs = performance.now() - editStart;
    expect(report.removeCommitToRenderMs).toBeLessThan(5000);
    const undoStart = performance.now();
    await page.getByRole('button', { name: '復原', exact: true }).click({ timeout: 5000 });
    await expect(page.getByTestId('cell-count')).toHaveText(String(scenario.cells), { timeout: 5000 }); await painted(page);
    report.undoToRenderMs = performance.now() - undoStart;
    expect(report.undoToRenderMs).toBeLessThan(5000);
    report.heapAfterUndoBytes = await heap();
    report.rendererAfterUndo = await rendererStats(page);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await testInfo.attach('performance-' + scenario.cells, { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    const aggregate = JSON.parse(await readFile('evidence/performance.json', 'utf8')) as { fixtures: Record<string, unknown>[] };
    aggregate.fixtures.push(report); await writeFile('evidence/performance.json', JSON.stringify(aggregate, null, 2));
    await cdp.detach();
  }
});
