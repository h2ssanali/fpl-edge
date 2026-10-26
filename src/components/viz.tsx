import { useEffect, useRef, useState } from 'react';
import type { Distribution } from '../engine/types';
import { useI18n } from '../i18n';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Number that counts up from 0 (or the previous value) with ease-out. */
export function CountUp({ value, decimals = 0, duration = 900, suffix = '', className = '' }: { value: number; decimals?: number; duration?: number; suffix?: string; className?: string }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={`num ${className}`}>{shown.toFixed(decimals)}{suffix}</span>;
}

/**
 * Histogram of simulated points (from -2 to 30). Bars inside the p10–p90 band are
 * accented; the median gets a marker. Bars animate up on mount.
 */
export function DistChart({ dist, height = 90, compact = false }: { dist: Distribution; height?: number; compact?: boolean }) {
  const { t, fmt, pct } = useI18n();
  const total = dist.hist.reduce((a, b) => a + b, 0) || 1;
  // Trim long empty tails so the shape fills the width.
  let first = dist.hist.findIndex((c) => c / total > 0.0015);
  let last = dist.hist.length - 1 - [...dist.hist].reverse().findIndex((c) => c / total > 0.0015);
  if (first < 0) { first = 0; last = dist.hist.length - 1; }
  const bins = dist.hist.slice(first, last + 1).map((c, i) => ({ pts: dist.histStart + (first + i) * dist.histStep, p: c / total }));
  const maxP = Math.max(...bins.map((b) => b.p), 0.01);
  const w = 300;
  const bw = w / Math.max(1, bins.length);
  const tickEvery = Math.max(1, Math.round(5 / dist.histStep)) * (bins.length > 24 ? 2 : 1);
  return (
    <div dir="ltr">
      <svg className="dist" viewBox={`0 0 ${w} ${height + 16}`} role="img" aria-label={`${t('median')} ${fmt(dist.median, 0)}`}>
        {bins.map((b, i) => {
          const h = Math.max(1, (b.p / maxP) * height);
          const inBand = b.pts + dist.histStep > dist.p10 && b.pts <= dist.p90;
          return (
            <rect key={i} className="b" x={i * bw + 1} y={height - h} width={Math.max(1, bw - 2)} height={h} rx={2}
              fill={inBand ? 'var(--accent)' : 'var(--faint)'} opacity={inBand ? 0.9 : 0.45}
              style={{ animationDelay: `${i * 18}ms` }} />
          );
        })}
        {(() => {
          const idx = bins.findIndex((b) => b.pts + dist.histStep > dist.median);
          const x = (idx < 0 ? bins.length - 1 : idx) * bw + bw / 2;
          return <line x1={x} x2={x} y1={0} y2={height} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 3" />;
        })()}
        {bins.map((b, i) => ((first + i) % tickEvery === 0 ? <text key={`t${i}`} x={i * bw + bw / 2} y={height + 13} fontSize="10" textAnchor="middle" fill="var(--muted)" fontFamily="var(--font-num)">{b.pts}</text> : null))}
      </svg>
      {!compact && (
        <div className="dist-legend" dir="auto">
          <span>{t('median')} <b>{fmt(dist.median, 0)}</b></span>
          <span>{t('range')} <b>{fmt(dist.p10, 0)}–{fmt(dist.p90, 0)}</b></span>
          <span>{t('p10plus')} <b>{pct(dist.p10plus)}</b></span>
        </div>
      )}
    </div>
  );
}

/** Semicircle gauge 0..1 */
export function Gauge({ value, label, color = 'var(--accent)', display }: { value: number; label?: string; color?: string; display?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const r = 80, c = Math.PI * r;
  const [offset, setOffset] = useState(c);
  useEffect(() => { const id = requestAnimationFrame(() => setOffset(c * (1 - v))); return () => cancelAnimationFrame(id); }, [v, c]);
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 112" aria-hidden>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--surface-2)" strokeWidth="14" strokeLinecap="round" />
        <path className="arc" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div className="g-val">
        <div className="mid-num">{display ?? <CountUp value={v * 100} suffix="%" />}</div>
      </div>
      {label && <div className="tiny muted g-label">{label}</div>}
    </div>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></div>;
}

export function Spark({ values, width = 80, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / Math.max(1e-6, max - min)) * height}`).join(' ');
  const up = values.at(-1)! >= values[0];
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ direction: "ltr" }} aria-hidden><polyline points={pts} fill="none" stroke={up ? 'var(--good)' : 'var(--bad)'} strokeWidth="2" strokeLinecap="round" /></svg>;
}

const fdrIdx = (f: number) => Math.max(1, Math.min(5, Math.round(f)));
/** Official FPL difficulty colours (background + readable text). */
export const fdrColor = (f: number) => `var(--fdr-${fdrIdx(f)})`;
export const fdrText = (f: number) => (fdrIdx(f) === 2 || fdrIdx(f) === 3 ? '#0b1f14' : '#ffffff');
