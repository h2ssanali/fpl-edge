import type { ManagerFile, Player, Pos } from './types';

export interface SquadMember { id: number; pos: Pos; team: number; cost: number; sell: number }

export const SQUAD_SHAPE: Record<Pos, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };
export const XI_MIN: Record<Pos, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };
export const XI_MAX: Record<Pos, number> = { 1: 1, 2: 5, 3: 5, 4: 3 };

/**
 * Best starting XI from a squad given a score per player. Greedy by score while
 * respecting formation minima, which is optimal for FPL's simple constraints.
 */
export function bestXI<T extends { id: number; pos: Pos }>(squad: T[], score: (id: number) => number): { xi: T[]; bench: T[]; total: number; captain: T | null; vice: T | null } {
  const byScore = [...squad].sort((a, b) => score(b.id) - score(a.id));
  const xi: T[] = [];
  const counts: Record<Pos, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  // Fill minima first
  for (const pos of [1, 2, 3, 4] as Pos[]) {
    for (const p of byScore) {
      if (counts[pos] >= XI_MIN[pos]) break;
      if (p.pos === pos) { xi.push(p); counts[pos]++; }
    }
  }
  for (const p of byScore) {
    if (xi.length >= 11) break;
    if (xi.includes(p)) continue;
    if (counts[p.pos] >= XI_MAX[p.pos]) continue;
    xi.push(p); counts[p.pos]++;
  }
  const benchAll = byScore.filter((p) => !xi.includes(p));
  const benchGk = benchAll.filter((p) => p.pos === 1);
  const bench = [...benchGk, ...benchAll.filter((p) => p.pos !== 1)]; // GK first, then by score
  const xiSorted = [...xi].sort((a, b) => score(b.id) - score(a.id));
  const total = xi.reduce((s, p) => s + score(p.id), 0);
  return { xi, bench, total, captain: xiSorted[0] ?? null, vice: xiSorted[1] ?? null };
}

/** Lineup-aware value of a squad for one GW: XI + captain + small bench weight. */
export function squadGwValue<T extends { id: number; pos: Pos }>(squad: T[], score: (id: number) => number, benchWeight = 0.1): number {
  const r = bestXI(squad, score);
  const bench = r.bench.reduce((s, p, i) => s + score(p.id) * benchWeight * (i === 0 ? 0.3 : 1), 0);
  return r.total + (r.captain ? score(r.captain.id) : 0) + bench;
}

/**
 * Selling prices. FPL keeps half of any profit (rounded down to £0.1m). We know
 * the purchase price from the manager's transfer history; players held since the
 * start are assumed bought at their opening price.
 */
export function sellingPrices(manager: ManagerFile, players: Map<number, Player>, squadIds: number[]): Map<number, number> {
  const out = new Map<number, number>();
  const lastBuy = new Map<number, number>();
  const sorted = [...manager.transfers].sort((a, b) => (a[5] < b[5] ? -1 : 1));
  for (const t of sorted) lastBuy.set(t[0], t[1]);
  // Wildcard / free-hit rebuys are not in transfers history; fall back to start price.
  for (const id of squadIds) {
    const p = players.get(id);
    if (!p) continue;
    const bought = lastBuy.get(id) ?? p.cost - p.ccs;
    const sell = p.cost > bought ? bought + Math.floor((p.cost - bought) / 2) : p.cost;
    out.set(id, sell);
  }
  return out;
}

/** The squad (15 ids, in pick order) for the most recent gameweek in a manager file. */
export function latestPicks(manager: ManagerFile): { gw: number; picks: ManagerFile['picks'][string] } | null {
  const gws = Object.keys(manager.picks).map(Number).sort((a, b) => b - a);
  for (const gw of gws) {
    const p = manager.picks[gw];
    if (p && p.picks.length) {
      // A Free Hit squad reverts afterwards — use the previous squad instead.
      if (p.chip === 'freehit') {
        const prev = gws.find((g) => g < gw && manager.picks[g]?.picks.length);
        if (prev) return { gw, picks: { ...manager.picks[prev], bank: p.bank } };
      }
      return { gw, picks: p };
    }
  }
  return null;
}

export function toMembers(ids: number[], players: Map<number, Player>, sell?: Map<number, number>): SquadMember[] {
  return ids.map((id) => {
    const p = players.get(id)!;
    return { id, pos: p.pos, team: p.team, cost: p.cost, sell: sell?.get(id) ?? p.cost };
  });
}

export function validSquad(members: { pos: Pos; team: number }[], teamLimit = 3): boolean {
  const counts: Record<Pos, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const teams = new Map<number, number>();
  for (const m of members) {
    counts[m.pos]++;
    teams.set(m.team, (teams.get(m.team) ?? 0) + 1);
  }
  return ([1, 2, 3, 4] as Pos[]).every((p) => counts[p] === SQUAD_SHAPE[p]) && [...teams.values()].every((c) => c <= teamLimit);
}

/** Free transfers available next GW, replaying FPL's banking rules over history. */
export function freeTransfers(manager: ManagerFile, maxBank = 5): number {
  let ft = 1;
  const chipsByGw = new Map(manager.chips.map((c) => [c.gw, c.name]));
  const hist = [...manager.history].sort((a, b) => a.gw - b.gw);
  for (const h of hist) {
    if (h.gw === manager.entry.startedEvent) { ft = 1; continue; }
    const chip = chipsByGw.get(h.gw);
    if (chip === 'wildcard' || chip === 'freehit') { ft = Math.min(maxBank, ft + 0); }
    else ft = Math.max(0, ft - h.tr);
    ft = Math.min(maxBank, ft + 1);
  }
  return Math.max(1, ft);
}
