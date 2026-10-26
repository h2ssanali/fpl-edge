import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildModelData, parseLive } from './data';
import { expectedFloorDiv, normCdf, normInv, poissonPmf, rng, poisson, shrink } from './math';
import { availability } from './players';
import { buildContext, matchOdds, minutesStates, projectFixture, projectGw } from './projection';
import { buildTeamModel, fixtureLambdas } from './teams';
import { buildSimSetup, playerDistribution, simulate, squadSamples, summarize } from './montecarlo';
import { bestXI, freeTransfers, sellingPrices, validSquad } from './squad';
import { optimizeTransfers } from './optimizer';
import { dreamTeam } from './dreamteam';
import { effectiveOwnership, headToHead } from './league';
import { winProbability, suggestMode } from './strategy';
import { chipAvailability } from './chips';
import { priceSignals } from './insights';
import type { Core, Fixture, LiveFile, ManagerFile, Player, Pos, Scoring } from './types';

// ---------- synthetic world ----------
const SCORING: Scoring = {
  longPlay: 2, shortPlay: 1,
  goals: { GKP: 10, DEF: 6, MID: 5, FWD: 4 }, cs: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
  gc: { GKP: -1, DEF: -1, MID: 0, FWD: 0 }, dc: { GKP: 0, DEF: 2, MID: 2, FWD: 2 },
  assists: 3, saves: 1, ps: 5, pm: -2, yc: -1, rc: -3, og: -2,
};

function mkPlayer(id: number, team: number, pos: Pos, cost: number, extra: Partial<Player> = {}): Player {
  return {
    id, code: id, web: `P${id}`, first: 'F', second: `S${id}`, team, pos, cost, sel: 10, status: 'a', cop: null, copThis: null,
    news: '', newsAdded: null, form: 0, ppg: 0, ep: 0, total: 0, evPts: 0, mins: 0, starts: 0, g: 0, a: 0, cs: 0, gc: 0, og: 0,
    ps: 0, pm: 0, yc: 0, rc: 0, saves: 0, bonus: 0, bps: 0, xg: 0, xa: 0, xgc: 0, dc: 0, ict: 0, pen: null, setp: null, fk: null,
    tin: 0, tout: 0, tinAll: 0, toutAll: 0, cce: 0, ccs: 0, pcp: null, pcr: null, pcProj: null, pcLocked: null,
    canSelect: true, removed: false, ...extra,
  };
}

