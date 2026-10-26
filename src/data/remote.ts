import type { GwEvent, LeagueFile, ManagerFile, PicksGw } from '../engine/types';

/**
 * In-app team loading. The FPL API sends no CORS headers, so the browser reaches it
 * through a relay:
 *  - "own": the project's Cloudflare Worker (relay/worker.js), set as relayUrl in
 *    config.json — fast and effectively unlimited;
 *  - "jina": the free r.jina.ai reader, which returns the JSON with CORS headers but
 *    allows ~20 requests per minute per visitor, so we throttle and fetch in phases.
 * Only personal data comes this way — players, fixtures and live stats still come
 * from the static files refreshed by GitHub Actions.
 */

const API = 'https://fantasy.premierleague.com/api';

interface Relay { name: 'own' | 'jina'; url: (target: string) => string; perMinute: number }

const JINA: Relay = { name: 'jina', url: (t) => `https://r.jina.ai/${t}`, perMinute: 18 };
let relays: Relay[] = [JINA];

/** Use the project's own relay (config.json → relayUrl) before the public one. */
export function setOwnRelay(base: string | null | undefined) {
  const b = (base ?? '').trim().replace(/\/+$/, '');
  relays = b ? [{ name: 'own', url: (t) => b + t.slice('https://fantasy.premierleague.com'.length), perMinute: 600 }, JINA] : [JINA];
}

/** True when only the rate-limited public relay is available. */
export const isLite = () => relays[0].name !== 'own';

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* quota or private mode */ } };

export class TeamNotFound extends Error {}

// ---------- throttling (sliding window per relay) ----------
const stamps = new Map<string, number[]>();
async function slot(r: Relay) {
  for (;;) {
    const now = Date.now();
    const list = (stamps.get(r.name) ?? []).filter((t) => now - t < 60_000);
    if (list.length < r.perMinute) { list.push(now); stamps.set(r.name, list); return; }
    await new Promise((res) => setTimeout(res, 60_000 - (now - list[0]) + 50));
  }
}

/** Extract the JSON document from a relay response (jina prefixes a short header). */
export function extractJson(text: string): unknown {
  const t = text.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  const marker = t.indexOf('Markdown Content:');
  const from = marker >= 0 ? marker : 0;
  const i = [t.indexOf('{', from), t.indexOf('[', from)].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  if (i === undefined) throw new Error('no json in response');
  return JSON.parse(t.slice(i));
}

async function viaRelay(r: Relay, target: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await slot(r);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(r.url(target), { signal: ctrl.signal });
      if (res.status === 429) { await new Promise((ok) => setTimeout(ok, 8_000 * (attempt + 1))); continue; }
      const text = await res.text();
      if (res.status === 404 || /"detail"\s*:\s*"Not found\."/.test(text) || /returned error 404|404 Not Found/i.test(text.slice(0, 400))) throw new TeamNotFound('404');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = extractJson(text) as { detail?: string };
      if (data && typeof data === 'object' && data.detail === 'Not found.') throw new TeamNotFound('404');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('rate limited');
}

