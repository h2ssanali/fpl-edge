import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, PageHeader, PName, Reasons, Seg, usePlayer } from '../components/ui';
import { CountUp, DistChart } from '../components/viz';
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
  const top = options[0];
  return (
    <div>
      <PageHeader title={t('cap.title')} sub={t('cap.sub')} />
      <Seg full value={mode} onChange={setMode} options={[{ value: 'safe', label: t('cap.safe') }, { value: 'upside', label: t('cap.upside') }]} />
      <div className={`card ${mode === 'upside' ? 'accent' : ''}`} style={{ margin: '10px 0 14px', padding: 12 }} key={`hint-${mode}`}>
        <div className="small">{mode === 'safe' ? t('cap.safeExplain') : t('cap.upsideExplain')}</div>
        {top && <div className="small" style={{ marginTop: 6 }}><b>{t('cap.verdict', { name: pl.name(top.id) })}</b></div>}
      </div>
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
              <div style={{ marginTop: 10 }}><DistChart dist={c.capDist} height={70} /></div>
              {mode === 'safe' ? (
                <div className="kv" style={{ marginTop: 10 }}>
                  <div><div className="k">{t('p10')}</div><div className="v">{fmt(c.capDist.p10, 0)}</div></div>
                  <div><div className="k">{t('median')}</div><div className="v">{fmt(c.capDist.median, 0)}</div></div>
                  <div><div className="k">{t('pBlank')}</div><div className="v">{pct(c.dist.pBlank)}</div></div>
                </div>
              ) : (
                <div className="kv" style={{ marginTop: 10 }}>
                  <div><div className="k">{t('p90')}</div><div className="v">{fmt(c.capDist.p90, 0)}</div></div>
                  <div><div className="k">{t('p10plus')}</div><div className="v">{pct(c.dist.p10plus)}</div></div>
                  <div><div className="k">{t('cap.othersCap')}</div><div className={`v ${others < 40 ? 'good' : others > 120 ? 'bad' : ''}`}>{fmt(Math.min(100, others / 2), 0)}%</div></div>
                </div>
              )}
              <div className="row wrap small muted" style={{ marginTop: 8, gap: 12 }}>
                <span>{t('pGoal')}: <b className="num">{pct(c.dist.pGoal)}</b></span>
                <span>{t('pAssist')}: <b className="num">{pct(c.dist.pAssist)}</b></span>
                {c.dist.pCS > 0.05 && <span>{t('pCS')}: <b className="num">{pct(c.dist.pCS)}</b></span>}
              </div>
              {ps && <Reasons reasons={ps.reasons} max={5} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}
