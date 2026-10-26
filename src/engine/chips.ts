import type { Chip, ManagerFile, Player } from './types';
import { bestXI, squadGwValue, type SquadMember } from './squad';
import { dreamTeam } from './dreamteam';

/**
 * Chip planner. For every remaining gameweek in the window we estimate the value of
 * each chip from the projections, then recommend the best GW per chip.
 *  - Triple Captain: best captain's xPts in your squad (an extra 1x captain).
 *  - Bench Boost: xPts of your four bench players.
 *  - Free Hit: best one-week squad (same budget) minus your squad's value.
 *  - Wildcard: 6-GW value of the optimal squad minus your squad's 6-GW value.
 */

export type ChipName = 'wildcard' | 'freehit' | 'bboost' | '3xc';

export interface ChipGwValue { gw: number; value: number; dgwTeams: number; bgwTeams: number }
export interface ChipAdvice { chip: ChipName; available: boolean; window: [number, number] | null; best: ChipGwValue | null; values: ChipGwValue[] }

export function chipAvailability(manager: ManagerFile | null, chips: Chip[], gw: number): Map<ChipName, [number, number] | null> {
  const out = new Map<ChipName, [number, number] | null>();
  for (const name of ['wildcard', 'freehit', 'bboost', '3xc'] as ChipName[]) {
    const windows = chips.filter((c) => c.name === name).sort((a, b) => a.start - b.start);
    let avail: [number, number] | null = null;
    for (const w of windows) {
      if (gw > w.stop) continue;
      const used = manager?.chips.some((u) => u.name === name && u.gw >= w.start && u.gw <= w.stop);
      if (!used) { avail = [Math.max(gw, w.start), w.stop]; break; }
    }
    out.set(name, avail);
  }
  return out;
}

export function planChips(params: {
  squad: SquadMember[]; bank: number; players: Map<number, Player>;
  xptsByGw: Map<number, Map<number, number>>; // gw -> xPts
  fixtureCounts: Map<number, Map<number, number>>; // gw -> team -> fixtures
  availability: Map<ChipName, [number, number] | null>;
  quick?: boolean;
}): ChipAdvice[] {
  const { squad, players, xptsByGw, availability } = params;
  const gws = [...xptsByGw.keys()].sort((a, b) => a - b);
  const budget = squad.reduce((s, m) => s + m.sell, 0) + params.bank;
  const counts = (gw: number) => {
    const fc = params.fixtureCounts.get(gw) ?? new Map();
    let d = 0, b = 0;
    for (const t of new Set([...players.values()].map((p) => p.team))) {
      const c = fc.get(t) ?? 0;
      if (c >= 2) d++;
      if (c === 0) b++;
    }
    return { dgwTeams: d, bgwTeams: b };
  };
  const inWindow = (name: ChipName, gw: number) => {
    const w = availability.get(name);
    return !!w && gw >= w[0] && gw <= w[1];
  };
  const result: ChipAdvice[] = [];

  const tc: ChipGwValue[] = [];
  const bb: ChipGwValue[] = [];
  const fh: ChipGwValue[] = [];
  const wc: ChipGwValue[] = [];
  for (const gw of gws) {
    const xp = xptsByGw.get(gw)!;
    const score = (id: number) => xp.get(id) ?? 0;
    const r = bestXI(squad, score);
    const c = counts(gw);
    tc.push({ gw, value: r.captain ? score(r.captain.id) : 0, ...c });
    bb.push({ gw, value: r.bench.reduce((s, p) => s + score(p.id), 0), ...c });
    if (inWindow('freehit', gw)) {
      const dream = dreamTeam({ players, xpts: [xp], budget, benchWeight: 0.05 });
      fh.push({ gw, value: squadGwValue(dream.squad, score, 0) - squadGwValue(squad, score, 0), ...c });
    }
  }
  if (availability.get('wildcard')) {
    // Evaluate wildcard start points over the next few GWs (6-GW lookahead each).
    const starts = gws.filter((g) => inWindow('wildcard', g)).slice(0, params.quick ? 3 : 6);
    for (const g of starts) {
      const window = gws.filter((x) => x >= g && x < g + 6).map((x) => xptsByGw.get(x)!);
      if (!window.length) continue;
      const dream = dreamTeam({ players, xpts: window, budget });
      const cur = window.reduce((s, m) => s + squadGwValue(squad, (id) => m.get(id) ?? 0), 0);
      // A wildcard also saves the transfers you'd make anyway (~2 pts/GW value of FTs).
      wc.push({ gw: g, value: dream.value - cur - window.length * 1.5, ...counts(g) });
    }
  }
  const pick = (name: ChipName, values: ChipGwValue[]) => {
    const vals = values.filter((v) => inWindow(name, v.gw));
    const best = vals.length ? vals.reduce((a, b) => (b.value > a.value ? b : a)) : null;
    result.push({ chip: name, available: !!availability.get(name), window: availability.get(name) ?? null, best, values });
  };
  pick('3xc', tc);
  pick('bboost', bb);
  pick('freehit', fh);
  pick('wildcard', wc);
  return result;
}
