import type { Player, Pos } from './types';
import { normCdf, normInv } from './math';

/**
 * Live gameweek scoring, computed in the browser from FPL's live endpoints:
 *  - points so far, with provisional bonus (top 3 BPS per match) until FPL confirms it;
 *  - automatic substitutions once a starter's matches are over and he didn't play;
 *  - a rough overall rank, from a Normal model of everyone's totals (see liveRank).
 */

export interface LiveEl { id: number; minutes: number; points: number; bonus: number; bps: Map<number, number> } // bps per fixture
export interface LiveFx { id: number; h: number; a: number; hs: number | null; as: number | null; started: boolean; done: boolean; minutes: number; kickoff: string | null }

interface RawLive { elements: { id: number; stats: { minutes: number; total_points: number; bonus: number; bps: number }; explain: { fixture: number; stats: { identifier: string; value: number }[] }[] }[] }
interface RawFixture { id: number; team_h: number; team_a: number; team_h_score: number | null; team_a_score: number | null; started: boolean | null; finished: boolean; finished_provisional: boolean; minutes: number; kickoff_time: string | null }
export interface RawPicks {
  active_chip: string | null;
  picks: { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }[];
  entry_history: { points: number; total_points: number; event_transfers_cost: number; overall_rank: number | null };
}

export function parseLiveEls(raw: RawLive): Map<number, LiveEl> {
  const out = new Map<number, LiveEl>();
  for (const e of raw.elements ?? []) {
    const bps = new Map<number, number>();
    for (const x of e.explain ?? []) bps.set(x.fixture, x.stats.find((s) => s.identifier === 'bps')?.value ?? 0);
    // Players without an "explain" row for a fixture still get their total BPS on the first one.
    if (!bps.size && e.stats.minutes > 0) bps.set(-1, e.stats.bps);
    out.set(e.id, { id: e.id, minutes: e.stats.minutes, points: e.stats.total_points, bonus: e.stats.bonus, bps });
  }
  return out;
}

export function parseLiveFixtures(raw: RawFixture[]): LiveFx[] {
  return raw.map((f) => ({
    id: f.id, h: f.team_h, a: f.team_a, hs: f.team_h_score, as: f.team_a_score,
    started: !!f.started, done: f.finished || f.finished_provisional, minutes: f.minutes, kickoff: f.kickoff_time,
  }));
}

/**
 * Provisional bonus: in each started match whose bonus FPL hasn't added yet, the top three
 * BPS get 3/2/1. Ties share the higher award and push the next award down (FPL rules).
 */
export function provisionalBonus(els: Map<number, LiveEl>, fixtures: LiveFx[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of fixtures) {
    if (!f.started) continue;
    const inMatch = [...els.values()].filter((e) => e.bps.has(f.id) && e.minutes > 0);
    if (inMatch.some((e) => e.bonus > 0)) continue; // confirmed: already inside total_points
    const ranked = inMatch.map((e) => ({ id: e.id, bps: e.bps.get(f.id)! })).sort((a, b) => b.bps - a.bps);
    let award = 3, i = 0;
    while (award > 0 && i < ranked.length) {
      const tied = ranked.filter((r) => r.bps === ranked[i].bps);
      for (const r of tied) out.set(r.id, (out.get(r.id) ?? 0) + award);
      i += tied.length;
      award -= tied.length;
    }
  }
  return out;
}

export type LiveStatus = 'played' | 'playing' | 'yet' | 'out';

export interface LiveRow {
  id: number; pos: Pos; slot: number; // 1–15 pick position
  mult: number; points: number; bonus: number; minutes: number; status: LiveStatus;
  isCap: boolean; isVice: boolean; subIn: boolean; subOut: boolean;
}

export interface LiveTeam { rows: LiveRow[]; points: number; hits: number; net: number; chip: string | null; left: number }

/** Is a player's gameweek over / under way, given his team's fixtures? */
function statusOf(p: Player, el: LiveEl | undefined, fixtures: LiveFx[]): LiveStatus {
  const mine = fixtures.filter((f) => f.h === p.team || f.a === p.team);
  const mins = el?.minutes ?? 0;
  if (!mine.length) return 'out'; // blank gameweek
  if (mine.every((f) => f.done)) return mins > 0 ? 'played' : 'out';
  if (mine.some((f) => f.started && !f.done)) return 'playing';
  return mins > 0 ? 'playing' : 'yet';
}

