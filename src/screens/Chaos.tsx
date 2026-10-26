import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, usePlayer } from '../components/ui';
import { Gauge } from '../components/viz';

export function Chaos() {
  const { t, pct } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  if (!a) return null;
  const now = a.chaos[0];
  const color = (i: number) => (i >= 65 ? 'var(--bad)' : i < 35 ? 'var(--good)' : 'var(--warn)');
  return (
    <div>
      <PageHeader title={t('cx.title')} back="#/more" />
      <div className="card">
        <p style={{ margin: 0, lineHeight: 1.8 }}>{t('cx.what')}</p>
      </div>
      {now && (
        <div className="card glass" style={{ marginTop: 12 }}>
          <Gauge value={now.index / 100} display={String(now.index)} label={`${t('gw')} ${now.gw} · ${t(`cx.${now.label}`)}`} color={color(now.index)} />
          <p className="display" style={{ textAlign: 'center', margin: '8px 0 12px', fontSize: '1.05rem' }}>{t(`cx.${now.advice}`)}</p>
          <div className="card-label">{t('cx.whyTitle', { gw: now.gw })}</div>
          <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, lineHeight: 1.8 }}>
            <li>{t('cx.factBalanced', { n: now.balancedFixtures, total: now.fixtures })}</li>
            {now.captainId && <li>{t('cx.factCaptain', { name: pl.name(now.captainId), p: pct(now.captainRisk) })}</li>}
            <li>{now.doubles || now.blanks ? t('cx.factIrregular', { d: now.doubles, b: now.blanks }) : t('cx.factRegular')}</li>
          </ul>
          {now.upsets.length > 0 && (
            <>
              <div className="card-label" style={{ marginTop: 10 }}>{t('cx.upsets')}</div>
              <div className="list">
                {now.upsets.map((u, i) => (
                  <div key={i} className="list-row" style={{ padding: '6px 0' }}>
                    <span className="grow num" dir="ltr" style={{ textAlign: 'start' }}>{pl.teamShort(u.h)} – {pl.teamShort(u.a)}</span>
                    <span className="small num" dir="ltr">{pct(u.pH)} · {pct(u.pD)} · {pct(u.pA)}</span>
                  </div>
                ))}
              </div>
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>{t('cx.oddsNote')}</p>
            </>
          )}
        </div>
      )}
      <h2 className="section-title">{t('cx.next')}</h2>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 140 }} dir="ltr">
          {a.chaos.map((c) => (
            <div key={c.gw} style={{ flex: 1, textAlign: 'center' }}>
              <div className="num small">{c.index}</div>
              <div style={{ height: `${c.index}px`, background: color(c.index), borderRadius: 6, animation: 'rise .7s both', transformOrigin: 'bottom' }} />
              <div className="tiny num muted">{t('gwShort')}{c.gw}</div>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t('cx.scale')}</p>
      </div>
    </div>
  );
}
