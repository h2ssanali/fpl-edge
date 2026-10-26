import { gauss, normCdf, rng } from './math';

/**
 * Position-aware strategy (the "Risk Dial").
 *
 * We optimize for winning the league, not for raw points. Each candidate move
 * changes (a) Hassan's expected points and (b) how different his team is from
 * each rival (variance of the head-to-head difference). Leading → reduce
 * variance by covering rivals' effective ownership; chasing → add variance with
 * differentials.
 */

export type Mode = 'protect' | 'balanced' | 'attack';

export function suggestMode(myRank: number, gapToLeader: number, gapToNext: number, remainingGws: number): { mode: Mode; dial: number } {
  // Dial: -1 (protect) .. +1 (attack)
  const perGw = Math.max(1, remainingGws);
  if (myRank === 1) {
    const lead = gapToNext / perGw;
    return lead > 1.2 ? { mode: 'protect', dial: -0.8 } : { mode: 'protect', dial: -0.4 };
  }
  const deficit = gapToLeader / perGw;
  if (deficit > 2.5) return { mode: 'attack', dial: 0.9 };
  if (deficit > 0.8) return { mode: 'attack', dial: 0.5 };
  return { mode: 'balanced', dial: 0 };
}

/**
 * League-win probability via a quick Normal Monte Carlo on season totals.
 * diffSd: spread of each rival's final difference with me.
 */
export function winProbability(
  myTotal: number, myRemaining: number, rivals: { total: number; remaining: number; diffSd: number }[],
  n = 4000, seed = 5,
): number {
  const rand = rng(seed);
  let wins = 0;
  // My own noise is shared by every head-to-head difference; split the variance.
  const sdMe = rivals.length ? Math.min(...rivals.map((r) => r.diffSd)) / Math.SQRT2 : 0;
  const sdR = rivals.map((r) => Math.sqrt(Math.max(1, r.diffSd ** 2 - sdMe ** 2)));
  for (let s = 0; s < n; s++) {
    const me = myTotal + myRemaining + gauss(rand) * sdMe;
    let ok = true;
    for (let i = 0; i < rivals.length; i++) {
      const r = rivals[i];
      if (me <= r.total + r.remaining + gauss(rand) * sdR[i]) { ok = false; break; }
    }
    if (ok) wins++;
  }
  return wins / n;
}

// ---------------------------------------------------------------------------
// Head-to-head difference model
// ---------------------------------------------------------------------------

/** A starting XI with multipliers (captain = 2, triple captain = 3). */
export type Lineup = Map<number, number>;

/** Per-GW variance of an FPL player's score, roughly over-dispersed Poisson. */
export const pointVariance = (xp: number) => 1.6 * Math.max(0, xp) + 0.8;

/**
 * Mean and variance of (my GW score − rival GW score). Shared players cancel
 * out unless their multipliers differ (e.g. different captains), which is exactly
 * why covering a rival's captain is "safe" and a differential is "risky".
 */
export function pairStats(mine: Lineup, theirs: Lineup, xp: (id: number) => number): { mean: number; variance: number } {
  let mean = 0, variance = 0;
  const ids = new Set([...mine.keys(), ...theirs.keys()]);
  for (const id of ids) {
    const d = (mine.get(id) ?? 0) - (theirs.get(id) ?? 0);
    if (d === 0) continue;
    const x = xp(id);
    mean += d * x;
    variance += d * d * pointVariance(x);
  }
  return { mean, variance };
}

/** Per-GW variance from future decisions (transfers, captains, chips) per manager pair. */
export const DECISION_VAR = 60;

/** How much of a manager's season points-per-GW edge persists into future GWs. */
export const SKILL_WEIGHT = 0.15;

const logit = (p: number) => Math.log(Math.max(1e-4, Math.min(1 - 1e-4, p)) / (1 - Math.max(1e-4, Math.min(1 - 1e-4, p))));

/** Apply the change from `from` to `to` (one model) onto `base` (another model) in logit space. */
export function logitShift(base: number, from: number, to: number): number {
  const z = logit(base) + logit(to) - logit(from);
  return 1 / (1 + Math.exp(-z));
}

export interface RivalOdds { entry: number; pBeat: number; mean: number; sd: number }

/**
 * Season-long head-to-head odds vs each rival. The horizon GWs use projected
 * lineups; GWs beyond the horizon assume similar expected scores but keep the
 * same per-GW variance (squads keep differing).
 */
export function rivalOdds(
  me: { total: number; ppg: number; lineups: Lineup[] }, rivals: { entry: number; total: number; ppg: number; lineups: Lineup[] }[],
  xpByGw: ((id: number) => number)[], remainingGws: number,
): RivalOdds[] {
  return rivals.map((r) => {
    let mean = me.total - r.total + SKILL_WEIGHT * (me.ppg - r.ppg) * Math.max(0, remainingGws - xpByGw.length), variance = 0;
    xpByGw.forEach((xp, gi) => {
      const s = pairStats(me.lineups[gi] ?? me.lineups.at(-1)!, r.lineups[gi] ?? r.lineups.at(-1)!, xp);
      mean += s.mean;
      variance += s.variance;
    });
    const perGwVar = variance / Math.max(1, xpByGw.length);
    variance += perGwVar * Math.max(0, remainingGws - xpByGw.length);
    // Future transfers, captaincy calls and chips the model can't see yet.
    variance += DECISION_VAR * remainingGws;
    const sd = Math.sqrt(Math.max(1, variance));
    return { entry: r.entry, pBeat: normCdf(mean / sd), mean, sd };
  });
}

/** P(finish 1st) from head-to-head means and sds, with my own noise shared across pairs. */
export function winFromOdds(odds: RivalOdds[], n = 4000, seed = 11): number {
  if (!odds.length) return 1;
  const rand = rng(seed);
  const sdMe = Math.min(...odds.map((o) => o.sd)) / Math.SQRT2;
  const sdR = odds.map((o) => Math.sqrt(Math.max(1, o.sd ** 2 - sdMe ** 2)));
  let wins = 0;
  for (let s = 0; s < n; s++) {
    const e = gauss(rand) * sdMe;
    let ok = true;
    for (let i = 0; i < odds.length; i++) {
      if (odds[i].mean + e + gauss(rand) * sdR[i] <= 0) { ok = false; break; }
    }
    if (ok) wins++;
  }
  return wins / n;
}
