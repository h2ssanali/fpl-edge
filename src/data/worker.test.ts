import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS module
import worker from '../../relay/worker.js';
// @ts-expect-error plain JS module
import { entryFor } from '../../scripts/invite.mjs';

// In-memory stand-in for a Cloudflare KV namespace.
function kv() {
  const m = new Map<string, string>();
  return {
    m,
    get: async (k: string, type?: string) => { const v = m.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; },
    put: async (k: string, v: string) => { m.set(k, v); },
  };
}

let accessCodes: unknown[] = [];
const realFetch = globalThis.fetch;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z').getTime() + Math.random() * 1e9); // bust the 60s list cache
  globalThis.fetch = (async () => new Response(JSON.stringify({ enabled: true, codes: accessCodes }))) as typeof fetch;
});

const call = (env: unknown, path: string, body: unknown) =>
  worker.fetch(new Request(`https://w.example${path}`, { method: 'POST', body: JSON.stringify(body) }), env, { waitUntil() {} });

describe('one-time invite gate worker', () => {
  it('binds a code to the first device and refuses everyone else', async () => {
    const e = entryFor('حسن', 'ARK-TEST-1234');
    accessCodes = [{ s: e.s, h: e.h, n: e.n }];
    const env = { CODES: kv(), TOKEN_SECRET: 'x'.repeat(32) };

    const bad = await call(env, '/gate/redeem', { code: 'nope', device: 'device-AAAA' });
    expect(bad.status).toBe(403);

    const first = await call(env, '/gate/redeem', { code: ' ark-test-1234 ', device: 'device-AAAA' });
    expect(first.status).toBe(200);
    const { token, name } = await first.json();
    expect(name).toBe('حسن');

    // Same device can redeem again (e.g. after clearing the token) ...
    expect((await call(env, '/gate/redeem', { code: 'ARK-TEST-1234', device: 'device-AAAA' })).status).toBe(200);
    // ... but a second device cannot.
    const other = await call(env, '/gate/redeem', { code: 'ARK-TEST-1234', device: 'device-BBBB' });
    expect(other.status).toBe(403);
    expect((await other.json()).error).toBe('used');

    // The token verifies; a tampered one does not.
    expect((await call(env, '/gate/verify', { token })).status).toBe(200);
    const [body] = token.split('.');
    expect((await call(env, '/gate/verify', { token: `${body}.AAAA` })).status).toBe(401);

    // Removing the code from the published list revokes the device.
    accessCodes = [];
    vi.setSystemTime(Date.now() + 120_000);
    expect((await call(env, '/gate/verify', { token })).status).toBe(401);
  });

  it('reports health and refuses non-FPL relay paths', async () => {
    const env = { CODES: kv(), TOKEN_SECRET: 's'.repeat(32) };
    const h = await worker.fetch(new Request('https://w.example/'), env, { waitUntil() {} });
    expect(await h.json()).toEqual({ ok: true, kv: true, secret: true });
    const r = await worker.fetch(new Request('https://w.example/api/../admin'), env, { waitUntil() {} });
    expect(r.status).not.toBe(200);
  });
});

globalThis.fetch = realFetch;
