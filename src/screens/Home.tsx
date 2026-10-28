import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Countdown, Empty, MiniShirt, PName, Reasons, usePlayer } from '../components/ui';
import { CountUp, DistChart } from '../components/viz';
import { IconArrowDown, IconArrowUp, IconClock, IconPhone } from '../components/icons';
import { RankCard } from '../components/MyRank';
import { WhatIf } from '../components/WhatIf';

export function Home() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a, phase2, raw } = useStore();
  const pl = usePlayer();
  if (!a || !raw) return null;
  const me = a.me;
  const cap = me?.captains.find((c) => c.id === me.edge.captain) ?? me?.captains[0];
  const topPlan = phase2?.plans[0]?.[0];
  // The next two captain options (by expected points), so the choice is visible at a glance.
  const alts = (me?.captains ?? []).filter((c) => c.id !== cap?.id).sort((x, y) => y.capDist.mean - x.capDist.mean).slice(0, 2);
  const fxText = (id: number) => (a.players[id]?.fx ?? []).map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') || t('r.blank');
  const updated = new Date(raw.meta.updated);
  return (
    <div className="stack">
      <section className="scoreboard" aria-label={t('deadline')}>
        <div className="sb-top">
          <span><span className="live-dot" />{t('gw')} <span className="num">{a.gw}</span> · {t('deadline')}</span>
          <span className="num" dir="ltr">{a.deadline ? new Date(a.deadline).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : ''}</span>
        </div>
        <Countdown deadline={a.deadline} />
        {me && (
          <div className="row between small" style={{ marginTop: 8 }}>
            <a href="#/more/settings" className="muted" style={{ textDecoration: 'none' }}><bdi dir="ltr">{me.name}</bdi> · <span className="accent-text">{t('team.change')}</span></a>
            <span className="muted">{t('updated')}: <span className="num" dir="ltr">{updated.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span></span>
          </div>
        )}
      </section>

      {me?.recorded ? (
        <a href="#/transfers" className="card accent" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 14px' }}>
          <div className="small"><b>{t('rec.homeDone', { n: me.recorded.ins.length })}</b> <span className="card-link">{t('rec.edit')}</span></div>
        </a>
      ) : me && (
        <a href="#/transfers" className="small muted" style={{ textDecoration: 'none', padding: '0 4px' }}>{t('rec.homeHint')} <span className="accent-text">{t('rec.homeHintLink')}</span></a>
      )}

      <RankCard />
      <WhatIf />

      <a href="#/captain" className="card accent" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="card-head"><span className="card-label">{t('home.captainGw', { gw: a.gw })}</span><span className="card-link">{t('home.seeAll')}</span></div>
        {cap ? (
          <>
            <div className="row between" style={{ marginTop: 6, alignItems: 'center' }}>
              <div className="row" style={{ minWidth: 0 }}>
                <MiniShirt id={cap.id} />
                <div style={{ minWidth: 0 }}>
                  <div className="name" style={{ fontSize: '1.1rem' }}><PName id={cap.id} /> <span className="pill accent">C</span></div>
                  <div className="sub">{t('home.vs', { fx: fxText(cap.id) })}</div>
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <CountUp value={cap.capDist.mean} decimals={1} className="big-num accent-text" />
                <div className="tiny muted">{t('home.capPts')}</div>
              </div>
            </div>
            <div className="small" style={{ marginTop: 8, lineHeight: 1.7 }}>
              {t('home.capWhy', { goal: pct(cap.dist.pGoal), start: pct(a.players[cap.id]?.pStart ?? 0), low: fmt(cap.capDist.p10, 0), high: fmt(cap.capDist.p90, 0) })}
            </div>
            {alts.length > 0 && (
              <div className="list" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                <div className="tiny muted" style={{ padding: '4px 0' }}>{t('home.capAlts')}</div>
                {alts.map((c, i) => (
                  <div key={c.id} className="list-row" style={{ padding: '6px 0' }}>
                    <span className="num faint" style={{ width: 16 }}>{i + 2}</span>
                    <MiniShirt id={c.id} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="name"><PName id={c.id} /></div>
                      <div className="sub">{t('home.vs', { fx: fxText(c.id) })}</div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <div className="num" style={{ fontWeight: 700 }}>{fmt(c.capDist.mean)}</div>
                      <div className="tiny muted">{t('home.ptsShort')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : <Empty>—</Empty>}
      </a>

      <a href="#/transfers" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="card-head"><span className="card-label">{t('home.transferGw', { gw: a.gw })}</span><span className="card-link">{t('home.seeAll')}</span></div>
        {!phase2 ? <div className="skeleton" style={{ height: 48 }} /> : topPlan && topPlan.net > 1 ? (
          <div className="row between wrap">
            <div className="stack" style={{ gap: 6 }}>
              {topPlan.moves.map((m) => (
                <div key={m.out} className="move">
                  <IconArrowDown width={16} className="out" /><span className="out"><PName id={m.out} withTeam /></span>
                  <IconArrowUp width={16} className="in" /><span className="in"><PName id={m.in} withTeam /></span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'end' }}>
              <div className="mid-num good">+<CountUp value={topPlan.net} decimals={1} /></div>
              <div className="tiny muted">{t('home.over6', { from: a.horizon[0], to: a.horizon[Math.min(5, a.horizon.length - 1)] })}</div>
            </div>
          </div>
        ) : <div className="muted small">{t('home.noTransfer')}</div>}
        {topPlan && a.players[topPlan.moves[0].in] && <Reasons reasons={a.players[topPlan.moves[0].in].reasons} max={4} />}
      </a>

      {me && (
        <div className="card">
          <div className="card-label">{t('home.squadGw', { gw: a.gw })}</div>
          <div className="row between" style={{ alignItems: 'baseline', marginTop: 6 }}>
            <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
              <CountUp value={me.squadDist.mean} decimals={0} className="big-num" />
              <span className="small muted">{t('xp')}</span>
            </div>
            <div className="small muted">{t('home.squadRange', { low: fmt(me.squadDist.p10, 0), high: fmt(me.squadDist.p90, 0) })}</div>
          </div>
          <DistChart dist={me.squadDist} height={40} compact />
        </div>
      )}

      {phase2?.report && (
        <a href="#/more/report" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-head"><span className="card-label">{t('home.report')} · {t('gw')} {phase2.report.gw}</span><span className="card-link">{t('home.seeAll')}</span></div>
          <div className="row between">
            <div><div className="big-num">{phase2.report.points}</div><div className="tiny muted">{t('points')}</div></div>
            <div style={{ textAlign: 'end' }} className="small">
              <div className={phase2.report.points >= phase2.report.avg ? 'good' : 'bad'}>{t('rp.vsAvg')}: <span className="num">{phase2.report.points - phase2.report.avg > 0 ? '+' : ''}{phase2.report.points - phase2.report.avg}</span></div>
              {phase2.report.top10k != null && <div className={phase2.report.points >= phase2.report.top10k ? 'good' : 'bad'}>{t('rp.vsTop')}: <span className="num">{phase2.report.points - phase2.report.top10k > 0 ? '+' : ''}{fmt(phase2.report.points - phase2.report.top10k, 0)}</span></div>}
            </div>
          </div>
        </a>
      )}

      <div className="grid-2">
        <a href="#/more/deadline" className="btn"><IconClock /> {t('home.deadlineMode')}</a>
        <a href="#/more/story" className="btn primary"><IconPhone /> {t('home.story')}</a>
      </div>
      <a href="#/more/method" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="display" style={{ fontSize: '1.05rem' }}>{t('method.cta')}</div>
        <div className="small muted">{t('method.ctaSub')}</div>
      </a>
    </div>
  );
}
