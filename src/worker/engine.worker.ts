/// <reference lib="webworker" />
import { Analyzer, type RawData } from '../engine/analyze';

// The whole engine runs here so 10,000-sim Monte Carlo never blocks the UI.
let az: Analyzer | null = null;

type Msg =
  | { id: number; type: 'init'; payload: { raw: RawData; leagueId?: number } }
  | { id: number; type: 'optimize'; payload: { horizon: number; maxMoves: number; exclude?: number[] } }
  | { id: number; type: 'impacts'; payload: { dial: number; horizon?: number } }
  | { id: number; type: 'dream'; payload: { budget: number; horizon: number } }
  | { id: number; type: 'swing'; payload: { playerId: number } }
  | { id: number; type: 'squadDist'; payload: { xi: number[]; bench: number[]; captain: number; vice: number; chip?: 'bboost' | '3xc' | null } };

const post = (id: number, kind: string, data: unknown) => (self as unknown as Worker).postMessage({ id, kind, data });

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, type } = e.data;
  try {
    if (type === 'init') {
      az = new Analyzer(e.data.payload.raw, { leagueId: e.data.payload.leagueId });
      post(id, 'phase1', az.phase1());
      const p2 = az.phase2();
      post(id, 'phase2', { phase2: p2, rivals: az.analysis?.league?.rivals ?? [] });
      return;
    }
    if (!az) throw new Error('engine not initialised');
    switch (type) {
      case 'optimize': {
        const { horizon, maxMoves, exclude } = e.data.payload;
        post(id, 'result', az.optimize(horizon, maxMoves, exclude ?? []));
        break;
      }
      case 'impacts': {
        const opt = az.optimize(e.data.payload.horizon ?? 6, 2);
        const plans = [...(opt.plans[0] ?? []).slice(0, 10), ...(opt.plans[1] ?? []).slice(0, 6)];
        post(id, 'result', az.moveImpacts(plans, e.data.payload.dial));
        break;
      }
      case 'dream':
        post(id, 'result', az.dream(e.data.payload.budget, e.data.payload.horizon));
        break;
      case 'swing':
        post(id, 'result', az.swing(e.data.payload.playerId));
        break;
      case 'squadDist': {
        const p = e.data.payload;
        post(id, 'result', az.squadDistribution(p.xi, p.bench, p.captain, p.vice, p.chip ?? null));
        break;
      }
    }
  } catch (err) {
    post(id, 'error', String((err as Error)?.stack || err));
  }
};