/** 4 teams, 15 players each (2/5/5/3); team 1 is strong, team 4 weak. */
function world(gwsPlayed = 6) {
  const teams = [1, 2, 3, 4].map((id) => ({ id, code: id, name: `Team${id}`, short: `T${id}`, strengthHome: 5 - id + 1, strengthAway: 5 - id + 1, position: id, played: 0, win: 0, draw: 0, loss: 0, points: 0 }));
  const players: Player[] = [];
  let id = 1;
  for (const t of teams) {
    const shape: Pos[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
    shape.forEach((pos, i) => {
      const star = i === 7 || i === 12;
      players.push(mkPlayer(id++, t.id, pos, star ? 100 : 45 + pos * 5, { sel: star ? 40 : 5 }));
    });
  }
  // Round-robin fixtures, each GW: (1v4, 2v3) alternating home.
  const fixtures: Fixture[] = [];
  let fid = 1;
  for (let gw = 1; gw <= 12; gw++) {
    const pairs = gw % 2 ? [[1, 4], [2, 3]] : [[4, 1], [3, 2]];
    for (const [h, a] of pairs) {
      const played = gw <= gwsPlayed;
      const strong = (t: number) => (5 - t) * 0.6;
      fixtures.push({ id: fid++, ev: gw, h, a, hs: played ? Math.round(strong(h)) : null, as: played ? Math.round(strong(a) * 0.6) : null, ko: `2026-08-${10 + gw}T15:00:00Z`, fin: played, prov: played, started: played, hd: 3, ad: 3 });
    }
  }
  // Live: starters = first 11 of each team play 90; stars have big xG.
  const liveFiles: LiveFile[] = [];
  for (let gw = 1; gw <= gwsPlayed; gw++) {
    const rows: (number | number[])[][] = [];
    for (const p of players) {
      const idx = (p.id - 1) % 15;
      const starter = [0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13].includes(idx);
      const star = idx === 7 || idx === 12;
      const teamStrength = (5 - p.team) / 4;
      const xg = starter ? (star ? 0.7 * teamStrength + 0.2 : p.pos >= 3 ? 0.12 : 0.03) : 0;
      const fx = fixtures.find((f) => f.ev === gw && (f.h === p.team || f.a === p.team))!;
      rows.push([p.id, starter ? 90 : 0, star && gw % 2 ? 1 : 0, 0, 0, 1, 0, 0, 0, 0, 0, p.pos === 1 && starter ? 3 : 0, star ? 2 : 0, starter ? 20 : 0, xg, starter ? 0.1 : 0, 1.2, p.pos === 2 && starter ? 11 : 3, starter ? 1 : 0, starter ? (star ? 8 : 3) : 0, [fx.id]]);
    }
    liveFiles.push({ gw, fields: ['mins', 'g', 'a', 'cs', 'gc', 'og', 'ps', 'pm', 'yc', 'rc', 'saves', 'bonus', 'bps', 'xg', 'xa', 'xgc', 'dc', 'starts', 'pts', 'fixtures'], rows });
  }
  const core: Core = {
    updated: '', season: '2026/27', currentGw: gwsPlayed, nextGw: gwsPlayed + 1, lastFinished: gwsPlayed, totalPlayers: 1_000_000,
    rules: { squadSize: 15, squadPlay: 11, teamLimit: 3, budget: 1000, maxExtraFT: 4, sellOnFee: 0.5, positions: [], scoring: SCORING, priceChangeDeadlines: [] },
    chips: [
      { id: 1, name: 'wildcard', number: 1, start: 2, stop: 19, type: 'transfer' },
      { id: 2, name: 'wildcard', number: 1, start: 20, stop: 38, type: 'transfer' },
      { id: 3, name: '3xc', number: 1, start: 1, stop: 19, type: 'team' },
    ],
    events: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, deadline: '', finished: i + 1 <= gwsPlayed, dataChecked: i + 1 <= gwsPlayed, current: i + 1 === gwsPlayed, next: i + 1 === gwsPlayed + 1, prev: false, avg: 50, highest: 100, mostCaptained: 8, mostVice: null, mostSelected: 8, mostIn: null, top: null, chips: {}, transfers: 0, ranked: 0 })),
    teams, players,
  };
  return { data: buildModelData(core, fixtures, liveFiles), players, core };
}

describe('math', () => {
  it('poisson pmf sums to 1 and floor-div expectation is sane', () => {
    let s = 0;
    for (let k = 0; k < 30; k++) s += poissonPmf(k, 1.7);
    expect(s).toBeCloseTo(1, 6);
    // E[floor(X/2)] for lambda=2: sum floor(k/2) p(k) ≈ 0.77
    expect(expectedFloorDiv(2, 2)).toBeGreaterThan(0.7);
    expect(expectedFloorDiv(2, 2)).toBeLessThan(0.85);
  });
  it('normal cdf / inverse round-trip', () => {
    for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) expect(normCdf(normInv(p))).toBeCloseTo(p, 3);
  });
  it('poisson sampler mean matches lambda', () => {
    const r = rng(1);
    let s = 0;
    for (let i = 0; i < 20000; i++) s += poisson(1.4, r);
    expect(s / 20000).toBeCloseTo(1.4, 1);
  });
  it('shrinkage pulls small samples to the prior', () => {
    expect(shrink(1, 1, 0, 9)).toBeCloseTo(0.1);
    expect(shrink(1, 1000, 0, 9)).toBeGreaterThan(0.99);
  });
});

