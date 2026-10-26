import type { ModelData } from './data';
import { teamFixtures } from './data';
import type { Player, Pos } from './types';
import { clamp, shrink } from './math';

/**
 * Per-player profile derived from gameweek history up to (not including) `asOfGw`:
 * minutes behaviour, per-90 attacking rates, bonus/BPS baseline, defensive contribution.
 */
export interface PlayerProfile {
  id: number;
  pos: Pos;
  team: number;
  /** Probability the player is available (fit, not suspended) for the planning GW. */
  avail: number;
  /** Start probability given available, from recent team matches. */
  startRate: number;
  /** P(plays 60+ | starts). */
  p60GivenStart: number;
  /** P(comes off the bench | available and not starting). */
  subRate: number;
  xg90: number;
  xa90: number;
  saves90: number;
  /** Bonus points per 90 (shrunk). */
  bonus90: number;
  /** BPS per 90 that is NOT explained by goals/assists/clean sheets — the "baseline". */
  bpsBase90: number;
  /** P(reaches the defensive-contribution threshold | plays 60+). */
  pDC: number;
  yc90: number;
  /** How many recent team matches we observed. */
  sample: number;
  recentMins: number[]; // most recent first, one entry per team gameweek
  rotationRisk: boolean;
  newsFlag: 'none' | 'doubt' | 'out' | 'gone';
}

const POS_PRIORS: Record<Pos, { xg90: number; xa90: number; bonus90: number; pDC: number; bpsBase: number }> = {
  1: { xg90: 0, xa90: 0.01, bonus90: 0.25, pDC: 0, bpsBase: 14 },
  2: { xg90: 0.04, xa90: 0.06, bonus90: 0.2, pDC: 0.3, bpsBase: 11 },
  3: { xg90: 0.13, xa90: 0.13, bonus90: 0.25, pDC: 0.12, bpsBase: 8 },
  4: { xg90: 0.32, xa90: 0.1, bonus90: 0.35, pDC: 0.03, bpsBase: 6 },
};

/** BPS awarded for a goal by position (FPL BPS rules). */
export const GOAL_BPS: Record<Pos, number> = { 1: 12, 2: 12, 3: 18, 4: 24 };
export const CS_BPS: Record<Pos, number> = { 1: 12, 2: 12, 3: 0, 4: 0 };
export const DC_THRESHOLD: Record<Pos, number> = { 1: 999, 2: 10, 3: 12, 4: 12 };

/** Availability from FPL status / chance of playing, optionally looking k gameweeks ahead. */
export function availability(p: Player, aheadGws = 0): { avail: number; flag: PlayerProfile['newsFlag'] } {
  const cop = p.cop;
  switch (p.status) {
    case 'a':
      return { avail: cop == null ? 1 : cop / 100, flag: cop != null && cop < 100 ? 'doubt' : 'none' };
    case 'd': {
      const base = cop == null ? 0.5 : cop / 100;
      return { avail: 1 - (1 - base) * Math.pow(0.55, aheadGws), flag: 'doubt' };
    }
    case 'i':
    case 's': {
      const base = cop == null ? 0 : cop / 100;
      // Unknown return date: recover gradually over the following gameweeks.
      const recovery = p.status === 's' ? (aheadGws >= 1 ? 0.85 : 0) : clamp(0.22 * aheadGws, 0, 0.85);
      return { avail: Math.max(base, recovery), flag: 'out' };
    }
    case 'u':
    case 'n':
      return { avail: cop == null ? 0 : cop / 100, flag: 'gone' };
    default:
      return { avail: 1, flag: 'none' };
  }
}

