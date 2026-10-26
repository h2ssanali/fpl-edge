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
  const goodCount = j.filter((e) => e.verdict.startsWith('good')).length;
  const luckSum = j.reduce((s, e) => s + e.luck, 0);
  const signed = (x: number) => `${x >= 0 ? '+' : ''}${fmt(x)}`;
  return (
    <div>
      <PageHeader title={t('jr.title')} back="#/more" />
      <div className="card glass">
        <p style={{ margin: 0, lineHeight: 1.8 }}>{t('jr.explain')}</p>
        <div className="row wrap small" style={{ gap: 6, marginTop: 8 }}>
          {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => <span key={g} className="row" style={{ gap: 4 }}><span className={`grade ${g}`} style={{ width: 26, height: 26, fontSize: '0.95rem', borderRadius: 8 }}>{g}</span>{t(`jr.g.${g}`)}</span>)}
        </div>
        <hr className="divider" />
        <p style={{ margin: 0 }}><b>{t('jr.summary', { good: goodCount, n: j.length })}</b> {t(luckSum >= 0 ? 'jr.luckySeason' : 'jr.unluckySeason', { l: fmt(Math.abs(luckSum), 0) })}</p>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {[...j].reverse().map((e) => {
          const lines: { tone: 'good' | 'bad' | 'neutral'; text: string }[] = [];
          if (e.bestCaptain === e.captain) {
            lines.push({ tone: 'good', text: t('jr.capRight', { cap: pl.name(e.captain), xp: fmt(e.capXp), act: e.capActual }) });
          } else {
            lines.push({ tone: e.bestCapXp - e.capXp > 1 ? 'bad' : 'neutral', text: t('jr.capOther', { cap: pl.name(e.captain), xp: fmt(e.capXp), best: pl.name(e.bestCaptain), bxp: fmt(e.bestCapXp), act: e.capActual, bact: e.bestCapActual }) });
          }
          lines.push(e.lineupLoss > 1
            ? { tone: 'bad', text: t('jr.benchWrong', { l: fmt(e.lineupLoss) }) }
            : { tone: 'good', text: t('jr.benchRight') });
          for (const tr of e.transfers) {
            lines.push({ tone: tr.xGain >= 0 ? 'good' : 'bad', text: t('jr.transfer', { out: pl.name(tr.out), in: pl.name(tr.in), x: signed(tr.xGain), a: signed(tr.actualGain) }) });
          }
          if (e.hitCost > 0) lines.push({ tone: e.transferEV >= 0 ? 'good' : 'bad', text: e.transferEV >= 0 ? t('jr.hitPaid', { c: e.hitCost }) : t('jr.hitNot', { c: e.hitCost }) });
          return (
            <article key={e.gw} className="card">
              <div className="row">
                <div className={`grade ${e.grade}`}>{e.grade}</div>
                <div className="grow">
                  <div className="row between wrap" style={{ gap: 6 }}>
                    <b>{t('gw')} <span className="num">{e.gw}</span> · {t(`jr.g.${e.grade}`)}{e.chip && <span className="pill accent" style={{ marginInlineStart: 6 }}>{t(`ch.${e.chip}`)}</span>}</b>
                    <span className={`pill ${e.verdict.startsWith('good') ? 'good' : 'bad'}`}>{t(`jr.v.${e.verdict}`)}</span>
                  </div>
                </div>
              </div>
              <div className="card-label" style={{ marginTop: 10 }}>{t('jr.why')}</div>
              <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, lineHeight: 1.75 }}>
                {lines.map((l, i) => <li key={i} className={l.tone === 'bad' ? 'bad' : l.tone === 'good' ? '' : 'muted'} style={l.tone === 'good' ? { color: 'var(--text)' } : undefined}>{l.text}</li>)}
              </ul>
              <div className="card-label" style={{ marginTop: 8 }}>{t('jr.luckTitle')}</div>
              <p className="small" style={{ margin: '2px 0 0', lineHeight: 1.7 }}>
                {t(e.luck >= 0 ? 'jr.luckGood' : 'jr.luckBad', { exp: fmt(e.expected, 0), act: e.actual, d: fmt(Math.abs(e.luck), 0) })}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
