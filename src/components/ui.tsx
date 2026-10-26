import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Shirt } from './Shirt';
import { IconBack } from './icons';
import type { Reason } from '../engine/types';

export function Seg<T extends string | number>({ value, options, onChange, full = false }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; full?: boolean }) {
  return (
    <div className={`seg ${full ? 'full' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, back }: { title: string; sub?: string; back?: string }) {
  const { t } = useI18n();
  return (
    <header>
      {back && <a href={back} className="card-link row small" style={{ gap: 4, marginBottom: 4 }}><IconBack width={14} height={14} className="back-ico" /> {t('tab.more')}</a>}
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </header>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export function Countdown({ deadline, compact = false }: { deadline: string | null; compact?: boolean }) {
  const { t } = useI18n();
  const now = useNow();
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return <div className="countdown"><span className="pill warn">{t('deadlinePassed')}</span></div>;
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const urgent = ms < 6 * 3600000;
  const units = [[d, t('days')], [h, t('hours')], [m, t('minutes')], [s, t('seconds')]] as const;
  return (
    <div className={`countdown ${urgent ? 'cd-urgent' : ''}`} role="timer" aria-live="off">
      {units.map(([v, l], i) => (
        <div key={i} style={{ display: 'contents' }}>
          {i > 0 && !compact && <span className="cd-sep">:</span>}
          <div className="cd-unit"><div className="cd-num">{String(v).padStart(2, '0')}</div><div className="cd-lbl">{l}</div></div>
        </div>
      ))}
    </div>
  );
}

export function usePlayer() {
  const { players, teams } = useStore();
  return {
    name: (id: number) => players.get(id)?.web ?? `#${id}`,
    team: (id: number) => teams.get(players.get(id)?.team ?? 0)?.short ?? '',
    teamShort: (teamId: number) => teams.get(teamId)?.short ?? '',
    p: (id: number) => players.get(id),
  };
}

/** Player name kept in English (LTR) inside Arabic text. */
export function PName({ id, withTeam = false }: { id: number; withTeam?: boolean }) {
  const pl = usePlayer();
  return <bdi dir="ltr">{pl.name(id)}{withTeam && <span className="faint"> · {pl.team(id)}</span>}</bdi>;
}

export function MiniShirt({ id }: { id: number }) {
  const pl = usePlayer();
  const p = pl.p(id);
  return <Shirt team={pl.team(id)} gk={p?.pos === 1} className="mini-shirt" />;
}

export function Reasons({ reasons, max = 6 }: { reasons: Reason[]; max?: number }) {
  const { reason } = useI18n();
  return (
    <div className="reasons">
      {reasons.slice(0, max).map((r, i) => <span key={i} className={`reason ${r.tone ?? ''}`}>{reason(r)}</span>)}
    </div>
  );
}

export function Money({ v }: { v: number }) {
  return <span className="num">£{(v / 10).toFixed(1)}m</span>;
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading-screen">
      <div>
        <svg className="loader-ball" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="12" cy="12" r="9" /><path d="m12 7.5 3.6 2.6-1.4 4.3H9.8L8.4 10.1 12 7.5Z" /><path d="M12 3v4.5M20.6 9.5l-5 .6M17.5 19.3l-3.3-4.9M6.5 19.3l3.3-4.9M3.4 9.5l5 .6" /></svg>
        <div className="display" style={{ fontSize: '1.1rem' }}>{label ?? t('loading')}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Kv({ items }: { items: { k: string; v: ReactNode }[] }) {
  return <div className="kv">{items.map((it, i) => <div key={i}><div className="k">{it.k}</div><div className="v">{it.v}</div></div>)}</div>;
}
