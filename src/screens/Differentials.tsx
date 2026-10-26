import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Reasons, usePlayer } from '../components/ui';

export function Differentials() {
  const { t, fmt } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  if (!a) return null;
  return (
    <div>
      <PageHeader title={t('df.title')} sub={t('df.sub')} back="#/more" />
      <div className="stack">
        {a.differentials.slice(0, 20).map((d, i) => (
          <div key={d.id} className={`card ${i < 3 ? 'accent' : ''}`}>
            <div className="row between">
              <div className="row" style={{ minWidth: 0 }}>
                <MiniShirt id={d.id} />
                <div style={{ minWidth: 0 }}>
                  <div className="name"><PName id={d.id} withTeam /></div>
                  <div className="sub">{pl.p(d.id) && <Money v={pl.p(d.id)!.cost} />} · {t('df.sel')} <span className="num">{fmt(d.sel, 1)}%</span> · {t('df.leagueEo')} <span className="num">{fmt(d.leagueEo, 0)}%</span></div>
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div className="mid-num accent-text">{fmt(d.rankGain)}</div>
                <div className="tiny muted">{t('df.gain')} · {fmt(d.xp)} {t('xp')}</div>
              </div>
            </div>
            {i < 6 && a.players[d.id] && <Reasons reasons={a.players[d.id].reasons} max={4} />}
          </div>
        ))}
      </div>
    </div>
  );
}
