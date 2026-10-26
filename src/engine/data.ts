import type { Core, Fixture, LiveByGw, LiveFile, LiveRow, Player, Team, Pos } from './types';

/** Everything the model needs, already indexed. */
export interface ModelData {
  core: Core;
  fixtures: Fixture[];
  live: LiveByGw;
  players: Map<number, Player>;
  teams: Map<number, Team>;
  fixturesByGw: Map<number, Fixture[]>;
}

export function parseLive(file: LiveFile): Map<number, LiveRow> {
  const idx: Record<string, number> = {};
  file.fields.forEach((f, i) => (idx[f] = i + 1));
  const out = new Map<number, LiveRow>();
  for (const r of file.rows) {
    const v = (k: string) => (r[idx[k]] as number) ?? 0;
    out.set(r[0] as number, {
      id: r[0] as number, mins: v('mins'), g: v('g'), a: v('a'), cs: v('cs'), gc: v('gc'), og: v('og'),
      ps: v('ps'), pm: v('pm'), yc: v('yc'), rc: v('rc'), saves: v('saves'), bonus: v('bonus'), bps: v('bps'),
      xg: v('xg'), xa: v('xa'), xgc: v('xgc'), dc: v('dc'), starts: v('starts'), pts: v('pts'),
      fixtures: (r[idx['fixtures']] as number[]) ?? [],
    });
  }
  return out;
}

export function buildModelData(core: Core, fixtures: Fixture[], liveFiles: LiveFile[]): ModelData {
  const live: LiveByGw = new Map();
  for (const f of liveFiles) live.set(f.gw, parseLive(f));
  const fixturesByGw = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    if (f.ev == null) continue;
    const list = fixturesByGw.get(f.ev) ?? [];
    list.push(f);
    fixturesByGw.set(f.ev, list);
  }
  return {
    core,
    fixtures,
    live,
    players: new Map(core.players.map((p) => [p.id, p])),
    teams: new Map(core.teams.map((t) => [t.id, t])),
    fixturesByGw,
  };
}

/** Fixtures for team `teamId` in gameweek `gw` (0 = blank, 2 = double). */
export function teamFixtures(data: ModelData, gw: number, teamId: number): Fixture[] {
  return (data.fixturesByGw.get(gw) ?? []).filter((f) => f.h === teamId || f.a === teamId);
}

export const posKey = (pos: Pos) => (['GKP', 'DEF', 'MID', 'FWD'] as const)[pos - 1];

/** The gameweek we plan for: the next one whose deadline hasn't passed. */
export function planningGw(core: Core): number {
  return core.nextGw ?? Math.min(38, core.currentGw + 1);
}
