import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, Seg } from '../components/ui';
import { REPO } from '../App';
import { TeamBox } from '../components/TeamBox';

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { raw } = useStore();
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme as 'dark' | 'light') || 'dark');
  const setTheme = (th: 'dark' | 'light') => {
    setThemeState(th);
    window.dispatchEvent(new CustomEvent('fpl-theme', { detail: th }));
  };
  return (
    <div>
      <PageHeader title={t('set.title')} back="#/more" />
      <div className="card stack">
        <div className="row between"><span>{t('set.lang')}</span><Seg value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} /></div>
        <div className="row between"><span>{t('set.theme')}</span><Seg value={theme} onChange={setTheme} options={[{ value: 'dark', label: t('set.dark') }, { value: 'light', label: t('set.light') }]} /></div>
      </div>
      <h2 className="section-title">{t('team.title')}</h2>
      <TeamBox />
      <h2 className="section-title">{t('set.team')} · config.json</h2>
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>{t('set.teamHow')}</p>
        <pre dir="ltr" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10, overflowX: 'auto', fontSize: '0.85rem' }}>{`{
  "teamId": "1234567",
  "leagueIds": [123456]
}`}</pre>
        <div className="row wrap">
          <a className="btn primary small" href={`https://github.com/${REPO}/edit/main/config.json`} target="_blank" rel="noreferrer">{t('set.editConfig')}</a>
          <a className="btn small" href={`https://github.com/${REPO}/actions/workflows/data.yml`} target="_blank" rel="noreferrer">{t('set.runWorkflow')}</a>
        </div>
      </div>
      {raw && (
        <>
          <h2 className="section-title">{t('set.data')}</h2>
          <div className="card small stack" style={{ gap: 6 }}>
            <div className="row between"><span className="muted">{t('set.current')}</span><span>{t(`set.mode.${raw.meta.mode}`)} · <span className="num">{raw.meta.teamId ?? '—'}</span></span></div>
            <div className="row between"><span className="muted">{t('lg.title')}</span><span className="num">{raw.meta.leagueIds.join(', ') || '—'}</span></div>
            <div className="row between"><span className="muted">{t('updated')}</span><span className="num" dir="ltr">{new Date(raw.meta.updated).toLocaleString()}</span></div>
            <div className="row between"><span className="muted">Season</span><span className="num">{raw.core.season}</span></div>
            <p className="muted" style={{ margin: 0 }}>{t('set.howUpdates')}</p>
          </div>
        </>
      )}
    </div>
  );
}
