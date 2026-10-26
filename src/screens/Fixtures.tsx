import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, Seg, usePlayer } from '../components/ui';
import { fdrColor } from '../components/viz';
import type { FixtureCell } from '../engine/analyze';

type Sort = 'overall' | 'att' | 'def';

export function Fixtures() {
  const { t } = useI18n();
  const { analysis: a, raw } = useStore();
  const pl = usePlayer();
  const [sort, setSort] = useState<Sort>('overall');
  if (!a || !raw) return null;
  const gws = a.horizon.slice(0, 8);
  const score = (cells: FixtureCell[][]) => cells.slice(0, 8).reduce((s, fx) => {
    if (!fx.length) return s + 5.5; // blank = worst
    // Doubles count as two fixtures (easier overall).
    return s + fx.reduce((x, f) => x + (sort === 'att' ? f.att : sort === 'def' ? f.def : f.overall), 0) / fx.length - (fx.length - 1) * 2;
  }, 0);
  const teams = [...raw.core.teams].sort((x, y) => score(a.grid[x.id] ?? []) - score(a.grid[y.id] ?? []));
  return (
    <div>
      <PageHeader title={t('fx.title')} sub={t('fx.sub')} back="#/more" />
      <Seg full value={sort} onChange={setSort} options={[{ value: 'overall', label: t('fx.sortAll') }, { value: 'att', label: t('fx.sortAtt') }, { value: 'def', label: t('fx.sortDef') }]} />
      <div className="row small muted" style={{ gap: 10, margin: '10px 2px' }}>
        {[1, 2, 3, 4, 5].map((f) => <span key={f} className="row" style={{ gap: 4 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: fdrColor(f), display: 'inline-block' }} /><span className="num">{f}</span></span>)}
        <span className="row" style={{ gap: 4 }}><i className="tk double" style={{ width: 14, height: 12, minWidth: 0, padding: 0, display: 'inline-block' }} />{t('fx.dgw')}</span>
        <span className="row" style={{ gap: 4 }}><i className="tk blank" style={{ width: 14, height: 12, minWidth: 0, padding: 0, display: 'inline-block' }} />{t('fx.bgw')}</span>
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
                  const val = (f: FixtureCell) => (sort === 'att' ? f.att : sort === 'def' ? f.def : f.overall);
                  return (
                    <td key={i}>
                      <div className={`tk ${fx.length > 1 ? 'double tk-dbl' : ''}`} style={{ background: fx.length > 1 ? 'transparent' : fdrColor(val(fx[0])), padding: fx.length > 1 ? 2 : undefined }}>
                        {fx.map((f, j) => (
                          <div key={j} className={`tk f${Math.round(val(f))}`} style={{ background: fdrColor(val(f)), minWidth: 0, padding: fx.length > 1 ? '2px' : 0 }}>
                            {pl.teamShort(f.opp)}<small>{f.home ? 'H' : 'A'} · {(sort === 'def' ? f.la : f.lf).toFixed(1)}</small>
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
