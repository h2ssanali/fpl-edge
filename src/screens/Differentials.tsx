import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Reasons, Seg, usePlayer } from '../components/ui';

type Pos = 0 | 2 | 3 | 4;

export function Differentials() {
  const { t, fmt } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  const [pos, setPos] = useState<Pos>(0);
  if (!a) return null;
  const from = a.horizon[0];
  const to = a.horizon[Math.min(3, a.horizon.length - 1)];
  // Most important: expected points. Differential = owned by under 10% of managers.
  const list = [...a.differentials]
    .filter((d) => d.sel <= 10 && (!pos || pl.p(d.id)?.pos === pos))
    .sort((x, y) => y.xp - x.xp)
    .slice(0, 20);
  return (
    <div>
      <PageHeader title={t('df.title')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('df.explain', { from, to })}</p></div>
      <div style={{ margin: '12px 0' }}>
        <Seg full value={pos} onChange={setPos} options={[{ value: 0, label: t('tr.all') }, { value: 2, label: 'DEF' }, { value: 3, label: 'MID' }, { value: 4, label: 'FWD' }]} />
      </div>
      <div className="stack">
        {list.map((d, i) => (
          <div key={d.id} className={`card ${i < 3 ? 'accent' : ''}`}>
            <div className="row between">
              <div className="row" style={{ minWidth: 0 }}>
                <span className="num faint" style={{ width: 22, fontSize: '1.2rem' }}>{i + 1}</span>
                <MiniShirt id={d.id} />
                <div style={{ minWidth: 0 }}>
                  <div className="name"><PName id={d.id} withTeam /></div>
                  <div className="sub">{pl.p(d.id) && <Money v={pl.p(d.id)!.cost} />} · {t('df.ownedBy', { p: fmt(d.sel, 1) })}{d.leagueEo > 0 ? ` · ${t('df.leagueOwn', { p: fmt(Math.min(100, d.leagueEo), 0) })}` : ''}</div>
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div className="mid-num accent-text">{fmt(d.xp)}</div>
                <div className="tiny muted">{t('df.pts', { from, to })}</div>
              </div>
            </div>
            {i < 6 && a.players[d.id] && <Reasons reasons={a.players[d.id].reasons} max={4} />}
          </div>
        ))}
      </div>
    </div>
  );
}