describe('availability', () => {
  it('maps FPL statuses to probabilities and recovers over time', () => {
    expect(availability(mkPlayer(1, 1, 3, 50)).avail).toBe(1);
    expect(availability(mkPlayer(1, 1, 3, 50, { status: 'd', cop: 75 })).avail).toBe(0.75);
    expect(availability(mkPlayer(1, 1, 3, 50, { status: 'i', cop: 0 })).avail).toBe(0);
    expect(availability(mkPlayer(1, 1, 3, 50, { status: 'i', cop: 0 }), 3).avail).toBeGreaterThan(0.5);
    expect(availability(mkPlayer(1, 1, 3, 50, { status: 'u', cop: 0 }), 5).avail).toBe(0);
  });
});

describe('team model', () => {
  it('rates the stronger team higher and favours the home side', () => {
    const { data } = world();
    const tm = buildTeamModel(data, 7);
    expect(tm.ratings.get(1)!.attack).toBeGreaterThan(tm.ratings.get(4)!.attack);
    const l = fixtureLambdas(tm, 1, 4);
    const r = fixtureLambdas(tm, 4, 1);
    expect(l.home).toBeGreaterThan(r.away); // strong team scores more at home than away
    const odds = matchOdds(l.home, l.away);
    expect(odds.home + odds.draw + odds.away).toBeCloseTo(1, 3);
    expect(odds.home).toBeGreaterThan(odds.away);
  });
});

describe('projection', () => {
  it('scores a nailed attacker above a benchwarmer and decomposes points', () => {
    const { data } = world();
    const ctx = buildContext(data, 7);
    const proj = projectGw(ctx, 7);
    const star = proj.get(8)!; // team 1 star MID
    const bench = proj.get(2)!; // team 1 backup GK
    expect(star.xPts).toBeGreaterThan(4);
    expect(bench.xPts).toBeLessThan(1);
    expect(star.fixtures).toHaveLength(1);
    expect(star.reasons.some((r) => r.key === 'fixture')).toBe(true);
    expect(star.pStart).toBeGreaterThan(0.85);
  });
  it('a defender gets clean-sheet points only when playing 60+', () => {
    const prof = { id: 1, pos: 2 as Pos, team: 1, avail: 1, startRate: 1, p60GivenStart: 1, subRate: 0, xg90: 0, xa90: 0, saves90: 0, bonus90: 0, bpsBase90: 10, pDC: 0, yc90: 0, sample: 6, recentMins: [], rotationRisk: false, newsFlag: 'none' as const };
    const ms = minutesStates(prof, 1);
    const fp = projectFixture(prof, SCORING, ms, 1.5, 0.0001, 1.5);
    // 2 appearance + 4 clean sheet (lambda against ≈ 0)
    expect(fp.xPts).toBeCloseTo(6, 1);
    const sub = projectFixture({ ...prof, startRate: 0, subRate: 1 }, SCORING, minutesStates({ ...prof, startRate: 0, subRate: 1 }, 1), 1.5, 0.0001, 1.5);
    expect(sub.xPts).toBeCloseTo(1, 1);
  });
  it('blank gameweeks project to zero and doubles roughly double', () => {
    const { data, core } = world();
    // Give team 1 a second fixture in GW8 and remove team 2/3 from GW8.
    const fx = data.fixtures;
    const extra: Fixture = { id: 999, ev: 8, h: 1, a: 3, hs: null, as: null, ko: null, fin: false, prov: false, started: false, hd: 3, ad: 3 };
    const fixtures = [...fx.filter((f) => !(f.ev === 8 && (f.h === 2 || f.a === 2))), extra];
    const d2 = buildModelData(core, fixtures, [...data.live.entries()].map(([gw]) => ({ gw, fields: [], rows: [] })));
    // reuse live maps from original
    d2.live = data.live;
    const ctx = buildContext(d2, 7);
    const p8 = projectGw(ctx, 8);
    const single = projectGw(buildContext(data, 7), 8).get(8)!.xPts;
    expect(p8.get(8)!.fixtures).toHaveLength(2);
    expect(p8.get(8)!.xPts).toBeGreaterThan(single * 1.5);
    const t2player = [...d2.players.values()].find((p) => p.team === 2)!;
    expect(p8.get(t2player.id)!.xPts).toBe(0);
    expect(p8.get(t2player.id)!.reasons[0].key).toBe('blank');
  });
});

