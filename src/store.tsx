import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Analysis, Phase2, RawData, RivalView } from './engine/analyze';
import type { Player, Team } from './engine/types';
import { loadAll } from './data/load';

type Status = 'loading' | 'simulating' | 'ready' | 'error';

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
        const r = await loadAll((p) => !cancelled && setProgress(p));
        if (cancelled) return;
        setRaw(r);
        setStatus('simulating');
        worker.postMessage({ id: 0, type: 'init', payload: { raw: r } });
      } catch (err) {
        if (!cancelled) { setError(String(err)); setStatus('error'); }
      }
    })();
    return () => { cancelled = true; worker.terminate(); };
  }, [nonce]);

  const request = useCallback(<T,>(type: string, payload: unknown) => new Promise<T>((resolve, reject) => {
    const id = nextId.current++;
    pending.current.set(id, { resolve: resolve as (v: unknown) => void, reject });
    workerRef.current?.postMessage({ id, type, payload });
  }), []);

  const players = useMemo(() => new Map((raw?.core.players ?? []).map((p) => [p.id, p])), [raw]);
  const teams = useMemo(() => new Map((raw?.core.teams ?? []).map((t) => [t.id, t])), [raw]);

  const value: Store = { status, progress, error, raw, analysis, phase2, players, teams, request, reload: () => setNonce((n) => n + 1) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
