import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader } from '../components/ui';
import { Bar, Gauge } from '../components/viz';

export function Chaos() {
  const { t, pct } = useI18n();
  const { analysis: a } = useStore();
  if (!a) return null;
  const now = a.chaos[0];
  const color = (i: number) => (i >= 65 ? 'var(--bad)' : i < 35 ? 'var(--good)' : 'var(--warn)');
  return (
    <div>
      <PageHeader title={t('cx.title')} sub={t('cx.sub')} back="#/more" />
      {now && (
        <div className="card glass">
          <div className="row between">
            <div style={{ flex: 1 }}><Gauge value={now.index / 100} display={String(now.index)} label={`${t('gw')} ${now.gw} · ${t(`cx.${now.label}`)}`} color={color(now.index)} /></div>
          </div>
          <p className="display" style={{ textAlign: 'center', margin: '8px 0 12px' }}>{t(`cx.${now.advice}`)}</p>
          <div className="stack" style={{ gap: 8 }}>
            {[['cx.balance', now.balance], ['cx.fragility', Math.min(1, now.fragility / 0.5)], ['cx.capRisk', now.captainRisk], ['cx.irregular', now.irregular]].map(([k, v]) => (
              <div key={k as string}><div className="row between small"><span className="muted">{t(k as string)}</span><span className="num">{pct(v as number)}</span></div><Bar value={v as number} /></div>
            ))}
          </div>
        </div>
      )}
      <h2 className="section-title">{t('gw')}</h2>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 140 }} dir="ltr">
          {a.chaos.map((c) => (
            <div key={c.gw} style={{ flex: 1, textAlign: 'center' }}>
              <div className="num small">{c.index}</div>
              <div style={{ height: `${c.index}px`, background: color(c.index), borderRadius: 6, animation: 'rise .7s both', transformOrigin: 'bottom' }} />
              <div className="tiny num muted">{c.gw}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
