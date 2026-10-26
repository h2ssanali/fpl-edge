import { posKey, teamFixtures } from './data';
import { availability } from './players';
import { CS_BPS, GOAL_BPS } from './players';
import type { ModelContext } from './projection';
import { fixtureLambdas, teamBaseLambda } from './teams';
import type { Distribution, Pos, Scoring } from './types';
import { gauss, poisson, quantileSorted, rng } from './math';

/**
 * Monte Carlo gameweek simulator.
 *
 * Each simulation draws a scoreline for every fixture (Poisson on our team model),
 * then allocates those goals and assists to the players who are on the pitch in
 * proportion to their xG / xA share. Teammates are therefore correlated (a 4-0 win
 * lifts the whole defence and attack), which is what makes squad, captaincy and
 * mini-league distributions honest. Bonus is awarded 3/2/1 within each fixture by
 * ranking a BPS proxy, so there are exactly three bonus winners per match.
 */

export const FLAG_PLAYED = 1, FLAG_GOAL = 2, FLAG_ASSIST = 4, FLAG_CS = 8, FLAG_60 = 16;

export interface SimPlayer {
  id: number; pos: Pos; team: number;
  avail: number; startRate: number; p60: number; subRate: number;
  goalShare: number; // share of team goals per 90 (xG90 / team base λ)
  assistShare: number;
  saves90: number; pDC: number; yc90: number; bpsBase90: number;
  fixtures: { fx: number; home: boolean }[]; // indexes into SimSetup.fixtures
}

export interface SimSetup {
  gw: number;
  fixtures: { id: number; lh: number; la: number }[];
  players: SimPlayer[];
  scoring: Scoring;
}

export interface SimResult {
  gw: number; n: number;
  ids: number[];
  index: Map<number, number>;
  points: Int8Array[]; // per player, per simulation
  flags: Uint8Array[];
}

/** Players worth simulating: anyone with a realistic chance of minutes, plus forced ids. */
export function buildSimSetup(ctx: ModelContext, gw: number, forceIds: Iterable<number> = []): SimSetup {
  const gwFixtures = ctx.data.fixturesByGw.get(gw) ?? [];
  const fixtures = gwFixtures.map((f) => {
    const l = fixtureLambdas(ctx.teams, f.h, f.a);
    return { id: f.id, lh: l.home, la: l.away };
  });
  const fxIndex = new Map(gwFixtures.map((f, i) => [f.id, i]));
  const forced = new Set(forceIds);
  const ahead = Math.max(0, gw - ctx.asOfGw);
  const players: SimPlayer[] = [];
  for (const p of ctx.data.players.values()) {
    const prof = ctx.profiles.get(p.id);
    if (!prof) continue;
    const avail = availability(p, ahead).avail;
    const meaningful = avail * (prof.startRate + (1 - prof.startRate) * prof.subRate) > 0.04;
    if (!meaningful && !forced.has(p.id)) continue;
    const base = teamBaseLambda(ctx.teams, p.team);
    players.push({
      id: p.id, pos: p.pos, team: p.team, avail, startRate: prof.startRate, p60: prof.p60GivenStart,
      subRate: prof.subRate, goalShare: base > 0 ? prof.xg90 / base : 0, assistShare: base > 0 ? prof.xa90 / base : 0,
      saves90: prof.saves90, pDC: prof.pDC, yc90: prof.yc90, bpsBase90: prof.bpsBase90,
      fixtures: teamFixtures(ctx.data, gw, p.team).map((f) => ({ fx: fxIndex.get(f.id)!, home: f.h === p.team })),
    });
  }
  return { gw, fixtures, players, scoring: ctx.scoring };
}