describe('monte carlo', () => {
  it('simulated means track the analytic model and distributions are ordered', () => {
    const { data } = world();
    const ctx = buildContext(data, 7);
    const proj = projectGw(ctx, 7);
    const res = simulate(buildSimSetup(ctx, 7), 4000, 3);
    const d = playerDistribution(res, 8)!;
    expect(d.mean).toBeGreaterThan(proj.get(8)!.xPts * 0.75);
    expect(d.mean).toBeLessThan(proj.get(8)!.xPts * 1.3);
    expect(d.p10).toBeLessThanOrEqual(d.median);
    expect(d.median).toBeLessThanOrEqual(d.p90);
    expect(d.pGoal).toBeGreaterThan(0.2);
    expect(d.hist.reduce((a, b) => a + b, 0)).toBe(4000);
  });
  it('awards exactly 6 bonus points per fixture at most', () => {
    const { data } = world();
    const ctx = buildContext(data, 7);
    const setup = buildSimSetup(ctx, 7);
    // zero-out everything except bonus by giving no goals: lambdas tiny
    setup.fixtures.forEach((f) => { f.lh = 0; f.la = 0; });
    setup.players.forEach((p) => { p.pDC = 0; p.yc90 = 0; p.saves90 = 0; p.startRate = 1; p.p60 = 1; p.avail = 1; });
    const res = simulate(setup, 200, 1);
    for (let s = 0; s < 200; s++) {
      let total = 0;
      res.points.forEach((pts) => (total += pts[s]));
      // Each player: 2 appearance; GK/DEF also +4 CS (0 goals); MID +1 CS; plus 6 bonus per fixture
      const base = setup.players.reduce((a, p) => a + 2 + (p.pos <= 2 ? 4 : p.pos === 3 ? 1 : 0), 0);
      expect(total).toBe(base + 6 * setup.fixtures.length);
    }
  });
  it('captain doubles and autosubs replace non-playing starters', () => {
    const { data } = world();
    const ctx = buildContext(data, 7);
    const res = simulate(buildSimSetup(ctx, 7, [2]), 500, 2);
    const squad = data.core.players.filter((p) => p.team === 1).map((p, i) => ({ id: p.id, position: i + 1, pos: p.pos }));
    const withCap = squadSamples(res, squad, 8, 13);
    const noCapEffect = squadSamples(res, squad, 2, 2); // backup GK never plays → no captain bonus
    const meanA = withCap.reduce((a, b) => a + b, 0) / res.n;
    const meanB = noCapEffect.reduce((a, b) => a + b, 0) / res.n;
    expect(meanA).toBeGreaterThan(meanB);
    const s = summarize(withCap);
    expect(s.p90).toBeGreaterThan(s.p10);
  });
});

