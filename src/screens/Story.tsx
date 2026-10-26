import { useEffect, useRef, useState } from 'react';
import { useI18n, type T } from '../i18n';
import { useStore } from '../store';
import { Empty, PageHeader, Seg } from '../components/ui';
import { kitFor } from '../components/Shirt';
import { IconDownload, IconShare } from '../components/icons';
import type { Analysis, Phase2 } from '../engine/analyze';
import type { Distribution, Player, Team } from '../engine/types';

type Kind = 'gw' | 'captain' | 'prediction' | 'league';
const W = 1080, H = 1920;
const ACCENT = '#d4ff3a';
const SHIRT = 'M16 6 L22 4 Q32 9 42 4 L48 6 L60 16 L53 26 L47 22 L47 58 Q32 61 17 58 L17 22 L11 26 L4 16 Z';

interface Ctx { a: Analysis; p2: Phase2 | null; players: Map<number, Player>; teams: Map<number, Team>; t: T; lang: string }

function background(c: CanvasRenderingContext2D) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e3424'); g.addColorStop(0.45, '#071d15'); g.addColorStop(1, '#02060b');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // grass stripes
  c.save();
  const m = c.createLinearGradient(0, 0, 0, H);
  m.addColorStop(0, 'rgba(255,255,255,0.035)'); m.addColorStop(0.7, 'rgba(255,255,255,0.0)');
  c.fillStyle = m;
  for (let x = 0; x < W; x += 180) c.fillRect(x, 0, 90, H);
  c.restore();
  // floodlights
  for (const x of [80, W - 80]) {
    const r = c.createRadialGradient(x, -40, 10, x, -40, 900);
    r.addColorStop(0, 'rgba(220,255,240,0.28)'); r.addColorStop(1, 'rgba(220,255,240,0)');
    c.fillStyle = r; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - 45 + i * 30, 46, 7, 0, Math.PI * 2); c.fill(); }
  }
  // broadcast scanlines
  c.fillStyle = 'rgba(255,255,255,0.018)';
  for (let y = 0; y < H; y += 6) c.fillRect(0, y, W, 2);
  // pitch arc at bottom
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 4;
  c.beginPath(); c.arc(W / 2, H + 120, 420, Math.PI, 0); c.stroke();
  c.strokeRect(60, 60, W - 120, H - 120);
}

function brand(c: CanvasRenderingContext2D, ctx: Ctx, label: string) {
  c.save();
  c.fillStyle = ACCENT; roundRect(c, 90, 120, 74, 74, 20); c.fill();
  c.fillStyle = '#0b1a02'; c.beginPath(); c.moveTo(108, 140); c.lineTo(146, 140); c.lineTo(140, 154); c.lineTo(114, 154); c.closePath(); c.fill();
  c.fillRect(124, 154, 6, 26);
  c.fillStyle = '#fff'; c.font = '700 54px "Barlow Condensed"'; c.textAlign = 'left'; c.direction = 'ltr';
  c.fillText('ARK', 186, 176); const w = c.measureText('ARK').width; c.fillStyle = ACCENT; c.fillText('ILO', 186 + w, 176);
  c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = '600 40px "Barlow Condensed"';
  c.fillText(`${ctx.t('gw').toUpperCase()} ${ctx.a.gw}`, W - 90, 172);
  c.restore();
  text(c, label, W / 2, 330, `600 64px "Reem Kufi"`, '#ffffff', 'center', ctx.lang);
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign, lang: string) {
  c.save(); c.font = font; c.fillStyle = color; c.textAlign = align; c.direction = lang === 'ar' ? 'rtl' : 'ltr'; c.fillText(s, x, y); c.restore();
}
function latin(c: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') {
  c.save(); c.font = font; c.fillStyle = color; c.textAlign = align; c.direction = 'ltr'; c.fillText(s, x, y); c.restore();
}
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function glass(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.save(); roundRect(c, x, y, w, h, 36); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 2; c.stroke(); c.restore();
}
function shirt(c: CanvasRenderingContext2D, team: string, x: number, y: number, size: number, gk = false) {
  const kit = gk ? { body: '#c6f432', sleeve: '#1d1d1d', trim: '#1d1d1d' } : kitFor(team);
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(size / 64, size / 64);
  const p = new Path2D(SHIRT);
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
  c.fillStyle = kit.body; c.fill(p); c.shadowColor = 'transparent';
  c.save(); c.clip(p);
  if ('pattern' in kit && kit.pattern === 'stripes') { c.fillStyle = kit.trim; [20, 30, 40].forEach((sx) => c.fillRect(sx, 0, 5, 64)); }
  c.fillStyle = kit.sleeve; c.beginPath(); c.moveTo(4, 16); c.lineTo(16, 6); c.lineTo(17, 22); c.lineTo(11, 26); c.fill();
  c.beginPath(); c.moveTo(60, 16); c.lineTo(48, 6); c.lineTo(47, 22); c.lineTo(53, 26); c.fill();
  const sh = c.createLinearGradient(0, 0, 64, 64); sh.addColorStop(0, 'rgba(255,255,255,0.3)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = sh; c.fillRect(0, 0, 64, 64); c.restore();
  c.strokeStyle = kit.trim; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(22, 4); c.quadraticCurveTo(32, 12, 42, 4); c.stroke();
  c.restore();
}
function histogram(c: CanvasRenderingContext2D, d: Distribution, x: number, y: number, w: number, h: number) {
  const total = d.hist.reduce((s, v) => s + v, 0) || 1;
  let first = d.hist.findIndex((v) => v / total > 0.002);
  let last = d.hist.length - 1 - [...d.hist].reverse().findIndex((v) => v / total > 0.002);
  if (first < 0) { first = 0; last = d.hist.length - 1; }
  const bins = d.hist.slice(first, last + 1);
  const mx = Math.max(...bins) / total || 0.01;
  const bw = w / bins.length;
  const tick = Math.max(1, Math.round(5 / d.histStep)) * (bins.length > 24 ? 2 : 1);
  bins.forEach((v, i) => {
    const pts = d.histStart + (first + i) * d.histStep;
    const bh = Math.max(4, (v / total / mx) * h);
    const inBand = pts + d.histStep > d.p10 && pts <= d.p90;
    c.fillStyle = inBand ? ACCENT : 'rgba(255,255,255,0.22)';
    roundRect(c, x + i * bw + 3, y + h - bh, Math.max(2, bw - 6), bh, Math.min(6, bw / 3)); c.fill();
    if ((first + i) % tick === 0) latin(c, String(pts), x + i * bw + bw / 2, y + h + 44, '500 30px "Barlow Condensed"', 'rgba(255,255,255,0.6)');
  });
}
function ring(c: CanvasRenderingContext2D, p: number, x: number, y: number, r: number) {
  c.save(); c.lineWidth = 36; c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = ACCENT; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, p)); c.stroke(); c.restore();
}
function stat(c: CanvasRenderingContext2D, ctx: Ctx, label: string, value: string, x: number, y: number) {
  latin(c, value, x, y, '700 92px "Barlow Condensed"', '#fff');
  text(c, label, x, y + 54, '500 34px "IBM Plex Sans Arabic"', 'rgba(255,255,255,0.65)', 'center', ctx.lang);
}
function footer(c: CanvasRenderingContext2D, ctx: Ctx) {
  latin(c, (location.host + location.pathname).replace(/\/$/, ''), W / 2, H - 110, '600 34px "Barlow Condensed"', 'rgba(255,255,255,0.55)');
  text(c, ctx.t('tagline'), W / 2, H - 160, '500 36px "IBM Plex Sans Arabic"', 'rgba(255,255,255,0.75)', 'center', ctx.lang);
}

