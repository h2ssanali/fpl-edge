import type { Player, Pos } from './types';
import { dreamTeam } from './dreamteam';
import { bestXI, squadGwValue, SQUAD_SHAPE, type SquadMember } from './squad';

/**
 * Wildcard builder. The user locks the players they want; we complete the squad within
 * their real budget (selling value of the current squad + bank) and offer three
 * different builds:
 *  - best:         maximum expected points over the horizon;
 *  - differential: tilted towards low-ownership players (for managers chasing rivals);
 *  - keep:         keeps more of the current squad (owned players are cheaper to keep,
 *                  because buying back after selling costs the full current price).
 * Each option is scored on the *true* expected points so they're comparable.
 */

export type WildcardKind = 'best' | 'differential' | 'keep';

export interface WildcardOption {
  kind: WildcardKind;
  squad: SquadMember[];
  xi: number[]; bench: number[]; captain: number | null;
  value: number; // expected points over the horizon (XI + captain each GW)
  perGw: number[];
  cost: number; bankLeft: number;
  ins: number[]; outs: number[]; kept: number[];
  avgOwnership: number;
  sameAs: WildcardKind | null; // identical squad to an earlier option
}

export interface WildcardInput {
  players: Map<number, Player>;
  xpts: Map<number, number>[]; // per horizon GW
  current: SquadMember[]; // current squad with selling prices (may be empty)
  bank: number;
  locked: number[];
  excluded: number[];
  teamLimit?: number;
  /** Random seed: each build nudges the projections a little so squads vary between runs and users. */
  seed?: number;
  /** Players from the previous build to steer away from ("show me something different"). */
  avoid?: number[];
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Projections are estimates, so near-equal players are interchangeable: vary them per build. */
const NOISE = 0.08;
const AVOID_PENALTY = 0.94;

export interface LockCheck { ok: boolean; problem: 'position' | 'team' | 'budget' | null; pos?: Pos; team?: number }

/** Can these locked players coexist in a legal squad within budget? */
export function checkLocks(players: Map<number, Player>, locked: number[], budget: number, cheapest: Record<Pos, number>, teamLimit = 3): LockCheck {
  const counts: Record<Pos, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const teams = new Map<number, number>();
  let cost = 0;
  for (const id of locked) {
    const p = players.get(id);
    if (!p) continue;
    counts[p.pos as Pos]++;
    teams.set(p.team, (teams.get(p.team) ?? 0) + 1);
    cost += p.cost;
  }
  for (const pos of [1, 2, 3, 4] as Pos[]) if (counts[pos] > SQUAD_SHAPE[pos]) return { ok: false, problem: 'position', pos };
  for (const [team, c] of teams) if (c > teamLimit) return { ok: false, problem: 'team', team };
  // Fill the remaining slots with the cheapest players to test affordability.
  const rest = ([1, 2, 3, 4] as Pos[]).reduce((s, pos) => s + (SQUAD_SHAPE[pos] - counts[pos]) * cheapest[pos], 0);
  if (cost + rest > budget) return { ok: false, problem: 'budget' };
  return { ok: true, problem: null };
}

export function buildWildcards(input: WildcardInput): { budget: number; options: WildcardOption[] } {
  const owned = new Map(input.current.map((m) => [m.id, m.sell]));
  const budget = input.current.reduce((s, m) => s + m.sell, 0) + input.bank || 1000;
  // Players you own can be kept at their selling price.
  const priced = new Map<number, Player>();
  for (const [id, p] of input.players) priced.set(id, owned.has(id) ? { ...p, cost: owned.get(id)! } : p);
  const excluded = new Set(input.excluded);
  const locked = input.locked.filter((id) => priced.has(id) && !excluded.has(id));

  // Per-player nudge, shared across GWs and variants so each build is internally consistent.
  const nudge = new Map<number, number>();
  if (input.seed != null) {
    const r = rng(input.seed);
    const avoid = new Set(input.avoid ?? []);
    for (const id of [...input.players.keys()].sort((x, y) => x - y)) {
      if (locked.includes(id)) continue;
      nudge.set(id, (1 + (r() * 2 - 1) * NOISE) * (avoid.has(id) ? AVOID_PENALTY : 1));
    }
  }
  const tilt = (m: Map<number, number>) => (nudge.size ? new Map([...m].map(([id, x]) => [id, x * (nudge.get(id) ?? 1)])) : m);
  const base = input.xpts.map(tilt);

  const variants: { kind: WildcardKind; xpts: Map<number, number>[] }[] = [
    { kind: 'best', xpts: base },
    {
      kind: 'differential',
      xpts: base.map((m) => new Map([...m].map(([id, x]) => {
        const sel = input.players.get(id)?.sel ?? 0;
        return [id, locked.includes(id) ? x : x * (1 - Math.min(60, sel) / 120)];
      }))),
    },
    {
      kind: 'keep',
      xpts: base.map((m) => new Map([...m].map(([id, x]) => [id, x + (owned.has(id) ? 0.45 : 0)]))),
    },
  ];
  if (!owned.size) variants.pop(); // nothing to keep without a current squad

  const options: WildcardOption[] = [];
  for (const v of variants) {
    const r = dreamTeam({ players: priced, xpts: v.xpts, budget, locked, excluded, teamLimit: input.teamLimit });
    const squad = r.squad;
    const perGw = input.xpts.map((m) => squadGwValue(squad, (id) => m.get(id) ?? 0, 0));
    const first = input.xpts[0] ?? new Map();
    const lineup = bestXI(squad, (id) => first.get(id) ?? 0);
    const ids = new Set(squad.map((m) => m.id));
    const key = [...ids].sort().join(',');
    const same = options.find((o) => o.squad.map((m) => m.id).sort().join(',') === key);
    options.push({
      kind: v.kind, squad,
      xi: lineup.xi.map((m) => m.id), bench: lineup.bench.map((m) => m.id), captain: lineup.captain?.id ?? null,
      value: perGw.reduce((s, x) => s + x, 0), perGw,
      cost: r.cost, bankLeft: budget - r.cost,
      ins: squad.filter((m) => !owned.has(m.id)).map((m) => m.id),
      outs: input.current.filter((m) => !ids.has(m.id)).map((m) => m.id),
      kept: squad.filter((m) => owned.has(m.id)).map((m) => m.id),
      avgOwnership: squad.reduce((s, m) => s + (input.players.get(m.id)?.sel ?? 0), 0) / squad.length,
      sameAs: same ? same.kind : null,
    });
  }
  // With the random nudge another build can edge out "best" on true points: keep the label honest.
  const top = options.reduce((m, o) => (o.value > m.value ? o : m), options[0]);
  if (top && top.kind !== 'best') {
    options[0] = { ...top, kind: 'best', sameAs: null };
    top.sameAs = 'best';
  }
  return { budget, options };
}
