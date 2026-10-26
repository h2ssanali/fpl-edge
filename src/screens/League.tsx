import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, MiniShirt, PageHeader, PName, Seg, usePlayer } from '../components/ui';
import { Bar, CountUp, Gauge } from '../components/viz';
import { IconArrowDown, IconArrowUp } from '../components/icons';
import type { MoveImpact, RivalView } from '../engine/analyze';

type Tab = 'standings' | 'dial' | 'rivals' | 'eo';

export function League() {
  const { t } = useI18n();
  const { analysis: a, rivalsLoading } = useStore();
  const [tab, setTab] = useState<Tab>('standings');
  const lg = a?.league;
  if (!a || !lg) return (
    <>
      <PageHeader title={t('lg.title')} />
      {rivalsLoading ? (
        <div className="card"><div className="skeleton" style={{ height: 90, marginBottom: 10 }} /><div className="small">{t('team.rivalsLoading', rivalsLoading)}</div><div className="tiny muted">{t('team.liteNote')}</div></div>
      ) : <Empty>{t('team.noLeague')}</Empty>}
    </>
  );
  return (
    <div>
      <PageHeader title={lg.name} sub={lg.demo ? t('lg.demoNote') : undefined} />
      <Seg full value={tab} onChange={setTab} options={[
        { value: 'standings', label: t('lg.standings') }, { value: 'dial', label: t('lg.dial') },
        { value: 'rivals', label: t('lg.rivals') }, { value: 'eo', label: t('lg.eo') },
      ]} />
      <div style={{ marginTop: 14 }}>
        {tab === 'standings' && <Standings />}
        {tab === 'dial' && <RiskDial />}
        {tab === 'rivals' && <Rivals />}
        {tab === 'eo' && <EoWhatIf />}
      </div>
    </div>
  );
}

