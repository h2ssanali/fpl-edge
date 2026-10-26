// FPL Edge data pipeline. Runs in GitHub Actions (the FPL API has no CORS).
// Fetches the official API politely (throttled, retried), writes compact JSON
// into public/data/, and keeps caches so finished gameweeks are never refetched.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public', 'data');
const API = 'https://fantasy.premierleague.com/api';
const UA = 'Mozilla/5.0 (compatible; FPL-Edge/1.0; +https://github.com/h2ssanali/fpl-edge)';
const MAX_RIVALS = Number(process.env.MAX_RIVALS || 24);

// ---------- polite HTTP ----------
const CONCURRENCY = 3;
const MIN_GAP_MS = 150;
let active = 0;
let lastStart = 0;
const queue = [];
let requestCount = 0;

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const wait = Math.max(0, lastStart + MIN_GAP_MS - Date.now());
    if (wait > 0) { setTimeout(pump, wait); return; }
    lastStart = Date.now();
    const job = queue.shift();
    active++;
    job().finally(() => { active--; pump(); });
  }
}

function get(url, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          requestCount++;
          const res = await fetch(API + url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
          if (res.status === 404 && optional) return resolve(null);
          if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
          if (!res.ok) {
            if (optional) return resolve(null);
            throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
          }
          const text = await res.text();
          if (text.startsWith('"The game is being updated')) throw new Error('game updating');
          return resolve(JSON.parse(text));
        } catch (err) {
          if (err.fatal || attempt === 5) {
            if (optional) { console.warn(`  ! giving up on ${url}: ${err.message}`); return resolve(null); }
            return reject(err);
          }
          const backoff = 1000 * 2 ** attempt + Math.random() * 500;
          console.warn(`  retry ${url} in ${Math.round(backoff)}ms (${err.message})`);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    });
    pump();
  });
}

// ---------- fs helpers ----------
const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(path.join(OUT, file), 'utf8')); } catch { return fallback; }
};
const writeJson = (file, data) => {
  const full = path.join(OUT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data));
};
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const round = (v, d = 2) => Math.round(num(v) * 10 ** d) / 10 ** d;

// ---------- config ----------
function loadConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch {}
  const envTeam = (process.env.TEAM_ID || '').trim();
  const envLeagues = (process.env.LEAGUE_IDS || '').trim();
  const teamId = Number(envTeam || cfg.teamId || 0) || null;
  const leagueIds = (envLeagues ? envLeagues.split(/[\s,]+/) : cfg.leagueIds || [])
    .map(Number).filter((n) => n > 0);
  const relayUrl = String(cfg.relayUrl || '').trim().replace(/\/+$/, '');
  return { teamId, leagueIds, relayUrl };
}

// ---------- transforms ----------
function compactPlayer(e) {
  return {
    id: e.id, code: e.code, web: e.web_name, first: e.first_name, second: e.second_name,
    team: e.team, pos: e.element_type, cost: e.now_cost, sel: num(e.selected_by_percent),
    status: e.status, cop: e.chance_of_playing_next_round, copThis: e.chance_of_playing_this_round,
    news: e.news || '', newsAdded: e.news_added, form: num(e.form), ppg: num(e.points_per_game),
    ep: num(e.ep_next), total: e.total_points, evPts: e.event_points, mins: e.minutes, starts: e.starts ?? 0,
    g: e.goals_scored, a: e.assists, cs: e.clean_sheets, gc: e.goals_conceded, og: e.own_goals,
    ps: e.penalties_saved, pm: e.penalties_missed, yc: e.yellow_cards, rc: e.red_cards, saves: e.saves,
    bonus: e.bonus, bps: e.bps, xg: num(e.expected_goals), xa: num(e.expected_assists),
    xgc: num(e.expected_goals_conceded), dc: num(e.defensive_contribution), ict: num(e.ict_index),
    pen: e.penalties_order, setp: e.corners_and_indirect_freekicks_order, fk: e.direct_freekicks_order,
    tin: e.transfers_in_event, tout: e.transfers_out_event, tinAll: e.transfers_in, toutAll: e.transfers_out,
    cce: e.cost_change_event, ccs: e.cost_change_start,
    pcp: e.price_change_percent === undefined || e.price_change_percent === null ? null : num(e.price_change_percent),
    pcr: e.price_change_hourly_rate ?? null,
    pcProj: Array.isArray(e.price_change_projections)
      ? e.price_change_projections.map((p) => [p.offset, num(p.projected_percent), p.likelihood]) : null,
    pcLocked: e.price_change_locked_until ?? null,
    canSelect: e.can_select !== false, removed: !!e.removed,
  };
}

