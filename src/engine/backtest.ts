import type { ModelData } from './data';
import { buildContext, projectGw } from './projection';
import { bestXI, toMembers, type SquadMember } from './squad';
import { optimizeTransfers } from './optimizer';
import type { ManagerFile, PerGwHistory, Pos } from './types';
import { normCdf, normInv } from './math';

/**
 * Hindsight engine. Re-runs the model "as of" each past gameweek (only using data
 * that existed before that deadline) and scores its decisions with what actually
 * happened. Two strategies:
 *  - Edge lineup: your real squads, but Edge's XI, bench order and captain.
 *  - Edge autopilot: from your GW1 squad, Edge makes its own free transfers.
 * Plus raw model accuracy and the biggest misses.
 */

export interface BacktestGw {
  gw: number;
  yours: number; // your GW points after hits
  edgeLineup: number;
  autopilot: number;
  yourCaptain: number; edgeCaptain: number;
  yourCaptainPts: number; edgeCaptainPts: number;
  autopilotMoves: { out: number; in: number }[];
  mae: number; corr: number;
}

export interface BacktestResult {
  gws: BacktestGw[];
  totals: { yours: number; edgeLineup: number; autopilot: number };
  ranks: { yours: number | null; edgeLineup: number | null; autopilot: number | null };
  accuracy: { mae: number; corr: number; captainWins: number; captainGws: number };
  misses: { id: number; gw: number; xp: number; actual: number }[];
}

export function actualSquadPoints(
  data: ModelData, gw: number, xi: number[], bench: number[], captain: number, vice: number,
  chip: string | null = null,
): number {
  const live = data.live.get(gw);
  const pts = (id: number) => live?.get(id)?.pts ?? 0;
  const played = (id: number) => (live?.get(id)?.mins ?? 0) > 0;
  const posOf = (id: number) => data.players.get(id)?.pos ?? 3;
  if (chip === 'bboost') {
    const all = [...xi, ...bench].reduce((s, id) => s + pts(id), 0);
    const c = played(captain) ? captain : played(vice) ? vice : null;
    return all + (c ? pts(c) : 0);
  }
  const lineup = xi.filter(played);
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  lineup.forEach((id) => counts[posOf(id)]++);
  const used = new Set<number>();
  for (const out of xi.filter((id) => !played(id))) {
    if (posOf(out) === 1) {
      const gk = bench.find((b) => posOf(b) === 1);
      if (gk && played(gk)) { lineup.push(gk); counts[1]++; }
      continue;
    }
    for (const b of bench) {
      if (posOf(b) === 1 || used.has(b) || !played(b)) continue;
      const c = { ...counts, [posOf(b)]: counts[posOf(b)] + 1 };
      const slots = 10 - (c[2] + c[3] + c[4]);
      const need = Math.max(0, 3 - c[2]) + Math.max(0, 2 - c[3]) + Math.max(0, 1 - c[4]);
      if (need > slots) continue;
      lineup.push(b); used.add(b); counts[posOf(b)]++;
      break;
    }
  }
  let total = lineup.reduce((s, id) => s + pts(id), 0);
  const c = played(captain) ? captain : played(vice) ? vice : null;
  if (c) total += pts(c) * (chip === '3xc' ? 2 : 1);
  return total;
}

function priceAt(hist: PerGwHistory | null, data: ModelData, id: number, gw: number): number {
  const v = hist?.players[id]?.[gw]?.[0];
  if (v) return v;
  const p = data.players.get(id)!;
  // Linear interpolation from the opening price.
  const start = p.cost - p.ccs;
  const cur = Math.max(1, data.core.currentGw);
  return Math.round(start + (p.cost - start) * Math.min(1, (gw - 1) / cur));
}

function corrOf(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) { c += (xs[i] - mx) * (ys[i] - my); vx += (xs[i] - mx) ** 2; vy += (ys[i] - my) ** 2; }
  return c / Math.sqrt(Math.max(1e-9, vx * vy));
}

export function estimateRank(manager: ManagerFile, data: ModelData, total: number, gw: number): number | null {
  const h = manager.history.find((x) => x.gw === gw);
  if (!h || !h.rank) return null;
  const N = Math.max(1000, data.core.totalPlayers);
  const mean = data.core.events.filter((e) => e.id <= gw).reduce((s, e) => s + (e.avg || 0), 0);
  const z = normInv(1 - Math.min(0.999999, Math.max(1e-7, h.rank / N)));
  let sd = Math.abs(z) > 0.2 ? (h.total - mean) / z : 0;
  if (!(sd > 5)) sd = 9 * Math.sqrt(gw) + 10;
  const r = N * (1 - normCdf((total - mean) / sd));
  return Math.max(1, Math.round(r));
}

