import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Money, PageHeader, Seg } from '../components/ui';
import { Pitch } from '../components/Pitch';
import { bestXI, type SquadMember } from '../engine/squad';

export function Dream() {
  const { t, fmt } = useI18n();
  const { analysis: a, request } = useStore();
  const [budget, setBudget] = useState(() => (a?.me ? Math.max(1000, a.me.teamValue) : 1000));
  const [h, setH] = useState(3);
  const [res, setRes] = useState<{ squad: SquadMember[]; value: number; cost: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const build = async () => { setBusy(true); try { setRes(await request('dream', { budget, horizon: h })); } finally { setBusy(false); } };
  useEffect(() => { build(); /* initial */ // eslint-disable-line react-hooks/exhaustive-deps
  }, []);
  if (!a) return null;
  const score = (id: number) => a.players[id]?.xp.slice(0, h).reduce((s, x) => s + x, 0) ?? 0;
  const lineup = res ? bestXI(res.squad, score) : null;
  return (
    <div>
      <PageHeader title={t('dt.title')} sub={t('dt.sub')} back="#/more" />
      <div className="card">
        <div className="row between"><span className="small muted">{t('dt.budget')}</span><b><Money v={budget} /></b></div>
        <input type="range" min={800} max={1100} step={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} dir="ltr" aria-label={t('dt.budget')} />
        <div className="row between wrap" style={{ marginTop: 8, gap: 8 }}>
          <span className="small muted">{t('dt.gws')}</span>
          <Seg value={h} onChange={setH} options={[1, 2, 3, 4, 5, 6].map((x) => ({ value: x, label: String(x) }))} />
          <button className="btn primary small" onClick={build} disabled={busy}>{busy ? '…' : t('dt.build')}</button>
        </div>
      </div>
      {res && lineup && (
        <>
          <div className="kv" style={{ margin: '12px 0' }}>
            <div><div className="k">{t('dt.cost')}</div><div className="v"><Money v={res.cost} /></div></div>
            <div><div className="k">{t('dt.value')}</div><div className="v">{fmt(lineup.total + (lineup.captain ? score(lineup.captain.id) : 0))}</div></div>
            <div><div className="k">{t('dt.gws')}</div><div className="v">{h}</div></div>
          </div>
          <Pitch xi={lineup.xi.map((m) => ({ id: m.id, label: fmt(score(m.id)), captain: m.id === lineup.captain?.id }))} bench={lineup.bench.map((m) => ({ id: m.id, label: fmt(score(m.id)) }))} />
        </>
      )}
    </div>
  );
}
