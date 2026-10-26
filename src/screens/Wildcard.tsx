import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Reasons, Seg, usePlayer } from '../components/ui';
import { Pitch } from '../components/Pitch';
import { IconArrowDown, IconArrowUp } from '../components/icons';
import { checkLocks, type WildcardKind, type WildcardOption } from '../engine/wildcard';
import type { Pos } from '../engine/types';
import { searchKey } from '../data/names';

interface Result { budget: number; options: WildcardOption[] }

const POS = ['', 'GKP', 'DEF', 'MID', 'FWD'];

export function Wildcard() {
  const { t, fmt } = useI18n();
  const { analysis: a, players, request } = useStore();
  const pl = usePlayer();
  const [locked, setLocked] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [horizon, setHorizon] = useState(6);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [kind, setKind] = useState<WildcardKind>('best');

  const me = a?.me;
  const budget = me ? me.squad.reduce((s, m) => s + m.sell, 0) + me.bank : 1000;
  const cheapest = useMemo(() => {
    const c: Record<Pos, number> = { 1: 999, 2: 999, 3: 999, 4: 999 };
    for (const p of players.values()) if (p.canSelect && p.status !== 'u') c[p.pos as Pos] = Math.min(c[p.pos as Pos], p.cost);
    return c;
  }, [players]);
  const check = checkLocks(players, locked, budget, cheapest);
  const xpN = (id: number) => (a?.players[id]?.xp ?? []).slice(0, horizon).reduce((s, x) => s + x, 0);
  const q = searchKey(query.trim());
  const results = q.length < 2 ? [] : [...players.values()]
    .filter((p) => p.canSelect && p.status !== 'u' && [p.web, p.second, p.first, `${p.first} ${p.second}`].some((n) => searchKey(n).includes(q)))
    .sort((x, y) => xpN(y.id) - xpN(x.id)).slice(0, 8);

  if (!a) return null;
  const from = a.horizon[0];
  const to = a.horizon[Math.min(horizon, a.horizon.length) - 1];

  // A fresh random seed each time, so two people (or two tries) don't get the exact same squad.
  const build = async (another = false) => {
    setBusy(true);
    try {
      const avoid = another && res ? [...new Set(res.options.flatMap((o) => o.squad.map((m) => m.id)))].filter((id) => !locked.includes(id)) : [];
      const seed = Math.floor(Math.random() * 2 ** 31);
      const r = await request<Result>('wildcard', { locked, excluded, horizon, seed, avoid });
      setRes(r);
      setKind('best');
    } finally { setBusy(false); }
  };
  const toggle = (list: number[], set: (v: number[]) => void, id: number) => { set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]); setRes(null); };

  const best = res?.options.find((o) => o.kind === 'best');
  const opt = res?.options.find((o) => o.kind === kind) ?? best;
  const why = (o: WildcardOption): string => {
    if (o.sameAs) return t('wc.same', { name: t(`wc.kind.${o.sameAs}`) });
    const base = { pts: fmt(o.value), from, to, out: o.outs.length, bank: (o.bankLeft / 10).toFixed(1) };
    if (o.kind === 'best') return t('wc.whyBest', base);
    if (o.kind === 'differential') return t('wc.whyDiff', { ...base, own: fmt(o.avgOwnership, 0), ownBest: fmt(best?.avgOwnership ?? 0, 0), diff: fmt((best?.value ?? 0) - o.value) });
    return t('wc.whyKeep', { ...base, kept: o.kept.length, diff: fmt((best?.value ?? 0) - o.value) });
  };
  const highlights = opt ? opt.squad.filter((m) => !locked.includes(m.id)).sort((x, y) => xpN(y.id) - xpN(x.id)).slice(0, 4) : [];
  const next3 = (id: number) => {
    const team = players.get(id)?.team ?? 0;
    return (a.grid[team] ?? []).slice(0, 3).map((fx) => fx.map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') || t('r.blank')).join('، ');
  };

  return (
    <div>
      <PageHeader title={t('wc.title')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('wc.explain')}</p></div>

      <div className="kv" style={{ marginTop: 12 }}>
        <div><div className="k">{t('wc.budget')}</div><div className="v"><Money v={budget} /></div></div>
        <div><div className="k">{t('wc.locked')}</div><div className="v">{locked.length}</div></div>
        <div><div className="k">{t('wc.horizon')}</div><div className="v">{t('gwShort')}{from}–{to}</div></div>
      </div>

      <h2 className="section-title">{t('wc.step1')}</h2>
      <input type="search" placeholder={t('wc.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      {results.length > 0 && (
        <div className="card" style={{ marginTop: 8, padding: '4px 12px' }}>
          <div className="list">
            {results.map((p) => (
              <div key={p.id} className="list-row">
                <MiniShirt id={p.id} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="name"><PName id={p.id} withTeam /></div>
                  <div className="sub">{POS[p.pos]} · <Money v={p.cost} /> · {fmt(xpN(p.id))} {t('wc.ptsShort')}</div>
                </div>
                <button className={`btn small ${locked.includes(p.id) ? 'primary' : ''}`} onClick={() => { toggle(locked, setLocked, p.id); setExcluded(excluded.filter((x) => x !== p.id)); }}>{t('wc.want')}</button>
                <button className={`btn small ghost ${excluded.includes(p.id) ? 'bad' : ''}`} onClick={() => { toggle(excluded, setExcluded, p.id); setLocked(locked.filter((x) => x !== p.id)); }}>{t('wc.dontWant')}</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {(locked.length > 0 || excluded.length > 0) && (
        <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
          {locked.map((id) => <button key={id} className="pill accent" onClick={() => toggle(locked, setLocked, id)} style={{ cursor: 'pointer' }}>✓ <bdi dir="ltr">{pl.name(id)}</bdi> ×</button>)}
          {excluded.map((id) => <button key={id} className="pill bad" onClick={() => toggle(excluded, setExcluded, id)} style={{ cursor: 'pointer' }}>✕ <bdi dir="ltr">{pl.name(id)}</bdi> ×</button>)}
        </div>
      )}
      {!check.ok && (
        <p className="small bad">{check.problem === 'position' ? t('wc.errPos', { pos: POS[check.pos ?? 1] }) : check.problem === 'team' ? t('wc.errTeam', { team: pl.teamShort(check.team ?? 0) }) : t('wc.errBudget')}</p>
      )}

      <h2 className="section-title">{t('wc.step2')}</h2>
      <Seg full value={horizon} onChange={(h) => { setHorizon(h); setRes(null); }} options={[3, 6, 8].map((h) => ({ value: h, label: t('wc.nGws', { n: h }) }))} />
      <button className="btn primary" style={{ width: '100%', marginTop: 12 }} disabled={busy || !check.ok} onClick={() => build()}>{busy ? t('wc.building') : t('wc.build')}</button>

      {res && opt && (
        <>
          <h2 className="section-title">{t('wc.results')}</h2>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th /><th>{t('wc.colPts')}</th><th>{t('wc.colChanges')}</th><th>{t('wc.colBank')}</th><th>{t('wc.colOwn')}</th></tr></thead>
              <tbody>
                {res.options.map((o) => (
                  <tr key={o.kind} className={o.kind === kind ? 'me' : ''} onClick={() => setKind(o.kind)} style={{ cursor: 'pointer' }}>
                    <td><b>{t(`wc.kind.${o.kind}`)}</b></td>
                    <td className="num">{fmt(o.value)}</td>
                    <td className="num">{o.outs.length}</td>
                    <td className="num">£{(o.bankLeft / 10).toFixed(1)}m</td>
                    <td className="num">{fmt(o.avgOwnership, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn small" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={() => build(true)}>{busy ? t('wc.building') : t('wc.another')}</button>
          <p className="tiny muted" style={{ margin: '4px 2px 0' }}>{t('wc.anotherNote')}</p>
          <div style={{ marginTop: 10 }}>
            <Seg full value={kind} onChange={setKind} options={res.options.map((o) => ({ value: o.kind, label: t(`wc.kind.${o.kind}`) }))} />
          </div>

          <section className="card accent glass" style={{ marginTop: 12 }}>
            <div className="display" style={{ fontSize: '1.1rem' }}>{t('wc.whyTitle', { name: t(`wc.kind.${opt.kind}`) })}</div>
            <p style={{ margin: '6px 0 0', lineHeight: 1.8 }}>{why(opt)}</p>
          </section>

          <div style={{ marginTop: 12 }}>
            <Pitch
              xi={opt.xi.map((id) => ({ id, label: fmt(xpN(id)), captain: id === opt.captain, selected: locked.includes(id) }))}
              bench={opt.bench.map((id) => ({ id, label: fmt(xpN(id)), selected: locked.includes(id) }))}
            />
            <p className="tiny muted" style={{ margin: '6px 2px 0' }}>{t('wc.pitchNote', { from, to })}</p>
          </div>

          {(opt.outs.length > 0 || opt.ins.length > 0) && (
            <>
              <h2 className="section-title">{t('wc.changes', { n: opt.outs.length })}</h2>
              <div className="grid-2">
                <div className="card" style={{ padding: '8px 12px' }}>
                  <div className="card-label bad">{t('wc.sell')}</div>
                  {opt.outs.map((id) => <div key={id} className="move small" style={{ marginTop: 4 }}><IconArrowDown width={14} className="out" /><span className="out"><PName id={id} /></span></div>)}
                </div>
                <div className="card" style={{ padding: '8px 12px' }}>
                  <div className="card-label good">{t('wc.buy')}</div>
                  {opt.ins.map((id) => <div key={id} className="move small" style={{ marginTop: 4 }}><IconArrowUp width={14} className="in" /><span className="in"><PName id={id} /></span> <span className="faint"><Money v={players.get(id)?.cost ?? 0} /></span></div>)}
                </div>
              </div>
            </>
          )}

          <h2 className="section-title">{t('wc.keyPicks')}</h2>
          <div className="stack">
            {highlights.map((m) => (
              <div key={m.id} className="card" style={{ padding: '10px 14px' }}>
                <div className="row between">
                  <div className="row" style={{ minWidth: 0 }}><MiniShirt id={m.id} /><div style={{ minWidth: 0 }}><div className="name"><PName id={m.id} withTeam /></div><div className="sub">{POS[m.pos]} · <Money v={players.get(m.id)?.cost ?? 0} /> · {t('fx.owned', { p: (players.get(m.id)?.sel ?? 0).toFixed(1) })}</div></div></div>
                  <div style={{ textAlign: 'end' }}><div className="num accent-text" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{fmt(xpN(m.id))}</div><div className="tiny muted">{t('wc.ptsShort')}</div></div>
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>{t('wc.nextFx', { fx: next3(m.id) })}</div>
                {a.players[m.id] && <Reasons reasons={a.players[m.id].reasons} max={4} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
