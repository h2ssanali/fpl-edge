import type { ModelData } from './data';
import type { GwEvent, ManagerFile } from './types';
import { squadFromPicks } from './league';

/**
 * Rival DNA: learn each manager's habits from their season so far, then predict
 * their next captain and transfers.
 */
export interface RivalDNA {
  entry: number;
  gws: number;
  captainTemplateRate: number; // share of GWs captaining the globally most-captained player
  captainStyle: 'template' | 'balanced' | 'contrarian';
  hitRate: number; // share of GWs with a points hit
  hitPoints: number; // total hit points
  transfersPerGw: number;
  chaserRate: number; // share of transfers-in who scored 10+ the GW before
  chaser: boolean;
  avgBank: number; // £m
  chipsUsed: { name: string; gw: number }[];
  chipsLeft: string[];
  benchPointsPerGw: number;
  avgPoints: number;
  bestGw: { gw: number; pts: number } | null;
  captainHitRate: number; // captain scored ≥ 8 (before multiplier)
}

export interface RivalPrediction {
  entry: number;
  captain: { id: number; p: number }[];
  transfersOut: { id: number; p: number; why: string }[];
  transfersIn: { id: number; p: number; why: string }[];
  chipRisk: { name: string; p: number } | null;
}

function liveFor(data: ModelData, gw: number, id: number) {
  return data.live.get(gw)?.get(id);
}

export function rivalDNA(data: ModelData, m: ManagerFile, events: GwEvent[]): RivalDNA {
  const evById = new Map(events.map((e) => [e.id, e]));
  const gws = Object.keys(m.picks).map(Number).sort((a, b) => a - b);
  let templ = 0, capCount = 0, capHits = 0;
  for (const gw of gws) {
    const cap = m.picks[gw].picks.find((p) => p[3] === 1)?.[0];
    if (!cap) continue;
    capCount++;
    if (evById.get(gw)?.mostCaptained === cap) templ++;
    const lr = liveFor(data, gw, cap);
    if (lr && lr.pts >= 8) capHits++;
  }
  const rate = capCount ? templ / capCount : 0.5;
  const hist = m.history;
  const hits = hist.filter((h) => h.cost > 0);
  let chased = 0, ins = 0;
  for (const t of m.transfers) {
    const [inId, , , , gw] = t;
    const lr = liveFor(data, gw - 1, inId);
    ins++;
    if (lr && lr.pts >= 10) chased++;
  }
  const chaserRate = ins ? chased / ins : 0;
  const usedNames = m.chips.map((c) => ({ name: c.name, gw: c.gw }));
  // Two of each chip per season (one per half). Work out which remain.
  const currentGw = Math.max(0, ...hist.map((h) => h.gw));
  const half = currentGw < 19 ? 1 : 2;
  const all = ['wildcard', 'freehit', 'bboost', '3xc'];
  const chipsLeft = all.filter((c) => !usedNames.some((u) => u.name === c && (half === 1 ? u.gw <= 19 : u.gw >= 20)));
  const best = hist.reduce<{ gw: number; pts: number } | null>((b, h) => (!b || h.pts > b.pts ? { gw: h.gw, pts: h.pts } : b), null);
  return {
    entry: m.id,
    gws: hist.length,
    captainTemplateRate: rate,
    captainStyle: rate >= 0.65 ? 'template' : rate <= 0.35 ? 'contrarian' : 'balanced',
    hitRate: hist.length ? hits.length / hist.length : 0,
    hitPoints: hits.reduce((s, h) => s + h.cost, 0),
    transfersPerGw: hist.length > 1 ? hist.slice(1).reduce((s, h) => s + h.tr, 0) / (hist.length - 1) : 0,
    chaserRate,
    chaser: chaserRate >= 0.3 && ins >= 3,
    avgBank: hist.length ? hist.reduce((s, h) => s + h.bank, 0) / hist.length / 10 : 0,
    chipsUsed: usedNames,
    chipsLeft,
    benchPointsPerGw: hist.length ? hist.reduce((s, h) => s + h.bench, 0) / hist.length : 0,
    avgPoints: hist.length ? hist.reduce((s, h) => s + h.pts, 0) / hist.length : 0,
    bestGw: best,
    captainHitRate: capCount ? capHits / capCount : 0,
  };
}