export function buildProfiles(data: ModelData, asOfGw: number, opts: { ignoreStatus?: boolean } = {}): Map<number, PlayerProfile> {
  const gws = [...data.live.keys()].filter((g) => g < asOfGw).sort((a, b) => b - a); // most recent first
  const out = new Map<number, PlayerProfile>();

  // Which gameweeks did each team actually play in?
  const teamGws = new Map<number, number[]>();
  for (const t of data.teams.keys()) teamGws.set(t, gws.filter((g) => teamFixtures(data, g, t).some((f) => f.started || f.fin)));

  // Price ranks within position for the attacking prior (more expensive => more attacking threat).
  const avgCostByPos = new Map<Pos, number>();
  for (const pos of [1, 2, 3, 4] as Pos[]) {
    const list = [...data.players.values()].filter((p) => p.pos === pos);
    avgCostByPos.set(pos, list.reduce((s, p) => s + p.cost, 0) / Math.max(1, list.length));
  }

  for (const p of data.players.values()) {
    const prior = POS_PRIORS[p.pos];
    const playedGws = teamGws.get(p.team) ?? [];
    let wMins = 0, wXg = 0, wXa = 0, wSaves = 0, wBonus = 0, wBpsBase = 0, wYc = 0;
    let wStarts = 0, wObs = 0, starts = 0, s60 = 0, subs = 0, nonStarts = 0, dcHits = 0, dcObs = 0;
    const recentMins: number[] = [];
    playedGws.forEach((gw, age) => {
      const row = data.live.get(gw)?.get(p.id);
      const nFix = Math.max(1, teamFixtures(data, gw, p.team).length);
      const mins = row?.mins ?? 0;
      const st = row?.starts ?? 0;
      recentMins.push(mins);
      const w = Math.pow(0.82, age); // recency weight for minutes/role
      const wr = Math.pow(0.9, age); // slower decay for per-90 skill rates
      wObs += w * nFix;
      wStarts += w * Math.min(st, nFix);
      starts += st;
      if (st > 0 && mins / nFix >= 60) s60 += Math.min(st, nFix);
      if (st < nFix) {
        nonStarts += nFix - st;
        if (mins > 0 && st === 0) subs += 1;
      }
      if (!row || mins === 0) return;
      wMins += wr * mins;
      wXg += wr * row.xg;
      wXa += wr * row.xa;
      wSaves += wr * row.saves;
      wBonus += wr * row.bonus;
      wYc += wr * row.yc;
      const explained = row.g * GOAL_BPS[p.pos] + row.a * 9 + row.cs * CS_BPS[p.pos];
      wBpsBase += wr * Math.max(0, row.bps - explained);
      if (mins >= 60 * nFix) {
        dcObs += nFix;
        if (row.dc >= DC_THRESHOLD[p.pos] * nFix) dcHits += nFix;
        else if (nFix > 1 && row.dc >= DC_THRESHOLD[p.pos]) dcHits += 1;
      }
    });

    const n90 = wMins / 90;
    const costFactor = Math.pow(p.cost / (avgCostByPos.get(p.pos) ?? p.cost), 1.3);
    const xg90 = shrink(n90 ? wXg / n90 : 0, n90, prior.xg90 * costFactor, 3);
    const xa90 = shrink(n90 ? wXa / n90 : 0, n90, prior.xa90 * costFactor, 3);
    const saves90 = p.pos === 1 ? shrink(n90 ? wSaves / n90 : 0, n90, 2.8, 3) : 0;
    const bonus90 = shrink(n90 ? wBonus / n90 : 0, n90, prior.bonus90 * costFactor, 4);
    const bpsBase90 = shrink(n90 ? (wBpsBase / n90) : 0, n90, prior.bpsBase, 3);
    const yc90 = shrink(n90 ? wYc / n90 : 0, n90, 0.15, 5);
    const pDC = shrink(dcObs ? dcHits / dcObs : 0, dcObs, prior.pDC, 4);

    // Start rate: shrink toward a cost-based prior (cheap fringe players start less).
    const startPrior = clamp(0.15 + 0.6 * (costFactor - 0.6), 0.1, 0.8);
    const startRate = shrink(wObs ? wStarts / wObs : startPrior, wObs, startPrior, 1.2);
    const p60GivenStart = shrink(starts ? s60 / starts : 0.8, starts, 0.82, 2);
    const subRate = shrink(nonStarts ? subs / nonStarts : 0.25, nonStarts, 0.25, 2);

    const st = opts.ignoreStatus ? { avail: 1, flag: 'none' as const } : availability(p);
    const recent = recentMins.slice(0, 5);
    const rotationRisk = startRate > 0.3 && startRate < 0.8 && recent.some((m) => m < 30) && recent.some((m) => m >= 60);

    out.set(p.id, {
      id: p.id, pos: p.pos, team: p.team, avail: st.avail, startRate, p60GivenStart, subRate,
      xg90, xa90, saves90, bonus90, bpsBase90, pDC, yc90, sample: playedGws.length, recentMins,
      rotationRisk, newsFlag: st.flag,
    });
  }
  return out;
}
