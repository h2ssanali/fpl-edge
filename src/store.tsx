import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Analysis, Phase2, RawData, RivalView } from './engine/analyze';
import type { Player, Team } from './engine/types';
import type { PendingMoves } from './engine/pending';
import { loadAll } from './data/load';
import { loadLeagueAndHistory, loadMyTeam, setOwnRelay, TeamNotFound } from './data/remote';

type Status = 'loading' | 'team' | 'simulating' | 'ready' | 'error';

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Team chosen in the app: ?team=123 in a shared link wins, then the saved choice. */
function initialTeam(): number | null {
  const fromUrl = new URLSearchParams(window.location.search).get('team') ?? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('team');
  const id = Number(fromUrl || lsGet('fpl-edge-team') || 0);
  if (fromUrl && id > 0) lsSet('fpl-edge-team', String(id));
  return id > 0 ? id : null;
}

/** Transfers recorded in the app for the coming GW, per team (FPL hides them until the deadline). */
const movesKey = (teamId: number) => `arkilo-moves-${teamId}`;
function readMoves(teamId: number | null | undefined): PendingMoves | null {
  if (!teamId) return null;
  try { return JSON.parse(lsGet(movesKey(teamId)) ?? 'null'); } catch { return null; }
}

interface Store {
  status: Status;
  progress: number;
  error: string | null;
  raw: RawData | null;
  analysis: Analysis | null;
  phase2: Phase2 | null;
  players: Map<number, Player>;
  teams: Map<number, Team>;
  request: <T>(type: string, payload: unknown) => Promise<T>;
  reload: () => void;
  /** Team entered in the app (null = use config.json / demo). */
  customTeam: number | null;
  customLeague: number | null;
  setTeam: (id: number | null) => void;
  setLeague: (id: number | null) => void;
  teamError: 'notFound' | 'network' | null;
  /** Background loading of the mini-league (in-app teams only). */
  rivalsLoading: { done: number; total: number } | null;
  /** Save the transfers already made on the FPL site (null clears them) and re-run the analysis. */
  recordMoves: (p: PendingMoves | null) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<RawData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [phase2, setPhase2] = useState<Phase2 | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>());
  const nextId = useRef(1);
  const [nonce, setNonce] = useState(0);
  const [customTeam, setCustomTeam] = useState<number | null>(initialTeam);
  const [customLeague, setCustomLeague] = useState<number | null>(() => Number(lsGet('fpl-edge-league') || 0) || null);
  const [teamError, setTeamError] = useState<'notFound' | 'network' | null>(null);
  const [rivalsLoading, setRivalsLoading] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const worker = new Worker(new URL('./worker/engine.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<{ id: number; kind: string; data: unknown }>) => {
      const { id, kind, data } = e.data;
      if (cancelled) return;
      if (kind === 'phase1') { setAnalysis(data as Analysis); setStatus('ready'); return; }
      if (kind === 'phase2') {
        const d = data as { phase2: Phase2; rivals: RivalView[] };
        setPhase2(d.phase2);
        setAnalysis((a) => (a && a.league ? { ...a, league: { ...a.league, rivals: d.rivals } } : a));
        return;
      }
      const p = pending.current.get(id);
      if (!p) return;
      pending.current.delete(id);
      if (kind === 'error') { p.reject(new Error(String(data))); if (id === 0) setError(String(data)); } else p.resolve(data);
    };
    worker.onerror = (e) => { setError(e.message); setStatus('error'); };
    (async () => {
      try {
        setStatus('loading');
        let r = await loadAll((p) => !cancelled && setProgress(p));
        if (cancelled) return;
        setTeamError(null);
        setOwnRelay(__FPL_RELAY__ || r.meta.relayUrl);
        const teamId = customTeam ?? r.meta.teamId;
        const needRemote = !!teamId && ((!!customTeam && customTeam !== r.meta.teamId) || (!!customLeague && !r.meta.leagueIds.includes(customLeague)));
        const start = (input: RawData) => {
          const data = { ...input, pending: readMoves(input.meta.teamId) };
          setRaw(data); worker.postMessage({ id: 0, type: 'init', payload: { raw: data } });
        };
        if (!teamId || !needRemote) { setStatus('simulating'); start(r); return; }

        // Phase A: the user's own team, fast, then show the analysis straight away.
        setStatus('team');
        let me;
        try {
          me = await loadMyTeam(teamId, r.core.events);
        } catch (err) {
          if (cancelled) return;
          // Keep the default data so the app still works; tell the user why.
          setTeamError(err instanceof TeamNotFound ? 'notFound' : 'network');
          setStatus('simulating'); start(r); return;
        }
        if (cancelled) return;
        const base: RawData = { ...r, meta: { ...r.meta, mode: 'user', teamId, leagueIds: [] }, managers: [me], leagues: [] };
        setStatus('simulating');
        start(base);

        // Phase B (background): mini-league, rivals and full season history; re-run when ready.
        setRivalsLoading({ done: 0, total: 1 });
        const b = await loadLeagueAndHistory(me, r.core.events, customLeague, (done, total) => !cancelled && setRivalsLoading({ done, total }));
        if (cancelled) return;
        setRivalsLoading(null);
        setPhase2(null);
        start({ ...base, meta: { ...base.meta, leagueIds: b.league ? [b.league.id] : [] }, managers: [b.manager, ...b.rivals], leagues: b.league ? [b.league] : [] });
      } catch (err) {
        if (!cancelled) { setError(String(err)); setStatus('error'); }
      }
    })();
    return () => { cancelled = true; setRivalsLoading(null); worker.terminate(); };
  }, [nonce, customTeam, customLeague]);

  const request = useCallback(<T,>(type: string, payload: unknown) => new Promise<T>((resolve, reject) => {
    const id = nextId.current++;
    pending.current.set(id, { resolve: resolve as (v: unknown) => void, reject });
    workerRef.current?.postMessage({ id, type, payload });
  }), []);

  const players = useMemo(() => new Map((raw?.core.players ?? []).map((p) => [p.id, p])), [raw]);
  const teams = useMemo(() => new Map((raw?.core.teams ?? []).map((t) => [t.id, t])), [raw]);

  const setTeam = useCallback((id: number | null) => {
    lsSet('fpl-edge-team', id ? String(id) : null);
    lsSet('fpl-edge-league', null);
    setCustomLeague(null);
    setPhase2(null);
    setCustomTeam(id);
  }, []);
  const recordMoves = useCallback((p: PendingMoves | null) => {
    if (!raw?.meta.teamId) return;
    lsSet(movesKey(raw.meta.teamId), p && p.moves.length ? JSON.stringify(p) : null);
    const data = { ...raw, pending: p && p.moves.length ? p : null };
    setRaw(data);
    setPhase2(null);
    workerRef.current?.postMessage({ id: 0, type: 'init', payload: { raw: data } });
  }, [raw]);
  const setLeague = useCallback((id: number | null) => {
    lsSet('fpl-edge-league', id ? String(id) : null);
    setPhase2(null);
    setCustomLeague(id);
  }, []);

  const value: Store = {
    status, progress, error, raw, analysis, phase2, players, teams, request, reload: () => setNonce((n) => n + 1),
    customTeam, customLeague, setTeam, setLeague, teamError, rivalsLoading, recordMoves,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