export function runBacktest(data: ModelData, manager: ManagerFile, perGw: PerGwHistory | null, opts: { autopilot?: boolean } = {}): BacktestResult {
  const finished = data.core.events.filter((e) => e.finished || e.current).map((e) => e.id).filter((g) => data.live.has(g));
  const gws: BacktestGw[] = [];
  const misses: BacktestResult['misses'] = [];
  let capWins = 0, capGws = 0;
  const allX: number[] = [], allY: number[] = [];

  // Autopilot state
  const start = Math.max(1, manager.entry.startedEvent);
  const firstPicks = manager.picks[start];
  let apSquad: SquadMember[] | null = firstPicks ? toMembers(firstPicks.picks.map((p) => p[0]).filter((id) => data.players.has(id)), data.players) : null;
  let apBank = firstPicks?.bank ?? 0;
  let apFT = 1;

  for (const gw of finished) {
    if (gw <= start && gw !== start) continue;
    const pk = manager.picks[gw];
    const hist = manager.history.find((h) => h.gw === gw);
    if (!pk || !hist) continue;
    const ctx = buildContext(data, gw, { ignoreStatus: true });
    const proj = projectGw(ctx, gw, true);
    const xp = (id: number) => proj.get(id)?.xPts ?? 0;
    const live = data.live.get(gw)!;

    // Accuracy over players who played or were projected meaningfully
    const xs: number[] = [], ys: number[] = [];
    for (const [id, pr] of proj) {
      const act = live.get(id)?.pts ?? 0;
      if (pr.xPts < 1.5 && !(live.get(id)?.mins)) continue;
      xs.push(pr.xPts); ys.push(act);
      if (Math.abs(act - pr.xPts) >= 9) misses.push({ id, gw, xp: pr.xPts, actual: act });
    }
    allX.push(...xs); allY.push(...ys);
    const mae = xs.length ? xs.reduce((s, x, i) => s + Math.abs(x - ys[i]), 0) / xs.length : 0;

    // Edge lineup on your squad
    const squadIds = pk.picks.map((p) => p[0]).filter((id) => data.players.has(id));
    const members = toMembers(squadIds, data.players);
    const r = bestXI(members, xp);
    const xi = r.xi.map((m) => m.id);
    const bench = r.bench.map((m) => m.id);
    const edgeCap = r.captain?.id ?? xi[0];
    const edgeVice = r.vice?.id ?? xi[1];
    const chip = pk.chip === 'bboost' || pk.chip === '3xc' ? pk.chip : null;
    const edgeLineup = actualSquadPoints(data, gw, xi, bench, edgeCap, edgeVice, chip) - hist.cost;
    const yourCap = pk.picks.find((p) => p[3] === 1)?.[0] ?? 0;
    const capPts = (id: number) => live.get(id)?.pts ?? 0;
    capGws++;
    if (capPts(edgeCap) >= capPts(yourCap)) capWins++;

    // Autopilot
    let autopilot = 0;
    const moves: { out: number; in: number }[] = [];
    if (apSquad && opts.autopilot !== false) {
      if (gw > start) {
        apSquad = apSquad.map((m) => ({ ...m, cost: priceAt(perGw, data, m.id, gw), sell: priceAt(perGw, data, m.id, gw) }));
        const horizonMaps = [proj, ...[gw + 1, gw + 2].filter((g) => g <= 38).map((g) => projectGw(ctx, g, true))]
          .map((m) => new Map([...m].map(([id, p]) => [id, p.xPts])));
        const playersAtGw = new Map([...data.players].map(([id, p]) => [id, { ...p, cost: priceAt(perGw, data, id, gw) }]));
        const res = optimizeTransfers({
          squad: apSquad, bank: apBank, freeTransfers: apFT, players: playersAtGw, xpts: horizonMaps,
          maxMoves: Math.min(2, apFT), candidatesPerPos: 14, beam: 8,
        });
        const take = res.plans.slice(0, Math.min(2, apFT)).flat().filter((p) => p.hitCost === 0).sort((a, b) => b.net - a.net)[0];
        if (take && take.net > 1.5 * take.moves.length) {
          for (const m of take.moves) {
            const i = apSquad.findIndex((s) => s.id === m.out);
            const pin = playersAtGw.get(m.in)!;
            apBank += apSquad[i].sell - pin.cost;
            apSquad[i] = { id: pin.id, pos: pin.pos as Pos, team: pin.team, cost: pin.cost, sell: pin.cost };
            moves.push(m);
          }
          apFT = Math.min(5, apFT - take.moves.length + 1);
        } else apFT = Math.min(5, apFT + 1);
      }
      const ar = bestXI(apSquad, xp);
      autopilot = actualSquadPoints(data, gw, ar.xi.map((m) => m.id), ar.bench.map((m) => m.id), ar.captain?.id ?? 0, ar.vice?.id ?? 0);
    }

    gws.push({
      gw, yours: hist.pts - hist.cost, edgeLineup, autopilot, yourCaptain: yourCap, edgeCaptain: edgeCap,
      yourCaptainPts: capPts(yourCap) * (pk.chip === '3xc' ? 3 : 2), edgeCaptainPts: capPts(edgeCap) * (chip === '3xc' ? 3 : 2),
      autopilotMoves: moves, mae, corr: corrOf(xs, ys),
    });
  }
  const totals = {
    yours: gws.reduce((s, g) => s + g.yours, 0),
    edgeLineup: gws.reduce((s, g) => s + g.edgeLineup, 0),
    autopilot: gws.reduce((s, g) => s + g.autopilot, 0),
  };
  const lastGw = gws.at(-1)?.gw ?? 0;
  // Totals above skip the first GW for autopilot alignment; add GW1 baseline consistently.
  const ranks = {
    yours: lastGw ? estimateRank(manager, data, totals.yours, lastGw) : null,
    edgeLineup: lastGw ? estimateRank(manager, data, totals.edgeLineup, lastGw) : null,
    autopilot: lastGw ? estimateRank(manager, data, totals.autopilot, lastGw) : null,
  };
  return {
    gws, totals, ranks,
    accuracy: { mae: allX.length ? allX.reduce((s, x, i) => s + Math.abs(x - allY[i]), 0) / allX.length : 0, corr: corrOf(allX, allY), captainWins: capWins, captainGws: capGws },
    misses: misses.sort((a, b) => Math.abs(b.actual - b.xp) - Math.abs(a.actual - a.xp)).slice(0, 12),
  };
}
