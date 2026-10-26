import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, PageHeader, usePlayer } from '../components/ui';
import { useMe } from '../components/MyRank';
import { bestXI } from '../engine/squad';
import type { ChipAdvice } from '../engine/chips';

const NAMES: Record<string, string> = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };

export function Chips() {
  const { t, fmt } = useI18n();
  const { analysis: a, phase2 } = useStore();
  const pl = usePlayer();
  const manager = useMe();
  if (!a) return null;
  const chips = phase2?.chips;
  const me = a.me;

  const why = (c: ChipAdvice): string | null => {
    if (!c.best || !me) return null;
    const gi = a.horizon.indexOf(c.best.gw);
    const score = (id: number) => a.players[id]?.xp[gi] ?? 0;
    const r = bestXI(me.squad, score);
    const extra = c.best.dgwTeams ? ` ${t('ch.whyDgw', { n: c.best.dgwTeams })}` : c.best.bgwTeams ? ` ${t('ch.whyBgw', { n: c.best.bgwTeams })}` : '';
    switch (c.chip) {
      case '3xc': return t('ch.why3xc', { name: r.captain ? pl.name(r.captain.id) : '—', v: fmt(c.best.value), gw: c.best.gw }) + extra;
      case 'bboost': return t('ch.whyBb', { v: fmt(c.best.value), gw: c.best.gw }) + extra;
      case 'freehit': return t('ch.whyFh', { v: fmt(c.best.value), gw: c.best.gw }) + extra;
      case 'wildcard': return t('ch.whyWc', { v: fmt(c.best.value), gw: c.best.gw });
    }
  };
  const usedIn = (name: string) => manager?.chips.filter((u) => u.name === name).map((u) => u.gw) ?? [];

  return (
    <div>
      <PageHeader title={t('ch.title')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('ch.explain')}</p></div>
      {!me ? <Empty>{t('tr.noSquad')}</Empty> : !chips ? <div className="card" style={{ marginTop: 12 }}><div className="skeleton" style={{ height: 120 }} /><p className="small muted">{t('ch.computing')}</p></div> : (
        <div className="stack" style={{ marginTop: 12 }}>
          {!chips.some((c) => c.available) && <div className="card"><p style={{ margin: 0 }}>{t('ch.noneAvail')}</p></div>}
          {chips.map((c) => {
            const vals = c.values.filter((v) => !c.window || (v.gw >= c.window[0] && v.gw <= c.window[1]));
            const max = Math.max(1, ...vals.map((v) => v.value));
            const used = usedIn(c.chip);
            const reason = why(c);
            return (
              <article key={c.chip} className={`card ${c.best ? 'accent' : ''}`}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="display num" style={{ fontSize: '1.2rem' }}>{NAMES[c.chip]}</div>
                    <div className="small muted">{t(`ch.desc.${c.chip}`)}</div>
                  </div>
                  {c.best && (
                    <div style={{ textAlign: 'end', minWidth: 90 }}>
                      <div className="card-label">{t('ch.best')}</div>
                      <div className="mid-num accent-text">{t('gw')} {c.best.gw}</div>
                    </div>
                  )}
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  {c.available && c.window ? t('ch.availableRange', { a: c.window[0], b: c.window[1] }) : t('ch.usedIn', { gws: used.length ? used.join('، ') : '—' })}
                </div>
                {reason && <p style={{ margin: '8px 0 0', lineHeight: 1.7 }}><b>{t('ch.whyLabel')}</b> {reason}</p>}
                {c.chip === 'wildcard' && <a className="btn small primary" href="#/more/wildcard" style={{ marginTop: 8 }}>{t('wc.cta')}</a>}
                {vals.length > 0 && (
                  <>
                    <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 70, marginTop: 10 }} dir="ltr">
                      {vals.map((v) => (
                        <div key={v.gw} style={{ flex: 1, textAlign: 'center' }} title={`GW${v.gw}: ${fmt(v.value)}`}>
                          <div className="tiny num">{fmt(v.value, 0)}</div>
                          <div style={{ height: `${Math.max(4, (Math.max(0, v.value) / max) * 44)}px`, background: v.gw === c.best?.gw ? 'var(--accent)' : 'var(--surface-2)', borderRadius: 4, border: v.dgwTeams ? '1px solid var(--accent)' : undefined }} />
                          <div className="tiny num muted">{t('gwShort')}{v.gw}</div>
                        </div>
                      ))}
                    </div>
                    <p className="tiny muted" style={{ margin: '6px 0 0' }}>{t('ch.barsNote')}</p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
