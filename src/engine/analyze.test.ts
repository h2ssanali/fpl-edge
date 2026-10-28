import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Analyzer, type RawData } from './analyze';

const D = path.resolve(__dirname, '../../public/data');
const has = fs.existsSync(path.join(D, 'meta.json'));
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));

describe.skipIf(!has)('analyzer on real data', () => {
  it('produces a full analysis', () => {
    const meta = read('meta.json');
    const raw: RawData = {
      meta, core: read('core.json'), fixtures: read('fixtures.json'),
      live: meta.liveGws.map((g: number) => read(`live/${g}.json`)),
      managers: fs.readdirSync(path.join(D, 'managers')).map((f) => read(`managers/${f}`)),
      leagues: meta.leagueIds.map((id: number) => read(`league/${id}.json`)),
      top: meta.topGws.length ? read(`top/${meta.topGws.at(-1)}.json`) : null,
      perGw: read('history/per-gw.json'), snapshots: [],
    };
    const t0 = Date.now();
    const az = new Analyzer(raw);
    const a = az.phase1();
    const t1 = Date.now();
    const p2 = az.phase2();
    const t2 = Date.now();
    console.log(`phase1 ${t1 - t0}ms phase2 ${t2 - t1}ms`);
    expect(a.me).not.toBeNull();
    expect(a.me!.captains.length).toBeGreaterThan(3);
    expect(a.league!.standings.length).toBeGreaterThan(5);
    const pw = a.league!.standings.reduce((s, x) => s + x.pWin, 0);
    expect(pw).toBeCloseTo(1, 2);
    expect(a.chaos.length).toBeGreaterThan(0);
    expect(p2.plans[0].length).toBeGreaterThan(0);
    console.log('captains', a.me!.captains.slice(0, 3).map((c) => [raw.core.players.find((p) => p.id === c.id)!.web, c.capDist.mean.toFixed(1), c.safe.toFixed(1), c.upside.toFixed(1)]));
    console.log('pWin', a.league!.pWin.toFixed(3), 'mode', a.league!.mode, 'corr', a.league!.correlation.toFixed(2));
    console.log('top plan', p2.plans[0][0].moves.map((m) => `${raw.core.players.find((p) => p.id === m.out)!.web}->${raw.core.players.find((p) => p.id === m.in)!.web}`), p2.plans[0][0].gain.toFixed(2));
    console.log('impacts', p2.moveImpacts.slice(0, 4).map((m) => [m.pWinBefore.toFixed(3), m.delta.toFixed(3), m.gain.toFixed(1), m.hitCost, m.moves.map((x) => x.out + '>' + x.in).join(',')]));
    console.log('chips', p2.chips.map((c) => [c.chip, c.best?.gw, c.best?.value.toFixed(1)]));
    console.log('chaos', a.chaos.map((c) => c.index));
    console.log('rival', JSON.stringify(a.league!.rivals[0]).slice(0, 600));
    console.log('autosub', a.me!.benchAutoSub);
    console.log('report', JSON.stringify(p2.report).slice(0, 400));
  }, 60000);
});

describe.skipIf(!has)('wildcard builder', () => {
  it('builds legal squads around a locked player', () => {
    const meta = read('meta.json');
    const raw: RawData = {
      meta, core: read('core.json'), fixtures: read('fixtures.json'),
      live: meta.liveGws.map((g: number) => read(`live/${g}.json`)),
      managers: fs.readdirSync(path.join(D, 'managers')).map((f) => read(`managers/${f}`)),
      leagues: [], top: null, perGw: null, snapshots: [],
    };
    const az = new Analyzer(raw);
    az.phase1();
    const palmer = raw.core.players.find((p) => p.web === 'Palmer')!;
    const t0 = Date.now();
    const res = az.wildcard([palmer.id], [], 6);
    console.log(`wildcard ${Date.now() - t0}ms budget ${res.budget}`, res.options.map((o) => [o.kind, o.value.toFixed(1), o.cost, o.ins.length, o.avgOwnership.toFixed(1), o.sameAs]));
    expect(res.options.length).toBeGreaterThanOrEqual(2);
    for (const o of res.options) {
      expect(o.squad).toHaveLength(15);
      expect(o.squad.some((m) => m.id === palmer.id)).toBe(true);
      expect(o.cost).toBeLessThanOrEqual(res.budget);
      const teams = new Map<number, number>();
      o.squad.forEach((m) => teams.set(m.team, (teams.get(m.team) ?? 0) + 1));
      expect(Math.max(...teams.values())).toBeLessThanOrEqual(3);
    }
    // The "best" option has the highest true expected points.
    expect(res.options[0].value).toBeGreaterThanOrEqual(Math.max(...res.options.map((o) => o.value)) - 0.01);
    // Seeded builds vary but stay close to the best, and "avoid" steers away from the last squad.
    const ids = (o: { squad: { id: number }[] }) => new Set(o.squad.map((m) => m.id));
    const a1 = az.wildcard([palmer.id], [], 6, 1).options[0];
    const a2 = az.wildcard([palmer.id], [], 6, 2, [...ids(a1)].filter((id) => id !== palmer.id)).options[0];
    const overlap = [...ids(a2)].filter((id) => ids(a1).has(id)).length;
    console.log('wildcard variety', a1.value.toFixed(1), a2.value.toFixed(1), 'shared', overlap);
    expect(overlap).toBeLessThan(15);
    expect(a1.value).toBeGreaterThan(res.options[0].value * 0.93);
    expect(a2.value).toBeGreaterThan(res.options[0].value * 0.9);
    expect(a2.squad.some((m) => m.id === palmer.id)).toBe(true);
  }, 60000);
});

describe.skipIf(!has)('recorded (not yet public) transfers', () => {
  it('applies moves made on the FPL site to the squad, bank and free transfers', () => {
    const meta = read('meta.json');
    const raw: RawData = {
      meta, core: read('core.json'), fixtures: read('fixtures.json'),
      live: meta.liveGws.map((g: number) => read(`live/${g}.json`)),
      managers: fs.readdirSync(path.join(D, 'managers')).map((f) => read(`managers/${f}`)),
      leagues: [], top: null, perGw: null, snapshots: [],
    };
    const before = new Analyzer(raw).phase1().me!;
    const out = before.squad.find((m) => m.pos === 3)!;
    const inn = raw.core.players.filter((p) => p.pos === 3 && p.cost <= out.sell + before.bank && !before.squad.some((m) => m.id === p.id) && p.canSelect)
      .sort((x, y) => y.sel - x.sel)[0];
    const after = new Analyzer({ ...raw, pending: { gw: new Analyzer(raw).gw, moves: [[out.id, inn.id]] } }).phase1().me!;
    expect(after.squad.map((m) => m.id)).toContain(inn.id);
    expect(after.squad.map((m) => m.id)).not.toContain(out.id);
    expect(after.recorded).toEqual({ outs: [out.id], ins: [inn.id], wildcard: false });
    expect(after.bank).toBe(before.bank + out.sell - inn.cost);
    expect(after.ft).toBe(Math.max(0, before.ft - 1));
    // A stale record (for an older GW) is ignored.
    const stale = new Analyzer({ ...raw, pending: { gw: 1, moves: [[out.id, inn.id]] } }).phase1().me!;
    expect(stale.recorded).toBeNull();
    expect(stale.squad.map((m) => m.id)).toContain(out.id);
  }, 60000);
});
