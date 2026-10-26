import type { Player, Pos } from './types';
import { squadGwValue, type SquadMember } from './squad';

/**
 * Transfer optimizer. Given a squad, bank, free transfers and an xPts matrix over a
 * horizon, find the best 1, 2 or 3 transfer combinations (beam search over the
 * strongest candidates per position). Scores are lineup-aware: each gameweek the
 * best XI and captain are picked, so a bench upgrade is worth little.
 */

export interface Move { out: number; in: number }
export interface Plan {
  moves: Move[];
  gain: number; // xPts gain over the horizon BEFORE hit cost
  hitCost: number;
  net: number; // gain - hitCost
  bankAfter: number;
  perGw: number[]; // gain per GW
}

export interface OptimizerInput {
  squad: SquadMember[];
  bank: number; // tenths of £m
  freeTransfers: number;
  players: Map<number, Player>;
  xpts: Map<number, number>[]; // per GW in horizon: id -> xPts
  teamLimit?: number;
  maxMoves?: number;
  candidatesPerPos?: number;
  beam?: number;
  hitCost?: number;
  /** Optional per-player adjustment added to each GW score (risk dial / league context). */
  adjust?: (id: number, gwIndex: number) => number;
  exclude?: Set<number>;
  decay?: number; // weight multiplier per future GW
}

export function horizonValue(squad: { id: number; pos: Pos }[], input: OptimizerInput): { total: number; perGw: number[] } {
  const perGw = input.xpts.map((m, gi) => {
    const w = Math.pow(input.decay ?? 0.92, gi);
    const score = (id: number) => (m.get(id) ?? 0) + (input.adjust ? input.adjust(id, gi) : 0);
    return w * squadGwValue(squad, score);
  });
  return { total: perGw.reduce((s, x) => s + x, 0), perGw };
}

function candidatePool(input: OptimizerInput): Map<Pos, number[]> {
  const inSquad = new Set(input.squad.map((s) => s.id));
  const k = input.candidatesPerPos ?? 30;
  const pool = new Map<Pos, number[]>();
  const totals = new Map<number, number>();
  for (const p of input.players.values()) {
    if (inSquad.has(p.id) || !p.canSelect || p.removed || input.exclude?.has(p.id)) continue;
    totals.set(p.id, input.xpts.reduce((s, m, gi) => s + (m.get(p.id) ?? 0) * Math.pow(input.decay ?? 0.92, gi), 0));
  }
  for (const pos of [1, 2, 3, 4] as Pos[]) {
    const ids = [...totals.keys()].filter((id) => input.players.get(id)!.pos === pos);
    // Mix of best absolute and best value-for-money so budget moves surface too.
    const byTotal = [...ids].sort((a, b) => totals.get(b)! - totals.get(a)!).slice(0, k);
    const byValue = [...ids].sort((a, b) => totals.get(b)! / input.players.get(b)!.cost - totals.get(a)! / input.players.get(a)!.cost).slice(0, Math.ceil(k / 2));
    pool.set(pos, [...new Set([...byTotal, ...byValue])]);
  }
  return pool;
}

function applyMoves(input: OptimizerInput, moves: Move[]): { squad: SquadMember[]; bank: number } | null {
  let bank = input.bank;
  const squad = [...input.squad];
  for (const m of moves) {
    const idx = squad.findIndex((s) => s.id === m.out);
    if (idx < 0) return null;
    const pin = input.players.get(m.in)!;
    if (pin.pos !== squad[idx].pos) return null;
    bank += squad[idx].sell - pin.cost;
    squad[idx] = { id: pin.id, pos: pin.pos, team: pin.team, cost: pin.cost, sell: pin.cost };
  }
  if (bank < 0) return null;
  const teams = new Map<number, number>();
  for (const s of squad) teams.set(s.team, (teams.get(s.team) ?? 0) + 1);
  if ([...teams.values()].some((c) => c > (input.teamLimit ?? 3))) return null;
  if (new Set(squad.map((s) => s.id)).size !== squad.length) return null;
  return { squad, bank };
}

export function optimizeTransfers(input: OptimizerInput): { base: number; plans: Plan[][] } {
  const maxMoves = input.maxMoves ?? 3;
  const beam = input.beam ?? 25;
  const hit = input.hitCost ?? 4;
  const base = horizonValue(input.squad, input);
  const pool = candidatePool(input);
  const results: Plan[][] = [];

  const evaluate = (moves: Move[]): Plan | null => {
    const applied = applyMoves(input, moves);
    if (!applied) return null;
    const v = horizonValue(applied.squad, input);
    const hitCost = Math.max(0, moves.length - input.freeTransfers) * hit;
    const gain = v.total - base.total;
    return { moves, gain, hitCost, net: gain - hitCost, bankAfter: applied.bank, perGw: v.perGw.map((x, i) => x - base.perGw[i]) };
  };

  // One move: exhaustive over squad × pool.
  let frontier: Plan[] = [];
  for (const out of input.squad) {
    for (const inn of pool.get(out.pos) ?? []) {
      const plan = evaluate([{ out: out.id, in: inn }]);
      if (plan) frontier.push(plan);
    }
  }
  frontier.sort((a, b) => b.gain - a.gain);
  results.push(dedupe(frontier).slice(0, 10));

  for (let k = 2; k <= maxMoves; k++) {
    const next: Plan[] = [];
    const seen = new Set<string>();
    for (const plan of frontier.slice(0, beam)) {
      const usedOut = new Set(plan.moves.map((m) => m.out));
      const usedIn = new Set(plan.moves.map((m) => m.in));
      for (const out of input.squad) {
        if (usedOut.has(out.id)) continue;
        for (const inn of (pool.get(out.pos) ?? []).slice(0, 25)) {
          if (usedIn.has(inn)) continue;
          const moves = [...plan.moves, { out: out.id, in: inn }];
          const key = planKey(moves);
          if (seen.has(key)) continue;
          seen.add(key);
          const p = evaluate(moves);
          if (p) next.push(p);
        }
      }
    }
    next.sort((a, b) => b.gain - a.gain);
    frontier = next;
    results.push(dedupe(next).slice(0, 10));
  }
  return { base: base.total, plans: results };
}

/** Identity of a plan by the resulting squad (swapped pairings are the same plan). */
export const planKey = (moves: Move[]) => `${moves.map((m) => m.out).sort().join(',')}>${moves.map((m) => m.in).sort().join(',')}`;

function dedupe(plans: Plan[]): Plan[] {
  const seen = new Set<string>();
  return plans.filter((p) => {
    const key = planKey(p.moves);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The honest value of taking a -4: extra xPts from the extra move, minus the hit. */
export function hitValue(best: Plan[][], freeTransfers: number): { extraMove: number; gainVsFree: number; worthIt: boolean } | null {
  const k = freeTransfers; // best plan using exactly FT moves vs FT+1 moves
  const withFree = k >= 1 ? best[k - 1]?.[0] : null;
  const withHit = best[k]?.[0];
  if (!withHit) return null;
  const baseGain = withFree?.gain ?? 0;
  const extra = withHit.gain - baseGain;
  return { extraMove: k + 1, gainVsFree: extra, worthIt: extra > 4 };
}
