import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { BrandMark } from './icons';

/**
 * Invite-code gate. Codes live only with the people who hold them; the repo stores salted
 * hashes (access/codes.json, plus an optional GitHub secret) and the build publishes them in
 * public/access.json. A visitor's code is checked on every visit, so
 * removing a code from the secret locks that person out after the next deploy.
 * This keeps casual visitors out; it is not bank-grade security.
 */
interface AccessFile { enabled: boolean; codes?: { s: string; h: string; n: string }[] }

const KEY = 'arkilo-access';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };
const normalize = (c: string) => c.toUpperCase().replace(/\s+/g, '');

async function sha(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Returns the person's name ('' if none) when the code is valid, otherwise null. */
async function check(file: AccessFile, code: string): Promise<string | null> {
  if (!file.codes) return null;
  const c = normalize(code);
  for (const entry of file.codes) {
    if (hex(await sha(`${entry.s}:${c}`)) !== entry.h) continue;
    try {
      const enc = Uint8Array.from(atob(entry.n), (ch) => ch.charCodeAt(0));
      const key = await sha(`name:${entry.s}:${c}`);
      return new TextDecoder().decode(enc.map((b, i) => b ^ key[i]));
    } catch { return ''; }
  }
  return null;
}

// ---------- server mode (one-time codes via the ARKILO worker) ----------
const WORKER = (__FPL_RELAY__ || '').replace(/\/+$/, '');
const TOKEN = 'arkilo-token';

function deviceId(): string {
  let d = lsGet('arkilo-device');
  if (!d) {
    d = hex(crypto.getRandomValues(new Uint8Array(16)));
    lsSet('arkilo-device', d);
  }
  return d;
}

type Redeem = { ok: true; name: string } | { ok: false; error: 'invalid' | 'used' | 'network' };

async function redeemCode(code: string): Promise<Redeem> {
  try {
    const res = await fetch(`${WORKER}/gate/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, device: deviceId() }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) { lsSet(TOKEN, data.token); lsSet(`${KEY}-name`, data.name ?? ''); return { ok: true, name: data.name ?? '' }; }
    return { ok: false, error: data.error === 'used' ? 'used' : 'invalid' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** true = valid, false = revoked/invalid, null = couldn't reach the server */
async function verifyToken(token: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${WORKER}/gate/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    if (res.status === 401) return false;
    return res.ok ? true : null;
  } catch { return null; }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<'checking' | 'open' | 'locked'>('checking');
  const [file, setFile] = useState<AccessFile | null>(null);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState<false | 'invalid' | 'used' | 'network'>(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      let f: AccessFile;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}access.json`, { cache: 'no-cache' });
        f = res.ok ? await res.json() : { enabled: false };
      } catch {
        // Offline or unreachable: don't lock anyone out of the cached app.
        setState('open');
        return;
      }
      setFile(f);
      if (!f.enabled) { setState('open'); return; }
      // A code in the link (?code=...) is tried first, then the saved one.
      const params = new URLSearchParams(location.search);
      const fromUrl = params.get('code');
      if (fromUrl) {
        params.delete('code');
        const q = params.toString();
        history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
      }
      if (WORKER) {
        // One-time codes: the server binds each code to the first device that redeems it.
        const token = lsGet(TOKEN);
        if (token && !fromUrl) {
          const ok = await verifyToken(token);
          if (ok !== false) { setState('open'); return; } // valid, or offline with a token
          lsSet(TOKEN, null);
        }
        // A link code, or a code saved before one-time codes were switched on.
        for (const c of [fromUrl, lsGet(KEY)]) {
          if (!c) continue;
          const r = await redeemCode(c);
          if (r.ok) { lsSet(KEY, null); setState('open'); return; }
          if (r.error === 'used') setWrong('used');
        }
        lsSet(KEY, null);
        setState('locked');
        return;
      }
      for (const c of [fromUrl, lsGet(KEY)]) {
        if (!c) continue;
        const name = await check(f, c);
        if (name !== null) { lsSet(KEY, normalize(c)); lsSet(`${KEY}-name`, name); setState('open'); return; }
      }
      lsSet(KEY, null);
      setState('locked');
    })();
  }, []);

  if (state === 'open') return <>{children}</>;
  if (state === 'checking') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    if (WORKER) {
      const r = await redeemCode(value);
      setBusy(false);
      if (r.ok) setState('open'); else setWrong(r.error);
      return;
    }
    const name = await check(file, value);
    setBusy(false);
    if (name === null) { setWrong('invalid'); return; }
    lsSet(KEY, normalize(value));
    lsSet(`${KEY}-name`, name);
    setState('open');
  };

  return (
    <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <form onSubmit={submit} className="card glass" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <BrandMark style={{ width: 40, height: 40 }} />
          <span dir="ltr" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem' }}>ARK<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>ILO</em></span>
        </div>
        <p style={{ margin: '4px 0 14px', lineHeight: 1.7 }}>{t('gate.text')}</p>
        <input type="text" dir="ltr" autoCapitalize="characters" autoComplete="off" placeholder={t('gate.placeholder')} value={value}
          onChange={(e) => { setValue(e.target.value); setWrong(false); }} aria-label={t('gate.placeholder')} style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '0.08em' }} />
        {wrong && <div className="small bad" style={{ marginTop: 8 }}>{t(wrong === 'used' ? 'gate.used' : wrong === 'network' ? 'gate.network' : 'gate.wrong')}</div>}
        <button className="btn primary" type="submit" disabled={busy || !value.trim()} style={{ width: '100%', marginTop: 12 }}>{t('gate.enter')}</button>
        <p className="tiny muted" style={{ margin: '12px 0 0' }}>{t('gate.hint')}</p>
      </form>
    </div>
  );
}
