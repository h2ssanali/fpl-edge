import type { Player, Pos } from './types';
import { SQUAD_SHAPE, squadGwValue, type SquadMember } from './squad';

/**
 * Optimal 15 under a budget for the next N gameweeks.
 *
 * A two-phase heuristic: (1) greedy build by value-for-money with a budget
 * reserve per remaining slot, (2) steepest-ascent local search with 1-for-1 and
 * 2-for-2 swaps until no improving move exists. The objective is lineup-aware
 * (best XI + captain each GW, bench weighted), so it naturally prefers a strong
 * XI with a cheap bench — the way good FPL managers build.
 */
export interface DreamInput {
  players: Map<number, Player>;
  xpts: Map<number, number>[];
  budget: number; // tenths
  teamLimit?: number;
  benchWeight?: number;
  locked?: number[];
  excluded?: Set<number>;
}

export interface DreamResult { squad: SquadMember[]; value: number; cost: number }

export function dreamTeam(input: DreamInput): DreamResult {
  const teamLimit = input.teamLimit ?? 3;
  const benchWeight = input.benchWeight ?? 0.15;
  const total = (id: number) => input.xpts.reduce((s, m) => s + (m.get(id) ?? 0), 0);
  const eligible = [...input.players.values()].filter((p) => p.canSelect && !p.removed && !input.excluded?.has(p.id) && p.status !== 'u');
  const scoreCache = new Map<number, number>();
  for (const p of eligible) scoreCache.set(p.id, total(p.id));

  const objective = (sq: SquadMember[]) => input.xpts.reduce((s, m) => s + squadGwValue(sq, (id) => m.get(id) ?? 0, benchWeight), 0);
  const member = (p: Player): SquadMember => ({ id: p.id, pos: p.pos, team: p.team, cost: p.cost, sell: p.cost });

  // Phase 1: greedy
  const squad: SquadMember[] = [];
  for (const id of input.locked ?? []) { const p = input.players.get(id); if (p) squad.push(member(p)); }
  const need: Record<Pos, number> = { ...SQUAD_SHAPE };
  for (const m of squad) need[m.pos]--;
  const cheapest = new Map<Pos, number>();
  for (const pos of [1, 2, 3, 4] as Pos[]) cheapest.set(pos, Math.min(...eligible.filter((p) => p.pos === pos).map((p) => p.cost)));
  const teamCount = (sq: SquadMember[], t: number) => sq.filter((m) => m.team === t).length;
  const spent = () => squad.reduce((s, m) => s + m.cost, 0);
  // First fill "starter" slots with best per cost^0.5 (rewards stars), then fill bench with cheapest decent players.
  const order = [...eligible].sort((a, b) => scoreCache.get(b.id)! / Math.sqrt(b.cost) - scoreCache.get(a.id)! / Math.sqrt(a.cost));
  for (const p of order) {
    if (need[p.pos] <= 0 || squad.some((m) => m.id === p.id) || teamCount(squad, p.team) >= teamLimit) continue;
    const remainingAfter = ([1, 2, 3, 4] as Pos[]).reduce((s, pos) => s + (need[pos] - (pos === p.pos ? 1 : 0)) * cheapest.get(pos)!, 0);
    if (spent() + p.cost + remainingAfter > input.budget) continue;
    squad.push(member(p));
    need[p.pos]--;
    if (squad.length === 15) break;
  }
  if (squad.length < 15) {
    for (const p of [...eligible].sort((a, b) => a.cost - b.cost)) {
      if (need[p.pos] <= 0 || squad.some((m) => m.id === p.id) || teamCount(squad, p.team) >= teamLimit) continue;
      squad.push(member(p)); need[p.pos]--;
      if (squad.length === 15) break;
    }
  }

  // Phase 2: local search
  const poolByPos = new Map<Pos, Player[]>();
  for (const pos of [1, 2, 3, 4] as Pos[]) {
    poolByPos.set(pos, eligible.filter((p) => p.pos === pos).sort((a, b) => scoreCache.get(b.id)! - scoreCache.get(a.id)!).slice(0, 45));
  }
  const locked = new Set(input.locked ?? []);
  // Repair: if the greedy fill overspent, downgrade where it hurts least per £ saved.
  for (let guard = 0; spent() > input.budget && guard < 30; guard++) {
    const cur = objective(squad);
    let pickSwap: { i: number; p: Player; ratio: number } | null = null;
    for (let i = 0; i < squad.length; i++) {
      if (locked.has(squad[i].id)) continue;
      for (const p of eligible) {
        if (p.pos !== squad[i].pos || p.cost >= squad[i].cost || squad.some((m) => m.id === p.id)) continue;
        if (p.team !== squad[i].team && teamCount(squad, p.team) >= teamLimit) continue;
        const trial = [...squad];
        trial[i] = member(p);
        const ratio = (cur - objective(trial)) / (squad[i].cost - p.cost);
        if (!pickSwap || ratio < pickSwap.ratio) pickSwap = { i, p, ratio };
      }
    }
    if (!pickSwap) break;
    squad[pickSwap.i] = member(pickSwap.p);
  }

  let best = objective(squad);
  for (let iter = 0; iter < 40; iter++) {
    let improved = false;
    let bestSwap: { i: number; p: Player; v: number } | null = null;
    const budgetLeft = input.budget - spent();
    for (let i = 0; i < squad.length; i++) {
      if (locked.has(squad[i].id)) continue;
      for (const p of poolByPos.get(squad[i].pos)!) {
        if (squad.some((m) => m.id === p.id)) continue;
        if (p.cost - squad[i].cost > budgetLeft) continue;
        if (p.team !== squad[i].team && teamCount(squad, p.team) >= teamLimit) continue;
        const trial = [...squad];
        trial[i] = member(p);
        const v = objective(trial);
        if (v > best + 1e-6 && (!bestSwap || v > bestSwap.v)) bestSwap = { i, p, v };
      }
    }
    if (bestSwap) {
      squad[bestSwap.i] = member(bestSwap.p);
      best = bestSwap.v;
      improved = true;
    }
    if (!improved) {
      // 2-for-2: downgrade one slot to fund an upgrade elsewhere.
      let found = false;
      outer: for (let i = 0; i < squad.length; i++) {
        if (locked.has(squad[i].id)) continue;
        for (const down of poolByPos.get(squad[i].pos)!.filter((p) => p.cost < squad[i].cost).slice(0, 12)) {
          if (squad.some((m) => m.id === down.id)) continue;
          for (let j = 0; j < squad.length; j++) {
            if (j === i || locked.has(squad[j].id)) continue;
            for (const up of poolByPos.get(squad[j].pos)!.slice(0, 15)) {
              if (up.id === down.id || squad.some((m) => m.id === up.id)) continue;
              const trial = [...squad];
              trial[i] = member(down);
              trial[j] = member(up);
              const cost = trial.reduce((s, m) => s + m.cost, 0);
              if (cost > input.budget) continue;
              const counts = new Map<number, number>();
              trial.forEach((m) => counts.set(m.team, (counts.get(m.team) ?? 0) + 1));
              if ([...counts.values()].some((c) => c > teamLimit)) continue;
              const v = objective(trial);
              if (v > best + 0.05) { squad.splice(0, 15, ...trial); best = v; found = true; break outer; }
            }
          }
        }
      }
      if (!found) break;
    }
  }
  return { squad, value: best, cost: spent() };
}
