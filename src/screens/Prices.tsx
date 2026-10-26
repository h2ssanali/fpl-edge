import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, Money, PageHeader, PName, useNow, usePlayer } from '../components/ui';
import { Bar, Spark } from '../components/viz';
import type { PriceSignal } from '../engine/insights';

/**
 * When FPL next changes prices. FPL publishes the times (price_change_deadlines);
 * if that list has run out we fall back to the usual ~01:30 UK time.
 */
export function nextPriceChange(deadlines: string[], now = Date.now()): Date {
  const next = deadlines.map((d) => new Date(d)).filter((d) => d.getTime() > now).sort((a, b) => a.getTime() - b.getTime())[0];
  if (next) return next;
  const london = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  const base = new Date(now);
  for (let day = 0; day < 3; day++) {
    for (const offset of [0, 60]) { // GMT or BST
      const c = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + day, 1, 30) - offset * 60000);
      if (c.getTime() > now && london(c) === '01:30') return c;
    }
  }
  return new Date(now + 86400000);
}

function useTimeLabel() {
  const { lang } = useI18n();
  return (d: Date) => d.toLocaleTimeString(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { hour: 'numeric', minute: '2-digit' });
}

function Row({ s, at }: { s: PriceSignal; at: Date }) {
  const { t, fmt } = useI18n();
  const time = useTimeLabel();
  const pl = usePlayer();
  const p = pl.p(s.id);
  const rise = s.direction === 'rise';
  return (
    <div className="list-row">
      <MiniShirt id={s.id} />
      <div className="grow">
        <div className="name"><PName id={s.id} withTeam /> {s.tonight && <span className={`pill ${rise ? 'good' : 'bad'}`}>{t('pr.tonightAt', { time: time(at) })}</span>}</div>
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
  const { t, lang } = useI18n();
  const { analysis: a, raw } = useStore();
  const now = useNow(60000);
  const time = useTimeLabel();
  if (!a || !raw) return null;
  const at = nextPriceChange(raw.core.rules.priceChangeDeadlines ?? [], now);
  const mins = Math.max(0, Math.round((at.getTime() - now) / 60000));
  const day = at.toLocaleDateString(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { weekday: 'long' });
  const mine = new Set(a.me?.squad.map((s) => s.id) ?? []);
  const risers = a.prices.filter((s) => s.direction === 'rise');
  const fallers = a.prices.filter((s) => s.direction === 'fall');
  const myAlerts = a.prices.filter((s) => mine.has(s.id) && (s.tonight || Math.abs(s.progress) > 70));
  const values = a.me?.history.map((h) => h.value / 10) ?? [];
  return (
    <div>
      <PageHeader title={t('pr.title')} sub={t('pr.sub')} back="#/more" />
      <div className="card accent" style={{ marginBottom: 12 }}>
        <div className="card-label">{t('pr.nextChange')}</div>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <div className="mid-num accent-text">{day} · {time(at)}</div>
          <div className="small muted">{t('pr.inTime', { h: Math.floor(mins / 60), m: mins % 60 })}</div>
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>{t('pr.timeNote')}</div>
      </div>
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
        {myAlerts.length ? <div className="list">{myAlerts.map((s) => <Row key={s.id} s={s} at={at} />)}</div> : <Empty>{t('pr.noAlerts')}</Empty>}
      </div>
      <h2 className="section-title">{t('pr.risers')} <span className="hint">{t('pr.buyBefore')}</span></h2>
      <div className="card" style={{ padding: '4px 12px' }}><div className="list">{risers.slice(0, 15).map((s) => <Row key={s.id} s={s} at={at} />)}</div></div>
      <h2 className="section-title">{t('pr.fallers')} <span className="hint">{t('pr.sellBefore')}</span></h2>
      <div className="card" style={{ padding: '4px 12px' }}><div className="list">{fallers.slice(0, 15).map((s) => <Row key={s.id} s={s} at={at} />)}</div></div>
    </div>
  );
}
