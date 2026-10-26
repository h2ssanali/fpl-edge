import type { ModelData } from './data';
import { shrink } from './math';

/**
 * Team strength model.
 *
 * FPL's own `strength_attack_*` fields are zeroed this season, so we derive ratings
 * from match data: each finished fixture contributes the team's xG (summed from
 * player xG in the live data) blended with actual goals, weighted by recency.
 * Ratings are multiplicative (1.0 = league average) and opponent-adjusted with a
 * few fixed-point iterations, then shrunk towards a prior from FPL's overall strength.
 */
export interface TeamRating {
  id: number;
  attack: number; // >1 scores more than average
  defence: number; // <1 concedes less than average
  matches: number;
  xgFor: number; // recency-weighted per match
  xgAgainst: number;
  goalsFor: number;
  goalsAgainst: number;
  trendXga: number; // last-4 xGA per match minus season xGA per match (negative = improving)
}

export interface TeamModel {
  ratings: Map<number, TeamRating>;
  leagueAvgGoals: number; // per team per match
  homeAdv: number; // multiplicative, applied as sqrt on each side
}

const XG_WEIGHT = 0.7; // blend of xG vs goals for "true" scoring rate
const HALF_LIFE = 10; // matches
const PRIOR_MATCHES = 5;

interface MatchObs { team: number; opp: number; home: boolean; gf: number; ga: number; xgf: number; xga: number; age: number }

export function collectMatches(data: ModelData, asOfGw: number): MatchObs[] {
  const obs: MatchObs[] = [];
  // Team xG per fixture from player live rows. For a double gameweek the live row
  // is a sum over both fixtures, so we split it evenly between them.
  const teamXg = new Map<string, number>(); // `${fixtureId}:${team}`
  for (const [gw, rows] of data.live) {
    if (gw >= asOfGw) continue;
    const gwFixtures = data.fixturesByGw.get(gw) ?? [];
    for (const row of rows.values()) {
      if (!row.xg) continue;
      const p = data.players.get(row.id);
      if (!p) continue;
      const fx = gwFixtures.filter((f) => (f.h === p.team || f.a === p.team) && (f.fin || f.prov));
      if (!fx.length) continue;
      for (const f of fx) {
        const k = `${f.id}:${p.team}`;
        teamXg.set(k, (teamXg.get(k) ?? 0) + row.xg / fx.length);
      }
    }
  }
  const finished = data.fixtures
    .filter((f) => f.ev != null && f.ev < asOfGw && (f.fin || f.prov) && f.hs != null && f.as != null)
    .sort((a, b) => (b.ev! - a.ev!) || ((b.ko ?? '') > (a.ko ?? '') ? 1 : -1));
  const ageByTeam = new Map<number, number>();
  for (const f of finished) {
    const hxg = teamXg.get(`${f.id}:${f.h}`) ?? f.hs!;
    const axg = teamXg.get(`${f.id}:${f.a}`) ?? f.as!;
    const ah = ageByTeam.get(f.h) ?? 0;
    const aa = ageByTeam.get(f.a) ?? 0;
    obs.push({ team: f.h, opp: f.a, home: true, gf: f.hs!, ga: f.as!, xgf: hxg, xga: axg, age: ah });
    obs.push({ team: f.a, opp: f.h, home: false, gf: f.as!, ga: f.hs!, xgf: axg, xga: hxg, age: aa });
    ageByTeam.set(f.h, ah + 1);
    ageByTeam.set(f.a, aa + 1);
  }
  return obs;
}

function priorFor(strength: number | null | undefined): { att: number; def: number } {
  // FPL overall strength is on a ~2..5 scale; 3.5 ≈ average.
  const s = strength && strength > 0 ? strength : 3.5;
  return { att: 1 + 0.16 * (s - 3.5), def: 1 - 0.14 * (s - 3.5) };
}