describe('squad tools', () => {
  it('best XI respects formation', () => {
    const { players } = world();
    const squad = players.filter((p) => p.team === 1).map((p) => ({ id: p.id, pos: p.pos }));
    const r = bestXI(squad, (id) => (id === 2 ? 100 : id)); // backup GK scored huge
    expect(r.xi).toHaveLength(11);
    expect(r.xi.filter((p) => p.pos === 1)).toHaveLength(1);
    expect(r.xi.filter((p) => p.pos === 2).length).toBeGreaterThanOrEqual(3);
    expect(r.captain!.id).toBe(2);
  });
  it('selling price keeps half the profit, rounded down', () => {
    const { data } = world();
    const p = data.players.get(8)!;
    p.cost = 105;
    const m = { transfers: [[8, 100, 1, 50, 2, '2026-08-01']], picks: {}, chips: [], history: [], entry: { startedEvent: 1 } } as unknown as ManagerFile;
    expect(sellingPrices(m, data.players, [8]).get(8)).toBe(102);
    p.cost = 95;
    expect(sellingPrices(m, data.players, [8]).get(8)).toBe(95);
  });
  it('free transfers bank up to five and reset after a hit', () => {
    const base = { entry: { startedEvent: 1 }, chips: [], transfers: [], picks: {} } as unknown as ManagerFile;
    const h = (gw: number, tr: number) => ({ gw, pts: 50, total: 0, rank: 0, gwRank: 0, bank: 0, value: 1000, tr, cost: 0, bench: 0 });
    expect(freeTransfers({ ...base, history: [h(1, 0), h(2, 0), h(3, 0)] })).toBe(3);
    expect(freeTransfers({ ...base, history: [1, 2, 3, 4, 5, 6, 7, 8].map((g) => h(g, 0)) })).toBe(5);
    expect(freeTransfers({ ...base, history: [h(1, 0), h(2, 3)] })).toBe(1);
  });
});

describe('optimizer & dream team', () => {
  it('finds the obvious upgrade and respects budget/team limits', () => {
    const { data, players } = world();
    // Squad: 2 GK, 5 DEF, 5 MID, 3 FWD drawn from teams 2..4 non-stars, max 3 per team impossible → mix
    const pick = (team: number, idxs: number[]) => idxs.map((i) => players[(team - 1) * 15 + i]);
    const squadPlayers = [...pick(2, [0, 2, 3]), ...pick(3, [1, 4, 5]), ...pick(4, [6, 7, 8]), ...pick(1, [9, 10, 11]), ...pick(2, [12]), ...pick(3, [13]), ...pick(1, [14])];
    expect(squadPlayers).toHaveLength(15);
    const squad = squadPlayers.map((p) => ({ id: p.id, pos: p.pos, team: p.team, cost: p.cost, sell: p.cost }));
    const xp = new Map<number, number>(players.map((p) => [p.id, p.id === 13 ? 12 : 2]));
    // Can't own a 5th team-1 player (limit 4 in this 4-team world): player 13 is team 1 → optimizer must sell a team-1 player.
    const res = optimizeTransfers({ squad, bank: 200, freeTransfers: 1, players: data.players, xpts: [xp], maxMoves: 2, teamLimit: 4 });
    const best = res.plans[0][0];
    expect(best.moves[0].in).toBe(13);
    expect(data.players.get(best.moves[0].out)!.team).toBe(1);
    expect(best.gain).toBeGreaterThan(9);
    expect(res.plans[1][0].hitCost).toBe(4);
  });
  it('dream team is a valid squad within budget', () => {
    const { data } = world();
    const ctx = buildContext(data, 7);
    const xp = new Map([...projectGw(ctx, 7)].map(([id, p]) => [id, p.xPts]));
    const r = dreamTeam({ players: data.players, xpts: [xp], budget: 960, teamLimit: 5 });
    expect(r.squad).toHaveLength(15);
    expect(r.cost).toBeLessThanOrEqual(960);
    expect(validSquad(r.squad, 5)).toBe(true);
    const topId = [...xp].sort((a, b) => b[1] - a[1])[0][0];
    expect(r.squad.some((m) => m.id === topId)).toBe(true); // the best player
  });
});

