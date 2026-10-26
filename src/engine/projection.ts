import type { ModelData } from './data';
import { posKey, teamFixtures } from './data';
import { availability, buildProfiles, type PlayerProfile } from './players';
import { buildTeamModel, fixtureLambdas, teamBaseLambda, type TeamModel } from './teams';
import type { FixtureProjection, PlayerProjection, Reason, Scoring } from './types';
import { clamp, expectedFloorDiv, poissonPmf } from './math';

/** Minutes states for one fixture. */
export interface MinutesStates {
  pLong: number; // starts and plays 60+
  pShortStart: number; // starts, off before 60
  pSub: number; // comes on
  fracLong: number; fracShort: number; fracSub: number; // share of the match on the pitch
}

export function minutesStates(prof: PlayerProfile, avail: number): MinutesStates {
  const pStart = avail * prof.startRate;
  const pLong = pStart * prof.p60GivenStart;
  const pShortStart = pStart - pLong;
  const pSub = (avail - pStart) * prof.subRate;
  return { pLong, pShortStart, pSub, fracLong: 0.95, fracShort: 0.55, fracSub: 0.22 };
}

export interface ModelContext {
  data: ModelData;
  asOfGw: number;
  teams: TeamModel;
  profiles: Map<number, PlayerProfile>;
  scoring: Scoring;
}

export function buildContext(data: ModelData, asOfGw: number, opts: { ignoreStatus?: boolean } = {}): ModelContext {
  return {
    data, asOfGw,
    teams: buildTeamModel(data, asOfGw),
    profiles: buildProfiles(data, asOfGw, opts),
    scoring: data.core.rules.scoring,
  };
}

/**
 * Expected points for one player in one fixture, decomposed. Pure function of the
 * inputs so it is easy to test.
 */
export function projectFixture(
  prof: PlayerProfile, scoring: Scoring, ms: MinutesStates,
  lambdaFor: number, lambdaAgainst: number, teamBase: number,
): Omit<FixtureProjection, 'fixtureId' | 'opp' | 'home' | 'fdr'> {
  const key = posKey(prof.pos);
  const m = teamBase > 0 ? lambdaFor / teamBase : 1; // fixture attacking multiplier
  const states: [number, number, boolean][] = [
    [ms.pLong, ms.fracLong, true],
    [ms.pShortStart, ms.fracShort, false],
    [ms.pSub, ms.fracSub, false],
  ];
  let xPts = 0, eGoals = 0, eAssists = 0, pCS = 0, eBonus = 0, eSaves = 0, pDCtot = 0, xMins = 0;
  for (const [p, frac, long] of states) {
    if (p <= 0) continue;
    const g = prof.xg90 * m * frac;
    const a = prof.xa90 * m * frac;
    const conceded = lambdaAgainst * frac;
    const cs = long ? Math.exp(-conceded) : 0;
    const appearance = long ? scoring.longPlay : scoring.shortPlay;
    const gcPts = scoring.gc[key] !== 0 ? scoring.gc[key] * expectedFloorDiv(conceded, 2) : 0;
    const savesMean = prof.saves90 * frac * Math.pow(lambdaAgainst / 1.35, 0.6);
    const savePts = prof.pos === 1 ? scoring.saves * expectedFloorDiv(savesMean, 3) : 0;
    const dcP = long ? prof.pDC : prof.pDC * 0.15;
    // Bonus scales with how much the fixture favours this player's scoring routes.
    const routeBoost = prof.pos <= 2 ? 0.5 + 0.5 * (cs / 0.3) : 0.5 + 0.5 * m;
    const bonus = prof.bonus90 * frac * clamp(routeBoost, 0.4, 2);
    const pts = appearance + g * scoring.goals[key] + a * scoring.assists + cs * scoring.cs[key] + gcPts + savePts
      + dcP * scoring.dc[key] + bonus + prof.yc90 * frac * scoring.yc;
    xPts += p * pts;
    eGoals += p * g; eAssists += p * a; pCS += p * cs; eBonus += p * bonus; eSaves += p * savesMean; pDCtot += p * dcP;
    xMins += p * frac * 90;
  }
  return {
    lambdaFor, lambdaAgainst, xMins, pStart: ms.pLong + ms.pShortStart, p60: ms.pLong,
    eGoals, eAssists, pCS, eBonus, eSaves, pDC: pDCtot, xPts,
  };
}

