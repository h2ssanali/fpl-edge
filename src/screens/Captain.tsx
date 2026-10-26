import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, PageHeader, PName, Reasons, Seg, usePlayer } from '../components/ui';
import { CountUp, DistChart } from '../components/viz';

export function Captain() {
  const { t, pct, fmt } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  const [mode, setMode] = useState<'safe' | 'upside'>('safe');
  const me = a?.me;
  if (!a || !me) return <><PageHeader title={t('cap.title')} /><Empty>{t('tr.noSquad')}</Empty></>;
  const options = [...me.captains].sort((x, y) => (mode === 'safe' ? y.safe - x.safe : y.upside - x.upside));
  return (
    <div>
      <PageHeader title={t('cap.title')} sub={t('cap.sub')} />
      <Seg full value={mode} onChange={setMode} options={[{ value: 'safe', label: t('cap.safe') }, { value: 'upside', label: t('cap.upside') }]} />
      <p className="tiny muted" style={{ margin: '8px 2px 14px' }}>{t('cap.safeHint')}</p>
      <div className="stack">
        {options.map((c, i) => {
          const ps = a.players[c.id];
          const fx = ps?.fx ?? [];
          return (
            <article key={c.id} className={`card ${i === 0 ? 'accent glass' : ''}`}>
              <div className="row between">
                <div className="row" style={{ minWidth: 0 }}>
                  <span className="num faint" style={{ fontSize: '1.3rem', width: 22 }}>{i + 1}</span>
                  <MiniShirt id={c.id} />
                  <div style={{ minWidth: 0 }}>
                    <div className="name"><PName id={c.id} /> {i === 0 && <span className="pill accent">{t('cap.pick')}</span>}</div>
                    <div className="sub">
                      {pl.team(c.id)} · {fx.map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') || t('r.blank')}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <CountUp value={c.capDist.mean} decimals={1} className="mid-num accent-text" />
                  <div className="tiny muted">{t('cap.mean')} ×2</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}><DistChart dist={c.capDist} height={70} /></div>
              <div className="kv" style={{ marginTop: 10, gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div><div className="k">{t('pGoal')}</div><div className="v">{pct(c.dist.pGoal)}</div></div>
                <div><div className="k">{t('pAssist')}</div><div className="v">{pct(c.dist.pAssist)}</div></div>
                <div><div className="k">{t('p10plus')}</div><div className="v">{pct(c.dist.p10plus)}</div></div>
                <div><div className="k">{t('pBlank')}</div><div className="v">{pct(c.dist.pBlank)}</div></div>
              </div>
              <div className="row wrap small muted" style={{ marginTop: 8, gap: 12 }}>
                <span>{t('cap.leagueEo')}: <b className="num">{fmt(c.leagueEo, 0)}%</b></span>
                <span>{t('cap.topEo')}: <b className="num">{fmt(c.topEo, 0)}%</b></span>
                <span>{t('pCS')}: <b className="num">{pct(c.dist.pCS)}</b></span>
              </div>
              {ps && <Reasons reasons={ps.reasons} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}
