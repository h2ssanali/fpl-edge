import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, PName, usePlayer } from './ui';

type LeagueSwing = { blankRank: number | null; haulRank: number | null; baseRank: number | null; pBlank: number; pHaul: number };

const fmtRank = (r: number) => Math.round(r).toLocaleString('en-US');
const ordinal = (r: number | null) => (r == null ? '—' : String(Math.round(r)));

/**
 * "What if?": pick a player and see where you'd be after the gameweek if he blanks or
 * hauls — in your mini-league (exact, from the joint simulations) and in the world
 * (an estimate from global ownership).
 */
export function WhatIf() {
  const { t, pct } = useI18n();
  const { analysis: a, request } = useStore();
  const pl = usePlayer();
  const me = a?.me;
  const lg = a?.league;
  const world = me?.worldSwings ?? {};
  // Candidates: your starters plus the most-owned players among rivals / globally.
  const candidates = useMemo(() => {
    const ids = new Set<number>([...(me?.edge.xi ?? []).slice(0, 11)]);
    Object.entries(lg?.eo ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 6).forEach(([id]) => ids.add(Number(id)));
    Object.keys(world).forEach((id) => ids.add(Number(id)));
    return [...ids].filter((id) => world[id] || lg?.swings[id]).sort((x, y) => (world[y]?.eo ?? 0) - (world[x]?.eo ?? 0)).slice(0, 14);
  }, [me, lg, world]);
  const [sel, setSel] = useState<number | null>(null);
  const id = sel ?? candidates[0] ?? null;
  const [extra, setExtra] = useState<Record<number, LeagueSwing>>({});
  const lgSwing: LeagueSwing | null = id != null ? (lg?.swings[id] ?? extra[id] ?? null) : null;
  useEffect(() => {
    if (id == null || !lg || lg.swings[id] || extra[id]) return;
    request<LeagueSwing | null>('swing', { playerId: id }).then((s) => s && setExtra((e) => ({ ...e, [id]: s })));
  }, [id, lg, extra, request]);
  if (!me || id == null) return null;
  const w = world[id];
  const owned = (w?.mine ?? 0) > 0;
  return (
    <section className="card glass">
      <div className="row between">
        <div className="display" style={{ fontSize: '1.1rem' }}>{t('wi.title', { gw: a!.gw })}</div>
      </div>
      <p className="small muted" style={{ margin: '4px 0 10px' }}>{t('wi.sub')}</p>
      <div className="row" style={{ gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
        {candidates.map((c) => (
          <button key={c} className={`pill ${c === id ? 'accent' : ''}`} onClick={() => setSel(c)} style={{ cursor: 'pointer', flex: 'none' }}>
            <bdi dir="ltr">{pl.name(c)}</bdi>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <MiniShirt id={id} />
        <b><PName id={id} withTeam /></b>
        <span className={`pill ${owned ? 'good' : 'bad'}`}>{owned ? (w!.mine > 1 ? t('wi.captain') : t('lg.own')) : t('lg.notOwn')}</span>
      </div>
      {lg && lgSwing && (
        <div style={{ marginTop: 12 }}>
          <div className="card-label">{t('wi.inLeague', { name: lg.name })}</div>
          <div className="grid-2" style={{ marginTop: 6 }}>
            <div className="card" style={{ padding: 10 }}>
              <div className="tiny muted">{t('wi.ifBlank')} · {pct(lgSwing.pBlank)}</div>
              <div className="mid-num">{t('wi.rankN', { n: ordinal(lgSwing.blankRank) })}</div>
            </div>
            <div className="card" style={{ padding: 10 }}>
              <div className="tiny muted">{t('wi.ifHaul')} · {pct(lgSwing.pHaul)}</div>
              <div className="mid-num">{t('wi.rankN', { n: ordinal(lgSwing.haulRank) })}</div>
            </div>
          </div>
        </div>
      )}
      {w && (
        <div style={{ marginTop: 12 }}>
          <div className="card-label">{t('wi.inWorld')}</div>
          <div className="grid-2" style={{ marginTop: 6 }}>
            <div className="card" style={{ padding: 10 }}>
              <div className="tiny muted">{t('wi.ifBlankPts', { pts: w.blankPts })}</div>
              <div className={`num ${w.blankRank <= w.baseRank ? 'good' : 'bad'}`} style={{ fontWeight: 700, fontSize: '1.25rem' }}>{fmtRank(w.blankRank)}</div>
            </div>
            <div className="card" style={{ padding: 10 }}>
              <div className="tiny muted">{t('wi.ifHaulPts', { pts: w.haulPts })}</div>
              <div className={`num ${w.haulRank <= w.baseRank ? 'good' : 'bad'}`} style={{ fontWeight: 700, fontSize: '1.25rem' }}>{fmtRank(w.haulRank)}</div>
            </div>
          </div>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>{t('wi.worldNote', { eo: Math.round(w.eo * 100), base: fmtRank(w.baseRank) })}</p>
        </div>
      )}
    </section>
  );
}
