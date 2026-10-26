import type { LeagueFile, ManagerFile, Pos } from './types';
import type { Player } from './types';
import { squadSamples, type SimResult, type SquadPick } from './montecarlo';
import { gauss, normCdf, rng } from './math';
import { DECISION_VAR, SKILL_WEIGHT } from './strategy';

/**
 * Mini-league maths: effective ownership from the actual rivals, season-long
 * league-win probability, rank-swing "what ifs" and per-rival head-to-head odds.
 */

export interface LeagueSquad {
  entry: number; name: string; player: string; total: number; rank: number;
  picks: SquadPick[]; captain: number; vice: number; chip: 'bboost' | '3xc' | null;
  ppg: number; // season points per GW
}

export function squadFromPicks(manager: ManagerFile, players: Map<number, Player>, gw?: number): { picks: SquadPick[]; captain: number; vice: number } | null {
  const gws = Object.keys(manager.picks).map(Number).sort((a, b) => b - a);
  const g = gw ?? gws[0];
  let pk = manager.picks[g];
  if (pk?.chip === 'freehit') {
    const prev = gws.find((x) => x < g);
    if (prev) pk = manager.picks[prev];
  }
  if (!pk) return null;
  const picks = pk.picks
    .filter(([id]) => players.has(id))
    .map(([id, position]) => ({ id, position, pos: players.get(id)!.pos as Pos }));
  const cap = pk.picks.find((p) => p[3] === 1)?.[0] ?? picks[0]?.id ?? 0;
  const vice = pk.picks.find((p) => p[4] === 1)?.[0] ?? picks[1]?.id ?? 0;
  return { picks, captain: cap, vice };
}

/** Effective ownership (%) among the given squads: sum of multipliers / managers. */
export function effectiveOwnership(squads: LeagueSquad[]): Map<number, number> {
  const eo = new Map<number, number>();
  for (const s of squads) {
    const xi = [...s.picks].sort((a, b) => a.position - b.position);
    for (const p of xi) {
      let mult = p.position <= 11 || s.chip === 'bboost' ? 1 : 0;
      if (p.id === s.captain) mult = s.chip === '3xc' ? 3 : 2;
      if (mult) eo.set(p.id, (eo.get(p.id) ?? 0) + mult);
    }
  }
  for (const [k, v] of eo) eo.set(k, (v / Math.max(1, squads.length)) * 100);
  return eo;
}

export interface LeagueSimOutput {
  entries: number[];
  gwMean: number[]; gwSd: number[];
  pWin: number[]; // probability of finishing 1st at season end
  pTopAfterGw: number[]; // probability of leading after next GW
  expRankAfterGw: number[];
  rankDist: number[][]; // [entry][rank-1] after season
  gwSamples: Float64Array[];
  correlation: number;
}

/**
 * Season-long league simulation. Next GW comes from the correlated Monte Carlo
 * samples; the remaining gameweeks are modelled as a common shock plus a
 * manager-specific Normal term whose spread comes from the simulated squads.
 */