function draw(c: CanvasRenderingContext2D, kind: Kind, ctx: Ctx) {
  const { a, p2, players, teams, t } = ctx;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const short = (id: number) => teams.get(players.get(id)?.team ?? 0)?.short ?? '';
  background(c);
  if (kind === 'gw') {
    const r = p2?.report;
    brand(c, ctx, t('st.gw'));
    if (!r) return footer(c, ctx);
    latin(c, String(r.points), W / 2, 820, '800 420px "Barlow Condensed"', '#fff');
    text(c, `${t('points')} · ${t('gw')} ${r.gw}`, W / 2, 900, '600 52px "Reem Kufi"', ACCENT, 'center', ctx.lang);
    glass(c, 110, 980, W - 220, 300);
    stat(c, ctx, t('rp.vsAvg'), `${r.points - r.avg >= 0 ? '+' : ''}${r.points - r.avg}`, W / 2 - 230, 1120);
    stat(c, ctx, t('rp.vsTop'), r.top10k == null ? '—' : `${r.points - r.top10k >= 0 ? '+' : ''}${Math.round(r.points - r.top10k)}`, W / 2 + 230, 1120);
    shirt(c, short(r.captain.id), 260, 1460, 190, players.get(r.captain.id)?.pos === 1);
    text(c, t('st.captain'), 520, 1420, '500 38px "IBM Plex Sans Arabic"', 'rgba(255,255,255,0.65)', 'left', 'en');
    latin(c, `${players.get(r.captain.id)?.web ?? ''}  ${r.captain.pts}`, 520, 1500, '700 84px "Barlow Condensed"', '#fff', 'left');
  } else if (kind === 'captain') {
    const me = a.me;
    brand(c, ctx, t('st.captain'));
    const cap = me?.captains.find((x) => x.id === me.edge.captain) ?? me?.captains[0];
    if (!cap) return footer(c, ctx);
    const p = players.get(cap.id)!;
    shirt(c, short(cap.id), W / 2, 640, 440, p.pos === 1);
    c.save(); c.fillStyle = ACCENT; c.beginPath(); c.arc(W / 2 + 170, 470, 58, 0, Math.PI * 2); c.fill(); c.restore();
    latin(c, 'C', W / 2 + 170, 494, '800 72px "Barlow Condensed"', '#0b1a02');
    latin(c, p.web.toUpperCase(), W / 2, 1000, '800 130px "Barlow Condensed"', '#fff');
    const fx = a.players[cap.id]?.fx ?? [];
    latin(c, fx.map((f) => `${teams.get(f.opp)?.short} (${f.home ? 'H' : 'A'})`).join(' + '), W / 2, 1070, '600 48px "Barlow Condensed"', 'rgba(255,255,255,0.7)');
    histogram(c, cap.capDist, 140, 1150, W - 280, 220);
    glass(c, 110, 1460, W - 220, 230);
    stat(c, ctx, t('xPts'), cap.capDist.mean.toFixed(1), 280, 1590);
    stat(c, ctx, t('pGoal'), pct(cap.dist.pGoal), W / 2, 1590);
    stat(c, ctx, t('p10plus'), pct(cap.dist.p10plus), W - 280, 1590);
  } else if (kind === 'prediction') {
    const me = a.me;
    brand(c, ctx, t('st.prediction'));
    if (!me) return footer(c, ctx);
    latin(c, me.squadDist.mean.toFixed(0), W / 2, 760, '800 380px "Barlow Condensed"', '#fff');
    text(c, t('xPts'), W / 2, 850, '600 52px "Reem Kufi"', ACCENT, 'center', ctx.lang);
    latin(c, `${me.squadDist.p10.toFixed(0)} – ${me.squadDist.p90.toFixed(0)}`, W / 2, 940, '600 64px "Barlow Condensed"', 'rgba(255,255,255,0.75)');
    histogram(c, me.squadDist, 140, 1010, W - 280, 260);
    const chaos = a.chaos[0];
    glass(c, 110, 1400, W - 220, 260);
    stat(c, ctx, t('home.captain'), players.get(me.edge.captain)?.web ?? '', 300, 1530);
    if (chaos) stat(c, ctx, t('home.chaos'), String(chaos.index), W - 300, 1530);
  } else {
    const lg = a.league;
    brand(c, ctx, t('st.league'));
    const mine = lg?.standings.find((s) => s.isMe);
    if (!lg || !mine) return footer(c, ctx);
    ring(c, lg.pWin, W / 2, 760, 300);
    latin(c, pct(lg.pWin), W / 2, 800, '800 190px "Barlow Condensed"', '#fff');
    text(c, t('lg.pWin'), W / 2, 880, '600 46px "Reem Kufi"', ACCENT, 'center', ctx.lang);
    glass(c, 110, 1170, W - 220, 300);
    stat(c, ctx, t('home.leagueRank'), `#${mine.rank}`, 300, 1310);
    const leader = Math.max(...lg.standings.map((s) => s.total));
    stat(c, ctx, t('lg.gap'), mine.total === leader ? `+${mine.total - Math.max(...lg.standings.filter((s) => !s.isMe).map((s) => s.total))}` : `${mine.total - leader}`, W / 2, 1310);
    stat(c, ctx, t(`lg.mode.${lg.mode.mode}`), lg.mode.dial > 0 ? '↗' : lg.mode.dial < 0 ? '↘' : '→', W - 300, 1310);
    text(c, lg.name, W / 2, 1580, '600 46px "IBM Plex Sans Arabic"', 'rgba(255,255,255,0.8)', 'center', 'en');
  }
  footer(c, ctx);
}

