import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { searchKey } from '../data/names';
import { MiniShirt, Money, openPlayer } from './ui';

const POS = ['', 'GKP', 'DEF', 'MID', 'FWD'];

/** Search any player by name; picking one opens his page (or calls onPick). */
export function PlayerSearch({ onPick, placeholder, exclude = [] }: { onPick?: (id: number) => void; placeholder?: string; exclude?: number[] }) {
  const { t } = useI18n();
  const { players, teams } = useStore();
  const [q, setQ] = useState('');
  const key = searchKey(q.trim());
  const results = key.length < 2 ? [] : [...players.values()]
    .filter((p) => !p.removed && !exclude.includes(p.id) && [p.web, `${p.first} ${p.second}`, teams.get(p.team)?.name ?? ''].some((n) => searchKey(n).includes(key)))
    .sort((a, b) => b.sel - a.sel)
    .slice(0, 8);
  const pick = (id: number) => { setQ(''); (onPick ?? openPlayer)(id); };
  return (
    <div style={{ position: 'relative', zIndex: 25 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? t('ps.placeholder')} aria-label={placeholder ?? t('ps.placeholder')} />
      {results.length > 0 && (
        <div className="card search-pop" role="listbox">
          {results.map((p) => (
            <button key={p.id} className="list-row search-row" onClick={() => pick(p.id)} role="option" aria-selected={false}>
              <MiniShirt id={p.id} />
              <div className="grow" style={{ minWidth: 0, textAlign: 'start' }}>
                <div className="name"><bdi dir="ltr">{p.web}</bdi> <span className="faint">· {teams.get(p.team)?.short}</span></div>
                <div className="sub">{POS[p.pos]} · <Money v={p.cost} /> · {p.sel.toFixed(1)}%</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
