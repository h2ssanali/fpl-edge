import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Countdown, MiniShirt, PageHeader, PName, useNow, usePlayer } from '../components/ui';
import { Bar } from '../components/viz';
import { IconAlert } from '../components/icons';

export function Deadline() {
  const { t, pct } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  const now = useNow(30000);
  if (!a) return null;
  const me = a.me;
  const lastHours = a.deadline ? new Date(a.deadline).getTime() - now < 6 * 3600000 : false;
  const xi = me?.edge.xi ?? [];
  const flagged = xi.filter((id) => { const p = pl.p(id); return p && (p.status !== 'a' || (p.cop != null && p.cop < 100)); });
  const recent = (me?.squad ?? []).filter((s) => { const n = pl.p(s.id)?.newsAdded; return n && now - new Date(n).getTime() < 48 * 3600000; });
  return (
    <div>
      <PageHeader title={t('dl.title')} sub={t('dl.sub')} back="#/more" />
      <section className="scoreboard"><div className="sb-top"><span><span className="live-dot" />{t('gw')} <span className="num">{a.gw}</span></span></div><Countdown deadline={a.deadline} /></section>
      {lastHours && <div className="banner" style={{ marginTop: 12 }}><IconAlert /><div><b>{t('dl.lastHours')}</b></div></div>}
      {me && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="card-label">1 · {t('dl.check.news')}</div>
            {flagged.length === 0 && recent.length === 0 ? <div className="good small" style={{ marginTop: 6 }}>{t('dl.allClear')}</div> : (
              <div className="list">
                {[...new Set([...flagged, ...recent.map((r) => r.id)])].map((id) => (
                  <div key={id} className="list-row"><MiniShirt id={id} /><div className="grow"><div className="name"><PName id={id} /></div><div className="sub" dir="ltr" style={{ textAlign: 'start' }}>{pl.p(id)?.news || '—'}</div></div><span className="num">{pct(a.players[id]?.pStart ?? 0)}</span></div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-label">2 · {t('dl.check.captain')}</div>
            <div className="row" style={{ marginTop: 6 }}><MiniShirt id={me.edge.captain} /><b>{t('dl.capLock', { cap: pl.name(me.edge.captain), vice: pl.name(me.edge.vice) })}</b></div>
          </div>
          <div className="card">
            <div className="card-label">3 · {t('dl.check.bench')} · {t('dl.check.autosub')}</div>
            <div className="list">
              {me.benchAutoSub.map((b, i) => (
                <div key={b.id} className="list-row">
                  <span className="num faint">{i + 1}</span><MiniShirt id={b.id} />
                  <div className="grow"><div className="name"><PName id={b.id} withTeam /></div><Bar value={b.p} /></div>
                  <span className="num" style={{ fontWeight: 700 }}>{pct(b.p)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
