import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, PageHeader, PName, Reasons, Seg, usePlayer } from '../components/ui';
import { CountUp, RangeBar } from '../components/viz';
import type { CaptainOption } from '../engine/analyze';

type Mode = 'safe' | 'upside';

/**
 * Safe = the highest floor (worst-10% and median points).
 * Upside = a captain your rivals mostly don't have, with a high ceiling: if he hauls you
 * jump past them; if the popular pick hauls instead, you lose ground. That's the risk.
 */
function score(c: CaptainOption, mode: Mode): number {
  if (mode === 'safe') return c.safe;
  const othersCaptain = Math.min(200, c.leagueEo || c.topEo * 2); // % of rivals' effective captaincy
  const differential = 1 - othersCaptain / 200;
  return 0.4 * c.capDist.p90 + 15 * c.dist.p10plus + 0.6 * c.capDist.mean * differential;
}

export function Captain() {
  const { t, pct, fmt } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  const [mode, setMode] = useState<Mode>('safe');
  const me = a?.me;
  if (!a || !me) return <><PageHeader title={t('cap.title')} /><Empty>{t('tr.noSquad')}</Empty></>;
  const options = [...me.captains].sort((x, y) => score(y, mode) - score(x, mode));
  const scale = Math.max(...options.map((c) => c.capDist.p90), 10);
  return (
    <div>
      <PageHeader title={t('cap.title')} sub={t('cap.sub')} />
      <Seg full value={mode} onChange={setMode} options={[{ value: 'safe', label: t('cap.safe') }, { value: 'upside', label: t('cap.upside') }]} />
      <div className={`card ${mode === 'upside' ? 'accent' : ''}`} style={{ margin: '10px 0 14px', padding: 12 }} key={`hint-${mode}`}>
        <div className="small">{mode === 'safe' ? t('cap.safeExplain') : t('cap.upsideExplain')}</div>
        <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{t('cap.howRead')}</div>
      </div>
      <section className="card accent glass" style={{ marginBottom: 14 }}>
        <div className="display" style={{ fontSize: '1.1rem' }}>{t('cap.whyTitle', { gw: a.gw })}</div>
        <ol style={{ margin: '8px 0 0', paddingInlineStart: 20 }}>
          {options.slice(0, 3).map((c, i) => {
            const ps = a.players[c.id];
            const fxTxt = (ps?.fx ?? []).map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') || t('r.blank');
            const others = Math.min(100, (c.leagueEo || c.topEo * 2) / 2);
            const next = options[i + 1];
            return (
              <li key={c.id} style={{ marginBottom: 8, lineHeight: 1.7 }}>
                <b><PName id={c.id} /></b>{' — '}
                {t('cap.whyLine', { pts: fmt(c.capDist.mean), goal: pct(c.dist.pGoal), fx: fxTxt, start: pct(ps?.pStart ?? 0) })}
                {mode === 'upside' && <> {t('cap.whyOthers', { p: fmt(others, 0) })}</>}
                {i === 0 && next && <div className="small muted">{t(mode === 'safe' ? 'cap.whyBeatSafe' : 'cap.whyBeatUp', { name: pl.name(next.id), diff: fmt(c.capDist.mean - next.capDist.mean), p10: fmt(c.capDist.p10, 0), p10b: fmt(next.capDist.p10, 0) })}</div>}
              </li>
            );
          })}
        </ol>
      </section>
      <div className="stack" key={mode}>
        {options.map((c, i) => {
          const ps = a.players[c.id];
          const fx = ps?.fx ?? [];
          const others = c.leagueEo || c.topEo * 2;
          return (
            <article key={c.id} className={`card ${i === 0 ? 'accent glass' : ''}`} style={{ animation: `page-in .35s ${i * 40}ms both` }}>
              <div className="row between">
                <div className="row" style={{ minWidth: 0 }}>
                  <span className="num faint" style={{ fontSize: '1.3rem', width: 22 }}>{i + 1}</span>
                  <MiniShirt id={c.id} />
                  <div style={{ minWidth: 0 }}>
                    <div className="name"><PName id={c.id} /> {i === 0 && <span className="pill accent">{mode === 'safe' ? t('cap.pickSafe') : t('cap.pickUpside')}</span>}</div>
                    <div className="sub">
                      {pl.team(c.id)} · {fx.map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') || t('r.blank')}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <CountUp value={c.capDist.mean} decimals={1} className="mid-num accent-text" />
                  <div className="tiny muted">{t('cap.mean')}</div>
                </div>
              </div>
              <RangeBar low={c.capDist.p10} mid={c.capDist.median} high={c.capDist.p90} scale={scale} />
              <div className="facts">
                <span className="fact">{t('cap.fGoal')} <b>{pct(c.dist.pGoal)}</b></span>
                <span className="fact">{t('cap.fAssist')} <b>{pct(c.dist.pAssist)}</b></span>
                {c.dist.pCS > 0.05 && <span className="fact">{t('cap.fCS')} <b>{pct(c.dist.pCS)}</b></span>}
                <span className="fact">{t('cap.fStart')} <b>{pct(ps?.pStart ?? 0)}</b></span>
                {mode === 'safe'
                  ? <span className="fact">{t('cap.fBlank')} <b>{pct(c.dist.pBlank)}</b></span>
                  : <>
                      <span className="fact">{t('cap.fHaul')} <b>{pct(c.dist.p10plus)}</b></span>
                      <span className={`fact ${others < 40 ? 'good' : others > 120 ? 'bad' : ''}`}>{t('cap.othersCap')} <b>{fmt(Math.min(100, others / 2), 0)}%</b></span>
                    </>}
              </div>
              {ps && <Reasons reasons={ps.reasons} max={5} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}