describe('league & strategy', () => {
  it('effective ownership counts captaincy', () => {
    const sq = (cap: number) => ({ entry: cap, name: '', player: '', total: 0, rank: 1, picks: [{ id: 1, position: 1, pos: 1 as Pos }, { id: 2, position: 2, pos: 2 as Pos }, { id: 3, position: 12, pos: 2 as Pos }], captain: cap, vice: 1, chip: null, ppg: 50 });
    const eo = effectiveOwnership([sq(1), sq(2)]);
    expect(eo.get(1)).toBe(150);
    expect(eo.get(2)).toBe(150);
    expect(eo.get(3)).toBeUndefined();
  });
  it('head-to-head and win probability behave monotonically', () => {
    expect(headToHead(20, 0, 15, 10)).toBeGreaterThan(0.5);
    expect(headToHead(-20, 0, 15, 10)).toBeLessThan(0.5);
    const lead = winProbability(500, 300, [{ total: 480, remaining: 300, diffSd: 40 }]);
    const behind = winProbability(460, 300, [{ total: 480, remaining: 300, diffSd: 40 }]);
    expect(lead).toBeGreaterThan(behind);
    expect(suggestMode(1, 0, 40, 10).mode).toBe('protect');
    expect(suggestMode(5, 80, 5, 10).mode).toBe('attack');
  });
  it('chip availability honours the two-halves rule', () => {
    const { core } = world();
    const m = { chips: [{ name: 'wildcard', gw: 4, time: '' }] } as unknown as ManagerFile;
    const a = chipAvailability(m, core.chips, 9);
    expect(a.get('wildcard')).toEqual([20, 38]);
    expect(a.get('3xc')).toEqual([9, 19]);
  });
  it('price radar flags imminent risers from FPL progress data', () => {
    const p = mkPlayer(1, 1, 3, 80, { pcp: 98, pcProj: [[0, 104, 4]], sel: 20, tin: 50000, tout: 1000 });
    const q = mkPlayer(2, 1, 3, 80, { pcp: -60, pcProj: [[0, -70, -2]], sel: 20 });
    const s = priceSignals([p, q], 1_000_000);
    expect(s[0].id).toBe(1);
    expect(s[0].tonight).toBe(true);
    expect(s[1].direction).toBe('fall');
  });
});

// ---------- integration with real data (when present) ----------
const DATA_DIR = path.resolve(__dirname, '../../public/data');
const hasData = fs.existsSync(path.join(DATA_DIR, 'core.json'));
describe.skipIf(!hasData)('real data smoke test', () => {
  it('projects the live season and produces sensible numbers', () => {
    const core = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'core.json'), 'utf8')) as Core;
    const fixtures = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fixtures.json'), 'utf8')) as Fixture[];
    const live = fs.readdirSync(path.join(DATA_DIR, 'live')).filter((f) => /^\d+\.json$/.test(f))
      .map((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'live', f), 'utf8')) as LiveFile);
    expect(parseLive(live[0]).size).toBeGreaterThan(100);
    const data = buildModelData(core, fixtures, live);
    const gw = core.nextGw ?? core.currentGw + 1;
    const ctx = buildContext(data, gw);
    const proj = projectGw(ctx, gw);
    const top = [...proj.values()].sort((a, b) => b.xPts - a.xPts).slice(0, 10);
    expect(top[0].xPts).toBeGreaterThan(4);
    expect(top[0].xPts).toBeLessThan(16);
    const totalXp = [...proj.values()].reduce((s, p) => s + p.xPts, 0);
    // ~10 fixtures × 2 teams × ~11 players × ~2.5 pts ≈ 550 ± lots
    expect(totalXp).toBeGreaterThan(300);
    expect(totalXp).toBeLessThan(900);
    const res = simulate(buildSimSetup(ctx, gw), 1500, 1);
    const d = playerDistribution(res, top[0].id)!;
    expect(Math.abs(d.mean - top[0].xPts)).toBeLessThan(top[0].xPts * 0.35);
    const xp = new Map([...proj].map(([id, p]) => [id, p.xPts]));
    const dream = dreamTeam({ players: data.players, xpts: [xp], budget: 1000 });
    expect(dream.cost).toBeLessThanOrEqual(1000);
    expect(validSquad(dream.squad)).toBe(true);
  });
});
