// FPL Edge relay — a tiny Cloudflare Worker that lets the browser read the
// public FPL API (which sends no CORS headers). Free tier: 100k requests/day.
//
// Deploy: Cloudflare dashboard → Workers & Pages → Create → "Hello World" worker →
// Edit code → paste this file → Deploy. Then put the worker URL in config.json
// as "relayUrl" (e.g. "https://fpl-edge-relay.yourname.workers.dev").
//
// Usage: GET https://<worker>/api/entry/123/  →  https://fantasy.premierleague.com/api/entry/123/

const UPSTREAM = 'https://fantasy.premierleague.com';
// Only these read-only endpoints are relayed (no logins, no other sites).
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });
    const url = new URL(request.url);
    if (!ALLOWED.some((re) => re.test(url.pathname))) return new Response('Not allowed', { status: 403, headers: CORS });

    const target = UPSTREAM + url.pathname + url.search;
    const cache = caches.default;
    const cacheKey = new Request(target);
    let res = await cache.match(cacheKey);
    if (!res) {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (FPL Edge relay)', Accept: 'application/json' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      res = new Response(upstream.body, upstream);
      res.headers.set('Cache-Control', upstream.ok ? 'public, max-age=60' : 'no-store');
      if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
};
