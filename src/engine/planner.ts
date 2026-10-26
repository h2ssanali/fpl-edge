import type { Player, Pos } from './types';
import { bestXI, type SquadMember } from './squad';

/**
 * Multi-gameweek transfer planner. The user schedules transfers into future GWs;
 * we roll the squad forward, track bank and free transfers (FPL rules: +1 per GW,
 * max 5 banked, unlimited on Wildcard/Free Hit, Free Hit squad reverts), and
 * project points per GW with the best XI + captain.
 */
export interface PlannedTransfer { gw: number; out: number; in: number }
export interface PlanChip { gw: number; chip: 'wildcard' | 'freehit' | 'bboost' | '3xc' }

export interface PlanGw {
  gw: number;
  squad: SquadMember[];
  bank: number;
  ftAvailable: number;
  transfers: PlannedTransfer[];
  hits: number;
  xPts: number; // XI + captain (+ bench if BB, x3 if TC) minus hits
  captain: number | null;
  xi: number[];
  bench: number[];
  valid: boolean;
  problems: string[];
  chip: PlanChip['chip'] | null;
}

export function runPlan(params: {
  startSquad: SquadMember[]; bank: number; freeTransfers: number; gws: number[];
  xp: (id: number, gwIndex: number) => number; players: Map<number, Player>;
  transfers: PlannedTransfer[]; chips?: PlanChip[]; teamLimit?: number; maxFT?: number;
}): PlanGw[] {
  const out: PlanGw[] = [];
  let squad = [...params.startSquad];
  let bank = params.bank;
  let ft = params.freeTransfers;
  const maxFT = params.maxFT ?? 5;
  params.gws.forEach((gw, gi) => {
    const chip = params.chips?.find((c) => c.gw === gw)?.chip ?? null;
    const preFreeHit = chip === 'freehit' ? { squad: [...squad], bank } : null;
    const moves = params.transfers.filter((t) => t.gw === gw);
    const problems: string[] = [];
    for (const m of moves) {
      const idx = squad.findIndex((s) => s.id === m.out);
      const pin = params.players.get(m.in);
      if (idx < 0 || !pin) { problems.push('missing'); continue; }
      if (pin.pos !== squad[idx].pos) { problems.push('position'); continue; }
      if (squad.some((s) => s.id === m.in)) { problems.push('duplicate'); continue; }
      bank += squad[idx].sell - pin.cost;
      squad[idx] = { id: pin.id, pos: pin.pos as Pos, team: pin.team, cost: pin.cost, sell: pin.cost };
    }
    if (bank < 0) problems.push('budget');
    const teams = new Map<number, number>();
    squad.forEach((s) => teams.set(s.team, (teams.get(s.team) ?? 0) + 1));
    if ([...teams.values()].some((c) => c > (params.teamLimit ?? 3))) problems.push('teamLimit');
    const unlimited = chip === 'wildcard' || chip === 'freehit';
    const hits = unlimited ? 0 : Math.max(0, moves.length - ft) * 4;
    const score = (id: number) => params.xp(id, gi);
    const r = bestXI(squad, score);
    let xPts = r.total + (r.captain ? score(r.captain.id) * (chip === '3xc' ? 2 : 1) : 0);
    if (chip === 'bboost') xPts += r.bench.reduce((s, p) => s + score(p.id), 0);
    xPts -= hits;
    out.push({
      gw, squad: [...squad], bank, ftAvailable: ft, transfers: moves, hits, xPts,
      captain: r.captain?.id ?? null, xi: r.xi.map((p) => p.id), bench: r.bench.map((p) => p.id),
      valid: problems.length === 0, problems, chip,
    });
    if (unlimited) {
      // FTs are kept through a Wildcard / Free Hit, then +1 next week.
      ft = Math.min(maxFT, ft + 1);
    } else {
      ft = Math.min(maxFT, Math.max(0, ft - moves.length) + 1);
    }
    if (preFreeHit) { squad = preFreeHit.squad; bank = preFreeHit.bank; }
  });
  return out;
}