function Standings() {
  const { t, pct, fmt } = useI18n();
  const { analysis: a } = useStore();
  const lg = a!.league!;
  const me = lg.standings.find((s) => s.isMe);
  return (
    <div className="stack">
      {me && (
        <div className="grid-2">
          <div className="card glass"><Gauge value={lg.pWin} label={t('lg.pWin')} /></div>
          <div className="card">
            <div className="card-label">{t('lg.expRank')}</div>
            <div className="big-num"><CountUp value={me.expRank} decimals={1} /></div>
            <div className="tiny muted">{t('lg.pLead')}: <span className="num">{pct(me.pLead)}</span></div>
            <div className="tiny muted">{t('home.squad')}: <span className="num">{fmt(me.gwMean, 0)} ± {fmt(me.gwSd, 0)}</span></div>
          </div>
        </div>
      )}
      <div className="card" style={{ padding: '6px 12px' }}>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>#</th><th>{t('lg.title')}</th><th>{t('lg.total')}</th><th>{t('lg.pWin')}</th><th>{t('lg.expRank')}</th></tr></thead>
            <tbody>
              {[...lg.standings].sort((x, y) => x.rank - y.rank).map((s) => (
                <tr key={s.entry} className={s.isMe ? 'me' : ''}>
                  <td className="num">{s.rank}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div className="name"><bdi dir="ltr">{s.name}</bdi> {s.isMe && <span className="pill accent">{t('lg.you')}</span>}</div>
                    <div className="sub"><bdi dir="ltr">{s.player}</bdi></div>
                  </td>
                  <td className="num">{s.total}<div className="tiny muted">+{s.eventTotal}</div></td>
                  <td style={{ minWidth: 80 }}><div className="num small">{pct(s.pWin, 1)}</div><Bar value={s.pWin / Math.max(0.01, Math.max(...lg.standings.map((x) => x.pWin)))} /></td>
                  <td className="num">{fmt(s.expRank, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MoveLine({ moves }: { moves: { out: number; in: number }[] }) {
  return (
    <div className="stack" style={{ gap: 3 }}>
      {moves.map((m) => (
        <div key={m.out} className="move small">
          <IconArrowDown width={14} className="out" /><span className="out"><PName id={m.out} /></span>
          <IconArrowUp width={14} className="in" /><span className="in"><PName id={m.in} /></span>
        </div>
      ))}
    </div>
  );
}

function RiskDial() {
  const { t, pct, fmt } = useI18n();
  const { analysis: a, phase2, request } = useStore();
  const lg = a!.league!;
  const [dial, setDial] = useState(lg.mode.dial);
  const [impacts, setImpacts] = useState<MoveImpact[] | null>(null);
  useEffect(() => {
    if (Math.abs(dial - lg.mode.dial) < 1e-6) { setImpacts(null); return; }
    const id = setTimeout(() => { request<MoveImpact[]>('impacts', { dial }).then(setImpacts); }, 250);
    return () => clearTimeout(id);
  }, [dial, lg.mode.dial, request]);
  const list = impacts ?? phase2?.moveImpacts ?? [];
  const mode = dial < -0.25 ? 'protect' : dial > 0.25 ? 'attack' : 'balanced';
  return (
    <div className="stack">
      <div className="card glass">
        <div className="row between">
          <div>
            <div className="card-label">{t('lg.dialTitle')}</div>
            <div className="display" style={{ fontSize: '1.4rem' }}>{t(`lg.mode.${mode}`)}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="card-label">{t('lg.pWin')}</div>
            <div className="mid-num accent-text"><CountUp value={lg.pWin * 100} decimals={1} suffix="%" /></div>
          </div>
        </div>
        <p className="small muted">{t(`lg.modeExplain.${mode}`)}</p>
        <div className="dial">
          <input type="range" min={-1} max={1} step={0.1} value={dial} onChange={(e) => setDial(Number(e.target.value))} aria-label={t('lg.dial')} dir="ltr" />
          <div className="dial-labels" dir="ltr"><span>{t('lg.mode.protect')}</span><span>{t('lg.mode.balanced')}</span><span>{t('lg.mode.attack')}</span></div>
        </div>
        <p className="tiny faint">{t('lg.dialSub')}</p>
      </div>
      <h2 className="section-title">{t('lg.moveImpact')}</h2>
      <div className="card" style={{ padding: '4px 12px' }}>
        {!list.length && <div className="skeleton" style={{ height: 80, margin: 8 }} />}
        <div className="list">
          {list.slice(0, 8).map((m, i) => (
            <div key={i} className="list-row">
              <div className="grow"><MoveLine moves={m.moves} /><div className="tiny muted">{t('tr.gain')} {fmt(m.gain)}{m.hitCost ? ` · −${m.hitCost}` : ''}</div></div>
              <div style={{ textAlign: 'end' }}>
                <div className="num small muted">{pct(m.pWinBefore, 1)} → <b className={m.delta >= 0 ? 'good' : 'bad'}>{pct(m.pWinAfter, 1)}</b></div>
                <div className={`num tiny ${m.delta >= 0 ? 'good' : 'bad'}`}>{m.delta >= 0 ? '+' : ''}{fmt(m.delta * 100, 1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RivalCard({ r }: { r: RivalView }) {
  const { t, pct, fmt } = useI18n();
  const pl = usePlayer();
  const d = r.dna;
  return (
    <article className="card">
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <div className="name"><span className="num faint">{r.rank}.</span> <bdi dir="ltr">{r.name}</bdi></div>
          <div className="sub"><bdi dir="ltr">{r.player}</bdi> · <span className="num">{r.total}</span> ({r.gap >= 0 ? '+' : ''}<span className="num">{r.gap}</span>)</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div className={`mid-num ${r.pBeat >= 0.5 ? 'good' : 'bad'}`}>{pct(r.pBeat)}</div>
          <div className="tiny muted">{t('lg.beat')}</div>
        </div>
      </div>
      {d && (
        <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
          <span className="pill">{t('lg.captaincy')}: {t(`lg.style.${d.captainStyle}`)}</span>
          <span className={`pill ${d.hitRate > 0.2 ? 'warn' : ''}`}>{t('lg.hits')}: <span className="num">{d.hitPoints}</span></span>
          <span className={`pill ${d.chaser ? 'warn' : ''}`}>{d.chaser ? t('lg.chaser') : t('lg.notChaser')} <span className="num">({pct(d.chaserRate)})</span></span>
          <span className="pill">{t('lg.bank')}: <span className="num">£{fmt(d.avgBank)}m</span></span>
          <span className="pill"><span className="num">{fmt(d.transfersPerGw)}</span> {t('lg.perGw')}</span>
          <span className="pill">{t('lg.capHit')}: <span className="num">{pct(d.captainHitRate)}</span></span>
          <span className="pill">{t('lg.chipsLeft')}: {d.chipsLeft.length ? d.chipsLeft.map((c) => t(`ch.${c}`)).join('، ') : '—'}</span>
        </div>
      )}
      {r.prediction && (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div>
            <div className="card-label">{t('lg.predCaptain')}</div>
            {r.prediction.captain.slice(0, 2).map((c) => (
              <div key={c.id} className="row small" style={{ marginTop: 4 }}><MiniShirt id={c.id} /><PName id={c.id} /><span className="num muted">{pct(c.p)}</span></div>
            ))}
          </div>
          <div>
            <div className="card-label">{t('lg.predOut')} / {t('lg.predIn')}</div>
            {r.prediction.transfersOut.slice(0, 1).map((o) => <div key={o.id} className="small bad" style={{ marginTop: 4 }}><PName id={o.id} /> <span className="num">{pct(o.p)}</span></div>)}
            {r.prediction.transfersIn.slice(0, 2).map((o) => <div key={o.id} className="small good" style={{ marginTop: 4 }}><PName id={o.id} /> <span className="faint">{pl.team(o.id)}</span> <span className="num">{pct(o.p)}</span></div>)}
          </div>
        </div>
      )}
      {r.howToBeat.length > 0 && (
        <>
          <hr className="divider" />
          <div className="card-label">{t('lg.howToBeat')}</div>
          {r.howToBeat.slice(0, 2).map((h, i) => (
            <div key={i} className="row between" style={{ marginTop: 6 }}>
              <MoveLine moves={h.moves} />
              <span className={`num small ${h.delta >= 0 ? 'good' : 'bad'}`}>{pct(h.pBeat)} ({h.delta >= 0 ? '+' : ''}{fmt(h.delta * 100, 1)})</span>
            </div>
          ))}
        </>
      )}
    </article>
  );
}

function Rivals() {
  const { t } = useI18n();
  const { analysis: a } = useStore();
  const rivals = [...a!.league!.rivals].sort((x, y) => Math.abs(x.gap) - Math.abs(y.gap));
  return <div className="stack"><h2 className="section-title" style={{ margin: '4px 0 0' }}>{t('lg.rivalsTitle')}</h2>{rivals.map((r) => <RivalCard key={r.entry} r={r} />)}</div>;
}

function EoWhatIf() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a, request } = useStore();
  const lg = a!.league!;
  const mine = new Set(a!.me?.squad.map((s) => s.id) ?? []);
  const eoList = useMemo(() => Object.entries(lg.eo).map(([id, eo]) => ({ id: Number(id), eo })).sort((x, y) => y.eo - x.eo).slice(0, 20), [lg.eo]);
  const firstSwing = Object.keys(lg.swings).map(Number).sort((x, y) => (lg.eo[y] ?? 0) - (lg.eo[x] ?? 0))[0];
  const [sel, setSel] = useState<number | null>(firstSwing ?? null);
  const [extra, setExtra] = useState<Record<number, (typeof lg.swings)[number]>>({});
  const swing = sel != null ? lg.swings[sel] ?? extra[sel] : null;
  useEffect(() => {
    if (sel == null || lg.swings[sel] || extra[sel]) return;
    request<(typeof lg.swings)[number] | null>('swing', { playerId: sel }).then((s) => s && setExtra((e) => ({ ...e, [sel]: s })));
  }, [sel, lg.swings, extra, request]);
  const ord = (r: number | null) => (r == null ? '—' : fmt(r, 1));
  const pName = usePlayer().name;
  return (
    <div className="stack">
      <div className="card glass">
        <div className="card-label">{t('lg.whatIf')}</div>
        <p className="small muted" style={{ marginTop: 2 }}>{t('lg.whatIfSub')}</p>
        {sel != null && swing && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row"><MiniShirt id={sel} /><b><PName id={sel} /></b><span className="pill">{t('cap.leagueEo')} <span className="num">{fmt(lg.eo[sel] ?? 0, 0)}%</span></span></div>
            <div className="grid-2">
              <div className="card" style={{ padding: 12 }}>
                <div className="tiny muted">{t('pBlank')} · <span className="num">{pct(swing.pBlank)}</span></div>
                <div className="small">{t('lg.ifBlank', { name: pName(sel), rank: ord(swing.blankRank) })}</div>
                <div className="mid-num">{ord(swing.blankRank)}</div>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="tiny muted">{t('p10plus')} · <span className="num">{pct(swing.pHaul)}</span></div>
                <div className="small">{t('lg.ifHaul', { name: pName(sel), rank: ord(swing.haulRank) })}</div>
                <div className="mid-num">{ord(swing.haulRank)}</div>
              </div>
            </div>
            <div className="tiny faint">{t('lg.expRank')}: <span className="num">{ord(swing.baseRank)}</span></div>
          </div>
        )}
      </div>
      <h2 className="section-title">{t('lg.eoTable')}</h2>
      <div className="card" style={{ padding: '4px 12px' }}>
        <div className="list">
          {eoList.map(({ id, eo }) => (
            <button key={id} className="list-row" onClick={() => setSel(id)} style={{ background: id === sel ? 'var(--accent-soft)' : 'none', border: 0, borderBottom: '1px solid var(--border)', width: '100%', textAlign: 'start', cursor: 'pointer', color: 'inherit' }}>
              <MiniShirt id={id} />
              <div className="grow"><div className="name"><PName id={id} withTeam /></div><Bar value={Math.min(1, eo / 200)} /></div>
              <span className={`pill ${mine.has(id) ? 'good' : 'bad'}`}>{mine.has(id) ? t('lg.own') : t('lg.notOwn')}</span>
              <span className="num" style={{ fontWeight: 700, minWidth: 44, textAlign: 'end' }}>{fmt(eo, 0)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
