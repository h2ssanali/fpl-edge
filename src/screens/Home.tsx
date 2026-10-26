import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Countdown, Empty, MiniShirt, PName, Reasons } from '../components/ui';
import { CountUp, DistChart, Gauge } from '../components/viz';
import { IconArrowDown, IconArrowUp, IconClock, IconPhone } from '../components/icons';

export function Home() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a, phase2, raw } = useStore();
  if (!a || !raw) return null;
  const me = a.me;
  const cap = me?.captains.find((c) => c.id === me.edge.captain) ?? me?.captains[0];
  const topPlan = phase2?.plans[0]?.[0];
  const chaos = a.chaos[0];
  const league = a.league;
  const myRow = league?.standings.find((s) => s.isMe);
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
            <span className="muted"><bdi dir="ltr">{me.name}</bdi></span>
            <span className="muted">{t('updated')}: <span className="num" dir="ltr">{updated.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span></span>
          </div>
        )}
      </section>

      <div className="grid-2">
        <a href="#/captain" className="card accent" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-label">{t('home.captain')}</div>
          {cap ? (
            <>
              <div className="row" style={{ marginTop: 8 }}>
                <MiniShirt id={cap.id} />
                <div className="name" style={{ fontSize: '1.05rem' }}><PName id={cap.id} /></div>
              </div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <CountUp value={cap.capDist.mean} decimals={1} className="big-num accent-text" />
                <span className="small muted">{t('xp')}</span>
              </div>
              <div className="tiny muted">{t('p10plus')} {pct(cap.dist.p10plus)} · {t('pGoal')} {pct(cap.dist.pGoal)}</div>
            </>
          ) : <Empty>—</Empty>}
        </a>
        <a href={league ? '#/league' : '#/more/settings'} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-label">{t('home.winProb')}</div>
          {league && myRow ? (
            <>
              <Gauge value={league.pWin} label={`${t('home.leagueRank')}: ${myRow.rank}`} />
              <div className="tiny muted" style={{ textAlign: 'center' }}>{t(`lg.mode.${league.mode.mode}`)}</div>
            </>
          ) : <Empty>—</Empty>}
        </a>
      </div>

      <a href="#/transfers" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="card-head"><span className="card-label">{t('home.transfer')}</span><span className="card-link">{t('home.seeAll')}</span></div>
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
              <div className="tiny muted">{t('tr.horizon')} 6 {t('gw')}</div>
            </div>
          </div>
        ) : <div className="muted small">{t('home.noTransfer')}</div>}
        {topPlan && a.players[topPlan.moves[0].in] && <Reasons reasons={a.players[topPlan.moves[0].in].reasons} max={4} />}
      </a>

      <div className="grid-2">
        <a href="#/more/chaos" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-label">{t('home.chaos')}</div>
          {chaos && <Gauge value={chaos.index / 100} display={String(chaos.index)} label={t(`cx.${chaos.label}`)} color={chaos.index >= 65 ? 'var(--bad)' : chaos.index < 35 ? 'var(--good)' : 'var(--warn)'} />}
          {chaos && <div className="tiny muted" style={{ textAlign: 'center' }}>{t(`cx.${chaos.advice}`)}</div>}
        </a>
        <div className="card">
          <div className="card-label">{t('home.squad')}</div>
          {me ? (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <CountUp value={me.squadDist.mean} decimals={0} className="big-num" />
                <span className="small muted">{t('xp')}</span>
              </div>
              <div className="tiny muted num">{fmt(me.squadDist.p10, 0)}–{fmt(me.squadDist.p90, 0)}</div>
              <DistChart dist={me.squadDist} height={40} compact />
            </>
          ) : <Empty>—</Empty>}
        </div>
      </div>

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
    </div>
  );
}
