import { useI18n } from '../i18n';
import { useStore } from '../store';
import { usePlayer } from './ui';
import type { Plan } from '../engine/optimizer';

/**
 * Plain-language transfer advice for the coming gameweeks: what we recommend most,
 * why the outgoing player should go, why the incoming one is the best use of the
 * money, and whether a second move or a -4 hit is worth it.
 */
export function TransferReport() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a, phase2, players } = useStore();
  const pl = usePlayer();
  const me = a?.me;
  if (!a || !me) return null;
  if (!phase2) return <section className="card accent glass" style={{ marginBottom: 14 }}><div className="skeleton" style={{ height: 120 }} /></section>;
  const from = a.horizon[0];
  const to = a.horizon[Math.min(5, a.horizon.length - 1)];
  const sum6 = (id: number) => (a.players[id]?.xp ?? []).slice(0, 6).reduce((s, x) => s + x, 0);
  const next3 = (id: number) => {
    const team = players.get(id)?.team ?? 0;
    return (a.grid[team] ?? []).slice(0, 3).map((fx) => (fx.length ? fx.map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') : t('r.blank'))).join('، ');
  };
  const avgFdr = (id: number) => {
    const team = players.get(id)?.team ?? 0;
    const cells = (a.grid[team] ?? []).slice(0, 3).flat();
    return cells.length ? cells.reduce((s, f) => s + f.fdr, 0) / cells.length : 5;
  };
  const best: Plan | undefined = phase2.plans[0]?.[0];
  const worth = best && best.gain >= 1.5;
  const twoFree = me.ft >= 2 ? phase2.plans[1]?.find((p) => p.hitCost === 0) : undefined;
  const alt = phase2.plans[0]?.[1];

  const whyOut = (id: number): string[] => {
    const p = players.get(id)!;
    const s = a.players[id];
    const r: string[] = [];
    if (p.status !== 'a' && p.news) r.push(t('trr.outNews', { news: p.news }));
    else if (s && s.pStart < 0.6) r.push(t('trr.outStart', { p: pct(s.pStart) }));
    if (avgFdr(id) >= 3.4) r.push(t('trr.outFixtures', { fx: next3(id) }));
    r.push(t('trr.outXp', { x: fmt(sum6(id)) }));
    return r;
  };
  const whyIn = (id: number): string[] => {
    const s = a.players[id];
    const r: string[] = [t('trr.inXp', { x: fmt(sum6(id)) })];
    r.push(t('trr.inFixtures', { fx: next3(id) }));
    if (s) r.push(t('trr.inStart', { p: pct(s.pStart) }));
    const xg = s?.reasons.find((x) => x.key === 'xg90');
    const xa = s?.reasons.find((x) => x.key === 'xa90');
    if (xg) r.push(t('r.xg90', xg.params));
    if (xa) r.push(t('r.xa90', xa.params));
    if (s?.reasons.some((x) => x.key === 'pens')) r.push(t('r.pens'));
    return r;
  };

  return (
    <section className="card accent glass" style={{ marginBottom: 14 }}>
      <div className="display" style={{ fontSize: '1.15rem' }}>{t('trr.title', { gw: from })}</div>
      {!worth || !best ? (
        <p style={{ margin: '8px 0 0', lineHeight: 1.8 }}>{t('trr.roll', { ft: me.ft, next: Math.min(5, me.ft + 1) })}</p>
      ) : (
        <>
          <p style={{ margin: '8px 0 4px', lineHeight: 1.8, fontSize: '1.05rem' }}>
            {t('trr.main', { out: pl.name(best.moves[0].out), in: pl.name(best.moves[0].in), gain: fmt(best.gain), from, to })}
          </p>
          <div className="grid-2" style={{ marginTop: 8 }}>
            <div>
              <div className="card-label bad">{t('trr.whyOut', { name: pl.name(best.moves[0].out) })}</div>
              <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, lineHeight: 1.7 }} className="small">{whyOut(best.moves[0].out).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <div className="card-label good">{t('trr.whyIn', { name: pl.name(best.moves[0].in) })}</div>
              <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, lineHeight: 1.7 }} className="small">{whyIn(best.moves[0].in).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
          <p className="small" style={{ margin: '10px 0 0', lineHeight: 1.7 }}>{t('trr.bank', { bank: (best.bankAfter / 10).toFixed(1) })}</p>
          {alt && alt.gain > 0.5 && <p className="small muted" style={{ margin: '4px 0 0' }}>{t('trr.alt', { out: pl.name(alt.moves[0].out), in: pl.name(alt.moves[0].in), gain: fmt(alt.gain), diff: fmt(best.gain - alt.gain) })}</p>}
          {twoFree && twoFree.gain > best.gain + 1 && (
            <p className="small" style={{ margin: '4px 0 0' }}>{t('trr.two', { ft: me.ft, moves: twoFree.moves.map((m) => t('trr.pair', { out: pl.name(m.out), in: pl.name(m.in) })).join('، '), gain: fmt(twoFree.gain) })}</p>
          )}
          {phase2.hit && (
            <p className={`small ${phase2.hit.worthIt ? 'good' : 'muted'}`} style={{ margin: '4px 0 0' }}>
              {phase2.hit.worthIt ? t('trr.hitYes', { gain: fmt(phase2.hit.gainVsFree) }) : t('trr.hitNo', { gain: fmt(Math.max(0, phase2.hit.gainVsFree)) })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
