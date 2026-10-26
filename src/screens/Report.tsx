import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, PageHeader, usePlayer } from '../components/ui';
import { CountUp } from '../components/viz';

export function Report() {
  const { t, fmt } = useI18n();
  const { phase2 } = useStore();
  const pl = usePlayer();
  const r = phase2?.report;
  if (!phase2) return <><PageHeader title={t('rp.title')} back="#/more" /><div className="skeleton" style={{ height: 200 }} /></>;
  if (!r) return <><PageHeader title={t('rp.title')} back="#/more" /><Empty>—</Empty></>;
  const right: string[] = [];
  const wrong: string[] = [];
  const capGood = r.captain.pts >= r.bestCaptain.pts * 0.7 && r.captain.pts >= 8;
  (capGood ? right : wrong).push(t('rp.captain', { name: pl.name(r.captain.id), pts: r.captain.pts }));
  if (!capGood && r.bestCaptain.id !== r.captain.id) wrong.push(t('rp.bestCap', { name: pl.name(r.bestCaptain.id), pts: r.bestCaptain.pts }));
  if (r.bestPlayer) right.push(t('rp.best', { name: pl.name(r.bestPlayer.id), pts: r.bestPlayer.pts }));
  r.differentialHits.forEach((d) => right.push(t('rp.diffHit', { name: pl.name(d.id), pts: d.pts })));
  r.transfers.forEach((tr) => (tr.inPts >= tr.outPts ? right : wrong).push(t('rp.transfer', { in: pl.name(tr.in), inPts: tr.inPts, out: pl.name(tr.out), outPts: tr.outPts })));
  if (r.benchPoints >= 6) wrong.push(t('rp.bench', { pts: r.benchPoints }));
  if (r.worstStarter && r.worstStarter.pts <= 1) wrong.push(t('rp.worst', { name: pl.name(r.worstStarter.id), pts: r.worstStarter.pts }));
  r.missedHauls.forEach((m) => wrong.push(t('rp.missed', { name: pl.name(m.id), pts: m.pts, eo: fmt(m.eo, 0) })));
  if (r.hitCost) wrong.push(t('rp.hit', { pts: r.hitCost }));
  const diff = (x: number | null) => (x == null ? '—' : `${r.points - x >= 0 ? '+' : ''}${fmt(r.points - x, 0)}`);
  return (
    <div>
      <PageHeader title={`${t('rp.title')} · ${t('gw')} ${r.gw}`} back="#/more" />
      {r.provisional && <div className="banner"><div>{t('rp.provisional')}</div></div>}
      <div className="card glass">
        <div className="row between">
          <div><div className="big-num"><CountUp value={r.points} /></div><div className="tiny muted">{t('points')}</div></div>
          <div className="stack small" style={{ gap: 4, textAlign: 'end' }}>
            <div className={r.points >= r.avg ? 'good' : 'bad'}>{t('rp.vsAvg')} (<span className="num">{r.avg}</span>): <b className="num">{diff(r.avg)}</b></div>
            <div className={r.top10k == null ? 'muted' : r.points >= r.top10k ? 'good' : 'bad'}>{t('rp.vsTop')} (<span className="num">{r.top10k == null ? '—' : fmt(r.top10k, 0)}</span>): <b className="num">{diff(r.top10k)}</b></div>
            <div className="muted">{t('rp.optimal', { pts: r.optimalPoints })}</div>
          </div>
        </div>
      </div>
      <h2 className="section-title good">{t('rp.right')}</h2>
      <div className="card"><ul style={{ margin: 0, paddingInlineStart: 18 }}>{right.map((x, i) => <li key={i} style={{ marginBottom: 6 }}>{x}</li>)}</ul></div>
      <h2 className="section-title bad">{t('rp.wrong')}</h2>
      <div className="card"><ul style={{ margin: 0, paddingInlineStart: 18 }}>{wrong.length ? wrong.map((x, i) => <li key={i} style={{ marginBottom: 6 }}>{x}</li>) : <li>—</li>}</ul></div>
    </div>
  );
}