export function liveTeam(picks: RawPicks, els: Map<number, LiveEl>, fixtures: LiveFx[], players: Map<number, Player>, bonus: Map<number, number>, minPlay: Record<Pos, number> = { 1: 1, 2: 3, 3: 2, 4: 1 }): LiveTeam {
  const chip = picks.active_chip;
  const rows: LiveRow[] = picks.picks.map((pk) => {
    const p = players.get(pk.element);
    const el = els.get(pk.element);
    const b = bonus.get(pk.element) ?? 0;
    return {
      id: pk.element, pos: (p?.pos ?? 3) as Pos, slot: pk.position,
      mult: pk.multiplier, points: (el?.points ?? 0) + b, bonus: (el?.bonus ?? 0) + b, minutes: el?.minutes ?? 0,
      status: p ? statusOf(p, el, fixtures) : 'out',
      isCap: pk.is_captain, isVice: pk.is_vice_captain, subIn: false, subOut: false,
    };
  }).sort((a, b) => a.slot - b.slot);

  if (chip !== 'bboost') {
    const xi = rows.filter((r) => r.slot <= 11);
    const bench = rows.filter((r) => r.slot > 11);
    const count = (pos: Pos) => xi.filter((r) => r.pos === pos && !r.subOut).length;
    for (const out of xi.filter((r) => r.status === 'out')) {
      for (const b of bench) {
        if (b.subIn || b.status === 'out') continue;
        if ((out.pos === 1) !== (b.pos === 1)) continue;
        // The formation must stay legal after the swap.
        if (out.pos !== b.pos && count(out.pos) - 1 < minPlay[out.pos]) continue;
        // Next in line hasn't played yet: FPL decides at the end, so wait.
        if (b.minutes === 0) break;
        out.subOut = true; b.subIn = true;
        b.mult = 1;
        xi.push(b);
        break;
      }
    }
    for (const r of rows) if (r.slot <= 11 && r.subOut) r.mult = 0;
    // Captain didn't play: the vice-captain takes the armband.
    const cap = rows.find((r) => r.isCap);
    const vice = rows.find((r) => r.isVice);
    if (cap && vice && cap.status === 'out' && vice.status !== 'out' && vice.slot <= 11) {
      vice.mult = picks.picks.find((p) => p.is_captain)?.multiplier ?? 2;
      cap.mult = 0;
    }
  }
  const counted = rows.filter((r) => r.mult > 0);
  const points = counted.reduce((s, r) => s + r.points * r.mult, 0);
  const hits = picks.entry_history.event_transfers_cost ?? 0;
  const left = counted.filter((r) => r.status === 'yet' || r.status === 'playing').length;
  return { rows, points, hits, net: points - hits, chip, left };
}

/**
 * Estimated live score of the average manager: global ownership × points, with
 * ownership scaled so a squad has 11 starters, plus the captaincy share.
 */
export function fieldScore(players: Player[], points: (id: number) => number, capShare: Map<number, number>): number {
  const totalSel = players.reduce((s, p) => s + p.sel, 0) || 1;
  const k = 1100 / totalSel;
  return players.reduce((s, p) => s + ((p.sel * k) / 100 + (capShare.get(p.id) ?? 0)) * points(p.id), 0);
}

/**
 * Overall rank from a Normal model of everyone's season totals, calibrated on the
 * manager's rank before this gameweek (same approach as the what-if card).
 */
export function liveRank(opts: { N: number; prevTotal: number; prevRank: number; prevFieldMean: number; gwsBefore: number; myGw: number; fieldGw: number }): number {
  const { N, prevTotal, prevRank, prevFieldMean, gwsBefore, myGw, fieldGw } = opts;
  const z = normInv(1 - Math.min(0.999999, Math.max(1e-7, prevRank / N)));
  let sd = Math.abs(z) > 0.15 ? (prevTotal - prevFieldMean) / z : 0;
  if (!(sd > 5)) sd = 9 * Math.sqrt(Math.max(1, gwsBefore)) + 10;
  return Math.max(1, Math.round(N * (1 - normCdf((prevTotal + myGw - prevFieldMean - fieldGw) / sd))));
}