/** Project every player for gameweek `gw` (may be several GWs after asOfGw). */
export function projectGw(ctx: ModelContext, gw: number, ignoreStatus = false): Map<number, PlayerProjection> {
  const out = new Map<number, PlayerProjection>();
  const ahead = Math.max(0, gw - ctx.asOfGw);
  for (const p of ctx.data.players.values()) {
    const prof = ctx.profiles.get(p.id)!;
    const fixtures = teamFixtures(ctx.data, gw, p.team);
    const avail = ignoreStatus ? 1 : availability(p, ahead).avail;
    const ms = minutesStates(prof, avail);
    const fps: FixtureProjection[] = fixtures.map((f) => {
      const home = f.h === p.team;
      const opp = home ? f.a : f.h;
      const l = fixtureLambdas(ctx.teams, f.h, f.a);
      const lf = home ? l.home : l.away;
      const la = home ? l.away : l.home;
      const fp = projectFixture(prof, ctx.scoring, ms, lf, la, teamBaseLambda(ctx.teams, p.team));
      return { fixtureId: f.id, opp, home, fdr: home ? f.hd : f.ad, ...fp };
    });
    const xPts = fps.reduce((s, f) => s + f.xPts, 0);
    out.set(p.id, {
      id: p.id, gw, xPts, fixtures: fps, avail, pStart: avail * prof.startRate,
      xMins: fps.reduce((s, f) => s + f.xMins, 0), reasons: explain(ctx, p.id, fps, avail),
    });
  }
  return out;
}

/** Matrix of xPts for gameweeks [from, from+horizon). */
export function projectHorizon(ctx: ModelContext, from: number, horizon: number): Map<number, PlayerProjection>[] {
  const res: Map<number, PlayerProjection>[] = [];
  for (let gw = from; gw < from + horizon && gw <= 38; gw++) res.push(projectGw(ctx, gw));
  return res;
}

function explain(ctx: ModelContext, id: number, fps: FixtureProjection[], avail: number): Reason[] {
  const p = ctx.data.players.get(id)!;
  const prof = ctx.profiles.get(id)!;
  const reasons: Reason[] = [];
  if (fps.length === 0) {
    reasons.push({ key: 'blank', params: {}, tone: 'bad' });
    return reasons;
  }
  if (fps.length > 1) reasons.push({ key: 'double', params: {}, tone: 'good' });
  for (const f of fps) {
    const opp = ctx.data.teams.get(f.opp)?.short ?? '?';
    reasons.push({ key: 'fixture', params: { opp, venue: f.home ? 'H' : 'A', fdr: f.fdr }, tone: f.fdr <= 2 ? 'good' : f.fdr >= 4 ? 'bad' : 'neutral' });
  }
  if (p.pos >= 3 || prof.xg90 > 0.15) reasons.push({ key: 'xg90', params: { v: prof.xg90.toFixed(2) }, tone: prof.xg90 > 0.45 ? 'good' : 'neutral' });
  if (prof.xa90 > 0.12) reasons.push({ key: 'xa90', params: { v: prof.xa90.toFixed(2) }, tone: prof.xa90 > 0.25 ? 'good' : 'neutral' });
  const pStart = avail * prof.startRate;
  reasons.push({ key: 'start', params: { v: Math.round(pStart * 100) }, tone: pStart > 0.85 ? 'good' : pStart < 0.6 ? 'bad' : 'neutral' });
  if (p.pos <= 2) {
    const cs = fps.reduce((s, f) => s + f.pCS, 0) / fps.length;
    reasons.push({ key: 'cs', params: { v: Math.round(cs * 100) }, tone: cs > 0.4 ? 'good' : cs < 0.2 ? 'bad' : 'neutral' });
  }
  if (prof.pDC > 0.35 && p.pos >= 2) reasons.push({ key: 'dc', params: { v: Math.round(prof.pDC * 100) }, tone: 'good' });
  if (p.pen === 1) reasons.push({ key: 'pens', params: {}, tone: 'good' });
  if (prof.bonus90 > 0.6) reasons.push({ key: 'bonus', params: { v: prof.bonus90.toFixed(1) }, tone: 'good' });
  if (avail < 1 && p.news) reasons.push({ key: 'news', params: { v: p.news }, tone: 'bad' });
  if (prof.rotationRisk) reasons.push({ key: 'rotation', params: {}, tone: 'bad' });
  return reasons;
}

/** Probability a team wins / draws / loses a fixture, from Poisson goals. */
export function matchOdds(lh: number, la: number): { home: number; draw: number; away: number } {
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= 10; i++) {
    const pi = poissonPmf(i, lh);
    for (let j = 0; j <= 10; j++) {
      const pj = poissonPmf(j, la);
      if (i > j) home += pi * pj; else if (i === j) draw += pi * pj; else away += pi * pj;
    }
  }
  return { home, draw, away };
}
