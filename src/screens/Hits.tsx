import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, Money, PageHeader, PName, Seg, usePlayer } from '../components/ui';
import { PlayerSearch } from '../components/PlayerSearch';
import { hitPlan } from '../engine/hits';

const POS = ['', 'GKP', 'DEF', 'MID', 'FWD'];

/** "Is this -4 worth it?" for one to three moves, over the coming gameweeks. */
export function Hits() {
  const { t, fmt } = useI18n();
  const { analysis: a, players } = useStore();
  const pl = usePlayer();
  const [moves, setMoves] = useState<{ out: number; in: number }[]>([{ out: 0, in: 0 }]);
  const [ftPick, setFtPick] = useState<number | null>(null);
  const me = a?.me;
  const squad = useMemo(() => me?.squad.map(({ id, pos, team, cost, sell }) => ({ id, pos, team, cost, sell })) ?? [], [me]);
  if (!a) return null;
  if (!me) return <><PageHeader title={t('hc.title')} back="#/more" /><Empty>{t('tr.noSquad')}</Empty></>;

  const ft = ftPick ?? me.ft;
  const done = moves.filter((m) => m.out && m.in);
  const gws = Math.min(8, a.horizon.length);
  const r = done.length ? hitPlan({ squad, bank: me.bank, ft, moves: done.map((m) => [m.out, m.in]), players, xp: (id, gi) => a.players[id]?.xp[gi] ?? 0, gws }) : null;
  const at = (n: number) => (r ? r.perGw[Math.min(n, r.perGw.length) - 1]?.cum ?? 0 : 0);
  const net6 = r ? at(6) - r.cost : 0;
  const verdict = !r ? null : r.cost === 0 ? (at(6) > 0 ? 'free' : 'freeBad') : net6 > 2 ? 'yes' : net6 >= 0 ? 'close' : 'no';
  const maxAbs = Math.max(1, ...(r?.perGw.map((g) => Math.abs(g.cum)) ?? [1]), r?.cost ?? 0);
  const used = new Set(moves.flatMap((m) => [m.out, m.in]));
  const set = (i: number, patch: Partial<{ out: number; in: number }>) => setMoves((ms) => ms.map((m, k) => (k === i ? { ...m, ...patch, ...(patch.out !== undefined ? { in: 0 } : {}) } : m)));

  return (
    <div>
      <PageHeader title={t('hc.title')} sub={t('hc.sub')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('hc.explain')}</p></div>
      <div className="kv" style={{ marginTop: 12 }}>
        <div><div className="k">{t('tr.bank')}</div><div className="v"><Money v={me.bank} /></div></div>
        <div><div className="k">{t('hc.hits')}</div><div className={`v ${r && r.cost ? 'bad' : ''}`}>{r ? (r.cost ? `−${r.cost}` : '0') : '—'}</div></div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div className="small muted" style={{ marginBottom: 4 }}>{t('hc.ftPick')}</div>
        <Seg full value={ft} onChange={setFtPick} options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
      </div>

      <h2 className="section-title">{t('hc.moves')}</h2>
      <div className="stack">
        {moves.map((m, i) => {
          const out = squad.find((s) => s.id === m.out);
          return (
            <div key={i} className="card" style={{ padding: 10 }}>
              <div className="row between small" style={{ marginBottom: 6 }}>
                <b>{t('hc.move', { n: i + 1 })}{i >= ft && <span className="bad"> (−4)</span>}</b>
                {moves.length > 1 && <button className="btn small ghost" onClick={() => setMoves((ms) => ms.filter((_, k) => k !== i))}>×</button>}
              </div>
              <select value={m.out} onChange={(e) => set(i, { out: Number(e.target.value) })} aria-label={t('hc.out')}>
                <option value={0}>{t('hc.out')}</option>
                {[...squad].sort((x, y) => x.pos - y.pos).map((s) => (
                  <option key={s.id} value={s.id} disabled={used.has(s.id) && s.id !== m.out}>{POS[s.pos]} · {pl.name(s.id)} (£{(s.sell / 10).toFixed(1)}m)</option>
                ))}
              </select>
              {out && (
                <div style={{ marginTop: 8 }}>
                  {m.in ? (
                    <div className="row between">
                      <div className="row"><MiniShirt id={m.in} /><div><div className="name"><PName id={m.in} withTeam /></div><div className="sub"><Money v={players.get(m.in)?.cost ?? 0} /></div></div></div>
                      <button className="btn small ghost" onClick={() => set(i, { in: 0 })}>{t('hc.change')}</button>
                    </div>
                  ) : (
                    <PlayerSearch placeholder={t('hc.in', { pos: POS[out.pos] })} exclude={[...squad.map((s) => s.id), ...used]}
                      onPick={(id) => (players.get(id)?.pos === out.pos ? set(i, { in: id }) : undefined)} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {moves.length < 3 && <button className="btn small" style={{ marginTop: 8 }} onClick={() => setMoves((ms) => [...ms, { out: 0, in: 0 }])}>{t('hc.add')}</button>}

      {r && (
        <>
          {r.problems.length > 0 && <p className="small bad" style={{ marginTop: 10 }}>{r.problems.map((p) => t(`hc.problem.${p}`, { m: (Math.abs(r.bankAfter) / 10).toFixed(1) })).join(' · ')}</p>}
          <section className={`card ${verdict === 'yes' || verdict === 'free' ? 'accent' : ''} glass`} style={{ marginTop: 12 }}>
            <div className="card-label">{t('cmp.verdict')}</div>
            <div className="display" style={{ fontSize: '1.15rem', marginTop: 2 }} >
              <span className={verdict === 'no' || verdict === 'freeBad' ? 'bad' : verdict === 'close' ? 'warn' : 'good'}>{t(`hc.v.${verdict}`)}</span>
            </div>
            <p style={{ margin: '6px 0 0', lineHeight: 1.8 }}>
              {t(r.cost ? 'hc.summary' : 'hc.summaryFree', { g1: fmt(at(1)), g3: fmt(at(3)), g6: fmt(at(6)), cost: r.cost })}{' '}
              {r.cost > 0 && (r.payback !== null ? t('hc.payback', { gw: a.horizon[r.payback] }) : t('hc.never', { n: gws }))}
            </p>
            {r.cost > 0 && r.waitLoss > 0 && at(6) > 0 && <p className="small muted" style={{ margin: '6px 0 0', lineHeight: 1.7 }}>{t(r.waitLoss < r.cost ? 'hc.waitBetter' : 'hc.waitWorse', { loss: fmt(r.waitLoss), cost: r.cost })}</p>}
          </section>

          <h2 className="section-title">{t('hc.byGw')}</h2>
          <div className="card" style={{ padding: 12 }}>
            {r.perGw.map((g, gi) => (
              <div key={gi} className="row" style={{ gap: 8, marginBottom: 6 }}>
                <span className="num small" style={{ width: 44 }}>{t('gwShort')}{a.horizon[gi]}</span>
                <div className="grow" style={{ position: 'relative', height: 14, background: 'var(--surface-2)', borderRadius: 99 }} dir="ltr">
                  <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(Math.max(0, g.cum) / maxAbs) * 100}%`, background: g.cum >= r.cost ? 'var(--good)' : 'var(--accent)', borderRadius: 99, opacity: 0.85 }} />
                  {r.cost > 0 && <b style={{ position: 'absolute', left: `${(r.cost / maxAbs) * 100}%`, top: -3, bottom: -3, width: 2, background: 'var(--bad)' }} />}
                </div>
                <span className="num small" style={{ width: 48, textAlign: 'end' }}>{g.cum >= 0 ? '+' : ''}{fmt(g.cum)}</span>
              </div>
            ))}
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>{t('hc.barsNote')}</p>
          </div>
        </>
      )}
    </div>
  );
}
