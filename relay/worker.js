// ARKILO worker — one free Cloudflare Worker that does two jobs:
//
//  1) Invite gate with ONE-TIME codes.  A code can be redeemed once; it is then bound to
//     the device that redeemed it. Anyone else trying the same code is refused. Codes are
//     still issued and revoked through the repo (only their hashes are published at
//     <site>/access.json), so removing a code there locks that device out too.
//       POST /gate/redeem  {code, device}  → {token, name} | 403 {error:"invalid"|"used"}
//       POST /gate/verify  {token}         → {ok:true, name} | 401
//
//  2) FPL relay. The public FPL API has no CORS headers; this lets the site read a team.
//       GET /api/entry/123/ → https://fantasy.premierleague.com/api/entry/123/
//
// Setup (Cloudflare dashboard): create the Worker, bind a KV namespace as `CODES`, add a
// secret `TOKEN_SECRET` (any long random text), paste this file, deploy.

const SITE_ACCESS = 'https://h2ssanali.github.io/fpl-edge/access.json';
const UPSTREAM = 'https://fantasy.premierleague.com';
const ALLOWED = [
  /^\/api\/entry\/\d+\/$/,
  /^\/api\/entry\/\d+\/history\/$/,
  /^\/api\/entry\/\d+\/transfers\/$/,
  /^\/api\/entry\/\d+\/event\/\d+\/picks\/$/,
  /^\/api\/leagues-classic\/\d+\/standings\/$/,
  /^\/api\/bootstrap-static\/$/,
  /^\/api\/fixtures\/$/,
  /^\/api\/event\/\d+\/live\/$/,
  /^\/api\/element-summary\/\d+\/$/,
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// ---------- crypto helpers ----------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const normalize = (code) => String(code || '').toUpperCase().replace(/\s+/g, '');

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Constant-time comparison of two byte arrays. */
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// ---------- access list (published by the site build) ----------
let listCache = { at: 0, codes: [] };
async function accessList(env) {
  if (Date.now() - listCache.at < 60_000) return listCache.codes;
  const url = env.ACCESS_URL || SITE_ACCESS;
  const res = await fetch(url, { cf: { cacheTtl: 30 } });
  if (!res.ok) throw new Error('access list unavailable');
  const data = await res.json();
  listCache = { at: Date.now(), codes: data.enabled ? data.codes || [] : [] };
  return listCache.codes;
}

async function findEntry(env, code) {
  const c = normalize(code);
  if (c.length < 4) return null;
  for (const e of await accessList(env)) {
    if (hex(await sha256(`${e.s}:${c}`)) === e.h) {
      // Decrypt the name with the code (it was XOR-encrypted at build time).
      let name = '';
      try {
        const key = await sha256(`name:${e.s}:${c}`);
        name = new TextDecoder().decode(Uint8Array.from(atob(e.n), (ch) => ch.charCodeAt(0)).map((b, i) => b ^ key[i]));
      } catch { /* nameless */ }
      return { h: e.h, name };
    }
  }
  return null;
}

async function signToken(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64u(await hmac(env.TOKEN_SECRET, body))}`;
}

async function readToken(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  if (!same(unb64u(sig), await hmac(env.TOKEN_SECRET, body))) return null;
  try { return JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { return null; }
}

// ---------- gate endpoints ----------
async function redeem(request, env) {
  const { code, device } = await request.json().catch(() => ({}));
  if (!device || String(device).length < 8) return json({ error: 'invalid' }, 400);
  const entry = await findEntry(env, code);
  if (!entry) return json({ error: 'invalid' }, 403);
  const key = `used:${entry.h}`;
  const prev = await env.CODES.get(key, 'json');
  if (prev && prev.device !== device) return json({ error: 'used' }, 403);
  if (!prev) await env.CODES.put(key, JSON.stringify({ device, at: new Date().toISOString(), name: entry.name }));
  const token = await signToken(env, { h: entry.h, d: device, n: entry.name, iat: Date.now() });
  return json({ token, name: entry.name });
}

async function verify(request, env) {
  const { token } = await request.json().catch(() => ({}));
  const t = await readToken(env, token);
  if (!t) return json({ ok: false }, 401);
  // Still on the list? (Removing a code from the repo revokes it.)
  const codes = await accessList(env);
  if (!codes.some((e) => e.h === t.h)) return json({ ok: false, reason: 'revoked' }, 401);
  const used = await env.CODES.get(`used:${t.h}`, 'json');
  if (!used || used.device !== t.d) return json({ ok: false, reason: 'device' }, 401);
  return json({ ok: true, name: t.n || '' });
}

// ---------- FPL relay ----------
async function relay(request, url, ctx) {
  if (!ALLOWED.some((re) => re.test(url.pathname))) return new Response('Not allowed', { status: 403, headers: CORS });
  const target = UPSTREAM + url.pathname + url.search;
  const cache = caches.default;
  const cacheKey = new Request(target);
  let res = await cache.match(cacheKey);
  if (!res) {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (ARKILO relay)', Accept: 'application/json' },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    res = new Response(upstream.body, upstream);
    res.headers.set('Cache-Control', upstream.ok ? 'public, max-age=60' : 'no-store');
    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/gate/redeem' && request.method === 'POST') return await redeem(request, env);
      if (url.pathname === '/gate/verify' && request.method === 'POST') return await verify(request, env);
      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ ok: true, kv: !!env.CODES, secret: !!env.TOKEN_SECRET });
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/')) return await relay(request, url, ctx);
      return new Response('Not found', { status: 404, headers: CORS });
    } catch (err) {
      return json({ error: 'server', detail: String(err && err.message || err) }, 500);
    }
  },
};
