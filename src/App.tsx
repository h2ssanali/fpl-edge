import { useEffect, useState, type ComponentType } from 'react';
import { useI18n, safeGet, safeSet } from './i18n';
import { useStore } from './store';
import { BrandMark, IconArmband, IconGrid, IconHome, IconMoon, IconSun, IconTransfer, IconTrophy } from './components/icons';
import { Loading } from './components/ui';
import { TeamBox } from './components/TeamBox';
import { Home } from './screens/Home';
import { Captain } from './screens/Captain';
import { Transfers } from './screens/Transfers';
import { League } from './screens/League';
import { More } from './screens/More';
import { Prices } from './screens/Prices';
import { Differentials } from './screens/Differentials';
import { Fixtures } from './screens/Fixtures';
import { Chips } from './screens/Chips';
import { Dream } from './screens/Dream';
import { Injuries } from './screens/Injuries';
import { Report } from './screens/Report';
import { Hindsight } from './screens/Hindsight';
import { Journal } from './screens/Journal';
import { Chaos } from './screens/Chaos';
import { Story } from './screens/Story';
import { Deadline } from './screens/Deadline';
import { Settings } from './screens/Settings';
import { Method } from './screens/Method';


function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'home');
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => { setRoute(get()); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

const SCREENS: Record<string, ComponentType> = {
  home: Home, captain: Captain, transfers: Transfers, league: League, more: More,
  'more/prices': Prices, 'more/differentials': Differentials, 'more/fixtures': Fixtures, 'more/chips': Chips,
  'more/dream': Dream, 'more/injuries': Injuries, 'more/report': Report, 'more/hindsight': Hindsight,
  'more/journal': Journal, 'more/chaos': Chaos, 'more/story': Story, 'more/deadline': Deadline, 'more/settings': Settings, 'more/method': Method,
};

/** Welcome card: ask for a team ID until the visitor has entered one. */
function WelcomeCard({ full }: { full: boolean }) {
  const { t } = useI18n();
  const { raw, teamError } = useStore();
  if (!raw || (raw.meta.mode !== 'demo' && !teamError)) return null;
  const me = raw.managers.find((m) => m.id === raw.meta.teamId);
  if (!full) {
    return (
      <a href="#/home" className="pill accent" style={{ marginBottom: 12, display: 'inline-flex', textDecoration: 'none' }}>
        {teamError ? t(`team.${teamError}`) : t('demoSlim')}
      </a>
    );
  }
  return (
    <section className="card accent glass" style={{ marginBottom: 14 }}>
      <div className="display" style={{ fontSize: '1.2rem' }}>{t('demoTitle')}</div>
      {raw.meta.mode === 'demo' && <p className="small muted" style={{ margin: '4px 0 0' }}>{t('demoShort')}<bdi dir="ltr">{me?.entry.name ?? '#1'}</bdi></p>}
      <TeamBox compact />
    </section>
  );
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const { status, reload, raw, rivalsLoading } = useStore();
  const route = useRoute();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (safeGet('fpl-edge-theme') as 'dark' | 'light') || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    safeSet('fpl-edge-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#04110c' : '#dcebdf');
  }, [theme]);
  useEffect(() => {
    const on = (e: Event) => setTheme((e as CustomEvent<'dark' | 'light'>).detail);
    window.addEventListener('fpl-theme', on);
    return () => window.removeEventListener('fpl-theme', on);
  }, []);
  const Screen = SCREENS[route] ?? Home;
  const tab = route.split('/')[0];
  const tabs = [
    { id: 'home', icon: IconHome, label: t('tab.home') },
    { id: 'captain', icon: IconArmband, label: t('tab.captain') },
    { id: 'transfers', icon: IconTransfer, label: t('tab.transfers') },
    { id: 'league', icon: IconTrophy, label: t('tab.league') },
    { id: 'more', icon: IconGrid, label: t('tab.more') },
  ];
  return (
    <>
      <div className="app">
        <header className="topbar">
          <a href="#/home" className="brand" style={{ color: 'inherit', textDecoration: 'none' }}><BrandMark /> <span dir="ltr">hassan<em>ilo</em></span></a>
          <div className="spacer" />
          {raw && <span className="pill num" title={t('updated')}>{t('gw')} {raw.core.nextGw ?? raw.core.currentGw}</span>}
          <button className="icon-btn lang-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="Language">{lang === 'ar' ? 'EN' : 'ع'}</button>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Theme">{theme === 'dark' ? <IconSun /> : <IconMoon />}</button>
        </header>
        {status === 'ready' && route !== 'more/settings' && <WelcomeCard full={route === 'home'} />}
        {status === 'ready' && rivalsLoading && (
          <div className="pill" role="status" style={{ marginBottom: 10, display: 'flex', width: 'fit-content', gap: 8 }}>
            <span className="live-dot" />{t('team.rivalsLoading', { done: rivalsLoading.done, total: rivalsLoading.total })}
          </div>
        )}
        {status === 'error' ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="display">{t('loadError')}</p>
            <p className="small muted">{t('loadErrorHint')}</p>
            <button className="btn primary" onClick={reload}>{t('retry')}</button>
          </div>
        ) : status === 'loading' ? <Loading /> : status === 'team' ? <Loading label={t('team.loading')} /> : status === 'simulating' ? <Loading label={t('loadingSim')} /> : (
          <main className="page" key={route}><Screen /></main>
        )}
      </div>
      <div className="tabbar">
        <nav aria-label="Main">
          {tabs.map((tb) => (
            <a key={tb.id} href={`#/${tb.id}`} className={`tab ${tab === tb.id ? 'on' : ''}`} aria-current={tab === tb.id ? 'page' : undefined}>
              <tb.icon />
              <span>{tb.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