export function buildTeamModel(data: ModelData, asOfGw: number): TeamModel {
  const obs = collectMatches(data, asOfGw);
  const teams = [...data.teams.values()];
  const rate = (o: MatchObs, side: 'f' | 'a') =>
    side === 'f' ? XG_WEIGHT * o.xgf + (1 - XG_WEIGHT) * o.gf : XG_WEIGHT * o.xga + (1 - XG_WEIGHT) * o.ga;

  let totalHome = 0, totalAway = 0, nHome = 0, nAway = 0;
  for (const o of obs) {
    if (o.home) { totalHome += rate(o, 'f'); nHome++; } else { totalAway += rate(o, 'f'); nAway++; }
  }
  const avgHome = nHome ? totalHome / nHome : 1.5;
  const avgAway = nAway ? totalAway / nAway : 1.2;
  const leagueAvgGoals = nHome + nAway > 0 ? (totalHome + totalAway) / (nHome + nAway) : 1.35;
  // Home advantage, shrunk toward the long-run EPL ratio (~1.2).
  const rawHome = avgAway > 0 ? avgHome / avgAway : 1.2;
  const homeAdv = shrink(rawHome, nHome / 10, 1.2, 10);
  const hSide = Math.sqrt(homeAdv);

  const att = new Map<number, number>(teams.map((t) => [t.id, 1]));
  const def = new Map<number, number>(teams.map((t) => [t.id, 1]));
  const weightOf = (age: number) => Math.pow(0.5, age / HALF_LIFE);

  for (let iter = 0; iter < 6; iter++) {
    for (const t of teams) {
      const mine = obs.filter((o) => o.team === t.id);
      let wSum = 0, aNum = 0, dNum = 0;
      for (const o of mine) {
        const w = weightOf(o.age);
        const venue = o.home ? hSide : 1 / hSide;
        // Observed attack relative to what an average team would score vs this opponent.
        aNum += w * rate(o, 'f') / (leagueAvgGoals * venue * (def.get(o.opp) ?? 1));
        dNum += w * rate(o, 'a') / (leagueAvgGoals * (1 / venue) * (att.get(o.opp) ?? 1));
        wSum += w;
      }
      const prior = priorFor(((t.strengthHome ?? 0) + (t.strengthAway ?? 0)) / 2 || null);
      att.set(t.id, shrink(wSum ? aNum / wSum : prior.att, wSum, prior.att, PRIOR_MATCHES));
      def.set(t.id, shrink(wSum ? dNum / wSum : prior.def, wSum, prior.def, PRIOR_MATCHES));
    }
    // Normalise so the league average is exactly 1.
    const ma = [...att.values()].reduce((s, x) => s + x, 0) / teams.length;
    const md = [...def.values()].reduce((s, x) => s + x, 0) / teams.length;
    for (const t of teams) { att.set(t.id, att.get(t.id)! / ma); def.set(t.id, def.get(t.id)! / md); }
  }

  const ratings = new Map<number, TeamRating>();
  for (const t of teams) {
    const mine = obs.filter((o) => o.team === t.id);
    let w = 0, xf = 0, xa = 0, gf = 0, ga = 0;
    for (const o of mine) {
      const ww = weightOf(o.age);
      w += ww; xf += ww * o.xgf; xa += ww * o.xga; gf += ww * o.gf; ga += ww * o.ga;
    }
    const recent = mine.filter((o) => o.age < 4);
    const recentXga = recent.length ? recent.reduce((s, o) => s + o.xga, 0) / recent.length : 0;
    const seasonXga = mine.length ? mine.reduce((s, o) => s + o.xga, 0) / mine.length : 0;
    ratings.set(t.id, {
      id: t.id, attack: att.get(t.id)!, defence: def.get(t.id)!, matches: mine.length,
      xgFor: w ? xf / w : leagueAvgGoals, xgAgainst: w ? xa / w : leagueAvgGoals,
      goalsFor: w ? gf / w : leagueAvgGoals, goalsAgainst: w ? ga / w : leagueAvgGoals,
      trendXga: recent.length && mine.length ? recentXga - seasonXga : 0,
    });
  }
  return { ratings, leagueAvgGoals, homeAdv };
}

/** Expected goals for each side of a fixture. */
export function fixtureLambdas(model: TeamModel, home: number, away: number): { home: number; away: number } {
  const h = model.ratings.get(home);
  const a = model.ratings.get(away);
  const hs = Math.sqrt(model.homeAdv);
  const mu = model.leagueAvgGoals;
  return {
    home: mu * (h?.attack ?? 1) * (a?.defence ?? 1) * hs,
    away: (mu * (a?.attack ?? 1) * (h?.defence ?? 1)) / hs,
  };
}

/** A team's baseline expected goals per match vs an average opponent at a neutral venue. */
export function teamBaseLambda(model: TeamModel, team: number): number {
  return model.leagueAvgGoals * (model.ratings.get(team)?.attack ?? 1);
}

/** 1 (easiest) .. 5 (hardest) difficulty from our own model, for the ticker. */
export function modelFdr(model: TeamModel, team: number, opp: number, home: boolean): { attack: number; defence: number; overall: number } {
  const l = home ? fixtureLambdas(model, team, opp) : fixtureLambdas(model, opp, team);
  const forG = home ? l.home : l.away;
  const agG = home ? l.away : l.home;
  const mu = model.leagueAvgGoals;
  // Map ratios to 1..5: ratio 1.6 -> 1 (great), 0.6 -> 5 (awful).
  const toFdr = (ratio: number) => Math.min(5, Math.max(1, 3 - (ratio - 1) * 3.3));
  const attack = toFdr(forG / mu);
  const defence = toFdr(mu / Math.max(0.2, agG));
  return { attack, defence, overall: (attack + defence) / 2 };
}
