import type { Player, Pos } from './types';
import { squadGwValue, type SquadMember } from './squad';

/**
 * "Is this -4 worth it?" For a set of moves: the lineup-aware gain in expected points
 * per gameweek (XI + captain, so a benched signing counts for little), against the
 * cost of the hits, plus how it compares with simply waiting a week for a free transfer.
 */
export interface HitResult {
  perGw: { gain: number; cum: number }[];
  hits: number; // number of -4s
  cost: number; // points
  payback: number | null; // index of the GW where the cumulative gain covers the cost
  waitLoss: number; // points lost by making the moves next week instead (free)
  bankAfter: number;
  problems: ('budget' | 'team' | 'position')[];
}

export function hitPlan(opts: {
  squad: SquadMember[]; bank: number; ft: number; moves: [number, number][];
  players: Map<number, Player>; xp: (id: number, gi: number) => number; gws: number; teamLimit?: number;
}): HitResult {
  const { squad, bank, ft, moves, players, xp, gws } = opts;
  const after: SquadMember[] = squad.map((m) => ({ ...m }));
  let bankAfter = bank;
  const problems = new Set<HitResult['problems'][number]>();
  for (const [out, inn] of moves) {
    const i = after.findIndex((m) => m.id === out);
    const p = players.get(inn);
    if (i < 0 || !p) continue;
    if (p.pos !== after[i].pos) problems.add('position');
    bankAfter += after[i].sell - p.cost;
    after[i] = { id: inn, pos: p.pos as Pos, team: p.team, cost: p.cost, sell: p.cost };
  }
  if (bankAfter < 0) problems.add('budget');
  const teams = new Map<number, number>();
  for (const m of after) teams.set(m.team, (teams.get(m.team) ?? 0) + 1);
  if (Math.max(0, ...teams.values()) > (opts.teamLimit ?? 3)) problems.add('team');

  const hits = Math.max(0, moves.length - ft);
  const cost = hits * 4;
  let cum = 0;
  let payback: number | null = cost === 0 ? 0 : null;
  const perGw = Array.from({ length: gws }, (_, gi) => {
    const score = (id: number) => xp(id, gi);
    const gain = squadGwValue(after, score, 0) - squadGwValue(squad, score, 0);
    cum += gain;
    if (payback === null && cum >= cost) payback = gi;
    return { gain, cum };
  });
  return { perGw, hits, cost, payback, waitLoss: perGw[0]?.gain ?? 0, bankAfter, problems: [...problems] };
}
