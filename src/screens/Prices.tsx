import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, Money, PageHeader, PName, usePlayer } from '../components/ui';
import { Bar, Spark } from '../components/viz';
import type { PriceSignal } from '../engine/insights';

function Row({ s }: { s: PriceSignal }) {
  const { t, fmt } = useI18n();
  const pl = usePlayer();
  const p = pl.p(s.id);
  const rise = s.direction === 'rise';
  return (
    <div className="list-row">
      <MiniShirt id={s.id} />
      <div className="grow">
        <div className="name"><PName id={s.id} withTeam /> {s.tonight && <span className={`pill ${rise ? 'good' : 'bad'}`}>{t('pr.tonight')}</span>}</div>
        <div className="sub">{p && <Money v={p.cost} />} · {t('pr.net')}: <span className="num">{s.netTransfers > 0 ? '+' : ''}{s.netTransfers.toLocaleString('en')}</span></div>
        <Bar value={Math.min(1, Math.abs(s.progress) / 100)} color={rise ? 'var(--good)' : 'var(--bad)'} />
      </div>
      <div style={{ textAlign: 'end' }}>
        <div className={`num ${rise ? 'good' : 'bad'}`} style={{ fontWeight: 700 }}>{fmt(s.progress, 0)}%</div>
        <Spark values={s.trend} width={56} height={18} />
      </div>
    </div>
  );
}

export function Prices() {
  const { t } = useI18n();
  const { analysis: a, raw } = useStore();
  if (!a || !raw) return null;
  const mine = new Set(a.me?.squad.map((s) => s.id) ?? []);
  const risers = a.prices.filter((s) => s.direction === 'rise');
  const fallers = a.prices.filter((s) => s.direction === 'fall');
  const myAlerts = a.prices.filter((s) => mine.has(s.id) && (s.tonight || Math.abs(s.progress) > 70));
  const values = a.me?.history.map((h) => h.value / 10) ?? [];
  return (
    <div>
      <PageHeader title={t('pr.title')} sub={t('pr.sub')} back="#/more" />
      {a.me && (
        <div className="card glass">
          <div className="row between">
            <div><div className="card-label">{t('pr.teamValue')}</div><div className="mid-num"><Money v={a.me.teamValue} /></div></div>
            <Spark values={values} width={120} height={36} />
          </div>
        </div>
      )}
      <h2 className="section-title">{t('pr.yourAlerts')}</h2>
      <div className="card" style={{ padding: '4px 12px' }}>
        {myAlerts.length ? <div className="list">{myAlerts.map((s) => <Row key={s.id} s={s} />)}</div> : <Empty>{t('pr.noAlerts')}</Empty>}
      </div>
      <h2 className="section-title">{t('pr.risers')} <span className="hint">{t('pr.buyBefore')}</span></h2>
      <div className="card" style={{ padding: '4px 12px' }}><div className="list">{risers.slice(0, 15).map((s) => <Row key={s.id} s={s} />)}</div></div>
      <h2 className="section-title">{t('pr.fallers')} <span className="hint">{t('pr.sellBefore')}</span></h2>
      <div className="card" style={{ padding: '4px 12px' }}><div className="list">{fallers.slice(0, 15).map((s) => <Row key={s.id} s={s} />)}</div></div>
    </div>
  );
}
