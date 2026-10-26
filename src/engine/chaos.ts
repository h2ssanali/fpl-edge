import type { ModelData } from './data';
import { matchOdds } from './projection';
import type { ModelContext } from './projection';
import { fixtureLambdas } from './teams';
import type { PlayerProjection } from './types';
import { clamp } from './math';

/**
 * Chaos index (0–100): how random a gameweek is likely to be.
 *  - Fixture balance: many evenly matched games → more upsets.
 *  - Template fragility: how much of the template team's expected score rides on
 *    low-probability events (coefficient of variation of its xPts).
 *  - Captaincy concentration: when the consensus captain has a hard fixture.
 *  - Blank / double gameweeks reshuffle everything.
 */
export interface ChaosResult {
  gw: number; index: number; label: 'calm' | 'normal' | 'wild';
  balance: number; fragility: number; captainRisk: number; irregular: number;
  /** Plain-language facts behind the number. */
  balancedFixtures: number; fixtures: number; captainId: number | null; blanks: number; doubles: number;
  upsets: { h: number; a: number; pH: number; pD: number; pA: number }[]; // most upset-prone matches
  advice: 'safe' | 'neutral' | 'gamble';
}

export function chaosIndex(ctx: ModelContext, gw: number, proj: Map<number, PlayerProjection>, data: ModelData): ChaosResult {
  const fixtures = data.fixturesByGw.get(gw) ?? [];
  // 1) Balance: mean of (1 - |P(home) - P(away)|)
  let bal = 0, balancedFixtures = 0;
  const odds: ChaosResult['upsets'] = [];
  for (const f of fixtures) {
    const l = fixtureLambdas(ctx.teams, f.h, f.a);
    const o = matchOdds(l.home, l.away);
    bal += 1 - Math.abs(o.home - o.away);
    if (Math.abs(o.home - o.away) < 0.15) balancedFixtures++;
    odds.push({ h: f.h, a: f.a, pH: o.home, pD: o.draw, pA: o.away });
  }
  // Upset-prone: the underdog still has a real chance.
  const upsets = odds.sort((x, y) => Math.min(y.pH, y.pA) - Math.min(x.pH, x.pA)).slice(0, 3);
  const balance = fixtures.length ? bal / fixtures.length : 0.5;

  // 2) Template fragility: top-owned XI, CV of points from a Poisson-ish proxy.
  const template = [...data.players.values()].sort((a, b) => b.sel - a.sel).slice(0, 11);
  let mu = 0, varSum = 0;
  for (const p of template) {
    const x = proj.get(p.id)?.xPts ?? 0;
    mu += x;
    varSum += x * 1.6 + 1; // FPL points are over-dispersed: var ≈ 1.6 × mean
  }
  const fragility = mu > 0 ? Math.sqrt(varSum) / mu : 1;

  // 3) Captain risk: P(consensus captain blanks), proxied by 1 - goal involvement chance.
  const capId = template.sort((a, b) => (proj.get(b.id)?.xPts ?? 0) - (proj.get(a.id)?.xPts ?? 0))[0]?.id;
  const cp = capId ? proj.get(capId) : undefined;
  const gi = cp ? cp.fixtures.reduce((s, f) => s + f.eGoals + f.eAssists, 0) : 0.5;
  const captainRisk = Math.exp(-gi);

  // 4) Irregular gameweek
  const teams = new Set<number>();
  const counts = new Map<number, number>();
  for (const f of fixtures) { counts.set(f.h, (counts.get(f.h) ?? 0) + 1); counts.set(f.a, (counts.get(f.a) ?? 0) + 1); teams.add(f.h); teams.add(f.a); }
  const blanks = data.teams.size - teams.size;
  const doubles = [...counts.values()].filter((c) => c > 1).length;
  const irregular = clamp((blanks + doubles) / 8, 0, 1);

  const raw = 0.35 * clamp((balance - 0.45) / 0.35, 0, 1) + 0.3 * clamp((fragility - 0.25) / 0.25, 0, 1)
    + 0.2 * clamp((captainRisk - 0.2) / 0.5, 0, 1) + 0.15 * irregular;
  const index = Math.round(clamp(raw, 0, 1) * 100);
  return {
    gw, index, label: index < 35 ? 'calm' : index < 65 ? 'normal' : 'wild',
    balance, fragility, captainRisk, irregular,
    balancedFixtures, fixtures: fixtures.length, captainId: capId ?? null, blanks, doubles, upsets,
    advice: index < 35 ? 'safe' : index < 65 ? 'neutral' : 'gamble',
  };
}
