import type { RawData } from './analyze';
import type { ManagerFile, Player } from './types';
import { latestPicks, sellingPrices } from './squad';

/**
 * Transfers the user has already made on the FPL site for the coming gameweek.
 * FPL keeps them private until the deadline (the public API shows nothing for the
 * next GW), so the user records them in the app and we apply them to their squad.
 */
export interface PendingMoves {
  gw: number;
  moves: [number, number][]; // [out, in]
  wildcard?: boolean;
}

/** Apply moves in order, skipping any that no longer make sense. Returns the new 15 ids. */
export function applyMoves(ids: number[], moves: [number, number][], players: Map<number, Player>): { ids: number[]; applied: [number, number][] } {
  const cur = [...ids];
  const applied: [number, number][] = [];
  for (const [out, inn] of moves) {
    const i = cur.indexOf(out);
    const po = players.get(out), pi = players.get(inn);
    if (i < 0 || !pi || !po || cur.includes(inn) || po.pos !== pi.pos) continue;
    cur[i] = inn;
    applied.push([out, inn]);
  }
  return { ids: cur, applied };
}

/**
 * A copy of the raw data where the user's manager file carries the recorded moves as
 * a squad for the coming GW (picks, bank, purchase prices and a played wildcard).
 * Ignored once the deadline has passed and FPL publishes the real squad.
 */
export function withPending(raw: RawData, gw: number): RawData {
  const p = raw.pending;
  const teamId = raw.meta.teamId;
  if (!p || !teamId || p.gw !== gw || !p.moves.length) return raw;
  const me = raw.managers.find((m) => m.id === teamId);
  const latest = me ? latestPicks(me) : null;
  if (!me || !latest || latest.gw >= gw) return raw;
  const players = new Map(raw.core.players.map((x) => [x.id, x]));
  const before = latest.picks.picks.map((x) => x[0]);
  const { ids, applied } = applyMoves(before, p.moves, players);
  if (!applied.length) return raw;
  const sell = sellingPrices(me, players, before);
  const now = new Date().toISOString();
  // Net moves only (A→B then B→C is just A→C).
  const outs = before.filter((id) => !ids.includes(id));
  const ins = ids.filter((id) => !before.includes(id));
  const bank = (latest.picks.bank ?? me.entry.bank ?? 0) + outs.reduce((s, id) => s + (sell.get(id) ?? 0), 0) - ins.reduce((s, id) => s + (players.get(id)?.cost ?? 0), 0);
  const picks = latest.picks.picks.map((x, i) => {
    const id = ids[i];
    return (id === x[0] ? x : [id, x[1], x[2], x[3], x[4]]) as typeof x;
  });
  const manager: ManagerFile = {
    ...me,
    picks: { ...me.picks, [gw]: { ...latest.picks, picks, bank, chip: p.wildcard ? 'wildcard' : latest.picks.chip, transfers: ins.length, cost: 0, points: 0, final: false } },
    transfers: [...me.transfers, ...ins.map((id, k) => [id, players.get(id)!.cost, outs[k] ?? 0, sell.get(outs[k]) ?? 0, gw, now] as ManagerFile['transfers'][number])],
    chips: p.wildcard && !me.chips.some((c) => c.gw === gw) ? [...me.chips, { name: 'wildcard', gw, time: now }] : me.chips,
  };
  return { ...raw, managers: raw.managers.map((m) => (m.id === teamId ? manager : m)) };
}

/** Free transfers left after the recorded moves (a wildcard makes this week's moves free). */
export function pendingFt(ft: number, raw: RawData, gw: number, squadBefore: number[], squadAfter: number[]): number {
  if (!raw.pending || raw.pending.gw !== gw) return ft;
  if (raw.pending.wildcard) return ft;
  const made = squadAfter.filter((id) => !squadBefore.includes(id)).length;
  return Math.max(0, ft - made);
}