export function simulate(setup: SimSetup, n = 10000, seed = 7): SimResult {
  const rand = rng(seed + setup.gw * 7919);
  const P = setup.players.length;
  const points = setup.players.map(() => new Int8Array(n));
  const flags = setup.players.map(() => new Uint8Array(n));
  const sc = setup.scoring;

  // Per fixture & side: list of player indexes.
  const sides: number[][][] = setup.fixtures.map(() => [[], []]);
  setup.players.forEach((p, i) => p.fixtures.forEach((f) => sides[f.fx][f.home ? 0 : 1].push(i)));

  // Scratch buffers
  const pts = new Float64Array(P);
  const fl = new Uint8Array(P);
  const availNow = new Uint8Array(P);
  const frac = new Float64Array(P);
  const long = new Uint8Array(P);
  const goals = new Uint8Array(P);
  const assists = new Uint8Array(P);
  const bps = new Float64Array(P);
  const gcOn = new Uint8Array(P);

  for (let s = 0; s < n; s++) {
    pts.fill(0);
    fl.fill(0);
    for (let i = 0; i < P; i++) availNow[i] = rand() < setup.players[i].avail ? 1 : 0;

    for (let f = 0; f < setup.fixtures.length; f++) {
      const fx = setup.fixtures[f];
      const gH = poisson(fx.lh, rand);
      const gA = poisson(fx.la, rand);
      for (let side = 0; side < 2; side++) {
        const list = sides[f][side];
        const teamGoals = side === 0 ? gH : gA;
        const oppGoals = side === 0 ? gA : gH;
        // Minutes
        for (const i of list) {
          const p = setup.players[i];
          frac[i] = 0; long[i] = 0; goals[i] = 0; assists[i] = 0; gcOn[i] = 0; bps[i] = 0;
          if (!availNow[i]) continue;
          if (rand() < p.startRate) {
            if (rand() < p.p60) { long[i] = 1; frac[i] = 0.95; } else { frac[i] = 0.3 + 0.35 * rand(); }
          } else if (rand() < p.subRate) {
            frac[i] = 0.08 + 0.25 * rand();
          }
        }
        // Allocate goals and assists
        for (let g = 0; g < teamGoals; g++) {
          let u = rand(), scorer = -1;
          for (const i of list) {
            if (frac[i] === 0) continue;
            u -= setup.players[i].goalShare * frac[i];
            if (u < 0) { scorer = i; break; }
          }
          if (scorer >= 0) goals[scorer]++;
          let v = rand();
          for (const i of list) {
            if (frac[i] === 0 || i === scorer) continue;
            v -= setup.players[i].assistShare * frac[i];
            if (v < 0) { assists[i]++; break; }
          }
        }
        // Score everyone on this side
        for (const i of list) {
          if (frac[i] === 0) continue;
          const p = setup.players[i];
          const key = posKey(p.pos);
          for (let g = 0; g < oppGoals; g++) if (rand() < frac[i]) gcOn[i]++;
          const cs = long[i] && gcOn[i] === 0 ? 1 : 0;
          let x = long[i] ? sc.longPlay : sc.shortPlay;
          x += goals[i] * sc.goals[key] + assists[i] * sc.assists;
          if (cs) x += sc.cs[key];
          if (sc.gc[key] !== 0) x += sc.gc[key] * Math.floor(gcOn[i] / 2);
          if (p.pos === 1) {
            const saves = poisson(p.saves90 * frac[i] * Math.pow((side === 0 ? fx.la : fx.lh) / 1.35, 0.6), rand);
            x += sc.saves * Math.floor(saves / 3);
          }
          if (p.pos > 1 && rand() < (long[i] ? p.pDC : p.pDC * 0.15)) x += sc.dc[key];
          if (rand() < p.yc90 * frac[i]) x += sc.yc;
          pts[i] += x;
          bps[i] = p.bpsBase90 * frac[i] + goals[i] * GOAL_BPS[p.pos] + assists[i] * 9 + cs * CS_BPS[p.pos] + gauss(rand) * 4;
          fl[i] |= FLAG_PLAYED;
          if (goals[i]) fl[i] |= FLAG_GOAL;
          if (assists[i]) fl[i] |= FLAG_ASSIST;
          if (cs) fl[i] |= FLAG_CS;
          if (long[i]) fl[i] |= FLAG_60;
        }
      }
      // Bonus: top-3 BPS proxy across both sides of this fixture.
      let b1 = -1, b2 = -1, b3 = -1;
      for (let side = 0; side < 2; side++) {
        for (const i of sides[f][side]) {
          if (frac[i] === 0) continue;
          if (b1 < 0 || bps[i] > bps[b1]) { b3 = b2; b2 = b1; b1 = i; }
          else if (b2 < 0 || bps[i] > bps[b2]) { b3 = b2; b2 = i; }
          else if (b3 < 0 || bps[i] > bps[b3]) { b3 = i; }
        }
      }
      if (b1 >= 0) pts[b1] += 3;
      if (b2 >= 0) pts[b2] += 2;
      if (b3 >= 0) pts[b3] += 1;
    }
    for (let i = 0; i < P; i++) {
      points[i][s] = Math.max(-20, Math.min(127, Math.round(pts[i])));
      flags[i][s] = fl[i];
    }
  }
  const ids = setup.players.map((p) => p.id);
  return { gw: setup.gw, n, ids, index: new Map(ids.map((id, i) => [id, i])), points, flags };
}

