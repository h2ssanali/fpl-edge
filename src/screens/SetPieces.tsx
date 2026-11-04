import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, PName, Seg } from '../components/ui';
import type { Player } from '../engine/types';

type Kind = 'pen' | 'fk' | 'setp';

/** Penalty, free-kick and corner takers per club, from FPL's own set-piece order. */
export function SetPieces() {
  const { t } = useI18n();
  const { analysis: a, raw } = useStore();
  const [mode, setMode] = useState<'all' | 'mine'>('all');
  if (!a || !raw) return null;
  const mine = new Set(a.me?.squad.map((m) => m.id) ?? []);
  const notes = new Map((raw.core.setPieceNotes ?? []).map((n) => [n.team, n.notes]));
  const takers = (team: number, k: Kind) => raw.core.players
    .filter((p) => p.team === team && !p.removed && (p[k] ?? 0) > 0)
    .sort((x, y) => (x[k] ?? 9) - (y[k] ?? 9))
    .slice(0, 3);
  const teams = [...raw.core.teams]
    .filter((tm) => mode === 'all' || raw.core.players.some((p) => p.team === tm.id && mine.has(p.id)))
    .sort((x, y) => x.name.localeCompare(y.name));
  const line = (list: Player[]) => list.length
    ? <bdi dir="ltr">{list.map((p, i) => <span key={p.id}>{i > 0 && ' · '}<span className="num muted">{i + 1}.</span> <span className={mine.has(p.id) ? 'accent-text' : ''} style={{ fontWeight: i === 0 ? 700 : 400 }}><PName id={p.id} /></span></span>)}</bdi>
    : <span className="muted">—</span>;

  return (
    <div>
      <PageHeader title={t('sp.title')} sub={t('sp.sub')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('sp.explain')}</p></div>
      {a.me && (
        <div style={{ marginTop: 10 }}>
          <Seg full value={mode} onChange={setMode} options={[{ value: 'all', label: t('sp.all') }, { value: 'mine', label: t('sp.mine') }]} />
        </div>
      )}
      <div className="stack" style={{ marginTop: 10 }}>
        {teams.map((tm) => (
          <article key={tm.id} className="card" style={{ padding: '10px 14px' }}>
            <b className="num" style={{ fontSize: '1.05rem' }}>{tm.name}</b>
            <div className="small" style={{ marginTop: 6, lineHeight: 1.9 }}>
              <div><b>{t('sp.pen')}:</b> {line(takers(tm.id, 'pen'))}</div>
              <div><b>{t('sp.fk')}:</b> {line(takers(tm.id, 'fk'))}</div>
              <div><b>{t('sp.corners')}:</b> {line(takers(tm.id, 'setp'))}</div>
            </div>
            {(notes.get(tm.id) ?? []).length > 0 && (
              <ul className="tiny muted" dir="ltr" style={{ margin: '6px 0 0', paddingInlineStart: 16, textAlign: 'start' }}>
                {notes.get(tm.id)!.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </article>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: '10px 2px 0' }}>{t('sp.source')}</p>
    </div>
  );
}
