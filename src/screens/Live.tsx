import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, PageHeader, PName, usePlayer } from '../components/ui';
import { Pitch } from '../components/Pitch';
import { liveGw, useLive } from '../data/live';
import { fieldScore, liveRank, type LiveRow } from '../engine/live';
import { normCdf } from '../engine/math';

const fmtRank = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

export function Live() {
  const { t } = useI18n();
  const { analysis: a, raw, players } = useStore();
  const pl = usePlayer();
  const ev = raw ? liveGw(raw.core.events) : null;
  const me = a?.me ?? null;
  const { state, error, busy, refresh } = useLive({ gw: ev?.id ?? null, entry: me?.entry ?? null, leagueId: a?.league && !a.league.demo ? a.league.id : null, players });

  // The average manager's live score, for the rank estimate.
  const field = useMemo(() => {
    if (!raw || !state) return 0;
    const cap = new Map<number, number>();
    if (ev?.mostCaptained) cap.set(ev.mostCaptained, 0.45);
    const top = raw.top?.cap ?? {};
    const rest = Object.entries(top).filter(([id]) => Number(id) !== ev?.mostCaptained);
    const sum = rest.reduce((s, [, v]) => s + v, 0) || 1;
    for (const [id, v] of rest) cap.set(Number(id), (cap.get(Number(id)) ?? 0) + (ev?.mostCaptained ? 0.55 : 1) * (v / sum));
    return fieldScore(raw.core.players, (id) => (state.els.get(id)?.points ?? 0) + (state.bonus.get(id) ?? 0), cap);
  }, [raw, state, ev]);

  if (!a || !raw) return null;
  if (!ev) return <><PageHeader title={t('lv.title')} /><Empty>{t('lv.noGw')}</Empty></>;

  const gw = ev.id;
  const prev = me?.history.find((h) => h.gw === gw - 1);
  const prevFieldMean = raw.core.events.filter((e) => e.id < gw && e.avg > 0).reduce((s, e) => s + e.avg, 0);
  const team = state?.me ?? null;
  const rank = team && prev ? liveRank({ N: raw.core.totalPlayers, prevTotal: prev.total, prevRank: prev.rank, prevFieldMean, gwsBefore: gw - 1, myGw: team.net, fieldGw: field }) : null;
  const gwRank = team ? Math.max(1, Math.round(raw.core.totalPlayers * (1 - normCdf((team.net - field) / (4 + 0.22 * Math.max(field, 10)))))) : null;
  const started = state?.fixtures.some((f) => f.started) ?? false;
  const allDone = state ? state.fixtures.length > 0 && state.fixtures.every((f) => f.done) : false;

  return (
    <div>
      <PageHeader title={t('lv.title')} sub={t('lv.sub')} />
      <div className="row between small" style={{ marginBottom: 10 }}>
        <span className="pill">{!started ? t('lv.notStarted') : allDone ? t('lv.finished') : <><span className="live-dot" />{t('lv.live')}</>} · {t('gw')} {gw}</span>
        <button className="btn small" disabled={busy} onClick={refresh}>{busy ? t('lv.loading') : t('lv.refresh')}</button>
      </div>
      {error && !state && <div className="card"><p className="small bad" style={{ margin: 0 }}>{t('lv.error')}</p></div>}
      {!state && !error && <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>}

      {state && team && (
        <>
          <section className="card accent glass">
            <div className="row between" style={{ alignItems: 'flex-end' }}>
              <div>
                <div className="card-label">{t('lv.myPoints')}</div>
                <div className="big-num accent-text">{team.net}</div>
                <div className="tiny muted">{team.hits > 0 ? t('lv.hits', { pts: team.points, h: team.hits }) : t('lv.left', { n: team.left })}{team.chip && ` · ${t(`ch.${team.chip}`)}`}</div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div className="card-label">{t('lv.estRank')}</div>
                <div className="mid-num num">{rank ? fmtRank(rank) : '—'}</div>
                {rank && prev && <div className={`small ${rank <= prev.rank ? 'good' : 'bad'}`}>{rank <= prev.rank ? '▲' : '▼'} {t('lv.from', { r: fmtRank(prev.rank) })}</div>}
              </div>
            </div>
            <div className="facts">
              <span className="fact">{t('lv.avg')} <b>{Math.round(field)}</b></span>
              {gwRank && <span className="fact">{t('lv.gwRank')} <b>{fmtRank(gwRank)}</b></span>}
              <span className="fact">{t('lv.leftShort')} <b>{team.left}</b></span>
            </div>
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>{t('lv.rankNote')}</p>
          </section>

          <div style={{ marginTop: 12 }}>
            <Pitch
              xi={team.rows.filter((r) => (r.slot <= 11 && !r.subOut) || r.subIn).map((r) => ({ id: r.id, label: label(r), captain: r.mult >= 2, flag: r.status === 'out' ? 'out' : null }))}
              bench={team.rows.filter((r) => (r.slot > 11 && !r.subIn) || r.subOut).map((r) => ({ id: r.id, label: label(r), flag: r.status === 'out' ? 'out' : null }))}
            />
          </div>

          <h2 className="section-title">{t('lv.players')}</h2>
          <div className="card" style={{ padding: '4px 12px' }}>
            <div className="list">
              {team.rows.map((r) => (
                <div key={r.id} className="list-row" style={{ opacity: r.mult === 0 && !r.subOut ? 0.6 : 1 }}>
                  <MiniShirt id={r.id} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="name"><PName id={r.id} withTeam /> {r.mult >= 2 && <span className="pill accent">C{r.mult === 3 ? '×3' : ''}</span>} {r.subIn && <span className="pill good">{t('lv.subIn')}</span>} {r.subOut && <span className="pill bad">{t('lv.subOut')}</span>}</div>
                    <div className="sub">{t(`lv.st.${r.status}`)}{r.minutes > 0 && ` · ${r.minutes}'`}{r.bonus > 0 && ` · ${t('lv.bonus', { b: r.bonus })}`}{r.slot > 11 && !r.subIn && ` · ${t('lv.bench')}`}</div>
                  </div>
                  <div className="num" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{r.points * Math.max(1, r.mult)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {state && (
        <>
          <h2 className="section-title">{t('lv.matches')}</h2>
          <div className="stack">
            {[...state.fixtures].sort((x, y) => Number(y.started && !y.done) - Number(x.started && !x.done) || (x.kickoff ?? '').localeCompare(y.kickoff ?? '')).map((f) => {
              const top = [...state.els.values()].filter((e) => e.bps.has(f.id) && e.minutes > 0).sort((x, y) => y.bps.get(f.id)! - x.bps.get(f.id)!).slice(0, 3);
              return (
                <div key={f.id} className="card" style={{ padding: '8px 14px' }}>
                  <div className="row between" dir="ltr">
                    <b>{pl.teamShort(f.h)}</b>
                    <span className="num" style={{ fontWeight: 700 }}>{f.started ? `${f.hs ?? 0} – ${f.as ?? 0}` : f.kickoff ? new Date(f.kickoff).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    <b>{pl.teamShort(f.a)}</b>
                  </div>
                  {f.started && <div className="tiny muted" style={{ textAlign: 'center' }}>{f.done ? t('lv.ft') : `${f.minutes}'`}</div>}
                  {f.started && top.length > 0 && (
                    <div className="tiny" style={{ marginTop: 4 }}>
                      {t('lv.bps')}: {top.map((e, i) => <span key={e.id}>{i > 0 && ' · '}<PName id={e.id} /> <span className="num muted">{e.bps.get(f.id)}</span></span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {state && state.rivals.length > 0 && (
        <>
          <h2 className="section-title">{t('lv.league', { name: a.league?.name ?? '' })}</h2>
          {state.rivalsDone < state.rivals.length && <p className="tiny muted" style={{ marginTop: -4 }}>{t('lv.leagueLoading', { done: state.rivalsDone, total: state.rivals.length })}</p>}
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>#</th><th>{t('lv.manager')}</th><th>{t('lv.gwPts')}</th><th>{t('lv.total')}</th><th>{t('lv.cap')}</th><th>{t('lv.leftShort')}</th></tr></thead>
              <tbody>
                {[...state.rivals]
                  .map((r) => ({ ...r, live: r.prevTotal + (r.team?.net ?? 0) }))
                  .sort((x, y) => y.live - x.live)
                  .map((r, i) => (
                    <tr key={r.entry} className={r.entry === me?.entry ? 'me' : ''}>
                      <td className="num">{i + 1} {r.prevRank > i + 1 ? <span className="good">▲</span> : r.prevRank < i + 1 ? <span className="bad">▼</span> : null}</td>
                      <td><bdi dir="auto">{r.name}</bdi><div className="tiny muted"><bdi dir="auto">{r.player}</bdi></div></td>
                      <td className="num">{r.team ? r.team.net : '…'}</td>
                      <td className="num">{r.live}</td>
                      <td>{r.captain ? <PName id={r.captain} /> : '—'}</td>
                      <td className="num">{r.team ? r.team.left : '…'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ margin: '6px 2px 0' }}>{t('lv.leagueNote')}</p>
        </>
      )}
      {state && <p className="tiny muted" style={{ marginTop: 12 }}>{t('lv.updated', { time: new Date(state.updated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) })}</p>}
    </div>
  );
}

function label(r: LiveRow) {
  return `${r.points * Math.max(1, r.mult)}${r.status === 'playing' ? '•' : ''}`;
}