/** GET an FPL API path, trying the relays in order. */
export async function fplGet<T>(path: string): Promise<T> {
  let lastErr: unknown = null;
  for (const r of relays) {
    try { return (await viaRelay(r, API + path)) as T; } catch (err) {
      if (err instanceof TeamNotFound) throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('relay failed');
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// ---------- raw API shapes (only the fields we read) ----------
interface RawEntry {
  name: string; player_first_name: string; player_last_name: string; player_region_name: string;
  player_region_iso_code_short: string; favourite_team: number | null; started_event: number; years_active?: number;
  summary_overall_rank: number; summary_overall_points: number; summary_event_points: number; summary_event_rank: number;
  last_deadline_bank: number; last_deadline_value: number; last_deadline_total_transfers: number; current_event: number;
  leagues?: { classic?: { id: number; name: string; league_type: string; entry_rank: number; entry_last_rank: number; rank_count: number; scoring: string }[] };
}
interface RawHistory {
  current: { event: number; points: number; total_points: number; overall_rank: number; rank: number; bank: number; value: number; event_transfers: number; event_transfers_cost: number; points_on_bench: number }[];
  past: { season_name: string; total_points: number; rank: number }[];
  chips: { name: string; event: number; time: string }[];
}
interface RawPicks {
  active_chip: string | null;
  picks: { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }[];
  automatic_subs: { element_in: number; element_out: number }[];
  entry_history: { points: number; total_points: number; overall_rank: number; bank: number; value: number; event_transfers: number; event_transfers_cost: number; points_on_bench: number };
}
interface RawTransfer { element_in: number; element_in_cost: number; element_out: number; element_out_cost: number; event: number; time: string }
interface RawStandings { league: { id: number; name: string; league_type: string }; standings: { has_next: boolean; results: { entry: number; entry_name: string; player_name: string; rank: number; last_rank: number; total: number; event_total: number }[] } }

function compactPicks(p: RawPicks, final: boolean): PicksGw {
  const h = p.entry_history;
  return {
    chip: p.active_chip ?? null,
    picks: p.picks.map((x) => [x.element, x.position, x.multiplier, x.is_captain ? 1 : 0, x.is_vice_captain ? 1 : 0]),
    subs: (p.automatic_subs ?? []).map((s) => [s.element_in, s.element_out]),
    points: h.points, total: h.total_points, rank: h.overall_rank, bank: h.bank, value: h.value,
    transfers: h.event_transfers, cost: h.event_transfers_cost, bench: h.points_on_bench, final,
  };
}

const cacheKey = (id: number) => `fpl-edge-mgr-${id}`;
const readCache = (id: number): ManagerFile | null => { try { return JSON.parse(safeGet(cacheKey(id)) ?? 'null'); } catch { return null; } };

/** A cached manager is fresh if fetched in the last 30 minutes and after the latest deadline. */
function fresh(m: ManagerFile | null, events: GwEvent[]): boolean {
  if (!m) return false;
  const t = new Date(m.updated).getTime();
  const lastDeadline = Math.max(0, ...events.map((e) => new Date(e.deadline).getTime()).filter((d) => d < Date.now()));
  return Date.now() - t < 30 * 60_000 && t > lastDeadline;
}

export interface ManagerOptions {
  pickGws: number; // how many of the most recent played GWs need picks
  withEntry?: boolean; // full profile (leagues etc.)
  withTransfers?: boolean;
  fallback?: { name: string; player: string; total: number }; // from league standings when skipping the profile
}

export async function fetchManager(id: number, events: GwEvent[], opts: ManagerOptions): Promise<ManagerFile> {
  const cached = readCache(id);
  const needEntry = opts.withEntry !== false;
  if (fresh(cached, events) && (!needEntry || cached!.entry.leagues.length || cached!.entry.overallRank)) {
    const played = cached!.history.map((h) => h.gw).slice(-opts.pickGws);
    if (played.every((g) => cached!.picks[g])) return cached!;
  }
  const [entry, history, transfers] = await Promise.all([
    needEntry ? fplGet<RawEntry>(`/entry/${id}/`) : Promise.resolve(null),
    fplGet<RawHistory>(`/entry/${id}/history/`),
    opts.withTransfers !== false ? fplGet<RawTransfer[]>(`/entry/${id}/transfers/`).catch(() => null) : Promise.resolve(null),
  ]);
  const picks: Record<string, PicksGw> = { ...(cached?.picks ?? {}) };
  const final = new Map(events.map((e) => [e.id, e.dataChecked]));
  const wanted = history.current.map((h) => h.event).slice(-opts.pickGws).filter((g) => !picks[g]?.final);
  await pool(wanted, 3, async (g) => {
    try { picks[g] = compactPicks(await fplGet<RawPicks>(`/entry/${id}/event/${g}/picks/`), !!final.get(g)); } catch { /* skip this GW */ }
  });
  const last = history.current.at(-1);
  const prevEntry = cached?.entry;
  const m: ManagerFile = {
    id,
    entry: entry ? {
      name: entry.name, player: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
      region: entry.player_region_name, regionIso: entry.player_region_iso_code_short, favTeam: entry.favourite_team,
      startedEvent: entry.started_event, years: entry.years_active ?? 0, overallRank: entry.summary_overall_rank,
      total: entry.summary_overall_points, eventPoints: entry.summary_event_points, eventRank: entry.summary_event_rank,
      bank: entry.last_deadline_bank, value: entry.last_deadline_value, transfersTotal: entry.last_deadline_total_transfers,
      currentEvent: entry.current_event,
      leagues: (entry.leagues?.classic ?? []).map((l) => ({ id: l.id, name: l.name, type: l.league_type, rank: l.entry_rank, lastRank: l.entry_last_rank, count: l.rank_count, scoring: l.scoring })),
    } : prevEntry ?? {
      name: opts.fallback?.name ?? `#${id}`, player: opts.fallback?.player ?? '', region: '', regionIso: '', favTeam: null,
      startedEvent: history.current[0]?.event ?? 1, years: 0, overallRank: last?.overall_rank ?? 0,
      total: opts.fallback?.total ?? last?.total_points ?? 0, eventPoints: last?.points ?? 0, eventRank: last?.rank ?? 0,
      bank: last?.bank ?? 0, value: last?.value ?? 1000, transfersTotal: 0, currentEvent: last?.event ?? 0, leagues: [],
    },
    history: history.current.map((h) => ({ gw: h.event, pts: h.points, total: h.total_points, rank: h.overall_rank, gwRank: h.rank, bank: h.bank, value: h.value, tr: h.event_transfers, cost: h.event_transfers_cost, bench: h.points_on_bench })),
    past: history.past.map((p) => ({ season: p.season_name, total: p.total_points, rank: p.rank })),
    chips: history.chips.map((c) => ({ name: c.name, gw: c.event, time: c.time })),
    transfers: transfers ? transfers.map((t) => [t.element_in, t.element_in_cost, t.element_out, t.element_out_cost, t.event, t.time]) : cached?.transfers ?? [],
    picks,
    updated: new Date().toISOString(),
  };
  safeSet(cacheKey(id), JSON.stringify(m));
  return m;
}

/** Standings plus the rivals worth tracking (top of the table and those around you). */
export async function fetchLeague(leagueId: number, myId: number, maxRivals: number): Promise<LeagueFile> {
  const d = await fplGet<RawStandings>(`/leagues-classic/${leagueId}/standings/`);
  const standings = d.standings.results.map((r) => ({ entry: r.entry, name: r.entry_name, player: r.player_name, rank: r.rank, lastRank: r.last_rank, total: r.total, eventTotal: r.event_total }));
  const meIdx = standings.findIndex((s) => s.entry === myId);
  const chosen = new Set<number>([myId]);
  standings.slice(0, 4).forEach((s) => chosen.add(s.entry));
  if (meIdx >= 0) for (let i = Math.max(0, meIdx - 3); i <= Math.min(standings.length - 1, meIdx + 3); i++) chosen.add(standings[i].entry);
  for (const s of standings) { if (chosen.size >= maxRivals + 1) break; chosen.add(s.entry); }
  const rivals = [...chosen].slice(0, maxRivals + 1);
  return { id: d.league.id, name: d.league.name, type: d.league.league_type, myId, standings: standings.filter((s) => rivals.includes(s.entry)), rivals, hasMore: d.standings.has_next };
}

/** Phase A: the user's own team (fast — a handful of requests). */
export async function loadMyTeam(teamId: number, events: GwEvent[]): Promise<ManagerFile> {
  return fetchManager(teamId, events, { pickGws: isLite() ? 3 : 38 });
}

/**
 * Phase B (background): the mini-league and rivals, plus the rest of the user's
 * history for the journal and hindsight engine.
 */
export async function loadLeagueAndHistory(
  me: ManagerFile, events: GwEvent[], leagueId: number | null, onProgress?: (done: number, total: number) => void,
): Promise<{ manager: ManagerFile; league: LeagueFile | null; rivals: ManagerFile[] }> {
  const lite = isLite();
  const privateLeagues = me.entry.leagues.filter((l) => l.type === 'x');
  const lid = leagueId && me.entry.leagues.some((l) => l.id === leagueId) ? leagueId : privateLeagues[0]?.id ?? null;
  let league: LeagueFile | null = null;
  if (lid) { try { league = await fetchLeague(lid, me.id, lite ? 8 : 12); } catch { league = null; } }
  const ids = league ? league.rivals.filter((r) => r !== me.id) : [];
  const total = ids.length + 1;
  let done = 0;
  const rivals = (await pool(ids, 2, async (id) => {
    const st = league!.standings.find((s) => s.entry === id);
    try {
      return await fetchManager(id, events, { pickGws: lite ? 1 : 4, withEntry: !lite, withTransfers: true, fallback: st ? { name: st.name, player: st.player, total: st.total } : undefined });
    } catch { return null; } finally { onProgress?.(++done, total); }
  })).filter((x): x is ManagerFile => !!x);
  // Fill in the rest of the user's own season (cached forever once fetched).
  let manager = me;
  try { manager = await fetchManager(me.id, events, { pickGws: 38 }); } catch { /* keep partial */ }
  onProgress?.(total, total);
  if (league) {
    const have = new Set([me.id, ...rivals.map((r) => r.id)]);
    league = { ...league, rivals: league.rivals.filter((r) => have.has(r)), standings: league.standings.filter((s) => have.has(s.entry)) };
  }
  return { manager, league, rivals };
}
