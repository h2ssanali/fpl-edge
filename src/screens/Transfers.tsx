import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, safeGet, safeSet } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, Money, PageHeader, PName, Reasons, Seg, usePlayer } from '../components/ui';
import { Pitch } from '../components/Pitch';
import { TransferReport } from '../components/TransferReport';
import { CountUp } from '../components/viz';
import { IconArrowDown, IconArrowUp } from '../components/icons';
import { runPlan, type PlannedTransfer, type PlanChip } from '../engine/planner';
import type { Plan } from '../engine/optimizer';
import type { Pos } from '../engine/types';

type DragItem = { kind: 'player'; id: number } | { kind: 'transfer'; index: number };

/** Pointer-event drag & drop that works with mouse, pen and touch. */
function useDragDrop(onDrop: (item: DragItem, target: HTMLElement) => void) {
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const item = useRef<DragItem | null>(null);
  const hoverEl = useRef<HTMLElement | null>(null);
  const start = useCallback((e: React.PointerEvent, it: DragItem, label: string) => {
    e.preventDefault();
    item.current = it;
    setGhost({ x: e.clientX, y: e.clientY, label });
    // Auto-scroll when the pointer nears the top/bottom edge so the pitch is reachable.
    let lastY = e.clientY;
    let raf = 0;
    const edge = () => {
      const vh = window.innerHeight;
      const speed = lastY < 90 ? -Math.ceil((90 - lastY) / 6) : lastY > vh - 130 ? Math.ceil((lastY - (vh - 130)) / 6) : 0;
      if (speed) window.scrollBy(0, speed);
      raf = requestAnimationFrame(edge);
    };
    raf = requestAnimationFrame(edge);
    const move = (ev: PointerEvent) => {
      lastY = ev.clientY;
      setGhost((g) => (g ? { ...g, x: ev.clientX, y: ev.clientY } : g));
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-drop-id],[data-drop-gw]') ?? null;
      if (el !== hoverEl.current) {
        hoverEl.current?.classList.remove('drop-hover', 'hover');
        el?.classList.add(el.dataset.dropId ? 'drop-hover' : 'hover');
        hoverEl.current = el;
      }
    };
    const up = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const target = hoverEl.current;
      target?.classList.remove('drop-hover', 'hover');
      hoverEl.current = null;
      if (target && item.current) onDrop(item.current, target);
      item.current = null;
      setGhost(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [onDrop]);
  return { ghost, start };
}

export function Transfers() {
  const { t, fmt } = useI18n();
  const { analysis: a, phase2, request, players } = useStore();
  const pl = usePlayer();
  const me = a?.me;
  const storageKey = `fpl-edge-plan-${me?.entry ?? 'none'}-${a?.gw ?? 0}`;
  const [transfers, setTransfers] = useState<PlannedTransfer[]>(() => { try { return JSON.parse(safeGet(storageKey) ?? '[]'); } catch { return []; } });
  const [chips, setChips] = useState<PlanChip[]>([]);
  const [gi, setGi] = useState(0);
  const [selectedOut, setSelectedOut] = useState<number | null>(null);
  const [posFilter, setPosFilter] = useState<Pos | 0>(0);
  const [query, setQuery] = useState('');
  const [optH, setOptH] = useState(6);
  const [optK, setOptK] = useState(1);
  const [opt, setOpt] = useState<{ plans: Plan[][]; hit: { extraMove: number; gainVsFree: number; worthIt: boolean } | null } | null>(null);
  const [optBusy, setOptBusy] = useState(false);

  useEffect(() => { safeSet(storageKey, JSON.stringify(transfers)); }, [storageKey, transfers]);

  const gws = useMemo(() => a?.horizon.slice(0, 6) ?? [], [a]);
  const xp = useCallback((id: number, g: number) => a?.players[id]?.xp[g] ?? 0, [a]);
  const startSquad = useMemo(() => me?.squad.map(({ id, pos, team, cost, sell }) => ({ id, pos, team, cost, sell })) ?? [], [me]);
  const plan = useMemo(() => me ? runPlan({ startSquad, bank: me.bank, freeTransfers: me.ft, gws, xp, players, transfers, chips }) : [], [me, startSquad, gws, xp, players, transfers, chips]);
  const baseline = useMemo(() => me ? runPlan({ startSquad, bank: me.bank, freeTransfers: me.ft, gws, xp, players, transfers: [], chips }) : [], [me, startSquad, gws, xp, players, chips]);
  const total = plan.reduce((s, p) => s + p.xPts, 0);
  const baseTotal = baseline.reduce((s, p) => s + p.xPts, 0);
  const cur = plan[gi];

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2200); return () => clearTimeout(id); }, [toast]);
  const addTransfer = useCallback((out: number, inn: number, gwIdx = gi) => {
    const pOut = players.get(out), pIn = players.get(inn);
    if (!pOut || !pIn) return;
    if (pOut.pos !== pIn.pos) { setToast(t('tr.problem.position')); return; }
    setTransfers((ts) => [...ts, { gw: gws[gwIdx], out, in: inn }]);
    setSelectedOut(null);
  }, [players, gws, gi, t]);

  const { ghost, start } = useDragDrop(useCallback((item: DragItem, target: HTMLElement) => {
    if (item.kind === 'player' && target.dataset.dropId) addTransfer(Number(target.dataset.dropId), item.id);
    if (item.kind === 'transfer' && target.dataset.dropGw) {
      const gw = Number(target.dataset.dropGw);
      setTransfers((ts) => ts.map((tr, i) => (i === item.index ? { ...tr, gw } : tr)));
    }
  }, [addTransfer]));

  // "True value of a -4": remove the last move of each GW that took a hit.
  const hitValues = useMemo(() => {
    if (!me) return [];
    return plan.filter((p) => p.hits > 0).map((p) => {
      const lastIdx = transfers.map((tr, i) => ({ tr, i })).filter(({ tr }) => tr.gw === p.gw).at(-1)?.i;
      if (lastIdx === undefined) return null;
      const without = runPlan({ startSquad, bank: me.bank, freeTransfers: me.ft, gws, xp, players, transfers: transfers.filter((_, i) => i !== lastIdx), chips });
      const gainExtra = total - without.reduce((s, x) => s + x.xPts, 0) + 4; // gain before the hit
      return { gw: p.gw, gain: gainExtra, worth: gainExtra > 4 };
    }).filter(Boolean) as { gw: number; gain: number; worth: boolean }[];
  }, [plan, transfers, me, startSquad, gws, xp, players, chips, total]);

  if (!a || !me || !cur) return <><PageHeader title={t('tr.title')} /><Empty>{t('tr.noSquad')}</Empty></>;

  const squadIds = new Set(cur.squad.map((s) => s.id));
  const outPos = selectedOut ? players.get(selectedOut)?.pos : null;
  const filterPos = (outPos ?? posFilter) as Pos | 0;
  const remainingXp = (id: number) => gws.slice(gi).reduce((s, _, k) => s + xp(id, gi + k), 0);
  const q = query.trim().toLowerCase();
  // When a squad player is selected: best affordable replacements, ranked by the gain over him.
  const outMember = selectedOut ? cur.squad.find((m) => m.id === selectedOut) : null;
  const budgetFor = outMember ? cur.bank + outMember.sell : Infinity;
  const teamCount = (team: number) => cur.squad.filter((m) => m.team === team && m.id !== selectedOut).length;
  const outXp = selectedOut ? remainingXp(selectedOut) : 0;
  const candidates = [...players.values()]
    .filter((p) => !squadIds.has(p.id) && p.status !== 'u' && p.canSelect && (!filterPos || p.pos === filterPos) && (!q || p.web.toLowerCase().includes(q) || p.second.toLowerCase().includes(q)))
    .filter((p) => !outMember || q || (p.cost <= budgetFor && teamCount(p.team) < 3))
    .sort((x, y) => remainingXp(y.id) - remainingXp(x.id))
    .slice(0, 20);
  const suggestions = (phase2?.plans[0] ?? []).filter((p) => p.gain > 0.5).slice(0, 4);
  const applyMoves = (moves: { out: number; in: number }[]) => {
    setGi(0);
    setTransfers((ts) => [...ts.filter((x) => x.gw !== gws[0]), ...moves.map((m) => ({ gw: gws[0], out: m.out, in: m.in }))]);
  };

  const runOpt = async () => {
    setOptBusy(true);
    try { setOpt(await request('optimize', { horizon: optH, maxMoves: 3 })); } finally { setOptBusy(false); }
  };
  const optPlans = opt?.plans ?? phase2?.plans ?? [];
  const hit = opt?.hit ?? phase2?.hit ?? null;
  const flagOf = (id: number) => { const p = players.get(id); return !p ? null : p.status === 'i' || p.status === 's' || p.status === 'u' ? 'out' as const : p.status === 'd' || (p.cop != null && p.cop < 100) ? 'doubt' as const : null; };

  return (
    <div>
      <PageHeader title={t('tr.title')} />
      <TransferReport />

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="display" style={{ fontSize: '1.15rem' }}>{t('tr.bestTitle')}</div>
        <p className="small muted" style={{ margin: '4px 0 8px' }}>{t('tr.bestSub', { ft: me.ft, bank: (me.bank / 10).toFixed(1) })}</p>
        {!phase2 ? <div className="skeleton" style={{ height: 70 }} /> : suggestions.length === 0 ? <div className="small">{t('home.noTransfer')}</div> : (
          <div className="list">
            {suggestions.map((pln, i) => {
              const m = pln.moves[0];
              return (
                <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="move" style={{ fontSize: '1rem' }}>
                      <IconArrowDown width={16} className="out" /><span className="out"><PName id={m.out} /></span>
                      <IconArrowUp width={16} className="in" /><span className="in"><PName id={m.in} withTeam /></span>
                    </div>
                    <div className="tiny muted">{t('tr.bankAfter')}: <Money v={pln.bankAfter} /></div>
                    {i === 0 && a.players[m.in] && <Reasons reasons={a.players[m.in].reasons} max={4} />}
                  </div>
                  <div style={{ textAlign: 'end', minWidth: 78 }}>
                    <div className="num good" style={{ fontWeight: 700, fontSize: '1.2rem' }}>+{fmt(pln.gain)}</div>
                    <div className="tiny muted">{t('tr.pts6')}</div>
                    <button className="btn small" style={{ marginTop: 4 }} onClick={() => applyMoves(pln.moves)}>{t('tr.apply')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t('tr.tapHint')}</p>
      </section>
      <div className="kv">
        <div><div className="k">{t('tr.bank')}</div><div className={`v ${cur.bank < 0 ? 'bad' : ''}`}><Money v={cur.bank} /></div></div>
        <div><div className="k">{t('tr.ft')}</div><div className="v">{cur.ftAvailable}{cur.hits > 0 && <span className="bad small"> −{cur.hits}</span>}</div></div>
        <div><div className="k">{t('tr.projected')} (6)</div><div className="v"><CountUp value={total} decimals={1} /> <span className={`small ${total - baseTotal >= 0 ? 'good' : 'bad'}`}>{total - baseTotal >= 0 ? '+' : ''}{fmt(total - baseTotal)}</span></div></div>
      </div>

      <h2 className="section-title">{t('tr.planTitle')}</h2>
      <p className="small muted" style={{ marginTop: -4 }}>{t('tr.planHint')}</p>
      <div className="gw-cols">
        {plan.map((p, i) => (
          <div key={p.gw} className={`gw-col drop-zone ${i === gi ? 'on' : ''}`} data-drop-gw={p.gw} onClick={() => setGi(i)} role="button" tabIndex={0}>
            <h4><span>{t('gwShort')}{p.gw}</span><span className="num">{fmt(p.xPts)}</span></h4>
            <div className="tiny muted">{t('tr.ft')}: <span className="num">{p.ftAvailable}</span>{p.hits > 0 && <span className="bad"> −{p.hits}</span>}</div>
            {p.chip && <span className="pill accent tiny">{t(`ch.${p.chip}`)}</span>}
            {transfers.map((tr, idx) => tr.gw === p.gw && (
              <span key={idx} className="tchip draggable" onPointerDown={(e) => start(e, { kind: 'transfer', index: idx }, `${pl.name(tr.out)} → ${pl.name(tr.in)}`)}>
                <button aria-label="remove" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTransfers((ts) => ts.filter((_, j) => j !== idx)); }}
                  style={{ background: 'none', border: 0, padding: '0 4px 0 0', color: 'var(--bad)', cursor: 'pointer' }}>×</button>
                {pl.name(tr.out)} → {pl.name(tr.in)}
              </span>
            ))}
            {!p.valid && <div className="tiny bad">{p.problems.map((x) => t(`tr.problem.${x}`)).join(' · ')}</div>}
          </div>
        ))}
      </div>

      <div className="row between wrap" style={{ margin: '14px 0 8px' }}>
        <div className="small muted">{selectedOut ? t('tr.selected', { name: pl.name(selectedOut) }) : t('tr.selectOut')}</div>
        <div className="row">
          <select aria-label={t('tr.chip')} value={chips.find((c) => c.gw === gws[gi])?.chip ?? ''} style={{ width: 'auto' }}
            onChange={(e) => { const v = e.target.value as PlanChip['chip'] | ''; setChips((cs) => [...cs.filter((c) => c.gw !== gws[gi]), ...(v ? [{ gw: gws[gi], chip: v }] : [])]); }}>
            <option value="">{t('tr.chip')}: {t('tr.none')}</option>
            {(['wildcard', 'freehit', 'bboost', '3xc'] as const).filter((c) => me.chips[c]).map((c) => <option key={c} value={c}>{t(`ch.${c}`)}</option>)}
          </select>
          {transfers.length > 0 && <button className="btn small ghost" onClick={() => setTransfers((ts) => ts.slice(0, -1))}>{t('tr.undo')}</button>}
          {transfers.length > 0 && <button className="btn small ghost" onClick={() => setTransfers([])}>{t('tr.clear')}</button>}
        </div>
      </div>

      <Pitch
        dropTarget
        xi={cur.xi.map((id) => ({ id, label: fmt(xp(id, gi)), captain: id === cur.captain, flag: flagOf(id), selected: id === selectedOut }))}
        bench={cur.bench.map((id) => ({ id, label: fmt(xp(id, gi)), flag: flagOf(id), selected: id === selectedOut }))}
        onTap={(id) => {
          setSelectedOut((s) => (s === id ? null : id));
          setQuery('');
          // Bring the replacements list into view.
          setTimeout(() => document.getElementById('replacements')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
        }}
      />

      {hitValues.map((h) => (
        <div key={h.gw} className={`card ${h.worth ? 'accent' : ''}`} style={{ marginTop: 12 }}>
          <div className="card-label">{t('tr.hitValue')} · {t('gw')} {h.gw}</div>
          <div className="small">{t('tr.hitWorth', { gain: fmt(h.gain), verdict: h.worth ? t('tr.worth') : t('tr.notWorth') })}</div>
        </div>
      ))}

      <h2 className="section-title" id="replacements" style={{ scrollMarginTop: 70 }}>{selectedOut ? t('tr.replacementsFor', { name: pl.name(selectedOut) }) : t('tr.search')}</h2>
      {outMember && <p className="small muted" style={{ marginTop: -4 }}>{t('tr.budgetFor', { money: (budgetFor / 10).toFixed(1) })}</p>}
      <div className="row" style={{ marginBottom: 8 }}>
        <input type="search" placeholder={t('tr.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!outPos && (
        <Seg value={posFilter} onChange={setPosFilter} options={[{ value: 0, label: t('tr.all') }, { value: 1, label: 'GKP' }, { value: 2, label: 'DEF' }, { value: 3, label: 'MID' }, { value: 4, label: 'FWD' }]} />
      )}
      <div className="card" style={{ marginTop: 8, padding: '4px 12px' }}>
        <div className="list">
          {candidates.map((p) => (
            <div key={p.id} className="list-row">
              <span className="draggable" aria-label="drag" onPointerDown={(e) => start(e, { kind: 'player', id: p.id }, p.web)} style={{ padding: 4, color: 'var(--faint)' }}>
                <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden><g fill="currentColor">{[3, 10, 17].flatMap((y) => [<circle key={`a${y}`} cx="4" cy={y} r="1.6" />, <circle key={`b${y}`} cx="10" cy={y} r="1.6" />])}</g></svg>
              </span>
              <MiniShirt id={p.id} />
              <button className="grow" style={{ background: 'none', border: 0, textAlign: 'start', padding: 0, cursor: selectedOut ? 'pointer' : 'default', minWidth: 0 }}
                onClick={() => selectedOut && addTransfer(selectedOut, p.id)}>
                <div className="name"><PName id={p.id} /></div>
                <div className="sub">{pl.team(p.id)} · <Money v={p.cost} /> · {fmt(p.sel, 1)}%</div>
              </button>
              <div style={{ textAlign: 'end' }}>
                {selectedOut ? (
                  <>
                    <div className={`num ${remainingXp(p.id) - outXp >= 0 ? 'good' : 'bad'}`} style={{ fontWeight: 700 }}>{remainingXp(p.id) - outXp >= 0 ? '+' : ''}{fmt(remainingXp(p.id) - outXp)}</div>
                    <div className="tiny muted">{t('tr.vsOut')}</div>
                  </>
                ) : (
                  <>
                    <div className="num" style={{ fontWeight: 700 }}>{fmt(remainingXp(p.id))}</div>
                    <div className="tiny muted">{t('xp')}</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="section-title">{t('tr.optimizer')} <span className="hint">{t('tr.optSub')}</span></h2>
      <div className="card">
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="small muted">{t('tr.horizon')}</span>
          <Seg value={optH} onChange={setOptH} options={[1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: String(h) }))} />
          <button className="btn small primary" onClick={runOpt} disabled={optBusy}>{optBusy ? '…' : t('dt.build')}</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Seg full value={optK} onChange={setOptK} options={[1, 2, 3].map((k) => ({ value: k, label: `${k} ${t('tr.moves')}` }))} />
        </div>
        {hit && (
          <div className={`small ${hit.worthIt ? 'good' : 'muted'}`} style={{ marginTop: 10 }}>
            {t('tr.hitValue')}: {t('tr.hitWorth', { gain: fmt(hit.gainVsFree), verdict: hit.worthIt ? t('tr.worth') : t('tr.notWorth') })}
          </div>
        )}
        <div className="list" style={{ marginTop: 6 }}>
          {!optPlans.length && <div className="skeleton" style={{ height: 60 }} />}
          {(optPlans[optK - 1] ?? []).slice(0, 5).map((pln, i) => (
            <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div className="grow stack" style={{ gap: 4 }}>
                {pln.moves.map((m) => (
                  <div key={m.out} className="move small">
                    <IconArrowDown width={14} className="out" /><span className="out"><PName id={m.out} /></span>
                    <IconArrowUp width={14} className="in" /><span className="in"><PName id={m.in} withTeam /></span>
                  </div>
                ))}
                {i === 0 && a.players[pln.moves[0].in] && <Reasons reasons={a.players[pln.moves[0].in].reasons} max={4} />}
              </div>
              <div style={{ textAlign: 'end', minWidth: 86 }}>
                <div className={`num ${pln.net >= 0 ? 'good' : 'bad'}`} style={{ fontWeight: 700, fontSize: '1.15rem' }}>{pln.net >= 0 ? '+' : ''}{fmt(pln.net)}</div>
                <div className="tiny muted">{t('tr.gain')} {fmt(pln.gain)}{pln.hitCost ? ` · −${pln.hitCost}` : ''}</div>
                <button className="btn small" style={{ marginTop: 4 }} onClick={() => applyMoves(pln.moves)}>{t('tr.add')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {toast && <div className="drag-ghost" style={{ left: '50%', top: 'auto', bottom: 110, transform: 'translateX(-50%)', background: 'var(--bad)', color: '#fff' }} role="status">{toast}</div>}
      {ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div>}
    </div>
  );
}
