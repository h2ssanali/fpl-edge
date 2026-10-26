import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, usePlayer } from '../components/ui';

const color = (i: number) => (i >= 65 ? 'var(--bad)' : i < 35 ? 'var(--good)' : 'var(--warn)');

/** A 0–100 meter split into the three zones, with a marker at the value. */
function Meter({ value }: { value: number }) {
  const { t } = useI18n();
  return (
    <div dir="ltr" style={{ marginTop: 10 }}>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '35fr 30fr 35fr', gap: 3, height: 12 }}>
        <i style={{ background: 'var(--good)', opacity: 0.7, borderRadius: '99px 0 0 99px' }} />
        <i style={{ background: 'var(--warn)', opacity: 0.7 }} />
        <i style={{ background: 'var(--bad)', opacity: 0.7, borderRadius: '0 99px 99px 0' }} />
        <b style={{ position: 'absolute', left: `${value}%`, top: -5, width: 6, height: 22, marginLeft: -3, borderRadius: 3, background: 'var(--text)', boxShadow: '0 0 0 2px var(--bg-mid)' }} />
      </div>
      <div className="tiny muted" style={{ display: 'grid', gridTemplateColumns: '35fr 30fr 35fr', marginTop: 4, direction: 'ltr' }}>
        <span style={{ textAlign: 'left' }}>{t('cx.calm')}</span>
        <span style={{ textAlign: 'center' }}>{t('cx.normal')}</span>
        <span style={{ textAlign: 'right' }}>{t('cx.wild')}</span>
      </div>
    </div>
  );
}

export function Chaos() {
  const { t, pct } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  if (!a) return null;
  const now = a.chaos[0];
  return (
    <div>
      <PageHeader title={t('cx.title')} back="#/more" />
      <div className="card">
        <p style={{ margin: 0, lineHeight: 1.8 }}>{t('cx.what')}</p>
      </div>

      {now && (
        <>
          <section className="card glass" style={{ marginTop: 12 }}>
            <div className="row between" style={{ alignItems: 'baseline' }}>
              <div className="card-label">{t('gw')} {now.gw}</div>
              <span className="pill" style={{ background: color(now.index), color: '#0b0f14' }}>{t(`cx.${now.label}`)}</span>
            </div>
            <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="big-num" style={{ color: color(now.index) }}>{now.index}</span>
              <span className="small muted">/ 100</span>
            </div>
            <Meter value={now.index} />
            <div className="card" style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2)' }}>
              <div className="card-label">{t('cx.whatToDo')}</div>
              <div style={{ fontWeight: 700, lineHeight: 1.7 }}>{t(`cx.${now.advice}`)}</div>
            </div>
          </section>

          <h2 className="section-title">{t('cx.whyTitle', { gw: now.gw })}</h2>
          <div className="stack">
            <div className="card" style={{ padding: '10px 14px' }}>
              <div className="row between"><b>{t('cx.r1')}</b><span className="num" style={{ fontWeight: 700 }}>{now.balancedFixtures}/{now.fixtures}</span></div>
              <div className="small muted" style={{ marginTop: 2 }}>{t('cx.factBalanced', { n: now.balancedFixtures, total: now.fixtures })}</div>
            </div>
            {now.captainId && (
              <div className="card" style={{ padding: '10px 14px' }}>
                <div className="row between"><b>{t('cx.r2')}</b><span className="num" style={{ fontWeight: 700 }}>{pct(now.captainRisk)}</span></div>
                <div className="small muted" style={{ marginTop: 2 }}>{t('cx.factCaptain', { name: pl.name(now.captainId), p: pct(now.captainRisk) })}</div>
              </div>
            )}
            <div className="card" style={{ padding: '10px 14px' }}>
              <div className="row between"><b>{t('cx.r3')}</b><span className="num" style={{ fontWeight: 700 }}>{now.doubles || now.blanks ? `${now.doubles} / ${now.blanks}` : '—'}</span></div>
              <div className="small muted" style={{ marginTop: 2 }}>{now.doubles || now.blanks ? t('cx.factIrregular', { d: now.doubles, b: now.blanks }) : t('cx.factRegular')}</div>
            </div>
          </div>

          {now.upsets.length > 0 && (
            <>
              <h2 className="section-title">{t('cx.upsets')}</h2>
              <div className="card" style={{ padding: '6px 14px' }}>
                <div className="list">
                  {now.upsets.map((u, i) => (
                    <div key={i} style={{ padding: '8px 0' }}>
                      <div className="row between small" dir="ltr">
                        <b>{pl.teamShort(u.h)}</b>
                        <span className="muted">{t('cx.draw')}</span>
                        <b>{pl.teamShort(u.a)}</b>
                      </div>
                      <div dir="ltr" style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2, marginTop: 4 }}>
                        <i style={{ width: `${u.pH * 100}%`, background: 'var(--accent)' }} />
                        <i style={{ width: `${u.pD * 100}%`, background: 'var(--faint)' }} />
                        <i style={{ width: `${u.pA * 100}%`, background: 'var(--warn)' }} />
                      </div>
                      <div className="row between tiny num muted" dir="ltr" style={{ marginTop: 2 }}>
                        <span>{pct(u.pH)}</span><span>{pct(u.pD)}</span><span>{pct(u.pA)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="tiny muted" style={{ margin: '4px 2px 0' }}>{t('cx.oddsNote')}</p>
            </>
          )}
        </>
      )}

      <h2 className="section-title">{t('cx.next')}</h2>
      <div className="card" style={{ padding: '6px 14px' }}>
        <div className="list">
          {a.chaos.map((c) => (
            <div key={c.gw} className="list-row" style={{ padding: '8px 0' }}>
              <span className="num" style={{ width: 52 }}>{t('gwShort')}{c.gw}</span>
              <div className="grow"><div className="bar"><i style={{ width: `${c.index}%`, background: color(c.index) }} /></div></div>
              <span className="small" style={{ width: 64, textAlign: 'end' }}><b className="num">{c.index}</b> · {t(`cx.${c.label}`)}</span>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: '4px 0 6px' }}>{t('cx.scale')}</p>
      </div>
    </div>
  );
}
