import { useId } from 'react';

// Club kit colours (colours only — no crests or trademarks).
type Kit = { body: string; sleeve: string; trim: string; pattern?: 'stripes' | 'hoops' | 'halves' };
const KITS: Record<string, Kit> = {
  ARS: { body: '#e3141c', sleeve: '#ffffff', trim: '#ffffff' },
  AVL: { body: '#7a1a3d', sleeve: '#94c3eb', trim: '#f4d03f' },
  BOU: { body: '#d71920', sleeve: '#111111', trim: '#111111', pattern: 'stripes' },
  BRE: { body: '#e30613', sleeve: '#e30613', trim: '#111111', pattern: 'stripes' },
  BHA: { body: '#0057b8', sleeve: '#0057b8', trim: '#ffffff', pattern: 'stripes' },
  BUR: { body: '#6c1d45', sleeve: '#99d6ea', trim: '#99d6ea' },
  CHE: { body: '#034694', sleeve: '#034694', trim: '#ffffff' },
  COV: { body: '#7cc7ef', sleeve: '#7cc7ef', trim: '#ffffff' },
  CRY: { body: '#1b458f', sleeve: '#1b458f', trim: '#c4122e', pattern: 'stripes' },
  EVE: { body: '#003399', sleeve: '#003399', trim: '#ffffff' },
  FUL: { body: '#ffffff', sleeve: '#ffffff', trim: '#111111' },
  HUL: { body: '#f5a12d', sleeve: '#111111', trim: '#111111', pattern: 'stripes' },
  IPS: { body: '#3a64a3', sleeve: '#3a64a3', trim: '#ffffff' },
  LEE: { body: '#ffffff', sleeve: '#ffffff', trim: '#1d428a' },
  LEI: { body: '#003090', sleeve: '#003090', trim: '#fdbe11' },
  LIV: { body: '#c8102e', sleeve: '#c8102e', trim: '#f6eb61' },
  MCI: { body: '#6cabdd', sleeve: '#6cabdd', trim: '#ffffff' },
  MUN: { body: '#da291c', sleeve: '#da291c', trim: '#fbe122' },
  NEW: { body: '#1c1c1c', sleeve: '#1c1c1c', trim: '#ffffff', pattern: 'stripes' },
  NFO: { body: '#dd0000', sleeve: '#dd0000', trim: '#ffffff' },
  SHU: { body: '#ee2737', sleeve: '#ee2737', trim: '#ffffff', pattern: 'stripes' },
  SOU: { body: '#d71920', sleeve: '#ffffff', trim: '#ffffff', pattern: 'stripes' },
  SUN: { body: '#eb172b', sleeve: '#eb172b', trim: '#ffffff', pattern: 'stripes' },
  TOT: { body: '#ffffff', sleeve: '#ffffff', trim: '#132257' },
  WHU: { body: '#7a263a', sleeve: '#1bb1e7', trim: '#1bb1e7' },
  WOL: { body: '#fdb913', sleeve: '#fdb913', trim: '#231f20' },
  WAT: { body: '#fbee23', sleeve: '#fbee23', trim: '#ed2127' },
  NOR: { body: '#fff200', sleeve: '#fff200', trim: '#00a650' },
  MID: { body: '#e21a23', sleeve: '#e21a23', trim: '#ffffff' },
  WBA: { body: '#122f67', sleeve: '#122f67', trim: '#ffffff', pattern: 'stripes' },
  STK: { body: '#e03a3e', sleeve: '#e03a3e', trim: '#ffffff', pattern: 'stripes' },
};

function hashKit(short: string): Kit {
  let h = 0;
  for (const c of short) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return { body: `hsl(${hue} 65% 45%)`, sleeve: `hsl(${hue} 65% 45%)`, trim: '#ffffff' };
}

export const kitFor = (short: string) => KITS[short] ?? hashKit(short);

const GK: Kit = { body: '#c6f432', sleeve: '#1d1d1d', trim: '#1d1d1d' };

export function Shirt({ team, gk = false, className = 'shirt', size }: { team: string; gk?: boolean; className?: string; size?: number }) {
  const kit = gk ? GK : kitFor(team);
  const id = useId().replace(/:/g, '');
  const body = 'M16 6 L22 4 Q32 9 42 4 L48 6 L60 16 L53 26 L47 22 L47 58 Q32 61 17 58 L17 22 L11 26 L4 16 Z';
  return (
    <svg viewBox="0 0 64 64" className={className} width={size} height={size} aria-hidden>
      <defs>
        <clipPath id={`c${id}`}><path d={body} /></clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path d={body} fill={kit.body} />
      <g clipPath={`url(#c${id})`}>
        {kit.pattern === 'stripes' && [20, 30, 40].map((x) => <rect key={x} x={x} y="0" width="5" height="64" fill={kit.trim} opacity="0.95" />)}
        <path d="M4 16 L16 6 L17 22 L11 26 Z" fill={kit.sleeve} />
        <path d="M60 16 L48 6 L47 22 L53 26 Z" fill={kit.sleeve} />
        <rect x="0" y="0" width="64" height="64" fill={`url(#g${id})`} />
      </g>
      <path d="M22 4 Q32 12 42 4" fill="none" stroke={kit.trim} strokeWidth="3" strokeLinecap="round" />
      <path d={body} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
    </svg>
  );
}