function compactEvent(ev) {
  const chips = {};
  for (const c of ev.chip_plays || []) chips[c.chip_name] = c.num_played;
  return {
    id: ev.id, deadline: ev.deadline_time, finished: ev.finished, dataChecked: ev.data_checked,
    current: ev.is_current, next: ev.is_next, prev: ev.is_previous, avg: ev.average_entry_score,
    highest: ev.highest_score, mostCaptained: ev.most_captained, mostVice: ev.most_vice_captained,
    mostSelected: ev.most_selected, mostIn: ev.most_transferred_in, top: ev.top_element_info,
    chips, transfers: ev.transfers_made, ranked: ev.ranked_count,
  };
}

const LIVE_FIELDS = ['mins', 'g', 'a', 'cs', 'gc', 'og', 'ps', 'pm', 'yc', 'rc', 'saves', 'bonus', 'bps',
  'xg', 'xa', 'xgc', 'dc', 'starts', 'pts', 'fixtures'];
function compactLive(gw, live) {
  const rows = [];
  for (const el of live.elements || []) {
    const s = el.stats || {};
    const fixtures = (el.explain || []).map((x) => x.fixture);
    if (!s.minutes && !s.total_points && fixtures.length === 0) continue;
    rows.push([el.id, s.minutes, s.goals_scored, s.assists, s.clean_sheets, s.goals_conceded, s.own_goals,
      s.penalties_saved, s.penalties_missed, s.yellow_cards, s.red_cards, s.saves, s.bonus, s.bps,
      round(s.expected_goals), round(s.expected_assists), round(s.expected_goals_conceded),
      num(s.defensive_contribution), num(s.starts), s.total_points, fixtures]);
  }
  return { gw, fields: LIVE_FIELDS, rows };
}

function compactPicks(p) {
  if (!p) return null;
  const h = p.entry_history || {};
  return {
    chip: p.active_chip || null,
    picks: (p.picks || []).map((x) => [x.element, x.position, x.multiplier, x.is_captain ? 1 : 0, x.is_vice_captain ? 1 : 0]),
    subs: (p.automatic_subs || []).map((s) => [s.element_in, s.element_out]),
    points: h.points, total: h.total_points, rank: h.overall_rank, bank: h.bank, value: h.value,
    transfers: h.event_transfers, cost: h.event_transfers_cost, bench: h.points_on_bench,
  };
}

// ---------- managers ----------
async function fetchManager(entryId, events) {
  const file = `managers/${entryId}.json`;
  const cached = readJson(file, null) || { picks: {} };
  const [entry, history, transfers] = await Promise.all([
    get(`/entry/${entryId}/`, { optional: true }),
    get(`/entry/${entryId}/history/`, { optional: true }),
    get(`/entry/${entryId}/transfers/`, { optional: true }),
  ]);
  if (!entry || !history) return cached.entry ? cached : null;
  const played = new Set((history.current || []).map((h) => h.event));
  const picks = { ...cached.picks };
  const jobs = [];
  for (const ev of events) {
    if (!played.has(ev.id)) continue;
    const stale = !picks[ev.id] || !picks[ev.id].final;
    if (!stale) continue;
    jobs.push(get(`/entry/${entryId}/event/${ev.id}/picks/`, { optional: true }).then((p) => {
      const c = compactPicks(p);
      if (c) { c.final = !!ev.dataChecked; picks[ev.id] = c; }
    }));
  }
  await Promise.all(jobs);
  const out = {
    id: entryId,
    entry: {
      name: entry.name, player: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
      region: entry.player_region_name, regionIso: entry.player_region_iso_code_short,
      favTeam: entry.favourite_team, startedEvent: entry.started_event, years: entry.years_active,
      overallRank: entry.summary_overall_rank, total: entry.summary_overall_points,
      eventPoints: entry.summary_event_points, eventRank: entry.summary_event_rank,
      bank: entry.last_deadline_bank, value: entry.last_deadline_value,
      transfersTotal: entry.last_deadline_total_transfers, currentEvent: entry.current_event,
      leagues: (entry.leagues?.classic || []).map((l) => ({
        id: l.id, name: l.name, type: l.league_type, rank: l.entry_rank, lastRank: l.entry_last_rank,
        count: l.rank_count, scoring: l.scoring,
      })),
    },
    history: (history.current || []).map((h) => ({
      gw: h.event, pts: h.points, total: h.total_points, rank: h.overall_rank, gwRank: h.rank,
      bank: h.bank, value: h.value, tr: h.event_transfers, cost: h.event_transfers_cost, bench: h.points_on_bench,
    })),
    past: (history.past || []).map((p) => ({ season: p.season_name, total: p.total_points, rank: p.rank })),
    chips: (history.chips || []).map((c) => ({ name: c.name, gw: c.event, time: c.time })),
    transfers: transfers
      ? transfers.map((t) => [t.element_in, t.element_in_cost, t.element_out, t.element_out_cost, t.event, t.time])
      : cached.transfers || [],
    picks,
    updated: new Date().toISOString(),
  };
  writeJson(file, out);
  return out;
}

