import type { SVGProps } from 'react';

// Hand-drawn line icons (no emoji, no icon fonts). 24×24 grid, currentColor stroke.
const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props,
});

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 10.5 12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5.5h5V20" /></svg>
);
export const IconArmband = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="7" width="18" height="10" rx="3" /><path d="M13.6 10.2a2.6 2.6 0 1 0 0 3.6" /></svg>
);
export const IconTransfer = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 8h13" /><path d="m14 4 4 4-4 4" /><path d="M20 16H7" /><path d="m10 12-4 4 4 4" /></svg>
);
export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1" /><path d="M12 13v3M8.5 20h7M10 16h4l.5 4h-5L10 16Z" /></svg>
);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg>
);
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
);
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>
);
export const IconShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 15V3.5M8 7.5l4-4 4 4" /><path d="M5 12v7.5h14V12" /></svg>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3.5V15M8 11l4 4 4-4" /><path d="M5 19.5h14" /></svg>
);
export const IconPulse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></svg>
);
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5-8.5-8.5Z" /><circle cx="8" cy="8.5" r="1.3" /></svg>
);
export const IconDiamond = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 4h12l3.5 5L12 20.5 2.5 9 6 4Z" /><path d="M2.5 9h19M9 4l3 16.5L15 4" /></svg>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" /></svg>
);
export const IconChip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" /></svg>
);
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8L12 3.5Z" /></svg>
);
export const IconCross = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
);
export const IconReport = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3.5h9l3.5 3.5v13.5H6V3.5Z" /><path d="M9 12h6M9 15.5h6M9 8.5h3" /></svg>
);
export const IconRewind = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4v4.5H8" /><path d="M12 8v4.5l3 2" /></svg>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2V5.5Z" /><path d="M4 20.5A2 2 0 0 1 6 18.5h13v2H6" /><path d="M9 8h6" /></svg>
);
export const IconStorm = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 15.5a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 19 8.5a3.5 3.5 0 0 1-.5 7" /><path d="m12.5 12-2.5 4.5h3.5L11 21" /></svg>
);
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /><path d="m9.5 12 2-2 3 3" /></svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9.5 2.5h5" /></svg>
);
export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const IconArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);
export const IconArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
);
export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconBall = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m12 7.5 3.6 2.6-1.4 4.3H9.8L8.4 10.1 12 7.5Z" /><path d="M12 3v4.5M20.6 9.5l-5 .6M17.5 19.3l-3.3-4.9M6.5 19.3l3.3-4.9M3.4 9.5l5 .6" /></svg>
);

export function BrandMark(p: SVGProps<SVGSVGElement>) {
  // Floodlight pylon + edge spark
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="brand-mark" {...p}>
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="color-mix(in srgb, var(--accent) 50%, #0b2b1d)" /></linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#bm)" />
      <path d="M9 9h14l-2 4H11l-2-4Z" fill="var(--accent-ink)" />
      <path d="M15 13h2l1.6 12h-5.2L15 13Z" fill="var(--accent-ink)" opacity="0.85" />
      <circle cx="12" cy="10.6" r="1" fill="var(--accent)" /><circle cx="16" cy="10.6" r="1" fill="var(--accent)" /><circle cx="20" cy="10.6" r="1" fill="var(--accent)" />
    </svg>
  );
}
