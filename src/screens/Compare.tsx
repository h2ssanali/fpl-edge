import { useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Reasons, usePlayer } from '../components/ui';
import { PlayerSearch } from '../components/PlayerSearch';
import { fdrColor, fdrText } from '../components/viz';
import { hashParams } from '../data/hash';
import { useGwHistory } from './Player';

/** Two players side by side over the next gameweeks, with a plain verdict. */
export function Compare() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a, players } = useStore();
  const pl = usePlayer();
  const hist = useGwHistory();
  const params = hashParams();
  const [ids, setIds] = useState<[number, number]>([Number(params.get('a')) || 0, Number(params.get('b')) || 0]);
  const [horizon, setHorizon] = useState(6);
  if (!a) return null;

  const set = (i: 0 | 1, id: number) => {
    const next: [number, number] = i === 0 ? [id, ids[1]] : [ids[0], id];
    setIds(next);
    window.history.replaceState(null, '', `#/compare?a=${next[0] || ''}&b=${next[1] || ''}`);
  };
  const xp = (id: number) => (a.players[id]?.xp ?? []).slice(0, horizon).reduce((s, x) => s + x, 0);
  const lastGws = [...hist.keys()].sort((x, y) => x - y).slice(-5);
  const form = (id: number) => lastGws.reduce((s, g) => s + (hist.get(g)?.get(id)?.pts ?? 0), 0);
  const dc = (id: number) => a.defcon.find((r) => r.id === id);
  const [A, B] = ids.map((id) => players.get(id));

  const slot = (i: 0 | 1) => {
    const p = i === 0 ? A : B;
    return (
      <div className="card" style={{ padding: 10, minWidth: 0 }}>
        {p ? (
          <div className="row between">
            <div className="row" style={{ minWidth: 0 }}><MiniShirt id={p.id} /><div style={{ minWidth: 0 }}><div className="name"><PName id={p.id} /></div><div className="sub">{pl.team(p.id)} · <Money v={p.cost} /></div></div></div>
            <button className="btn small ghost" onClick={() => set(i, 0)} aria-label="clear">×</button>
          </div>
        ) : <PlayerSearch onPick={(id) => set(i, id)} placeholder={t(i === 0 ? 'cmp.pickA' : 'cmp.pickB')} exclude={ids} />}
      </div>
    );
  };

  const rows: { k: string; a: ReactNode; b: ReactNode; better?: 0 | 1 | null }[] = [];
  if (A && B) {
    const cmp = (x: number, y: number, higherBetter = true): 0 | 1 | null => (Math.abs(x - y) < 1e-9 ? null : (x > y) === higherBetter ? 0 : 1);
    const ra = a.players[A.id], rb = a.players[B.id];
    rows.push({ k: t('cmp.xp', { n: horizon }), a: fmt(xp(A.id)), b: fmt(xp(B.id)), better: cmp(xp(A.id), xp(B.id)) });
    rows.push({ k: t('pp.price'), a: <Money v={A.cost} />, b: <Money v={B.cost} />, better: cmp(A.cost, B.cost, false) });
    rows.push({ k: t('cmp.perM'), a: fmt(xp(A.id) / (A.cost / 10), 2), b: fmt(xp(B.id) / (B.cost / 10), 2), better: cmp(xp(A.id) / A.cost, xp(B.id) / B.cost) });
    rows.push({ k: t('cmp.form'), a: form(A.id), b: form(B.id), better: cmp(form(A.id), form(B.id)) });
    rows.push({ k: t('cap.fStart'), a: pct(ra?.pStart ?? 0), b: pct(rb?.pStart ?? 0), better: cmp(ra?.pStart ?? 0, rb?.pStart ?? 0) });
    rows.push({ k: t('pp.total'), a: A.total, b: B.total, better: cmp(A.total, B.total) });
    rows.push({ k: 'xG + xA', a: fmt(A.xg + A.xa), b: fmt(B.xg + B.xa), better: cmp(A.xg + A.xa, B.xg + B.xa) });
    const da = dc(A.id), db = dc(B.id);
    if (da || db) rows.push({ k: t('cmp.dc'), a: da ? `${da.hits}/${da.full}` : '—', b: db ? `${db.hits}/${db.full}` : '—', better: cmp(da?.rate ?? 0, db?.rate ?? 0) });
    rows.push({ k: t('fx.ownedShort'), a: `${A.sel.toFixed(1)}%`, b: `${B.sel.toFixed(1)}%`, better: null });
  }

  const winner = A && B ? (xp(A.id) >= xp(B.id) ? A : B) : null;
  const loser = winner && (winner === A ? B : A);
  const diff = A && B ? Math.abs(xp(A.id) - xp(B.id)) : 0;
  const priceDiff = winner && loser ? (winner.cost - loser.cost) / 10 : 0;

  return (
    <div>
      <PageHeader title={t('cmp.title')} sub={t('cmp.sub')} back="#/more" />
      <div className="grid-2">{slot(0)}{slot(1)}</div>
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        {[3, 6, 8].map((h) => <button key={h} className={`btn small ${h === horizon ? 'primary' : ''}`} onClick={() => setHorizon(h)}>{t('wc.nGws', { n: h })}</button>)}
      </div>

      {winner && loser && (
        <>
          <section className="card accent glass" style={{ marginTop: 12 }}>
            <div className="card-label">{t('cmp.verdict')}</div>
            <p style={{ margin: '4px 0 0', lineHeight: 1.8 }}>
              {diff < 0.5 ? t('cmp.even', { a: winner.web, b: loser.web, n: horizon })
                : t('cmp.better', { a: winner.web, b: loser.web, d: fmt(diff), n: horizon })}{' '}
              {Math.abs(priceDiff) >= 0.1 && t(priceDiff > 0 ? 'cmp.pricier' : 'cmp.cheaper', { m: Math.abs(priceDiff).toFixed(1) })}
            </p>
          </section>

          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table className="data">
              <thead><tr><th /><th><PName id={A!.id} /></th><th><PName id={B!.id} /></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.k}>
                    <td className="small">{r.k}</td>
                    <td className={`num ${r.better === 0 ? 'good' : ''}`} style={{ fontWeight: r.better === 0 ? 700 : 400 }}>{r.a}</td>
                    <td className={`num ${r.better === 1 ? 'good' : ''}`} style={{ fontWeight: r.better === 1 ? 700 : 400 }}>{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section-title">{t('cmp.byGw')}</h2>
          <div className="card" style={{ padding: 10 }}>
            {[A!, B!].map((p) => (
              <div key={p.id} style={{ marginBottom: 8 }}>
                <div className="small" style={{ marginBottom: 4 }}><PName id={p.id} /></div>
                <div className="row" style={{ gap: 4 }}>
                  {a.horizon.slice(0, horizon).map((g, gi) => {
                    const cells = a.grid[p.team]?.[gi] ?? [];
                    const f = cells[0];
                    return (
                      <div key={g} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                        <div className="tiny num" style={{ background: f ? fdrColor(f.fdr) : 'transparent', color: f ? fdrText(f.fdr) : undefined, borderRadius: 6, padding: '2px 0' }}>
                          {cells.map((c) => pl.teamShort(c.opp)).join('+') || '—'}
                        </div>
                        <div className="num small" style={{ fontWeight: 700 }}>{fmt(a.players[p.id]?.xp[gi] ?? 0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            {[A!, B!].map((p) => (
              <div key={p.id} className="card" style={{ padding: 10 }}>
                <div className="small"><b><PName id={p.id} /></b></div>
                {a.players[p.id] && <Reasons reasons={a.players[p.id].reasons} max={4} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
