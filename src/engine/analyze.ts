import { buildModelData, planningGw, teamFixtures, type ModelData } from './data';
import { buildContext, projectGw, type ModelContext } from './projection';
import { buildSimSetup, simulate, summarize, squadSamples, FLAG_PLAYED, type SimResult, type SquadPick } from './montecarlo';
import { bestXI, freeTransfers, latestPicks, sellingPrices, toMembers, type SquadMember } from './squad';
import { optimizeTransfers, hitValue, planKey, type Plan } from './optimizer';
import { dreamTeam } from './dreamteam';
import { effectiveOwnership, leagueSquads, rankSwing, simulateLeague, type LeagueSquad, type LeagueSimOutput } from './league';
import { predictRival, rivalDNA, type RivalDNA, type RivalPrediction } from './rivals';
import { logitShift, rivalOdds, suggestMode, winFromOdds, type Lineup, type Mode } from './strategy';
import { chipAvailability, planChips, type ChipAdvice, type ChipName } from './chips';
import { chaosIndex, type ChaosResult } from './chaos';
import { runBacktest, type BacktestResult } from './backtest';
import { decisionJournal, differentials, gameweekReport, priceSignals, type Differential, type GwReport, type JournalEntry, type PriceSignal } from './insights';
import { modelFdr } from './teams';
import type { Core, Distribution, Fixture, LeagueFile, LiveFile, ManagerFile, Meta, PerGwHistory, Pos, Reason, Snapshot, TopSample } from './types';

export interface RawData {
  meta: Meta; core: Core; fixtures: Fixture[]; live: LiveFile[]; managers: ManagerFile[];
  leagues: LeagueFile[]; top: TopSample | null; perGw: PerGwHistory | null; snapshots: Snapshot[];
}

export interface PlayerSummary {
  xp: number[]; // per horizon GW
  pStart: number; avail: number; xMins: number; reasons: Reason[];
  fx: { opp: number; home: boolean; fdr: number; xPts: number; pCS: number; g: number; a: number }[];
  rotation: boolean; sample: number;
}

export interface FixtureCell { opp: number; home: boolean; att: number; def: number; overall: number; lf: number; la: number }

export interface SquadSlot extends SquadMember { position: number; isCap: boolean; isVice: boolean }

export interface CaptainOption { id: number; dist: Distribution; capDist: Distribution; leagueEo: number; topEo: number; safe: number; upside: number }

export interface RivalView {
  entry: number; name: string; player: string; rank: number; total: number; gap: number;
  dna: RivalDNA; prediction: RivalPrediction; pBeat: number;
  howToBeat: { moves: Plan['moves']; pBeat: number; delta: number; gain: number }[];
}

export interface MoveImpact { moves: Plan['moves']; gain: number; hitCost: number; pWinBefore: number; pWinAfter: number; delta: number; score: number; varShift: number }

export interface Analysis {
  generatedAt: string;
  gw: number; horizon: number[]; deadline: string | null;
  players: Record<number, PlayerSummary>;
  dists: Record<number, Distribution>;
  teams: { id: number; attack: number; defence: number; xgFor: number; xgAgainst: number; trendXga: number }[];
  grid: Record<number, FixtureCell[][]>; // team -> per horizon GW -> fixtures (0 = blank, 2 = double)
  chaos: ChaosResult[];
  prices: PriceSignal[];
  differentials: Differential[];
  injuries: { id: number; status: string; cop: number | null; news: string; newsAdded: string | null; pStart: number; rotation: boolean; mine: boolean; leagueEo: number }[];
  me: null | {
    entry: number; name: string; player: string; total: number; overallRank: number; lastGw: number;
    squad: SquadSlot[]; bank: number; ft: number; teamValue: number;
    chips: Record<ChipName, [number, number] | null>;
    edge: { xi: number[]; bench: number[]; captain: number; vice: number };
    squadDist: Distribution; lastLineupDist: Distribution | null;
    captains: CaptainOption[];
    benchAutoSub: { id: number; p: number }[];
    history: ManagerFile['history'];
  };
  league: null | {
    id: number; name: string; demo: boolean; myIdx: number;
    standings: { entry: number; name: string; player: string; rank: number; total: number; eventTotal: number; pWin: number; pLead: number; expRank: number; gwMean: number; gwSd: number; isMe: boolean; captain: number }[];
    mode: { mode: Mode; dial: number }; eo: Record<number, number>;
    swings: Record<number, { blankRank: number | null; haulRank: number | null; baseRank: number | null; pBlank: number; pHaul: number }>;
    rivals: RivalView[]; pWin: number; correlation: number; remaining: number;
  };
  phase2?: Phase2;
}

