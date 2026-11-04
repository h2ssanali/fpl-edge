import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, Money, PageHeader, Reasons, usePlayer } from '../components/ui';
import { Shirt } from '../components/Shirt';
import { fdrColor, fdrText, Spark } from '../components/viz';
import { parseLive } from '../engine/data';
import { hashId } from '../data/hash';
import type { LiveRow } from '../engine/types';

const POS = ['', 'GKP', 'DEF', 'MID', 'FWD'];

/** Each player's points/minutes per played GW, parsed once from the live files. */
export function useGwHistory() {
  const { raw } = useStore();
  return useMemo(() => {
    const out = new Map<number, Map<number, LiveRow>>();
    for (const f of raw?.live ?? []) out.set(f.gw, parseLive(f));
    return out;
  }, [raw]);
}

export function Player() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a, players, raw } = useStore();
  const pl = usePlayer();
  const hist = useGwHistory();
  const id = hashId();
  const p = players.get(id);
  if (!a || !raw) return null;
  if (!p) return <><PageHeader title={t('pp.notFound')} back="#/more" /><Empty>—</Empty></>;

  const s = a.players[id];
  const gws = [...hist.keys()].sort((x, y) => x - y).slice(-6);
  const form = gws.map((g) => ({ gw: g, row: hist.get(g)?.get(id) ?? null }));
  const dc = a.defcon.find((r) => r.id === id);
  const price = a.prices.find((r) => r.id === id);
  const mine = a.me?.squad.some((m) => m.id === id);
  const per90 = (v: number) => (p.mins >= 90 ? (v / p.mins) * 90 : 0);
  const sp = [p.pen && t('pp.pen', { n: p.pen }), p.fk && t('pp.fk', { n: p.fk }), p.setp && t('pp.corners', { n: p.setp })].filter(Boolean) as string[];
  const flagged = p.status !== 'a' || (p.cop != null && p.cop < 100);

  return (
    <div>
      <PageHeader title={p.web} back="#/more" />
      <section className="card glass">
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 64 }}><Shirt team={pl.team(id)} gk={p.pos === 1} /></div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: '1.2rem' }}><bdi dir="ltr">{p.first} {p.second}</bdi></div>
            <div className="small muted">{raw.core.teams.find((x) => x.id === p.team)?.name} · {POS[p.pos]}</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
              <span className="pill"><Money v={p.cost} /></span>
              <span className="pill">{t('fx.owned', { p: p.sel.toFixed(1) })}</span>
              {mine && <span className="pill accent">{t('dc.yours')}</span>}
            </div>
          </div>
        </div>
        {flagged && (
          <div className="card" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--surface-2)' }}>
            <b className={p.status === 'i' || p.status === 's' || p.status === 'u' ? 'bad' : 'warn'}>{p.cop != null ? t('pp.chance', { p: p.cop }) : t('pp.flag')}</b>
            {p.news && <div className="small" dir="ltr" style={{ textAlign: 'start' }}>{p.news}</div>}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <a className="btn small primary" href={`#/compare?a=${id}`}>{t('pp.compare')}</a>
        </div>
      </section>

      <h2 className="section-title">{t('pp.next')}</h2>
      <div className="card" style={{ padding: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          {a.horizon.slice(0, 6).map((g, gi) => {
            const cells = a.grid[p.team]?.[gi] ?? [];
            return (
              <div key={g} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <div className="tiny muted num">{t('gwShort')}{g}</div>
                {cells.length ? cells.map((f, k) => (
                  <div key={k} className="tiny num" style={{ background: fdrColor(f.fdr), color: fdrText(f.fdr), borderRadius: 6, padding: '3px 0', marginTop: 2, fontWeight: 700 }}>
                    {pl.teamShort(f.opp)}{f.home ? '' : '*'}
                  </div>
                )) : <div className="tiny muted" style={{ padding: '3px 0', marginTop: 2 }}>—</div>}
                <div className="num" style={{ fontWeight: 700, marginTop: 4 }}>{fmt(s?.xp[gi] ?? 0)}</div>
              </div>
            );
          })}
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t('pp.nextNote', { total: fmt((s?.xp ?? []).slice(0, 6).reduce((x, y) => x + y, 0)) })}</p>
        {s && <Reasons reasons={s.reasons} max={6} />}
      </div>

      <h2 className="section-title">{t('pp.form')}</h2>
      <div className="card" style={{ padding: 10 }}>
        <div className="row" style={{ gap: 6 }} dir="ltr">
          {form.map(({ gw, row }) => (
            <div key={gw} style={{ flex: 1, textAlign: 'center' }}>
              <div className="num" style={{ fontWeight: 700, borderRadius: 8, padding: '4px 0', background: !row || row.mins === 0 ? 'transparent' : row.pts >= 6 ? 'var(--good)' : 'var(--surface-2)', color: row && row.pts >= 6 ? '#0b0f14' : undefined, border: !row || row.mins === 0 ? '1px dashed var(--border)' : '1px solid transparent' }}>
                {row && row.mins > 0 ? row.pts : '–'}
              </div>
              <div className="tiny muted num">{t('gwShort')}{gw}</div>
              <div className="tiny faint num">{row?.mins ?? 0}'</div>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>{t('pp.formNote')}</p>
      </div>

      <h2 className="section-title">{t('pp.season')}</h2>
      <div className="facts" style={{ marginTop: 0 }}>
        <span className="fact">{t('pp.total')} <b>{p.total}</b></span>
        <span className="fact">{t('pp.ppg')} <b>{p.ppg}</b></span>
        <span className="fact">{t('pp.mins')} <b>{p.mins}</b></span>
        <span className="fact">{t('pp.goals')} <b>{p.g}</b> <span className="muted">(xG {fmt(p.xg)})</span></span>
        <span className="fact">{t('pp.assists')} <b>{p.a}</b> <span className="muted">(xA {fmt(p.xa)})</span></span>
        {p.pos <= 2 && <span className="fact">{t('pCS')} <b>{p.cs}</b></span>}
        {p.pos === 1 && <span className="fact">{t('pp.saves')} <b>{p.saves}</b></span>}
        <span className="fact">{t('pp.bonus')} <b>{p.bonus}</b></span>
        <span className="fact">xG+xA / 90 <b>{fmt(per90(p.xg + p.xa), 2)}</b></span>
        {s && <span className="fact">{t('cap.fStart')} <b>{pct(s.pStart)}</b></span>}
      </div>

      {dc && (
        <>
          <h2 className="section-title">DEFCON</h2>
          <div className="facts" style={{ marginTop: 0 }}>
            <span className="fact">{t('dc.hits')} <b>{dc.hits}/{dc.full}</b></span>
            <span className="fact">{t('dc.per90')} <b>{fmt(dc.per90)}</b> <span className="muted">({t('dc.need', { n: dc.threshold })})</span></span>
            <span className="fact">{t('dc.seasonPts')} <b>{dc.pts}</b></span>
            <span className="fact">{t('dc.next6')} <b>{fmt(dc.xPts6)}</b></span>
          </div>
        </>
      )}

      {sp.length > 0 && (
        <>
          <h2 className="section-title">{t('sp.title')}</h2>
          <div className="facts" style={{ marginTop: 0 }}>{sp.map((x) => <span key={x} className="fact">{x}</span>)}</div>
        </>
      )}

      <h2 className="section-title">{t('pp.price')}</h2>
      <div className="card">
        <div className="row between">
          <div>
            <div className="mid-num"><Money v={p.cost} /></div>
            <div className="small muted">{t('pp.sinceStart')}: <span className={`num ${p.ccs > 0 ? 'good' : p.ccs < 0 ? 'bad' : ''}`}>{p.ccs > 0 ? '+' : ''}{(p.ccs / 10).toFixed(1)}</span></div>
          </div>
          {price && <Spark values={price.trend} width={90} height={30} />}
        </div>
        <div className="facts">
          <span className="fact">{t('pp.in')} <b>{p.tin.toLocaleString('en')}</b></span>
          <span className="fact">{t('pp.out')} <b>{p.tout.toLocaleString('en')}</b></span>
          {price && <span className={`fact ${price.direction === 'rise' ? 'good' : 'bad'}`}>{t(price.direction === 'rise' ? 'pp.rising' : 'pp.falling', { p: fmt(Math.abs(price.progress), 0) })}</span>}
        </div>
      </div>
    </div>
  );
}
