import type { ModelData } from './data';
import { buildContext, projectGw } from './projection';
import { bestXI, toMembers } from './squad';
import { actualSquadPoints } from './backtest';
import type { ManagerFile, Player, Snapshot, TopSample } from './types';

// ---------------------------------------------------------------------------
// Decision journal & luck-vs-skill
// ---------------------------------------------------------------------------

export interface JournalEntry {
  gw: number;
  chip: string | null;
  captain: number; bestCaptain: number;
  capXp: number; bestCapXp: number; // expected points (single) of your captain vs the model's best at the time
  capActual: number; bestCapActual: number; // what they actually scored (single)
  lineupLoss: number; // expected points lost to bench/lineup choices (excluding captain)
  transferEV: number; // expected value of the week's transfers minus hits
  transfers: { in: number; out: number; xGain: number; actualGain: number }[];
  hitCost: number;
  expected: number; // xPts of the XI you actually fielded (with captain, minus hits)
  bestExpected: number; // xPts of the best XI available from your squad
  actual: number;
  decisionScore: number; // >0 good process
  luck: number; // actual - expected
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  verdict: 'good-good' | 'good-bad' | 'bad-good' | 'bad-bad';
}

export function decisionJournal(data: ModelData, manager: ManagerFile): JournalEntry[] {
  const out: JournalEntry[] = [];
  const gws = Object.keys(manager.picks).map(Number).sort((a, b) => a - b).filter((g) => data.live.has(g));
  for (const gw of gws) {
    const pk = manager.picks[gw];
    const hist = manager.history.find((h) => h.gw === gw);
    if (!pk || !hist) continue;
    const ctx = buildContext(data, gw, { ignoreStatus: true });
    const proj = projectGw(ctx, gw, true);
    const next = gw < 38 ? projectGw(ctx, gw + 1, true) : null;
    const xp = (id: number) => proj.get(id)?.xPts ?? 0;
    const chipMult = pk.chip === '3xc' ? 3 : 2;
    const sorted = [...pk.picks].sort((a, b) => a[1] - b[1]);
    const xi = sorted.filter((p) => p[1] <= 11 || pk.chip === 'bboost').map((p) => p[0]);
    const cap = pk.picks.find((p) => p[3] === 1)?.[0] ?? xi[0];
    const expected = xi.reduce((s, id) => s + xp(id), 0) + xp(cap) * (chipMult - 1) - hist.cost;
    const members = toMembers(pk.picks.map((p) => p[0]).filter((id) => data.players.has(id)), data.players);
    const best = bestXI(members, xp);
    const bestCap = best.captain?.id ?? cap;
    const bestExpected = (pk.chip === 'bboost' ? members.reduce((s, m) => s + xp(m.id), 0) : best.total) + xp(bestCap) * (chipMult - 1) - hist.cost;
    const live = data.live.get(gw)!;
    const transfers = manager.transfers.filter((t) => t[4] === gw).map(([inn, , outt]) => ({
      in: inn, out: outt,
      xGain: xp(inn) - xp(outt) + (next ? (next.get(inn)?.xPts ?? 0) - (next.get(outt)?.xPts ?? 0) : 0),
      actualGain: (live.get(inn)?.pts ?? 0) - (live.get(outt)?.pts ?? 0),
    }));
    // Wildcard / Free Hit rebuild the squad: judge those weeks on lineup choices only.
    const rebuild = pk.chip === 'wildcard' || pk.chip === 'freehit';
    const transferEV = rebuild ? 0 : transfers.reduce((s, t) => s + t.xGain, 0) - hist.cost;
    const actual = hist.pts - hist.cost;
    const decisionScore = (expected - bestExpected) + 0.5 * transferEV;
    const luck = actual - expected;
    // Small gaps to the model's choice are noise, not mistakes.
    const grade = decisionScore >= 1 ? 'A' : decisionScore >= -1.5 ? 'B' : decisionScore >= -3.5 ? 'C' : decisionScore >= -6 ? 'D' : 'F';
    const good = decisionScore >= -1.5;
    const capDiff = (xp(bestCap) - xp(cap)) * (chipMult - 1);
    out.push({
      gw, chip: pk.chip, captain: cap, bestCaptain: bestCap,
      capXp: xp(cap), bestCapXp: xp(bestCap), capActual: live.get(cap)?.pts ?? 0, bestCapActual: live.get(bestCap)?.pts ?? 0,
      lineupLoss: Math.max(0, bestExpected - expected - capDiff), transferEV,
      transfers, hitCost: hist.cost,
      expected, bestExpected, actual, decisionScore, luck, grade,
      verdict: good ? (luck >= 0 ? 'good-good' : 'good-bad') : (luck >= 0 ? 'bad-good' : 'bad-bad'),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gameweek report
// ---------------------------------------------------------------------------

export interface GwReport {
  gw: number; points: number; avg: number; top10k: number | null; highest: number | null;
  captain: { id: number; pts: number }; bestCaptain: { id: number; pts: number };
  benchPoints: number; bestPlayer: { id: number; pts: number } | null; worstStarter: { id: number; pts: number } | null;
  transfers: { in: number; out: number; inPts: number; outPts: number }[]; hitCost: number;
  missedHauls: { id: number; pts: number; eo: number }[];
  differentialHits: { id: number; pts: number; sel: number }[];
  optimalPoints: number; provisional: boolean;
}

export function gameweekReport(data: ModelData, manager: ManagerFile, gw: number, top: TopSample | null): GwReport | null {
  const pk = manager.picks[gw];
  const live = data.live.get(gw);
  const ev = data.core.events.find((e) => e.id === gw);
  const hist = manager.history.find((h) => h.gw === gw);
  if (!pk || !live || !ev || !hist) return null;
  const pts = (id: number) => live.get(id)?.pts ?? 0;
  const sorted = [...pk.picks].sort((a, b) => a[1] - b[1]);
  const xi = sorted.filter((p) => p[2] > 0).map((p) => p[0]);
  const benchIds = sorted.filter((p) => p[2] === 0).map((p) => p[0]);
  const cap = pk.picks.find((p) => p[3] === 1)?.[0] ?? xi[0];
  const capMult = pk.picks.find((p) => p[3] === 1)?.[2] ?? 2;
  const owned = new Set(pk.picks.map((p) => p[0]));
  const bestCapId = [...xi].sort((a, b) => pts(b) - pts(a))[0];
  const members = toMembers([...owned].filter((id) => data.players.has(id)), data.players);
  const opt = bestXI(members, pts);
  const optimalPoints = actualSquadPoints(data, gw, opt.xi.map((m) => m.id), [], opt.captain?.id ?? 0, opt.vice?.id ?? 0, pk.chip === '3xc' ? '3xc' : null);
  const starters = xi.map((id) => ({ id, pts: pts(id) })).sort((a, b) => b.pts - a.pts);
  const missedHauls = [...live.values()]
    .filter((r) => r.pts >= 10 && !owned.has(r.id))
    .map((r) => ({ id: r.id, pts: r.pts, eo: top?.eo[r.id] ?? data.players.get(r.id)?.sel ?? 0 }))
    .filter((m) => m.eo >= 15).sort((a, b) => b.pts * b.eo - a.pts * a.eo).slice(0, 4);
  const differentialHits = xi
    .map((id) => ({ id, pts: pts(id), sel: data.players.get(id)?.sel ?? 0 }))
    .filter((d) => d.pts >= 7 && d.sel < 10).slice(0, 4);
  return {
    gw, points: hist.pts - hist.cost, avg: ev.avg, top10k: top?.gw === gw ? top.avg : null, highest: ev.highest,
    captain: { id: cap, pts: pts(cap) * capMult }, bestCaptain: { id: bestCapId, pts: pts(bestCapId) * capMult },
    benchPoints: pk.chip === 'bboost' ? 0 : benchIds.reduce((s, id) => s + pts(id), 0),
    bestPlayer: starters[0] ?? null, worstStarter: starters.at(-1) ?? null,
    transfers: manager.transfers.filter((t) => t[4] === gw).map(([inn, , outt]) => ({ in: inn, out: outt, inPts: pts(inn), outPts: pts(outt) })),
    hitCost: hist.cost, missedHauls, differentialHits, optimalPoints, provisional: !ev.dataChecked,
  };
}

// ---------------------------------------------------------------------------
// Price-change radar
// ---------------------------------------------------------------------------

export interface PriceSignal {
  id: number; direction: 'rise' | 'fall'; progress: number; // -100..100+
  tonight: boolean; likelihood: number; // 0..5
  netTransfers: number; momentum: number; // net transfers per 1k owners
  trend: number[]; // ownership % trend from snapshots
}

/**
 * FPL now publishes `price_change_percent` (progress to the next change, ±100 =
 * change) and per-deadline projections with a signed likelihood. We use those when
 * present and fall back to net-transfer momentum vs ownership otherwise.
 */
export function priceSignals(players: Player[], totalPlayers: number, snapshots: Snapshot[] = []): PriceSignal[] {
  const trendOf = (id: number) => snapshots.map((s) => {
    const row = s.rows.find((r) => r[0] === id);
    return row ? (row[2] as number) / 10 : NaN;
  }).filter((x) => !Number.isNaN(x));
  const out: PriceSignal[] = [];
  for (const p of players) {
    if (p.status === 'u') continue;
    const owners = Math.max(1, (p.sel / 100) * totalPlayers);
    const net = p.tin - p.tout;
    const momentum = (net / owners) * 1000;
    let progress: number;
    let likelihood = 0;
    let tonight = false;
    if (p.pcp != null) {
      progress = p.pcp;
      const proj0 = p.pcProj?.[0];
      if (proj0) {
        likelihood = Math.abs(proj0[2]);
        tonight = Math.abs(proj0[1]) >= 100 && likelihood >= 3;
      } else tonight = Math.abs(progress) >= 100;
    } else {
      // Fallback heuristic: ~ +/-100 when net transfers reach ~4% of owners.
      progress = Math.max(-110, Math.min(110, momentum / 0.4));
      tonight = Math.abs(progress) >= 100;
      likelihood = Math.min(5, Math.round(Math.abs(progress) / 25));
    }
    if (Math.abs(progress) < 40 && !tonight) continue;
    out.push({ id: p.id, direction: progress >= 0 ? 'rise' : 'fall', progress, tonight, likelihood, netTransfers: net, momentum, trend: trendOf(p.id) });
  }
  return out.sort((a, b) => Math.abs(b.progress) - Math.abs(a.progress));
}

// ---------------------------------------------------------------------------
// Differentials
// ---------------------------------------------------------------------------

export interface Differential { id: number; xp: number; sel: number; leagueEo: number; rankGain: number }

/** High xPts at low ownership, ranked by expected rank gain vs the field you care about. */
export function differentials(players: Player[], xpHorizon: Map<number, number>, leagueEo: Map<number, number>, maxSel = 12): Differential[] {
  return players
    .filter((p) => p.status === 'a' && p.sel <= maxSel && (xpHorizon.get(p.id) ?? 0) > 0)
    .map((p) => {
      const xp = xpHorizon.get(p.id) ?? 0;
      const eo = leagueEo.get(p.id) ?? p.sel;
      return { id: p.id, xp, sel: p.sel, leagueEo: eo, rankGain: xp * (1 - Math.min(1, eo / 100)) - xp * (p.sel / 100) * 0.3 };
    })
    .sort((a, b) => b.rankGain - a.rankGain)
    .slice(0, 30);
}
