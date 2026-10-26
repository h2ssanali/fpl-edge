import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Spark } from './viz';
import { IconArrowDown, IconArrowUp } from './icons';
import type { ManagerFile } from '../engine/types';

export function useMe(): ManagerFile | null {
  const { raw } = useStore();
  return raw?.managers.find((m) => m.id === raw.meta.teamId) ?? null;
}

const fmtRank = (r: number | null | undefined) => (r ? r.toLocaleString('en-US') : '—');

/** Green up / red down arrow, like the FPL site. Lower rank number = better. */
export function Movement({ now, before }: { now: number; before: number }) {
  if (!now || !before || now === before) return <span className="faint" aria-hidden style={{ fontWeight: 700 }}>●</span>;
  const up = now < before;
  return up
    ? <IconArrowUp width={18} height={18} className="good" style={{ strokeWidth: 3 }} aria-label="up" />
    : <IconArrowDown width={18} height={18} className="bad" style={{ strokeWidth: 3 }} aria-label="down" />;
}

/** Overall rank, points and gameweek summary for the current team. */
export function RankCard({ link = true }: { link?: boolean }) {
  const { t } = useI18n();
  const me = useMe();
  if (!me) return null;
  const hist = me.history;
  const last = hist.at(-1);
  const prev = hist.at(-2);
  const overall = me.entry.overallRank || last?.rank || 0;
  const body = (
    <>
      <div className="row between">
        <span className="card-label">{t('rank.overall')}</span>
        {link && <span className="card-link">{t('rank.myLeagues')}</span>}
      </div>
      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 6 }}>
        <Movement now={overall} before={prev?.rank ?? 0} />
        <span className="big-num">{fmtRank(overall)}</span>
      </div>
      <div className="kv" style={{ marginTop: 12 }}>
        <div><div className="k">{t('rank.gwPoints')}</div><div className="v">{me.entry.eventPoints ?? last?.pts ?? '—'}</div></div>
        <div><div className="k">{t('rank.total')}</div><div className="v">{me.entry.total || last?.total || '—'}</div></div>
        <div><div className="k">{t('rank.gwRank')}</div><div className="v" style={{ fontSize: '1.05rem' }}>{fmtRank(me.entry.eventRank || last?.gwRank)}</div></div>
      </div>
      {hist.length > 2 && (
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="tiny muted">{t('rank.trend')}</span>
          {/* negate so that climbing the rankings draws an upward line */}
          <Spark values={hist.map((h) => -h.rank)} width={140} height={30} />
        </div>
      )}
    </>
  );
  return link
    ? <a href="#/league" className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{body}</a>
    : <div className="card">{body}</div>;
}

/** Every classic league the team is in, with rank and movement; private leagues can be analysed. */
export function LeaguesList() {
  const { t } = useI18n();
  const { raw, setLeague, customLeague } = useStore();
  const me = useMe();
  if (!me || !raw) return null;
  const leagues = [...me.entry.leagues].sort((a, b) => (a.type === b.type ? a.rank - b.rank : a.type === 'x' ? -1 : 1));
  const active = customLeague ?? raw.meta.leagueIds[0];
  if (!leagues.length) return null;
  const typeLabel = (type: string, name: string) => (type === 'x' ? t('rank.private') : /^gameweek/i.test(name) ? t('rank.gwLeague') : t('rank.public'));
  return (
    <div className="card" style={{ padding: '6px 14px' }}>
      <div className="list">
        {leagues.map((l) => (
          <div key={l.id} className="list-row" style={{ background: l.id === active ? 'var(--accent-soft)' : undefined, margin: '0 -14px', padding: '10px 14px' }}>
            <Movement now={l.rank} before={l.lastRank} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="name">{l.name}</div>
              <div className="sub">{typeLabel(l.type, l.name)} · {t('rank.of', { n: fmtRank(l.count) })}</div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div className="num" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{fmtRank(l.rank)}</div>
              {l.type === 'x' && l.id !== active && <button className="btn small" style={{ marginTop: 4 }} onClick={() => setLeague(l.id)}>{t('rank.analyse')}</button>}
              {l.id === active && <span className="pill accent tiny">{t('rank.analysing')}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