export function simulateLeague(res: SimResult, squads: LeagueSquad[], remainingGws: number, seed = 99): LeagueSimOutput {
  const n = res.n;
  const gwSamples = squads.map((s) => squadSamples(res, s.picks, s.captain, s.vice, s.chip));
  const gwMean = gwSamples.map((x) => x.reduce((a, b) => a + b, 0) / n);
  const gwSd = gwSamples.map((x, i) => Math.sqrt(x.reduce((a, b) => a + (b - gwMean[i]) ** 2, 0) / n));

  // Average pairwise correlation of GW scores (shared template players).
  let corrSum = 0, corrN = 0;
  for (let i = 0; i < squads.length && i < 12; i++) {
    for (let j = i + 1; j < squads.length && j < 12; j++) {
      let c = 0;
      for (let s = 0; s < n; s++) c += (gwSamples[i][s] - gwMean[i]) * (gwSamples[j][s] - gwMean[j]);
      const r = c / n / Math.max(1e-6, gwSd[i] * gwSd[j]);
      corrSum += r; corrN++;
    }
  }
  const correlation = corrN ? corrSum / corrN : 0.5;
  const rand = rng(seed);
  const later = Math.max(0, remainingGws - 1);
  // Future GWs: each manager's expected GW score regresses toward the league mean.
  const leagueMean = gwMean.reduce((a, b) => a + b, 0) / Math.max(1, gwMean.length);
  // Future GWs: squad strength regresses to the league mean; a little season skill persists.
  const ppgMean = squads.reduce((a, s) => a + s.ppg, 0) / Math.max(1, squads.length);
  const futureMean = squads.map((s, i) => 0.6 * gwMean[i] + 0.4 * leagueMean + SKILL_WEIGHT * (s.ppg - ppgMean));
  // Idiosyncratic spread per manager: squad differences plus future decisions.
  const idioSd = gwSd.map((sd) => Math.sqrt(Math.max(36, sd * sd * Math.max(0.15, 1 - correlation)) + DECISION_VAR / 2));

  const k = squads.length;
  const wins = new Array(k).fill(0);
  const leadAfter = new Array(k).fill(0);
  const rankAfterSum = new Array(k).fill(0);
  const rankDist = squads.map(() => new Array(k).fill(0));
  const totals = new Float64Array(k);
  const after = new Float64Array(k);
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < k; i++) {
      after[i] = squads[i].total + gwSamples[i][s];
      totals[i] = after[i] + later * futureMean[i] + Math.sqrt(later) * idioSd[i] * gauss(rand);
    }
    let best = 0, bestAfter = 0;
    for (let i = 1; i < k; i++) {
      if (totals[i] > totals[best]) best = i;
      if (after[i] > after[bestAfter]) bestAfter = i;
    }
    wins[best]++;
    leadAfter[bestAfter]++;
    for (let i = 0; i < k; i++) {
      let r = 1, rs = 1;
      for (let j = 0; j < k; j++) {
        if (j === i) continue;
        if (after[j] > after[i]) r++;
        if (totals[j] > totals[i]) rs++;
      }
      rankAfterSum[i] += r;
      rankDist[i][rs - 1]++;
    }
  }
  return {
    entries: squads.map((s) => s.entry), gwMean, gwSd,
    pWin: wins.map((w) => w / n), pTopAfterGw: leadAfter.map((w) => w / n),
    expRankAfterGw: rankAfterSum.map((r) => r / n), rankDist: rankDist.map((d) => d.map((x) => x / n)),
    gwSamples, correlation,
  };
}

/**
 * "What if" for one player: Hassan's expected league rank after the GW when the
 * player blanks (≤2 pts) vs hauls (≥10 pts), conditioning on the joint simulations.
 */
export function rankSwing(res: SimResult, league: LeagueSimOutput, squads: LeagueSquad[], meIdx: number, playerId: number) {
  const pi = res.index.get(playerId);
  if (pi === undefined) return null;
  const pts = res.points[pi];
  const buckets = { blank: { sum: 0, n: 0 }, haul: { sum: 0, n: 0 }, all: { sum: 0, n: 0 } };
  for (let s = 0; s < res.n; s++) {
    const mine = squads[meIdx].total + league.gwSamples[meIdx][s];
    let rank = 1;
    for (let j = 0; j < squads.length; j++) if (j !== meIdx && squads[j].total + league.gwSamples[j][s] > mine) rank++;
    const b = pts[s] <= 2 ? buckets.blank : pts[s] >= 10 ? buckets.haul : null;
    if (b) { b.sum += rank; b.n++; }
    buckets.all.sum += rank; buckets.all.n++;
  }
  const avg = (b: { sum: number; n: number }) => (b.n ? b.sum / b.n : null);
  return {
    playerId,
    blankRank: avg(buckets.blank), haulRank: avg(buckets.haul), baseRank: avg(buckets.all),
    pBlank: buckets.blank.n / res.n, pHaul: buckets.haul.n / res.n,
  };
}

/** P(finish above a rival over the rest of the season), Normal approximation. */
export function headToHead(gap: number, meanDiffPerGw: number, sdDiffPerGw: number, remainingGws: number): number {
  const mu = gap + meanDiffPerGw * remainingGws;
  const sd = Math.max(1, sdDiffPerGw * Math.sqrt(Math.max(1, remainingGws)));
  return normCdf(mu / sd);
}

export function leagueSquads(
  league: LeagueFile, managers: Map<number, ManagerFile>, players: Map<number, Player>,
  overrides: Map<number, { captain?: number; vice?: number }> = new Map(),
): LeagueSquad[] {
  const out: LeagueSquad[] = [];
  for (const st of league.standings) {
    const m = managers.get(st.entry);
    if (!m) continue;
    const sq = squadFromPicks(m, players);
    if (!sq || sq.picks.length < 11) continue;
    const o = overrides.get(st.entry);
    const played = m.history.length || 1;
    out.push({
      entry: st.entry, name: st.name, player: st.player, total: st.total, rank: st.rank,
      picks: sq.picks, captain: o?.captain ?? sq.captain, vice: o?.vice ?? sq.vice, chip: null,
      ppg: m.history.reduce((s, h) => s + h.pts - h.cost, 0) / played,
    });
  }
  return out;
}
