import type { ModelData } from './data';
import { teamFixtures } from './data';
import { DC_THRESHOLD } from './players';
import type { PlayerProjection, Pos } from './types';

/**
 * Defensive contribution ("DEFCON") points: since 2025/26 a defender earns 2 points for
 * 10+ clearances, blocks, interceptions and tackles in a match; midfielders and forwards
 * need 12+ (ball recoveries count for them too). Capped at 2 points per match.
 */
export interface DefconRow {
  id: number; pos: Pos;
  threshold: number;
  full: number; // matches with 60+ minutes
  hits: number; // matches where he reached the threshold
  rate: number; // hits / full (0 if none)
  per90: number; // defensive actions per 90 minutes
  pts: number; // DEFCON points this season
  last: { gw: number; dc: number | null; hit: boolean }[]; // most recent GWs, null = didn't play
  pNext: number; // expected DEFCON hits next GW = chance of the points in a single GW (includes chance of playing)
  xPts6: number; // expected DEFCON points over the next 6 GWs
}

export function defconTable(data: ModelData, horizon: number[], proj: Map<number, Map<number, PlayerProjection>>): DefconRow[] {
  const gws = [...data.live.keys()].sort((a, b) => a - b);
  const out: DefconRow[] = [];
  for (const p of data.players.values()) {
    if (p.pos === 1) continue;
    const pos = p.pos as Pos;
    const thr = DC_THRESHOLD[pos];
    const per = data.core.rules.scoring.dc[(['', 'GKP', 'DEF', 'MID', 'FWD'] as const)[pos] as 'DEF' | 'MID' | 'FWD'] ?? 2;
    let full = 0, hits = 0, mins = 0, actions = 0;
    const last: DefconRow['last'] = [];
    for (const gw of gws) {
      const row = data.live.get(gw)?.get(p.id);
      const nFix = teamFixtures(data, gw, p.team).filter((f) => f.started || f.fin).length;
      if (!nFix) continue;
      if (!row || row.mins === 0) { last.push({ gw, dc: null, hit: false }); continue; }
      mins += row.mins; actions += row.dc;
      // Double gameweeks: count each match where the average reaches the threshold.
      const got = row.dc >= thr * nFix ? nFix : row.dc >= thr ? 1 : 0;
      hits += got;
      if (row.mins >= 60 * nFix) full += nFix;
      last.push({ gw, dc: row.dc, hit: got > 0 });
    }
    if (mins < 180) continue;
    // Expected DEFCON hits in a GW (sums over fixtures, so a double GW can exceed 1).
    const eHits = (g: number) => (proj.get(g)?.get(p.id)?.fixtures ?? []).reduce((s, f) => s + f.pDC, 0);
    const pNext = eHits(horizon[0]);
    const xPts6 = horizon.slice(0, 6).reduce((s, g) => s + eHits(g) * per, 0);
    out.push({
      id: p.id, pos, threshold: thr, full, hits, rate: full ? Math.min(1, hits / full) : 0,
      per90: (actions / mins) * 90, pts: hits * per, last: last.slice(-6), pNext, xPts6,
    });
  }
  return out.sort((a, b) => b.xPts6 - a.xPts6);
}
