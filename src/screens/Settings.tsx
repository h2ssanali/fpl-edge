import { useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader, Seg } from '../components/ui';
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
      <h2 className="section-title" style={{ marginTop: 6 }}>{t('team.title')}</h2>
      <TeamBox />
      <h2 className="section-title">{t('set.lang')} · {t('set.theme')}</h2>
      <div className="card stack">
        <div className="row between"><span>{t('set.lang')}</span><Seg value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} /></div>
        <div className="row between"><span>{t('set.theme')}</span><Seg value={theme} onChange={setTheme} options={[{ value: 'dark', label: t('set.dark') }, { value: 'light', label: t('set.light') }]} /></div>
      </div>
      {raw && (
        <>
          <h2 className="section-title">{t('set.dataTitle')}</h2>
          <div className="card small stack" style={{ gap: 8 }}>
            <div className="row between"><span className="muted">{t('set.lastUpdate')}</span><span className="num" dir="ltr">{new Date(raw.meta.updated).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
            <p className="muted" style={{ margin: 0 }}>{t('set.howUpdates')}</p>
            <p className="muted" style={{ margin: 0 }}>{t('set.install')}</p>
          </div>
        </>
      )}
    </div>
  );
}
