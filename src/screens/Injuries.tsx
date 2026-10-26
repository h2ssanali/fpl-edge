import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, PageHeader, PName } from '../components/ui';
import { Bar } from '../components/viz';

export function Injuries() {
  const { t, pct, fmt } = useI18n();
  const { analysis: a } = useStore();
  if (!a) return null;
  const list = a.injuries.slice(0, 60);
  return (
    <div>
      <PageHeader title={t('in.title')} sub={t('in.sub')} back="#/more" />
      <div className="card" style={{ padding: '4px 12px' }}>
        {!list.length ? <Empty>{t('dl.allClear')}</Empty> : (
          <div className="list">
            {list.map((x) => (
              <div key={x.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <MiniShirt id={x.id} />
                <div className="grow">
                  <div className="name"><PName id={x.id} withTeam /> {x.mine && <span className="pill accent">{t('in.mine')}</span>}</div>
                  <div className="row wrap" style={{ gap: 6, margin: '4px 0' }}>
                    <span className={`pill ${x.status === 'a' ? '' : x.status === 'd' ? 'warn' : 'bad'}`}>{t(`in.status.${x.status}`)}{x.cop != null && x.status !== 'a' ? ` · ${x.cop}%` : ''}</span>
                    {x.rotation && <span className="pill warn">{t('in.rotation')}</span>}
                    {x.leagueEo > 0 && <span className="pill">{t('cap.leagueEo')} <span className="num">{fmt(x.leagueEo, 0)}%</span></span>}
                  </div>
                  {x.news && <div className="small muted" dir="ltr" style={{ textAlign: 'start' }}>{x.news}</div>}
                  {x.newsAdded && <div className="tiny faint num" dir="ltr">{new Date(x.newsAdded).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
                <div style={{ width: 70, textAlign: 'end' }}>
                  <div className="num" style={{ fontWeight: 700 }}>{pct(x.pStart)}</div>
                  <div className="tiny muted">{t('in.start')}</div>
                  <Bar value={x.pStart} color={x.pStart > 0.75 ? 'var(--good)' : x.pStart > 0.4 ? 'var(--warn)' : 'var(--bad)'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