export function Story() {
  const { t, lang } = useI18n();
  const { analysis: a, phase2, players, teams } = useStore();
  const [kind, setKind] = useState<Kind>('captain');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all(['800 100px "Barlow Condensed"', '600 100px "Barlow Condensed"', '600 60px "Reem Kufi"', '500 40px "IBM Plex Sans Arabic"'].map((f) => document.fonts?.load(f).catch(() => null)))
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !a || !ready) return;
    const c = cv.getContext('2d')!;
    draw(c, kind, { a, p2: phase2, players, teams, t, lang });
  }, [kind, a, phase2, players, teams, t, lang, ready]);
  if (!a) return <Empty>—</Empty>;
  const blob = () => new Promise<Blob | null>((res) => canvasRef.current?.toBlob(res, 'image/png'));
  const filename = `arkilo-gw${a.gw}-${kind}.png`;
  const download = async () => {
    const b = await blob(); if (!b) return;
    const url = URL.createObjectURL(b);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const share = async () => {
    const b = await blob(); if (!b) return;
    const file = new File([b], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'ARKILO' }); } catch { /* cancelled */ }
    } else download();
  };
  return (
    <div>
      <PageHeader title={t('st.title')} sub={t('st.sub')} back="#/more" />
      <Seg full value={kind} onChange={setKind} options={[{ value: 'captain', label: t('st.captain') }, { value: 'gw', label: t('st.gw') }, { value: 'prediction', label: t('st.prediction') }, { value: 'league', label: t('st.league') }]} />
      <div className="story-preview" style={{ marginTop: 14 }}><canvas ref={canvasRef} width={W} height={H} /></div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={share}><IconShare /> {t('st.share')}</button>
        <button className="btn" onClick={download}><IconDownload /> {t('st.download')}</button>
      </div>
    </div>
  );
}
