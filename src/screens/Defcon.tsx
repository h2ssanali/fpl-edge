import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { MiniShirt, Money, PageHeader, PName, Seg, usePlayer } from '../components/ui';
import type { DefconRow } from '../engine/defcon';

type Sort = 'next' | 'season' | 'value';

export function Defcon() {
  const { t, fmt, pct } = useI18n();
  const { analysis: a } = useStore();
  const pl = usePlayer();
  const [pos, setPos] = useState<2 | 3 | 4>(2);
  const [sort, setSort] = useState<Sort>('next');
  if (!a) return null;
  const mine = new Set(a.me?.squad.map((m) => m.id) ?? []);
  const cost = (r: DefconRow) => pl.p(r.id)?.cost ?? 50;
  const key = (r: DefconRow) => (sort === 'next' ? r.xPts6 : sort === 'season' ? r.rate + r.full / 1000 : r.xPts6 / (cost(r) / 10));
  const rows = a.defcon.filter((r) => r.pos === pos && r.full >= 2).sort((x, y) => key(y) - key(x)).slice(0, 25);
  const fx = (id: number) => (a.players[id]?.fx ?? []).map((f) => `${pl.teamShort(f.opp)} (${t(f.home ? 'H' : 'A')})`).join(' + ') || t('r.blank');
  const thr = pos === 2 ? 10 : 12;

  return (
    <div>
      <PageHeader title={t('dc.title')} sub={t('dc.sub')} back="#/more" />
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>{t('dc.explain')}</p></div>

      <div style={{ marginTop: 12 }}>
        <Seg full value={pos} onChange={setPos} options={[{ value: 2, label: t('dc.def') }, { value: 3, label: t('dc.mid') }, { value: 4, label: t('dc.fwd') }]} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Seg full value={sort} onChange={setSort} options={[{ value: 'next', label: t('dc.sortNext') }, { value: 'season', label: t('dc.sortSeason') }, { value: 'value', label: t('dc.sortValue') }]} />
      </div>
      <p className="tiny muted" style={{ margin: '6px 2px 0' }}>{t(`dc.sortHint.${sort}`)} · {t('dc.need', { n: thr })}</p>

      <div className="stack" style={{ marginTop: 10 }}>
        {rows.map((r, i) => (
          <article key={r.id} className={`card ${i === 0 ? 'accent' : ''}`} style={{ padding: '10px 14px' }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ minWidth: 0 }}>
                <span className="num faint" style={{ width: 20 }}>{i + 1}</span>
                <MiniShirt id={r.id} />
                <div style={{ minWidth: 0 }}>
                  <div className="name"><PName id={r.id} withTeam /> {mine.has(r.id) && <span className="pill accent">{t('dc.yours')}</span>}</div>
                  <div className="sub"><Money v={cost(r)} /> · {t('fx.owned', { p: (pl.p(r.id)?.sel ?? 0).toFixed(1) })} · {t('home.vs', { fx: fx(r.id) })}</div>
                </div>
              </div>
              <div style={{ textAlign: 'end', minWidth: 74 }}>
                <div className="num accent-text" style={{ fontWeight: 700, fontSize: '1.2rem' }}>{pct(r.rate)}</div>
                <div className="tiny muted">{t('dc.rateLbl')}</div>
              </div>
            </div>

            <div className="row" style={{ gap: 4, marginTop: 8 }} dir="ltr">
              {r.last.map((g) => (
                <div key={g.gw} style={{ flex: 1, textAlign: 'center' }}>
                  <div className="num small" style={{
                    borderRadius: 8, padding: '3px 0', fontWeight: 700,
                    background: g.dc == null ? 'transparent' : g.hit ? 'var(--good)' : 'var(--surface-2)',
                    color: g.hit ? '#0b0f14' : g.dc == null ? 'var(--faint)' : 'var(--text)',
                    border: g.dc == null ? '1px dashed var(--border)' : '1px solid transparent',
                  }}>{g.dc ?? '–'}</div>
                  <div className="tiny muted num">{t('gwShort')}{g.gw}</div>
                </div>
              ))}
            </div>

            <div className="facts">
              <span className="fact">{t('dc.hits')} <b>{r.hits}/{r.full}</b></span>
              <span className="fact">{t('dc.per90')} <b>{fmt(r.per90)}</b></span>
              <span className="fact">{t('dc.seasonPts')} <b>{r.pts}</b></span>
              <span className="fact">{t('dc.nextGw')} <b>{pct(Math.min(1, r.pNext))}</b></span>
              <span className="fact">{t('dc.next6')} <b>{fmt(r.xPts6)}</b></span>
            </div>
          </article>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: '10px 2px 0', lineHeight: 1.7 }}>{t('dc.boxesNote', { n: thr })}</p>
    </div>
  );
}
