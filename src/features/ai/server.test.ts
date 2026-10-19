import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiHandler, type AiConfig } from '../../../server/ai.ts';
import { createEmptyProject } from '../../core/project.ts';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }))); });
const config: AiConfig = { url: 'https://test-provider.invalid/propose', key: 'TEST-ONLY-NOT-A-REAL-KEY', model: 'test-only-provider', publicOrigin: 'http://studio.test' };
const project = createEmptyProject('http-test', 'HTTP test');
const payload = { kind: 'edit', project, scope: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } }, prompt: 'Test fixture', images: [], consent: true };
function proposal() {
  const pos = { x: 0, y: 0, z: 0 };
  return { kind: 'proposal', minecraftVersion: '1.20.1', baseRevision: 'initial', summary: 'TEST-ONLY result', uncertainties: ['Synthetic provider fixture'],
    transaction: { id: 'test-tx', baseRevision: 'initial', cause: 'ai_approved', collisionPolicy: 'cancel', structures: [], changes: [{ pos, before: null,
      after: { uid: 'new', id: 'minecraft:stone', pos, state: {}, source: { origin: 'ai_estimated', confidence: 0.5 }, edits: { createdByTransactionId: 'draft', lastModifiedByTransactionId: 'draft', userModified: false } } }] } };
}
async function start(c: AiConfig, upstream: typeof fetch) {
  const handler = createAiHandler(c, upstream);
  const server = createServer((req, res) => { void handler(req, res).then(handled => { if (!handled) { res.statusCode = 404; res.end(); } }).catch(error => { res.statusCode = 500; res.end(String(error)); }); });
  servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local server address');
  return `http://127.0.0.1:${address.port}`;
}
function post(url: string, body: unknown, origin = config.publicOrigin) { return fetch(url + '/api/ai/propose', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
describe('real local AI HTTP boundary with test-only upstream', () => {
  it('reports disabled without credentials and never invokes upstream', async () => {
    const upstream = vi.fn<typeof fetch>();
    const url = await start({ ...config, key: '' }, upstream);
    const capabilities = await fetch(url + '/api/ai/capabilities');
    expect(capabilities.status).toBe(200); expect(await capabilities.json()).toMatchObject({ enabled: false });
    expect((await post(url, payload)).status).toBe(503); expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests before any upstream call', async () => {
    const upstream = vi.fn<typeof fetch>(); const url = await start(config, upstream);
    expect((await post(url, payload, 'https://attacker.invalid')).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('requires consent before any upstream call', async () => {
    const upstream = vi.fn<typeof fetch>(); const url = await start(config, upstream);
    expect((await post(url, { ...payload, consent: false })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects malformed provider proposals without publishing them', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...proposal(), baseRevision: 'stale' }));
    const url = await start(config, upstream); const response = await post(url, payload);
    expect(response.status).toBe(400); const result = await response.json() as Record<string, unknown>;
    expect(result.transaction).toBeUndefined(); expect(result.error).toBeTypeOf('string'); expect(project.blocks).toEqual([]);
  });
  it('returns validated preview structure without changing canonical state or exposing credentials', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(Response.json(proposal()));
    const url = await start(config, upstream); const response = await post(url, payload);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.text(); expect(body).not.toContain(config.key);
    expect(JSON.parse(body)).toMatchObject({ kind: 'proposal', baseRevision: 'initial', transaction: { cause: 'ai_approved' } });
    expect(project.blocks).toEqual([]); expect(upstream).toHaveBeenCalledTimes(1);
    const [target, options] = upstream.mock.calls[0]!;
    expect(target).toBe(config.url); expect(options!.redirect).toBe('error');
    expect((options!.headers as Record<string, string>).Authorization).toBe('Bearer ' + config.key);
  });
  it('rate limits concurrent requests without making a second upstream call', async () => {
    let release!: (response: Response) => void;
    const upstream = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => { release = resolve; }));
    const url = await start(config, upstream); const first = post(url, payload);
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    expect((await post(url, payload)).status).toBe(429);
    release(Response.json(proposal())); expect((await first).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('isolated incoming-stream timeout regression (mock response only)', () => {
  it('destroys stalled input, releases active state and removes response close listener', async () => {
    vi.useFakeTimers();
    try {
      const upstream = vi.fn<typeof fetch>().mockResolvedValue(Response.json(proposal()));
      const handler = createAiHandler(config, upstream);
      function incoming() {
        return Object.assign(new PassThrough(), { url: '/api/ai/propose', method: 'POST', headers: { origin: config.publicOrigin, 'content-type': 'application/json' } });
      }
      function response() {
        const res = Object.assign(new EventEmitter(), { writableEnded: false, writeHead: vi.fn(), end: vi.fn() });
        res.end.mockImplementation(() => { res.writableEnded = true; });
        return res;
      }
      const req = incoming(), res = response();
      req.write('{');
      const result = handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await result).toBe(true);
      expect(req.destroyed).toBe(true); expect(upstream).not.toHaveBeenCalled();
      expect(res.listenerCount('close')).toBe(0); expect(vi.getTimerCount()).toBe(0);
      const next = incoming(), nextRes = response(); next.end(JSON.stringify(payload));
      expect(await handler(next as unknown as IncomingMessage, nextRes as unknown as ServerResponse)).toBe(true);
      expect(upstream).toHaveBeenCalledTimes(1); expect(nextRes.writeHead.mock.calls[0]![0]).toBe(200);
      expect(nextRes.listenerCount('close')).toBe(0); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
