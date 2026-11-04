import { useCallback, useEffect, useRef, useState } from 'react';
import { fplGet, isLite } from './remote';
import { liveTeam, parseLiveEls, parseLiveFixtures, provisionalBonus, type LiveEl, type LiveFx, type LiveTeam, type RawPicks } from '../engine/live';
import type { GwEvent, Player } from '../engine/types';

/** The gameweek whose deadline passed most recently (null before the season starts). */
export function liveGw(events: GwEvent[], now = Date.now()): GwEvent | null {
  return [...events].filter((e) => new Date(e.deadline).getTime() <= now).sort((a, b) => b.id - a.id)[0] ?? null;
}

export interface LiveRival { entry: number; name: string; player: string; prevTotal: number; prevRank: number; team: LiveTeam | null; captain: number | null }

export interface LiveState {
  gw: number;
  els: Map<number, LiveEl>;
  fixtures: LiveFx[];
  bonus: Map<number, number>;
  me: LiveTeam | null;
  rivals: LiveRival[];
  rivalsDone: number;
  updated: number;
}

interface RawStandings { standings: { results: { entry: number; entry_name: string; player_name: string; rank: number; last_rank: number; total: number; event_total: number }[] } }

/**
 * Live gameweek data for the user (and their mini-league), refreshed every minute
 * while the page is open. Uses the same relay as team loading.
 */
export function useLive(opts: { gw: number | null; entry: number | null; leagueId: number | null; players: Map<number, Player> }) {
  const { gw, entry, leagueId, players } = opts;
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!gw) return;
    setBusy(true);
    try {
      const [rawLive, rawFx] = await Promise.all([
        fplGet<Parameters<typeof parseLiveEls>[0]>(`/event/${gw}/live/`),
        fplGet<Parameters<typeof parseLiveFixtures>[0]>(`/fixtures/?event=${gw}`),
      ]);
      const els = parseLiveEls(rawLive);
      const fixtures = parseLiveFixtures(rawFx);
      const bonus = provisionalBonus(els, fixtures);
      const teamOf = async (id: number) => {
        try { return liveTeam(await fplGet<RawPicks>(`/entry/${id}/event/${gw}/picks/`), els, fixtures, players, bonus); } catch { return null; }
      };
      const me = entry ? await teamOf(entry) : null;
      if (!alive.current) return;
      setState((s) => ({ gw, els, fixtures, bonus, me, rivals: s?.gw === gw ? s.rivals : [], rivalsDone: s?.gw === gw ? s.rivalsDone : 0, updated: Date.now() }));
      setError(null);

      // Mini-league: fresh standings, then each rival's picks (fewer on the slow public relay).
      if (leagueId) {
        const st = await fplGet<RawStandings>(`/leagues-classic/${leagueId}/standings/`);
        const rows = st.standings.results.slice(0, isLite() ? 8 : 30);
        const rivals: LiveRival[] = rows.map((r) => ({
          entry: r.entry, name: r.entry_name, player: r.player_name,
          // Standings totals already include FPL's own running GW score; strip it to get the pre-GW total.
          prevTotal: r.total - r.event_total, prevRank: r.last_rank || r.rank, team: null, captain: null,
        }));
        let done = 0;
        for (const rv of rivals) {
          rv.team = rv.entry === entry ? me : await teamOf(rv.entry);
          rv.captain = rv.team?.rows.find((x) => x.isCap)?.id ?? null;
          done++;
          if (!alive.current) return;
          if (done % 5 === 0 || done === rivals.length) setState((s) => (s ? { ...s, rivals: rivals.map((x) => ({ ...x })), rivalsDone: done } : s));
        }
      }
    } catch (err) {
      if (alive.current) setError(String(err));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [gw, entry, leagueId, players]);

  useEffect(() => {
    alive.current = true;
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
    return () => { alive.current = false; clearInterval(id); };
  }, [load]);

  return { state, error, busy, refresh: load };
}