async function fetchLeague(leagueId, myId) {
  const first = await get(`/leagues-classic/${leagueId}/standings/`, { optional: true });
  if (!first) return null;
  let results = [...(first.standings?.results || [])];
  // Mini-leagues rarely exceed 50; fetch up to 4 pages if needed.
  let page = 1;
  let hasNext = first.standings?.has_next;
  while (hasNext && page < 4) {
    page++;
    const next = await get(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`, { optional: true });
    if (!next) break;
    results = results.concat(next.standings?.results || []);
    hasNext = next.standings?.has_next;
  }
  const standings = results.map((r) => ({
    entry: r.entry, name: r.entry_name, player: r.player_name, rank: r.rank, lastRank: r.last_rank,
    total: r.total, eventTotal: r.event_total,
  }));
  return { id: leagueId, name: first.league?.name || `League ${leagueId}`, type: first.league?.league_type,
    standings, hasMore: !!hasNext, myId };
}

function chooseRivals(standings, myId) {
  if (standings.length <= MAX_RIVALS) return standings.map((s) => s.entry);
  const meIdx = standings.findIndex((s) => s.entry === myId);
  const chosen = new Set(standings.slice(0, 10).map((s) => s.entry));
  if (meIdx >= 0) {
    for (let i = Math.max(0, meIdx - 7); i <= Math.min(standings.length - 1, meIdx + 7); i++) chosen.add(standings[i].entry);
  }
  for (const s of standings) { if (chosen.size >= MAX_RIVALS) break; chosen.add(s.entry); }
  return [...chosen];
}

// ---------- top 10k sample ----------
async function fetchTopSample(gw, deadlinePassed) {
  // Sample the overall league across ranks 1..10,000 for an estimate of the
  // top-10k average score, effective ownership and captaincy.
  const pages = [1, 21, 41, 61, 81, 101, 121, 141, 161, 181, 200];
  const rows = [];
  await Promise.all(pages.map((p) => get(`/leagues-classic/314/standings/?page_standings=${p}`, { optional: true })
    .then((d) => { if (d) rows.push(...(d.standings?.results || [])); })));
  if (!rows.length) return null;
  const sample = [];
  for (const p of pages) {
    const pageRows = rows.filter((r) => r.rank > (p - 1) * 50 && r.rank <= p * 50);
    sample.push(...pageRows.filter((_, i) => i % 5 === 0));
  }
  // Picks are frozen once the deadline passes, so sample them only once per GW.
  const prev = readJson(`top/${gw}.json`, null);
  const avgNow = round(rows.reduce((s, r) => s + (r.event_total || 0), 0) / rows.length, 1);
  if (prev && prev.sampled >= 40 && deadlinePassed) {
    return { ...prev, avg: avgNow, rows: rows.length, updated: new Date().toISOString() };
  }
  const counts = {};
  const caps = {};
  let n = 0;
  await Promise.all(sample.map((r) => get(`/entry/${r.entry}/event/${gw}/picks/`, { optional: true }).then((pk) => {
    if (!pk) return;
    n++;
    for (const x of pk.picks || []) {
      if (x.multiplier > 0) counts[x.element] = (counts[x.element] || 0) + x.multiplier;
      if (x.is_captain) caps[x.element] = (caps[x.element] || 0) + 1;
    }
  })));
  const eo = {};
  for (const [k, v] of Object.entries(counts)) eo[k] = round((v / Math.max(1, n)) * 100, 1);
  const cap = {};
  for (const [k, v] of Object.entries(caps)) cap[k] = round((v / Math.max(1, n)) * 100, 1);
  return { gw, sampled: n, rows: rows.length, avg: avgNow, eo, cap, updated: new Date().toISOString() };
}

// ---------- price history ----------
async function fetchPriceHistory(players, lastFinished) {
  // Per-GW price & ownership from element-summary. Done once per finished GW.
  const file = 'history/per-gw.json';
  const cached = readJson(file, null);
  if (cached && cached.throughGw >= lastFinished) return cached;
  console.log(`Fetching element-summary for ${players.length} players (once per gameweek)…`);
  const data = {};
  await Promise.all(players.map((p) => get(`/element-summary/${p.id}/`, { optional: true }).then((s) => {
    if (!s) return;
    const byGw = {};
    for (const h of s.history || []) {
      const cur = byGw[h.round] || [h.value, h.selected, 0];
      cur[2] += h.transfers_balance;
      byGw[h.round] = cur;
    }
    data[p.id] = byGw;
  })));
  const out = { throughGw: lastFinished, updated: new Date().toISOString(), players: data };
  writeJson(file, out);
  return out;
}

function writeSnapshot(players) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const rows = players.map((p) => [p.id, p.cost, Math.round(p.sel * 10), p.tin, p.tout, p.pcp]);
  writeJson(`history/${date}.json`, { date, ts: now.toISOString(), fields: ['id', 'cost', 'sel10', 'tin', 'tout', 'pcp'], rows });
  const index = readJson('history/index.json', { dates: [] });
  if (!index.dates.includes(date)) index.dates.push(date);
  index.dates.sort();
  writeJson('history/index.json', index);
}

// ---------- main ----------
async function main() {
  const t0 = Date.now();
  const cfg = loadConfig();
  console.log('Config:', cfg);

  const boot = await get('/bootstrap-static/');
  const fixturesRaw = await get('/fixtures/');
  const events = boot.events.map(compactEvent);
  const current = events.find((e) => e.current) || null;
  const next = events.find((e) => e.next) || null;
  const lastFinished = [...events].reverse().find((e) => e.finished)?.id || 0;
  const players = boot.elements.map(compactPlayer);
  const scoring = boot.game_config?.scoring || {};

  const core = {
    updated: new Date().toISOString(),
    season: (boot.game_config?.settings?.static_content_url || '').match(/(\d{4})_(\d{2})/)?.slice(1).join('/') || '',
    currentGw: current?.id || 0, nextGw: next?.id || null, lastFinished,
    totalPlayers: boot.total_players,
    rules: {
      squadSize: boot.game_settings.squad_squadsize, squadPlay: boot.game_settings.squad_squadplay,
      teamLimit: boot.game_settings.squad_team_limit, budget: boot.game_settings.squad_total_spend,
      maxExtraFT: boot.game_settings.max_extra_free_transfers, sellOnFee: boot.game_settings.transfers_sell_on_fee,
      positions: boot.element_types.map((t) => ({ id: t.id, short: t.singular_name_short, select: t.squad_select,
        minPlay: t.squad_min_play, maxPlay: t.squad_max_play })),
      scoring: {
        longPlay: scoring.long_play ?? 2, shortPlay: scoring.short_play ?? 1,
        goals: scoring.goals_scored || { GKP: 10, DEF: 6, MID: 5, FWD: 4 },
        cs: scoring.clean_sheets || { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
        gc: scoring.goals_conceded || { GKP: -1, DEF: -1, MID: 0, FWD: 0 },
        dc: scoring.defensive_contribution || { GKP: 0, DEF: 2, MID: 2, FWD: 2 },
        assists: scoring.assists ?? 3, saves: scoring.saves ?? 1, ps: scoring.penalties_saved ?? 5,
        pm: scoring.penalties_missed ?? -2, yc: scoring.yellow_cards ?? -1, rc: scoring.red_cards ?? -3,
        og: scoring.own_goals ?? -2,
      },
      priceChangeDeadlines: boot.game_config?.settings?.price_change_deadlines || [],
    },
    chips: boot.chips.map((c) => ({ id: c.id, name: c.name, number: c.number, start: c.start_event, stop: c.stop_event, type: c.chip_type })),
    events,
    teams: boot.teams.map((t) => ({ id: t.id, code: t.code, name: t.name, short: t.short_name,
      strengthHome: t.strength_overall_home, strengthAway: t.strength_overall_away, position: t.position,
      played: t.played, win: t.win, draw: t.draw, loss: t.loss, points: t.points })),
    players,
  };

  const fixtures = fixturesRaw.map((f) => ({
    id: f.id, ev: f.event, h: f.team_h, a: f.team_a, hs: f.team_h_score, as: f.team_a_score, ko: f.kickoff_time,
    fin: !!f.finished, prov: !!f.finished_provisional, started: !!f.started, hd: f.team_h_difficulty, ad: f.team_a_difficulty,
  }));

  // Live data per gameweek (cache finished + data-checked ones forever).
  const liveIndex = readJson('live/index.json', { gws: {} });
  for (const ev of events) {
    if (!(ev.finished || ev.current)) continue;
    const have = liveIndex.gws[ev.id];
    if (have && have.final && fs.existsSync(path.join(OUT, `live/${ev.id}.json`))) continue;
    const live = await get(`/event/${ev.id}/live/`, { optional: true });
    if (!live) continue;
    writeJson(`live/${ev.id}.json`, compactLive(ev.id, live));
    liveIndex.gws[ev.id] = { final: !!(ev.finished && ev.dataChecked), updated: new Date().toISOString() };
    console.log(`  live GW${ev.id} saved`);
  }
  writeJson('live/index.json', liveIndex);

  // Manager: user's team or demo (current overall #1).
  let mode = 'user';
  let teamId = cfg.teamId;
  let overallTop = null;
  if (!teamId) {
    mode = 'demo';
    overallTop = await get('/leagues-classic/314/standings/', { optional: true });
    teamId = overallTop?.standings?.results?.[0]?.entry || null;
  }
  const me = teamId ? await fetchManager(teamId, events) : null;
  if (cfg.teamId && !me) console.warn(`! Team ${teamId} could not be fetched — check config.json`);

  // Leagues: configured, else the user's private classic leagues, else (demo) the overall top 20.
  let leagueIds = cfg.leagueIds;
  if (!leagueIds.length && me && mode === 'user') {
    leagueIds = me.entry.leagues.filter((l) => l.type === 'x').map((l) => l.id).slice(0, 3);
  }
  const leagues = [];
  const rivalIds = new Set();
  if (mode === 'demo') {
    const results = (overallTop?.standings?.results || []).slice(0, 20);
    const league = {
      id: 314, name: 'Overall — Top 20 (demo)', type: 's', demo: true, myId: teamId,
      standings: results.map((r) => ({ entry: r.entry, name: r.entry_name, player: r.player_name, rank: r.rank,
        lastRank: r.last_rank, total: r.total, eventTotal: r.event_total })),
    };
    league.rivals = league.standings.map((s) => s.entry);
    league.rivals.forEach((id) => rivalIds.add(id));
    leagues.push(league);
  } else {
    for (const id of leagueIds) {
      const league = await fetchLeague(id, teamId);
      if (!league) { console.warn(`! league ${id} not found`); continue; }
      league.rivals = chooseRivals(league.standings, teamId);
      league.rivals.forEach((r) => rivalIds.add(r));
      leagues.push(league);
    }
  }
  rivalIds.delete(teamId);
  console.log(`Fetching ${rivalIds.size} rival managers…`);
  await Promise.all([...rivalIds].map((id) => fetchManager(id, events)));
  for (const l of leagues) writeJson(`league/${l.id}.json`, l);

  // Top-10k sample for the latest active GW (accumulates per GW over the season).
  const sampleGw = current?.id;
  if (sampleGw) {
    const top = await fetchTopSample(sampleGw, !!current && new Date(current.deadline) < new Date());
    if (top) writeJson(`top/${sampleGw}.json`, top);
  }
  const topIndex = fs.existsSync(path.join(OUT, 'top'))
    ? fs.readdirSync(path.join(OUT, 'top')).filter((f) => /^\d+\.json$/.test(f)).map((f) => Number(f.replace('.json', ''))).sort((a, b) => a - b)
    : [];

  await fetchPriceHistory(players, lastFinished);
  writeSnapshot(players);

  writeJson('core.json', core);
  writeJson('fixtures.json', fixtures);

  const nextDeadline = next?.deadline || null;
  const meta = {
    updated: new Date().toISOString(), mode, teamId, leagueIds: leagues.map((l) => l.id),
    configuredTeamId: cfg.teamId, configuredLeagueIds: cfg.leagueIds, relayUrl: cfg.relayUrl || null,
    currentGw: core.currentGw, nextGw: core.nextGw, lastFinished, nextDeadline,
    liveGws: Object.keys(liveIndex.gws).map(Number).sort((a, b) => a - b),
    topGws: topIndex, history: readJson('history/index.json', { dates: [] }).dates.slice(-30),
    requests: requestCount,
  };
  writeJson('meta.json', meta);
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s with ${requestCount} requests. Mode=${mode} team=${teamId}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
