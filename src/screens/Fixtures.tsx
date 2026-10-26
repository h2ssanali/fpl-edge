import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Seg, usePlayer } from '../components/ui';
import { fdrColor, fdrText } from '../components/viz';
import type { FixtureCell } from '../engine/analyze';

type Sort = 'fpl' | 'att' | 'def';

export function Fixtures() {
  const { t } = useI18n();
  const { analysis: a, raw } = useStore();
  const pl = usePlayer();
  const [sort, setSort] = useState<Sort>('fpl');
  const [pickMode, setPickMode] = useState<'att' | 'def'>('att');
  if (!a || !raw) return null;
  const gws = a.horizon.slice(0, 8);
  const val = (f: FixtureCell) => (sort === 'att' ? f.att : sort === 'def' ? f.def : f.fdr);
  const score = (cells: FixtureCell[][]) => cells.slice(0, 8).reduce((s, fx) => {
    if (!fx.length) return s + 5.5; // blank = worst
    // A double gameweek counts as easier overall (two chances to score).
    return s + fx.reduce((x, f) => x + val(f), 0) / fx.length - (fx.length - 1) * 2;
  }, 0);
  const teams = [...raw.core.teams].sort((x, y) => score(a.grid[x.id] ?? []) - score(a.grid[y.id] ?? []));
  return (
    <div>
      <PageHeader title={t('fx.title')} sub={sort === 'fpl' ? t('fx.subFpl') : t('fx.subEdge')} back="#/more" />
      <Seg full value={sort} onChange={setSort} options={[{ value: 'fpl', label: t('fx.sortFpl') }, { value: 'att', label: t('fx.sortAtt') }, { value: 'def', label: t('fx.sortDef') }]} />
      <div className="row wrap small muted" style={{ gap: 10, margin: '10px 2px' }}>
        <span>{t('fx.easy')}</span>
        {[1, 2, 3, 4, 5].map((f) => <span key={f} className="num" style={{ width: 24, height: 20, borderRadius: 4, background: fdrColor(f), color: fdrText(f), display: 'inline-grid', placeItems: 'center', fontWeight: 700 }}>{f}</span>)}
        <span>{t('fx.hard')}</span>
        <span className="row" style={{ gap: 4 }}><i className="tk double" style={{ width: 16, height: 14, minWidth: 0, padding: 0, display: 'inline-block' }} />{t('fx.dgw')}</span>
        <span className="row" style={{ gap: 4 }}><i className="tk blank" style={{ width: 16, height: 14, minWidth: 0, padding: 0, display: 'inline-block' }} />{t('fx.bgw')}</span>
      </div>
      <div className="table-scroll" dir="ltr">
        <table className="ticker">
          <thead><tr><th />{gws.map((g) => <th key={g}>{t('gwShort')}{g}</th>)}</tr></thead>
          <tbody>
            {teams.map((tm) => (
              <tr key={tm.id}>
                <td className="team">{tm.short}</td>
                {(a.grid[tm.id] ?? []).slice(0, 8).map((fx, i) => {
                  if (!fx.length) return <td key={i}><div className="tk blank">—</div></td>;
                  return (
                    <td key={i}>
                      <div className={fx.length > 1 ? 'tk double tk-dbl' : ''} style={fx.length > 1 ? { padding: 2 } : undefined}>
                        {fx.map((f, j) => (
                          <div key={j} className="tk" style={{ background: fdrColor(val(f)), color: fdrText(val(f)), padding: fx.length > 1 ? '2px' : undefined }}>
                            {pl.teamShort(f.opp)}<small>{f.home ? 'H' : 'A'}</small>
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">{t('fx.picksTitle', { from: gws[0], to: gws[Math.min(5, gws.length - 1)] })}</h2>
      <p className="small muted" style={{ marginTop: -4 }}>{t('fx.picksSub')}</p>
      <Seg full value={pickMode} onChange={setPickMode} options={[{ value: 'att', label: t('fx.pickAtt') }, { value: 'def', label: t('fx.pickDef') }]} />
      <div className="stack" style={{ marginTop: 10 }}>
        {[...raw.core.teams]
          .sort((x, y) => {
            // Rank clubs by how kind the next 6 fixtures are for this kind of player.
            const run = (id: number) => (a.grid[id] ?? []).slice(0, 6).reduce((s, fx) => s + (fx.length ? fx.reduce((q, f) => q + (pickMode === 'att' ? f.att : f.def), 0) / fx.length - (fx.length - 1) * 2 : 5.5), 0);
            return run(x.id) - run(y.id);
          })
          .slice(0, 8)
          .map((tm) => {
            const xp6 = (id: number) => (a.players[id]?.xp ?? []).slice(0, 6).reduce((s, v) => s + v, 0);
            const picks = raw.core.players
              .filter((p) => p.team === tm.id && (pickMode === 'att' ? p.pos >= 3 : p.pos <= 2) && (a.players[p.id]?.pStart ?? 0) > 0.5)
              .sort((x, y) => xp6(y.id) - xp6(x.id))
              .slice(0, 3);
            const run = (a.grid[tm.id] ?? []).slice(0, 4).map((fx) => fx.map((f) => `${pl.teamShort(f.opp)}${f.home ? '(H)' : '(A)'}`).join('+') || '—').join(' · ');
            return (
              <div key={tm.id} className="card" style={{ padding: '10px 14px' }}>
                <div className="row between">
                  <b className="num" style={{ fontSize: '1.1rem' }}>{tm.name}</b>
                  <span className="tiny muted num" dir="ltr">{run}</span>
                </div>
                <div className="list">
                  {picks.map((p) => (
                    <div key={p.id} className="list-row" style={{ padding: '6px 0' }}>
                      <MiniShirt id={p.id} />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="name"><PName id={p.id} /></div>
                        <div className="sub">{['', 'GKP', 'DEF', 'MID', 'FWD'][p.pos]} · <Money v={p.cost} /> · {t('fx.owned', { p: p.sel.toFixed(1) })}</div>
                      </div>
                      <div style={{ textAlign: 'end' }}>
                        <div className="num" style={{ fontWeight: 700 }}>{xp6(p.id).toFixed(1)}</div>
                        <div className="tiny muted">{t('fx.pts6')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
