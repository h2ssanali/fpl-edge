import type { ReactNode } from 'react';
import { Shirt } from './Shirt';
import { usePlayer } from './ui';
import type { Pos } from '../engine/types';

export interface PitchPlayer {
  id: number;
  label?: ReactNode; // value chip under the name
  captain?: boolean;
  vice?: boolean;
  flag?: 'doubt' | 'out' | null;
  selected?: boolean;
}

/**
 * A real pitch view: lines drawn in SVG, players arranged by position rows,
 * shirts in club colours, bench underneath.
 */
export function Pitch({ xi, bench, onTap, dropTarget }: {
  xi: PitchPlayer[]; bench?: PitchPlayer[]; onTap?: (id: number) => void; dropTarget?: boolean;
}) {
  const pl = usePlayer();
  const rows: Record<Pos, PitchPlayer[]> = { 1: [], 2: [], 3: [], 4: [] };
  xi.forEach((p) => { const pos = pl.p(p.id)?.pos as Pos | undefined; if (pos) rows[pos].push(p); });
  const render = (p: PitchPlayer) => (
    <div
      key={p.id}
      className={`pp ${p.selected ? 'selected' : ''} ${dropTarget ? 'drop-zone' : ''}`}
      data-drop-id={dropTarget ? p.id : undefined}
      onClick={onTap ? () => onTap(p.id) : undefined}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') onTap(p.id); } : undefined}
    >
      <Shirt team={pl.team(p.id)} gk={pl.p(p.id)?.pos === 1} />
      {p.captain && <span className="pp-badge">C</span>}
      {p.vice && <span className="pp-badge vice">V</span>}
      {p.flag && <span className={`pp-flag ${p.flag === 'out' ? 'out' : ''}`} />}
      <span className="pp-name">{pl.name(p.id)}</span>
      {p.label !== undefined && <span className="pp-val">{p.label}</span>}
    </div>
  );
  return (
    <div className="pitch">
      <svg className="pitch-lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke="#fff" strokeWidth="0.5">
          <rect x="3" y="3" width="94" height="134" />
          <line x1="3" y1="70" x2="97" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <rect x="25" y="3" width="50" height="18" />
          <rect x="38" y="3" width="24" height="7" />
          <rect x="25" y="119" width="50" height="18" />
          <rect x="38" y="130" width="24" height="7" />
          <path d="M40 21 A12 12 0 0 0 60 21" />
          <path d="M40 119 A12 12 0 0 1 60 119" />
        </g>
      </svg>
      {([1, 2, 3, 4] as Pos[]).map((pos) => <div key={pos} className="pitch-row">{rows[pos].map(render)}</div>)}
      {bench && bench.length > 0 && <div className="pitch-bench">{bench.map(render)}</div>}
    </div>
  );
}