export interface Phase2 {
  plans: Plan[][]; base: number; hit: ReturnType<typeof hitValue>;
  moveImpacts: MoveImpact[];
  chips: ChipAdvice[];
  backtest: BacktestResult | null;
  journal: JournalEntry[];
  report: GwReport | null;
}

const HORIZON = 10;

export class Analyzer {
  raw: RawData;
  data: ModelData;
  ctx: ModelContext;
  gw: number;
  horizon: number[];
  proj: Map<number, ReturnType<typeof projectGw>>; // gw -> projections
  xpByGw: Map<number, Map<number, number>>;
  res: SimResult | null = null;
  me: ManagerFile | null;
  managers: Map<number, ManagerFile>;
  league: LeagueFile | null;
  squads: LeagueSquad[] = [];
  leagueSim: LeagueSimOutput | null = null;
  mySquad: SquadMember[] = [];
  myBank = 0;
  myFT = 1;
  analysis: Analysis | null = null;

  constructor(raw: RawData, opts: { leagueId?: number } = {}) {
    this.raw = raw;
    this.data = buildModelData(raw.core, raw.fixtures, raw.live);
    this.gw = planningGw(raw.core);
    this.ctx = buildContext(this.data, this.gw);
    this.horizon = [];
    for (let g = this.gw; g < this.gw + HORIZON && g <= 38; g++) this.horizon.push(g);
    this.proj = new Map(this.horizon.map((g) => [g, projectGw(this.ctx, g)]));
    this.xpByGw = new Map(this.horizon.map((g) => [g, new Map([...this.proj.get(g)!].map(([id, p]) => [id, p.xPts]))]));
    this.managers = new Map(raw.managers.map((m) => [m.id, m]));
    this.me = raw.meta.teamId ? this.managers.get(raw.meta.teamId) ?? null : null;
    this.league = raw.leagues.find((l) => l.id === opts.leagueId) ?? raw.leagues[0] ?? null;
  }

  xp(id: number, gw = this.gw) { return this.xpByGw.get(gw)?.get(id) ?? 0; }

  /** Lineups (with captain multipliers) for each horizon GW. */
  lineupsFor(squadIds: number[], fixedFirst?: Lineup): Lineup[] {
    const members = squadIds.filter((id) => this.data.players.has(id)).map((id) => ({ id, pos: this.data.players.get(id)!.pos as Pos }));
    return this.horizon.slice(0, 6).map((g, gi) => {
      if (gi === 0 && fixedFirst) return fixedFirst;
      const r = bestXI(members, (id) => this.xp(id, g));
      const l: Lineup = new Map(r.xi.map((p) => [p.id, 1]));
      if (r.captain) l.set(r.captain.id, 2);
      return l;
    });
  }

