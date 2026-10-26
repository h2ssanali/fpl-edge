import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, PageHeader, PName } from '../components/ui';
import { CountUp } from '../components/viz';

export function Hindsight() {
  const { t, fmt } = useI18n();
  const { phase2 } = useStore();
  const bt = phase2?.backtest;
  if (!phase2) return <><PageHeader title={t('hs.title')} back="#/more" /><div className="skeleton" style={{ height: 240 }} /></>;
  if (!bt || !bt.gws.length) return <><PageHeader title={t('hs.title')} back="#/more" /><Empty>—</Empty></>;
  const maxPts = Math.max(...bt.gws.flatMap((g) => [g.yours, g.edgeLineup, g.autopilot]), 1);
  const rank = (r: number | null) => (r == null ? '—' : r.toLocaleString('en'));
  return (
    <div>
      <PageHeader title={t('hs.title')} sub={t('hs.sub')} back="#/more" />
      <div className="card glass accent">
        <p className="display" style={{ fontSize: '1.1rem', margin: 0, lineHeight: 1.6 }}>{t('hs.headline', { pts: bt.totals.edgeLineup, rank: rank(bt.ranks.edgeLineup) })}</p>
      </div>
      <div className="kv" style={{ marginTop: 12 }}>
        <div><div className="k">{t('hs.yours')}</div><div className="v"><CountUp value={bt.totals.yours} /></div><div className="tiny muted num">≈{rank(bt.ranks.yours)}</div></div>
        <div><div className="k">{t('hs.lineup')}</div><div className={`v ${bt.totals.edgeLineup >= bt.totals.yours ? 'good' : 'bad'}`}><CountUp value={bt.totals.edgeLineup} /></div><div className="tiny muted num">≈{rank(bt.ranks.edgeLineup)}</div></div>
        <div><div className="k">{t('hs.autopilot')}</div><div className="v"><CountUp value={bt.totals.autopilot} /></div><div className="tiny muted num">≈{rank(bt.ranks.autopilot)}</div></div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row small muted" style={{ gap: 12, marginBottom: 8 }}>
          <span className="row" style={{ gap: 4 }}><i style={{ width: 10, height: 10, background: 'var(--faint)', borderRadius: 2, display: 'inline-block' }} />{t('hs.yours')}</span>
          <span className="row" style={{ gap: 4 }}><i style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: 2, display: 'inline-block' }} />{t('hs.lineup')}</span>
          <span className="row" style={{ gap: 4 }}><i style={{ width: 10, height: 10, background: 'var(--good)', borderRadius: 2, display: 'inline-block', opacity: 0.6 }} />{t('hs.autopilot')}</span>
        </div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 130 }} dir="ltr">
          {bt.gws.map((g) => (
            <div key={g.gw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="row" style={{ alignItems: 'flex-end', gap: 1, height: 110, width: '100%' }}>
                {[[g.yours, 'var(--faint)', 1], [g.edgeLineup, 'var(--accent)', 1], [g.autopilot, 'var(--good)', 0.6]].map(([v, c, o], i) => (
                  <div key={i} title={String(v)} style={{ flex: 1, height: `${(Math.max(0, v as number) / maxPts) * 100}%`, background: c as string, opacity: o as number, borderRadius: 2, animation: 'rise .7s both', transformOrigin: 'bottom' }} />
                ))}
              </div>
              <div className="tiny num muted">{g.gw}</div>
            </div>
          ))}
        </div>
      </div>
      <h2 className="section-title">{t('hs.accuracy')}</h2>
      <div className="kv">
        <div><div className="k">{t('hs.mae')}</div><div className="v">{fmt(bt.accuracy.mae, 2)}</div></div>
        <div><div className="k">{t('hs.corr')}</div><div className="v">{fmt(bt.accuracy.corr, 2)}</div></div>
        <div><div className="k">{t('hs.capWins')}</div><div className="v">{bt.accuracy.captainWins}/{bt.accuracy.captainGws}</div></div>
      </div>
      <h2 className="section-title">{t('hs.misses')}</h2>
      <div className="card" style={{ padding: '4px 12px' }}>
        <div className="list">
          {bt.misses.map((m, i) => (
            <div key={i} className="list-row">
              <span className="num faint">{t('gwShort')}{m.gw}</span>
              <div className="grow name"><PName id={m.id} withTeam /></div>
              <span className="num small muted">{fmt(m.xp)} →</span>
              <b className={`num ${m.actual > m.xp ? 'good' : 'bad'}`}>{m.actual}</b>
            </div>
          ))}
        </div>
      </div>
      <p className="tiny faint" style={{ marginTop: 12 }}>{t('hs.autopilotNote')} {t('hs.statusNote')}</p>
    </div>
  );
}