export function summarize(values: ArrayLike<number>, flags?: Uint8Array): Distribution {
  const n = values.length;
  const sorted = Float64Array.from(values).sort();
  let total = 0, sq = 0, p10plus = 0, blank = 0;
  const hist = new Array(33).fill(0);
  for (let i = 0; i < n; i++) {
    const v = values[i];
    total += v; sq += v * v;
    if (v >= 10) p10plus++;
    if (v <= 2) blank++;
    hist[Math.max(0, Math.min(32, Math.round(v) + 2))]++;
  }
  let g = 0, a = 0, cs = 0;
  if (flags) for (let i = 0; i < n; i++) { if (flags[i] & FLAG_GOAL) g++; if (flags[i] & FLAG_ASSIST) a++; if (flags[i] & FLAG_CS) cs++; }
  const mean = total / n;
  return {
    mean, median: quantileSorted(sorted, 0.5), p10: quantileSorted(sorted, 0.1), p90: quantileSorted(sorted, 0.9),
    sd: Math.sqrt(Math.max(0, sq / n - mean * mean)), pGoal: g / n, pAssist: a / n, pCS: cs / n,
    p10plus: p10plus / n, pBlank: blank / n, hist,
  };
}

export function playerDistribution(res: SimResult, id: number, multiplier = 1): Distribution | null {
  const i = res.index.get(id);
  if (i === undefined) return null;
  if (multiplier === 1) return summarize(res.points[i], res.flags[i]);
  const v = new Float64Array(res.n);
  for (let s = 0; s < res.n; s++) v[s] = res.points[i][s] * multiplier;
  return summarize(v, res.flags[i]);
}

export interface SquadPick { id: number; position: number; pos: Pos } // position 1..15; 12..15 = bench order

/**
 * Total points per simulation for a squad, applying FPL auto-subs (bench order,
 * formation limits), captain/vice and chips.
 */
export function squadSamples(
  res: SimResult, picks: SquadPick[], captain: number, vice: number,
  chip: 'bboost' | '3xc' | null = null,
): Float64Array {
  const out = new Float64Array(res.n);
  const sorted = [...picks].sort((a, b) => a.position - b.position);
  const xi = sorted.slice(0, 11);
  const bench = sorted.slice(11);
  const idx = (id: number) => res.index.get(id);
  const capMult = chip === '3xc' ? 3 : 2;
  const POS_MIN: Record<Pos, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };
  for (let s = 0; s < res.n; s++) {
    const played = (id: number) => { const i = idx(id); return i !== undefined && (res.flags[i][s] & FLAG_PLAYED) !== 0; };
    const ptsOf = (id: number) => { const i = idx(id); return i === undefined ? 0 : res.points[i][s]; };
    let total = 0;
    if (chip === 'bboost') {
      for (const p of sorted) total += ptsOf(p.id);
    } else {
      const lineup = xi.filter((p) => played(p.id));
      const counts: Record<Pos, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      lineup.forEach((p) => counts[p.pos]++);
      const missing = xi.filter((p) => !played(p.id));
      const used = new Set<number>();
      for (const out of missing) {
        // Goalkeeper only swaps with the bench goalkeeper.
        if (out.pos === 1) {
          const gk = bench.find((b) => b.pos === 1);
          if (gk && played(gk.id) && !used.has(gk.id)) { lineup.push(gk); used.add(gk.id); counts[1]++; }
          continue;
        }
        for (const b of bench) {
          if (b.pos === 1 || used.has(b.id) || !played(b.id)) continue;
          // Check formation would remain valid once complete.
          const c = { ...counts, [b.pos]: counts[b.pos as Pos] + 1 } as Record<Pos, number>;
          const outfieldSlots = 10 - (c[2] + c[3] + c[4]);
          const need = Math.max(0, POS_MIN[2] - c[2]) + Math.max(0, POS_MIN[3] - c[3]) + Math.max(0, POS_MIN[4] - c[4]);
          if (need > outfieldSlots) continue;
          lineup.push(b); used.add(b.id); counts[b.pos]++;
          break;
        }
      }
      for (const p of lineup) total += ptsOf(p.id);
    }
    const capPlays = played(captain);
    const c = capPlays ? captain : played(vice) ? vice : null;
    if (c != null) total += ptsOf(c) * (capMult - 1);
    out[s] = total;
  }
  return out;
}
