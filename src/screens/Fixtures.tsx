import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, Seg, usePlayer } from '../components/ui';
import { fdrColor, fdrText } from '../components/viz';
import type { FixtureCell } from '../engine/analyze';

type Sort = 'fpl' | 'att' | 'def';

export function Fixtures() {
  const { t } = useI18n();
  const { analysis: a, raw } = useStore();
  const pl = usePlayer();
  const [sort, setSort] = useState<Sort>('fpl');
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
    </div>
  );
}