  phase1(): Analysis {
    const { data, raw } = this;
    const players: Record<number, PlayerSummary> = {};
    const p0 = this.proj.get(this.gw)!;
    for (const p of data.players.values()) {
      const pr = p0.get(p.id)!;
      const prof = this.ctx.profiles.get(p.id)!;
      players[p.id] = {
        xp: this.horizon.map((g) => +(this.xp(p.id, g)).toFixed(2)),
        pStart: pr.pStart, avail: pr.avail, xMins: pr.xMins, reasons: pr.reasons,
        fx: pr.fixtures.map((f) => ({ opp: f.opp, home: f.home, fdr: f.fdr, xPts: f.xPts, pCS: f.pCS, g: f.eGoals, a: f.eAssists })),
        rotation: prof.rotationRisk, sample: prof.sample,
      };
    }

    // Squads we must simulate (mine + rivals) so their players are included.
    const forced = new Set<number>();
    const myLatest = this.me ? latestPicks(this.me) : null;
    myLatest?.picks.picks.forEach((p) => forced.add(p[0]));
    if (this.league) for (const e of this.league.rivals) {
      const m = this.managers.get(e);
      const lp = m ? latestPicks(m) : null;
      lp?.picks.picks.forEach((p) => forced.add(p[0]));
    }
    this.res = simulate(buildSimSetup(this.ctx, this.gw, forced), 10000);
    const dists: Record<number, Distribution> = {};
    this.res.ids.forEach((id, i) => { dists[id] = summarize(this.res!.points[i], this.res!.flags[i]); });

    // Fixture grid with our own model difficulty.
    const grid: Analysis['grid'] = {};
    for (const t of data.teams.values()) {
      grid[t.id] = this.horizon.map((g) => teamFixtures(data, g, t.id).map((f) => {
        const home = f.h === t.id;
        const opp = home ? f.a : f.h;
        const m = modelFdr(this.ctx.teams, t.id, opp, home);
        const l = home ? this.lambdas(f.h, f.a) : this.lambdas(f.h, f.a);
        return { opp, home, att: m.attack, def: m.defence, overall: m.overall, lf: home ? l.home : l.away, la: home ? l.away : l.home };
      }));
    }

    const chaos = this.horizon.slice(0, 8).map((g) => chaosIndex(this.ctx, g, this.proj.get(g)!, data));
    const prices = priceSignals(raw.core.players, raw.core.totalPlayers, raw.snapshots).slice(0, 60);

    // ---------- me ----------
    let me: Analysis['me'] = null;
    let myLineup: Lineup | undefined;
    if (this.me && myLatest) {
      const ids = myLatest.picks.picks.map((p) => p[0]).filter((id) => data.players.has(id));
      const sell = sellingPrices(this.me, data.players, ids);
      this.mySquad = toMembers(ids, data.players, sell);
      this.myBank = myLatest.picks.bank ?? this.me.entry.bank ?? 0;
      this.myFT = freeTransfers(this.me);
      const r = bestXI(this.mySquad, (id) => this.xp(id));
      // Captain choice from the simulation (mean), not just analytic xPts.
      const xiIds = r.xi.map((m) => m.id);
      const byMean = [...xiIds].sort((a, b) => (dists[b]?.mean ?? 0) - (dists[a]?.mean ?? 0));
      const captain = byMean[0];
      const vice = byMean[1];
      const benchOrdered = r.bench.map((m) => m.id);
      const picks: SquadPick[] = [...xiIds, ...benchOrdered].map((id, i) => ({ id, position: i + 1, pos: data.players.get(id)!.pos as Pos }));
      const squadDist = summarize(squadSamples(this.res, picks, captain, vice));
      const lastPicks: SquadPick[] = myLatest.picks.picks.map((p) => ({ id: p[0], position: p[1], pos: data.players.get(p[0])?.pos as Pos })).filter((p) => p.pos);
      const lastCap = myLatest.picks.picks.find((p) => p[3])?.[0] ?? captain;
      const lastVice = myLatest.picks.picks.find((p) => p[4])?.[0] ?? vice;
      const lastLineupDist = summarize(squadSamples(this.res, lastPicks, lastCap, lastVice));
      myLineup = new Map(xiIds.map((id) => [id, 1]));
      myLineup.set(captain, 2);
      const capOptions: CaptainOption[] = ids.map((id) => {
        const i = this.res!.index.get(id);
        const dist = dists[id];
        if (i === undefined || !dist) return null;
        const doubled = new Float64Array(this.res!.n);
        for (let s = 0; s < this.res!.n; s++) doubled[s] = this.res!.points[i][s] * 2;
        const capDist = summarize(doubled, this.res!.flags[i]);
        return {
          id, dist, capDist, leagueEo: 0, topEo: raw.top?.cap[id] ?? 0,
          safe: 0.5 * capDist.median + 0.35 * capDist.p10 + 0.15 * capDist.mean,
          upside: 0.5 * capDist.p90 + 20 * dist.p10plus + 0.2 * capDist.mean,
        };
      }).filter((x): x is CaptainOption => !!x).sort((a, b) => b.capDist.mean - a.capDist.mean).slice(0, 8);

      me = {
        entry: this.me.id, name: this.me.entry.name, player: this.me.entry.player,
        total: this.me.entry.total, overallRank: this.me.entry.overallRank, lastGw: myLatest.gw,
        squad: this.mySquad.map((m) => {
          const pk = myLatest.picks.picks.find((p) => p[0] === m.id)!;
          return { ...m, position: pk[1], isCap: !!pk[3], isVice: !!pk[4] };
        }),
        bank: this.myBank, ft: this.myFT,
        teamValue: this.mySquad.reduce((s, m) => s + m.cost, 0) + this.myBank,
        chips: Object.fromEntries(chipAvailability(this.me, raw.core.chips, this.gw)) as Record<ChipName, [number, number] | null>,
        edge: { xi: xiIds, bench: benchOrdered, captain, vice },
        squadDist, lastLineupDist, captains: capOptions,
        benchAutoSub: this.autoSubOdds(xiIds, benchOrdered),
        history: this.me.history,
      };
    }

    // ---------- league ----------
    let league: Analysis['league'] = null;
    let leagueEo = new Map<number, number>();
    if (this.league) {
      const predictions = new Map<number, RivalPrediction>();
      const dnas = new Map<number, RivalDNA>();
      const xp0 = this.xpByGw.get(this.gw)!;
      for (const e of this.league.rivals) {
        const m = this.managers.get(e);
        if (!m) continue;
        const dna = rivalDNA(data, m, raw.core.events);
        dnas.set(e, dna);
        predictions.set(e, predictRival(data, m, dna, xp0, raw.core.lastFinished || raw.core.currentGw));
      }
      const overrides = new Map<number, { captain?: number; vice?: number }>();
      for (const [e, pr] of predictions) if (pr.captain[0]) overrides.set(e, { captain: pr.captain[0].id, vice: pr.captain[1]?.id });
      if (me) overrides.set(me.entry, { captain: me.edge.captain, vice: me.edge.vice });
      this.squads = leagueSquads(this.league, this.managers, data.players, overrides);
      // My squad in the league sim uses Edge's lineup.
      const myIdx = this.squads.findIndex((s) => s.entry === this.me?.id);
      if (myIdx >= 0 && me) {
        this.squads[myIdx].picks = [...me.edge.xi, ...me.edge.bench].map((id, i) => ({ id, position: i + 1, pos: data.players.get(id)!.pos as Pos }));
      }
      const remaining = Math.max(1, 38 - this.gw + 1);
      this.leagueSim = simulateLeague(this.res, this.squads, remaining);
      leagueEo = effectiveOwnership(this.squads.filter((_, i) => i !== myIdx));
      const sim = this.leagueSim;
      const standings = this.squads.map((s, i) => ({
        entry: s.entry, name: s.name, player: s.player, rank: s.rank, total: s.total,
        eventTotal: this.league!.standings.find((x) => x.entry === s.entry)?.eventTotal ?? 0,
        pWin: sim.pWin[i], pLead: sim.pTopAfterGw[i], expRank: sim.expRankAfterGw[i],
        gwMean: sim.gwMean[i], gwSd: sim.gwSd[i], isMe: i === myIdx, captain: s.captain,
      }));
      const meS = myIdx >= 0 ? this.squads[myIdx] : null;
      const leaderTotal = Math.max(...this.squads.map((s) => s.total));
      const others = this.squads.filter((_, i) => i !== myIdx);
      const nextBest = others.length ? Math.max(...others.map((s) => s.total)) : 0;
      const myRank = meS ? 1 + this.squads.filter((s) => s.total > meS.total).length : 1;
      const mode = meS ? suggestMode(myRank, leaderTotal - meS.total, meS.total - nextBest, remaining) : { mode: 'balanced' as Mode, dial: 0 };

      // Rank swings for my players + the league's most-owned players.
      const swingIds = new Set<number>([...(me?.edge.xi ?? []), ...[...leagueEo].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id)]);
      const swings: NonNullable<Analysis['league']>['swings'] = {};
      if (myIdx >= 0) for (const id of swingIds) {
        const s = rankSwing(this.res, sim, this.squads, myIdx, id);
        if (s) swings[id] = { blankRank: s.blankRank, haulRank: s.haulRank, baseRank: s.baseRank, pBlank: s.pBlank, pHaul: s.pHaul };
      }

      // Rival views with head-to-head odds (how-to-beat filled in phase 2).
      const xpFns = this.horizon.slice(0, 6).map((g) => (id: number) => this.xp(id, g));
      const myLineups = meS ? this.lineupsFor(meS.picks.map((p) => p.id), myLineup) : [];
      const rivalViews: RivalView[] = [];
      if (meS) {
        for (const s of this.squads) {
          if (s.entry === meS.entry) continue;
          const first: Lineup = new Map(s.picks.filter((p) => p.position <= 11).map((p) => [p.id, 1]));
          first.set(s.captain, 2);
          const odds = rivalOdds({ total: meS.total, ppg: meS.ppg, lineups: myLineups }, [{ entry: s.entry, total: s.total, ppg: s.ppg, lineups: this.lineupsFor(s.picks.map((p) => p.id), first) }], xpFns, remaining)[0];
          rivalViews.push({
            entry: s.entry, name: s.name, player: s.player, rank: s.rank, total: s.total, gap: meS.total - s.total,
            dna: dnas.get(s.entry)!, prediction: predictions.get(s.entry)!, pBeat: odds.pBeat, howToBeat: [],
          });
        }
      }
      league = {
        id: this.league.id, name: this.league.name, demo: !!this.league.demo, myIdx,
        standings, mode, eo: Object.fromEntries(leagueEo), swings, rivals: rivalViews,
        pWin: myIdx >= 0 ? sim.pWin[myIdx] : 0, correlation: sim.correlation, remaining,
      };
      if (me) for (const c of me.captains) c.leagueEo = leagueEo.get(c.id) ?? 0;
    }

