import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';

/**
 * Enter any FPL team ID inside the app. The choice is saved on this device, and a
 * shareable ?team= link lets anyone open the app straight on their own team.
 */
export function TeamBox({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { raw, customTeam, customLeague, setTeam, setLeague, teamError } = useStore();
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const me = raw?.managers.find((m) => m.id === raw.meta.teamId);
  const showing = raw?.meta.mode === 'user' && me;
  const leagues = me?.entry.leagues.filter((l) => l.type === 'x') ?? [];
  const currentLeague = customLeague ?? raw?.meta.leagueIds[0] ?? null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    // Accept a pasted FPL URL too: take the number after /entry/.
    const fromUrl = value.match(/entry\/(\d+)/)?.[1];
    const id = Number(fromUrl ?? digits);
    if (!id || id < 1 || id > 99_999_999) { setInvalid(true); return; }
    setInvalid(false);
    setEditing(false);
    setTeam(id);
  };
  const share = async () => {
    const id = raw?.meta.teamId;
    if (!id) return;
    const url = `${location.origin}${location.pathname}?team=${id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'FPL Edge', url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    } catch { /* cancelled */ }
  };

  const form = (
    <form onSubmit={submit} className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input type="text" inputMode="numeric" dir="ltr" placeholder={t('team.placeholder')} value={value} onChange={(e) => setValue(e.target.value)} aria-label={t('team.title')} style={{ flex: 1 }} />
        <button className="btn primary" type="submit">{t('team.go')}</button>
      </div>
      {invalid && <div className="small bad">{t('team.invalid')}</div>}
      <div className="tiny muted">{t('team.where')}</div>
    </form>
  );

  return (
    <div className={compact ? '' : 'card'} style={compact ? { marginTop: 10 } : undefined}>
      {teamError && <div className="small bad" style={{ marginBottom: 8 }}>{t(`team.${teamError}`)}</div>}
      {showing && !editing ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row between wrap" style={{ gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div className="tiny muted">{t('team.viewing')}</div>
              <div className="name"><bdi dir="ltr">{me!.entry.name}</bdi> <span className="faint num">#{me!.id}</span></div>
              <div className="sub"><bdi dir="ltr">{me!.entry.player}</bdi></div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn small" onClick={() => setEditing(true)}>{t('team.change')}</button>
              {customTeam && <button className="btn small ghost" onClick={() => setTeam(null)}>{t('team.reset')}</button>}
            </div>
          </div>
          {leagues.length > 0 ? (
            <label className="stack" style={{ gap: 4 }}>
              <span className="tiny muted">{t('team.league')}</span>
              <select value={currentLeague ?? ''} onChange={(e) => setLeague(Number(e.target.value) || null)}>
                {leagues.map((l) => <option key={l.id} value={l.id}>{l.name} · #{l.rank}/{l.count}</option>)}
              </select>
            </label>
          ) : <div className="tiny muted">{t('team.noLeague')}</div>}
          <button className="btn small ghost" onClick={share} style={{ alignSelf: 'flex-start' }}>{copied ? t('team.copied') : t('team.share')}</button>
        </div>
      ) : form}
    </div>
  );
}