export function predictRival(
  data: ModelData, m: ManagerFile, dna: RivalDNA, xpts: Map<number, number>, lastGw: number,
): RivalPrediction {
  const sq = squadFromPicks(m, data.players);
  const players = data.players;
  if (!sq) return { entry: m.id, captain: [], transfersOut: [], transfersIn: [], chipRisk: null };

  // Captain: softmax over squad by xPts, with ownership pull for template managers
  // and an ownership penalty for contrarians.
  const own = (id: number) => players.get(id)?.sel ?? 0;
  const pull = dna.captainStyle === 'template' ? 0.06 : dna.captainStyle === 'contrarian' ? -0.03 : 0.02;
  const cands = sq.picks.filter((p) => p.position <= 11).map((p) => ({ id: p.id, s: (xpts.get(p.id) ?? 0) * 1.0 + pull * own(p.id) }));
  const temp = dna.captainStyle === 'contrarian' ? 1.6 : 1.0;
  const mx = Math.max(...cands.map((c) => c.s));
  const ex = cands.map((c) => ({ id: c.id, e: Math.exp((c.s - mx) / temp) }));
  const z = ex.reduce((s, c) => s + c.e, 0);
  const captain = ex.map((c) => ({ id: c.id, p: c.e / z })).sort((a, b) => b.p - a.p).slice(0, 3);

  // Transfers out: unavailable or poor-projection players.
  const outs = sq.picks.map((p) => {
    const pl = players.get(p.id)!;
    const flagged = pl.status !== 'a' || (pl.cop != null && pl.cop < 75);
    const score = (flagged ? 0.6 : 0) + Math.max(0, 3 - (xpts.get(p.id) ?? 0)) * 0.08 + (p.position <= 11 ? 0.05 : -0.05);
    return { id: p.id, p: Math.min(0.9, score * Math.min(1.5, 0.5 + dna.transfersPerGw)), why: flagged ? 'flagged' : 'lowxp' };
  }).filter((o) => o.p > 0.12).sort((a, b) => b.p - a.p).slice(0, 3);

  // Transfers in: momentum + projection; chasers also weight last GW's haul.
  const owned = new Set(sq.picks.map((p) => p.id));
  const outPos = new Set(outs.map((o) => players.get(o.id)!.pos));
  const pool = [...players.values()].filter((p) => !owned.has(p.id) && p.status === 'a' && (outPos.size === 0 || outPos.has(p.pos)));
  const maxNet = Math.max(1, ...pool.map((p) => p.tin - p.tout));
  const ins = pool.map((p) => {
    const lr = data.live.get(lastGw)?.get(p.id);
    const haul = lr && lr.pts >= 10 ? 1 : 0;
    const mom = Math.max(0, p.tin - p.tout) / maxNet;
    const score = 0.45 * mom + 0.04 * (xpts.get(p.id) ?? 0) + (dna.chaser ? 0.35 * haul : 0.08 * haul);
    return { id: p.id, p: score, why: dna.chaser && haul ? 'chase' : mom > 0.5 ? 'momentum' : 'xp' };
  }).sort((a, b) => b.p - a.p).slice(0, 3);
  const total = ins.reduce((s, x) => s + x.p, 0) || 1;
  const inProb = Math.min(0.85, outs[0]?.p ?? 0.3);
  const transfersIn = ins.map((x) => ({ ...x, p: (x.p / total) * inProb }));

  const chipRisk = dna.chipsLeft.length
    ? { name: dna.chipsLeft.includes('3xc') ? '3xc' : dna.chipsLeft[0], p: Math.min(0.5, 0.08 * dna.chipsLeft.length) }
    : null;
  return { entry: m.id, captain, transfersOut: outs, transfersIn, chipRisk };
}