    // ---------- differentials & injuries ----------
    const xpH = new Map<number, number>();
    for (const p of data.players.values()) xpH.set(p.id, this.horizon.slice(0, 4).reduce((s, g) => s + this.xp(p.id, g), 0));
    const diffs = differentials(raw.core.players, xpH, leagueEo);
    const mine = new Set(this.mySquad.map((m) => m.id));
    const injuries = raw.core.players
      .filter((p) => (p.status !== 'a' || (p.cop != null && p.cop < 100) || this.ctx.profiles.get(p.id)?.rotationRisk) && p.status !== 'u' && (p.sel >= 2 || mine.has(p.id) || (leagueEo.get(p.id) ?? 0) > 0))
      .map((p) => ({ id: p.id, status: p.status, cop: p.cop, news: p.news, newsAdded: p.newsAdded, pStart: players[p.id].pStart, rotation: !!this.ctx.profiles.get(p.id)?.rotationRisk, mine: mine.has(p.id), leagueEo: leagueEo.get(p.id) ?? 0 }))
      .sort((a, b) => Number(b.mine) - Number(a.mine) || b.leagueEo - a.leagueEo || (data.players.get(b.id)!.sel - data.players.get(a.id)!.sel));

    const nextEv = raw.core.events.find((e) => e.id === this.gw);
    this.analysis = {
      generatedAt: new Date().toISOString(), gw: this.gw, horizon: this.horizon, deadline: nextEv?.deadline ?? null,
      players, dists,
      teams: [...this.ctx.teams.ratings.values()].map((r) => ({ id: r.id, attack: r.attack, defence: r.defence, xgFor: r.xgFor, xgAgainst: r.xgAgainst, trendXga: r.trendXga })),
      grid, chaos, prices, differentials: diffs, injuries, me, league,
    };
    return this.analysis;
  }

  private lambdas(h: number, a: number) {
    const mu = this.ctx.teams.leagueAvgGoals;
    const rh = this.ctx.teams.ratings.get(h), ra = this.ctx.teams.ratings.get(a);
    const hs = Math.sqrt(this.ctx.teams.homeAdv);
    return { home: mu * (rh?.attack ?? 1) * (ra?.defence ?? 1) * hs, away: mu * (ra?.attack ?? 1) * (rh?.defence ?? 1) / hs };
  }

  /** P(each bench player comes on) under FPL auto-sub order, from the simulations. */
  autoSubOdds(xi: number[], bench: number[]): { id: number; p: number }[] {
    const res = this.res!;
    const used = new Array(bench.length).fill(0);
    const posOf = (id: number) => this.data.players.get(id)!.pos;
    const played = (id: number, s: number) => { const i = res.index.get(id); return i !== undefined && (res.flags[i][s] & FLAG_PLAYED) !== 0; };
    for (let s = 0; s < res.n; s++) {
      const missing = xi.filter((id) => !played(id, s));
      const taken = new Set<number>();
      for (const m of missing) {
        const gk = posOf(m) === 1;
        for (let b = 0; b < bench.length; b++) {
          if (taken.has(b) || (posOf(bench[b]) === 1) !== gk || !played(bench[b], s)) continue;
          taken.add(b); used[b]++;
          break;
        }
      }
    }
    return bench.map((id, b) => ({ id, p: used[b] / res.n }));
  }

  optimize(horizon = 6, maxMoves = 3, excludeIds: number[] = []): { plans: Plan[][]; base: number; hit: ReturnType<typeof hitValue> } {
    if (!this.mySquad.length) return { plans: [], base: 0, hit: null };
    const res = optimizeTransfers({
      squad: this.mySquad, bank: this.myBank, freeTransfers: this.myFT, players: this.data.players,
      xpts: this.horizon.slice(0, horizon).map((g) => this.xpByGw.get(g)!), maxMoves, exclude: new Set(excludeIds),
    });
    return { ...res, hit: hitValue(res.plans, this.myFT) };
  }

  moveImpacts(plans: Plan[], dial: number): MoveImpact[] {
    const a = this.analysis;
    if (!a?.league || !a.me || a.league.myIdx < 0) return [];
    const meS = this.squads[a.league.myIdx];
    const remaining = a.league.remaining;
    const xpFns = this.horizon.slice(0, 6).map((g) => (id: number) => this.xp(id, g));
    const rivals = this.squads.filter((s) => s.entry !== meS.entry).map((s) => {
      const first: Lineup = new Map(s.picks.filter((p) => p.position <= 11).map((p) => [p.id, 1]));
      first.set(s.captain, 2);
      return { entry: s.entry, total: s.total, ppg: s.ppg, lineups: this.lineupsFor(s.picks.map((p) => p.id), first) };
    });
    const baseIds = meS.picks.map((p) => p.id);
    const baseOdds = rivalOdds({ total: meS.total, ppg: meS.ppg, lineups: this.lineupsFor(baseIds) }, rivals, xpFns, remaining);
    const oddsBefore = winFromOdds(baseOdds);
    // Headline probability comes from the league simulation; moves shift it in logit space.
    const pBefore = a.league.pWin;
    return plans.map((plan) => {
      const ids = baseIds.map((id) => plan.moves.find((m) => m.out === id)?.in ?? id);
      const odds = rivalOdds({ total: meS.total - plan.hitCost, ppg: meS.ppg, lineups: this.lineupsFor(ids) }, rivals, xpFns, remaining);
      const pAfter = logitShift(pBefore, oddsBefore, winFromOdds(odds));
      // Variance shift vs rivals ahead of me (attack wants more), behind (protect wants less).
      const varShift = odds.reduce((s, o, i) => s + (o.sd - baseOdds[i].sd) * (baseOdds[i].mean < 0 ? 1 : -1), 0) / Math.max(1, odds.length);
      const score = (pAfter - pBefore) * 100 + dial * varShift * 0.6 + plan.net * 0.08;
      return { moves: plan.moves, gain: plan.gain, hitCost: plan.hitCost, pWinBefore: pBefore, pWinAfter: pAfter, delta: pAfter - pBefore, score, varShift };
    }).sort((x, y) => y.score - x.score);
  }

  howToBeat(plans: Plan[]) {
    const a = this.analysis;
    if (!a?.league || a.league.myIdx < 0) return;
    const meS = this.squads[a.league.myIdx];
    const xpFns = this.horizon.slice(0, 6).map((g) => (id: number) => this.xp(id, g));
    const baseIds = meS.picks.map((p) => p.id);
    const candidates = plans.map((plan) => ({ plan, lineups: this.lineupsFor(baseIds.map((id) => plan.moves.find((m) => m.out === id)?.in ?? id)) }));
    for (const rv of a.league.rivals) {
      const s = this.squads.find((x) => x.entry === rv.entry);
      if (!s) continue;
      const first: Lineup = new Map(s.picks.filter((p) => p.position <= 11).map((p) => [p.id, 1]));
      first.set(s.captain, 2);
      const theirs = { entry: s.entry, total: s.total, ppg: s.ppg, lineups: this.lineupsFor(s.picks.map((p) => p.id), first) };
      rv.howToBeat = candidates.map(({ plan, lineups }) => {
        const o = rivalOdds({ total: meS.total - plan.hitCost, ppg: meS.ppg, lineups }, [theirs], xpFns, a.league!.remaining)[0];
        return { moves: plan.moves, pBeat: o.pBeat, delta: o.pBeat - rv.pBeat, gain: plan.gain };
      }).sort((x, y) => y.delta - x.delta).slice(0, 3);
    }
  }

  phase2(): Phase2 {
    const { data, raw } = this;
    const opt = this.optimize(6, 3);
    const seen = new Set<string>();
    const candidatePlans = [...(opt.plans[0] ?? []).slice(0, 10), ...(opt.plans[1] ?? []).slice(0, 5), ...(opt.plans[2] ?? []).slice(0, 3)]
      .filter((p) => { const k = planKey(p.moves); if (seen.has(k)) return false; seen.add(k); return true; });
    const dial = this.analysis?.league?.mode.dial ?? 0;
    const moveImpacts = this.moveImpacts(candidatePlans, dial);
    this.howToBeat(candidatePlans.slice(0, 12));
    let chips: ChipAdvice[] = [];
    if (this.me && this.mySquad.length) {
      const fixtureCounts = new Map<number, Map<number, number>>();
      for (const g of this.horizon) {
        const m = new Map<number, number>();
        for (const f of data.fixturesByGw.get(g) ?? []) { m.set(f.h, (m.get(f.h) ?? 0) + 1); m.set(f.a, (m.get(f.a) ?? 0) + 1); }
        fixtureCounts.set(g, m);
      }
      chips = planChips({
        squad: this.mySquad, bank: this.myBank, players: data.players, xptsByGw: this.xpByGw, fixtureCounts,
        availability: chipAvailability(this.me, raw.core.chips, this.gw), quick: true,
      });
    }
    const backtest = this.me ? runBacktest(data, this.me, raw.perGw) : null;
    const journal = this.me ? decisionJournal(data, this.me) : [];
    const reportGw = [...data.live.keys()].filter((g) => this.me?.picks[g]).sort((a, b) => b - a)[0];
    const report = this.me && reportGw ? gameweekReport(data, this.me, reportGw, raw.top?.gw === reportGw ? raw.top : null) : null;
    const p2: Phase2 = { plans: opt.plans, base: opt.base, hit: opt.hit, moveImpacts, chips, backtest, journal, report };
    if (this.analysis) this.analysis.phase2 = p2;
    return p2;
  }

  dream(budget: number, horizon: number) {
    return dreamTeam({ players: this.data.players, xpts: this.horizon.slice(0, horizon).map((g) => this.xpByGw.get(g)!), budget });
  }

  swing(id: number) {
    const a = this.analysis;
    if (!a?.league || a.league.myIdx < 0 || !this.res || !this.leagueSim) return null;
    return rankSwing(this.res, this.leagueSim, this.squads, a.league.myIdx, id);
  }

  /** Squad distribution for a custom captain/lineup (deadline mode, story cards). */
  squadDistribution(xi: number[], bench: number[], captain: number, vice: number, chip: 'bboost' | '3xc' | null = null): Distribution | null {
    if (!this.res) return null;
    const picks: SquadPick[] = [...xi, ...bench].map((id, i) => ({ id, position: i + 1, pos: this.data.players.get(id)!.pos as Pos }));
    return summarize(squadSamples(this.res, picks, captain, vice, chip));
  }
}
