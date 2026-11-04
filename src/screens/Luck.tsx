import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Seg, usePlayer } from '../components/ui';
import { useGwHistory } from './Player';

type Span = 'season' | 'recent';
type Pos = 0 | 2 | 3 | 4;

interface Row { id: number; g: number; a: number; xg: number; xa: number; mins: number; diff: number }

/**
 * Lucky or unlucky? Real goals + assists against expected (xG + xA, FPL/Opta).
 * A player well below his xGI is getting chances and is "due"; one far above is
 * finishing at a rate that rarely lasts.
 */
export function Luck() {
  const { t, fmt } = useI18n();
  const { analysis: a, players } = useStore();
  const pl = usePlayer();
  const hist = useGwHistory();
  const [span, setSpan] = useState<Span>('season');
  const [pos, setPos] = useState<Pos>(0);
  if (!a) return null;
  const mine = new Set(a.me?.squad.map((m) => m.id) ?? []);
  const recentGws = [...hist.keys()].sort((x, y) => x - y).slice(-6);

  const rows: Row[] = [];
  for (const p of players.values()) {
    if (p.pos === 1 || (pos && p.pos !== pos) || p.removed) continue;
    let g = p.g, as = p.a, xg = p.xg, xa = p.xa, mins = p.mins;
    if (span === 'recent') {
      g = 0; as = 0; xg = 0; xa = 0; mins = 0;
      for (const gw of recentGws) {
        const r = hist.get(gw)?.get(p.id);
        if (!r) continue;
        g += r.g; as += r.a; xg += r.xg; xa += r.xa; mins += r.mins;
      }
    }
    if (mins < (span === 'season' ? 360 : 180)) continue;
    rows.push({ id: p.id, g, a: as, xg, xa, mins, diff: g + as - (xg + xa) });
  }
  // Only players still likely to play are worth acting on.
  const playing = (id: number) => (a.players[id]?.pStart ?? 0) >= 0.5;
  const unlucky = rows.filter((r) => playing(r.id)).sort((x, y) => x.diff - y.diff).slice(0, 12);
  const lucky = [...rows].sort((x, y) => y.diff - x.diff).slice(0, 12);

  const card = (r: Row, kind: 'due' | 'hot') => {
    const max = Math.max(r.g + r.a, r.xg + r.xa, 1);
    return (
      <article key={r.id} className="card" style={{ padding: '10px 14px' }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ minWidth: 0 }}>
            <MiniShirt id={r.id} />
            <div style={{ minWidth: 0 }}>
              <div className="name"><PName id={r.id} withTeam /> {mine.has(r.id) && <span className="pill accent">{t('dc.yours')}</span>}</div>
              <div className="sub"><Money v={pl.p(r.id)?.cost ?? 0} /> · {t('fx.owned', { p: (pl.p(r.id)?.sel ?? 0).toFixed(1) })} · {r.mins}'</div>
            </div>
          </div>
          <div style={{ textAlign: 'end', minWidth: 64 }}>
            <div className={`num ${kind === 'due' ? 'good' : 'warn'}`} style={{ fontWeight: 700, fontSize: '1.2rem' }}>{r.diff > 0 ? '+' : ''}{fmt(r.diff)}</div>
            <div className="tiny muted">{t('lk.diffLbl')}</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }} dir="ltr">
          <div className="row" style={{ gap: 6 }}>
            <span className="tiny muted" style={{ width: 54 }}>{t('lk.real')}</span>
            <div className="grow bar"><i style={{ width: `${((r.g + r.a) / max) * 100}%`, background: 'var(--text)' }} /></div>
            <span className="num small" style={{ width: 40, textAlign: 'right' }}>{r.g + r.a}</span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <span className="tiny muted" style={{ width: 54 }}>{t('lk.expected')}</span>
            <div className="grow bar"><i style={{ width: `${((r.xg + r.xa) / max) * 100}%`, background: 'var(--accent)' }} /></div>
            <span className="num small" style={{ width: 40, textAlign: 'right' }}>{fmt(r.xg + r.xa)}</span>
          </div>
        </div>
        <div className="facts">
          <span className="fact">{t('pp.goals')} <b>{r.g}</b> <span className="muted">/ xG {fmt(r.xg)}</span></span>
          <span className="fact">{t('pp.assists')} <b>{r.a}</b> <span className="muted">/ xA {fmt(r.xa)}</span></span>
          <span className="fact">xGI/90 <b>{fmt(((r.xg + r.xa) / r.mins) * 90, 2)}</b></span>
          <span className="fact">{t('dc.next6')} <b>{fmt((a.players[r.id]?.xp ?? []).slice(0, 6).reduce((s, x) => s + x, 0))}</b></span>
        </div>
      </article>
    );
  };

  return (
    <div>
      <PageHeader title={t('lk.title')} sub={t('lk.sub')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('lk.explain')}</p></div>
      <div style={{ marginTop: 12 }}>
        <Seg full value={span} onChange={setSpan} options={[{ value: 'season', label: t('lk.season') }, { value: 'recent', label: t('lk.recent') }]} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Seg full value={pos} onChange={setPos} options={[{ value: 0, label: t('tr.all') }, { value: 2, label: t('dc.def') }, { value: 3, label: t('dc.mid') }, { value: 4, label: t('dc.fwd') }]} />
      </div>

      <h2 className="section-title">{t('lk.dueTitle')}</h2>
      <p className="small muted" style={{ marginTop: -4 }}>{t('lk.dueSub')}</p>
      <div className="stack">{unlucky.map((r) => card(r, 'due'))}</div>

      <h2 className="section-title">{t('lk.hotTitle')}</h2>
      <p className="small muted" style={{ marginTop: -4 }}>{t('lk.hotSub')}</p>
      <div className="stack">{lucky.map((r) => card(r, 'hot'))}</div>
      <p className="tiny muted" style={{ margin: '10px 2px 0', lineHeight: 1.7 }}>{t('lk.note')}</p>
    </div>
  );
}
