import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, PageHeader, usePlayer } from '../components/ui';

export function Journal() {
  const { t, fmt } = useI18n();
  const { phase2 } = useStore();
  const pl = usePlayer();
  const j = phase2?.journal;
  if (!phase2) return <><PageHeader title={t('jr.title')} back="#/more" /><div className="skeleton" style={{ height: 240 }} /></>;
  if (!j || !j.length) return <><PageHeader title={t('jr.title')} back="#/more" /><Empty>—</Empty></>;
  const dSum = j.reduce((s, e) => s + e.decisionScore, 0);
  const lSum = j.reduce((s, e) => s + e.luck, 0);
  return (
    <div>
      <PageHeader title={t('jr.title')} sub={t('jr.sub')} back="#/more" />
      <div className="card glass">
        <div className="small">{t('jr.season', { d: `${dSum >= 0 ? '+' : ''}${fmt(dSum)}`, l: `${lSum >= 0 ? '+' : ''}${fmt(lSum)}` })}</div>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {[...j].reverse().map((e) => (
          <article key={e.gw} className="card">
            <div className="row">
              <div className={`grade ${e.grade}`}>{e.grade}</div>
              <div className="grow">
                <div className="row between"><b>{t('gw')} <span className="num">{e.gw}</span>{e.chip && <span className="pill accent" style={{ marginInlineStart: 6 }}>{t(`ch.${e.chip}`)}</span>}</b><span className={`pill ${e.verdict.startsWith('good') ? 'good' : 'bad'}`}>{t(`jr.v.${e.verdict}`)}</span></div>
                <div className="row wrap small muted" style={{ gap: 12, marginTop: 4 }}>
                  <span>{t('jr.expected')} <b className="num">{fmt(e.expected)}</b></span>
                  <span>{t('jr.actual')} <b className="num">{e.actual}</b></span>
                  <span>{t('jr.luck')} <b className={`num ${e.luck >= 0 ? 'good' : 'bad'}`}>{e.luck >= 0 ? '+' : ''}{fmt(e.luck)}</b></span>
                </div>
              </div>
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              {t('jr.capChoice', { cap: pl.name(e.captain) })}
              {e.bestCaptain !== e.captain && <span className="muted"> · {t('jr.capBetter', { best: pl.name(e.bestCaptain) })}</span>}
            </div>
            {e.transfers.length > 0 && (
              <div className="stack small" style={{ gap: 2, marginTop: 6 }}>
                {e.transfers.map((tr, i) => (
                  <div key={i} className="row between">
                    <span dir="ltr"><span className="bad">{pl.name(tr.out)}</span> → <span className="good">{pl.name(tr.in)}</span></span>
                    <span className="num muted">xΔ {tr.xGain >= 0 ? '+' : ''}{fmt(tr.xGain)} · Δ {tr.actualGain >= 0 ? '+' : ''}{tr.actualGain}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
