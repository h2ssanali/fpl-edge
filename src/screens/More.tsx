import { useI18n } from '../i18n';
import { PageHeader } from '../components/ui';
import { IconAlert, IconArmband, IconBook, IconCalendar, IconChip, IconClock, IconCross, IconDiamond, IconGear, IconPhone, IconPulse, IconReport, IconRewind, IconShield, IconStar, IconStorm, IconTag, IconTransfer, IconBall } from '../components/icons';
import { PlayerSearch } from '../components/PlayerSearch';

type Item = { id: string; icon: typeof IconStar; href?: string; key?: string; isNew?: boolean };

/** The extra pages, grouped by when you'd use them. */
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'now', items: [
    { id: 'live', icon: IconPulse, href: '#/live', isNew: true },
    { id: 'report', icon: IconReport },
  ] },
  { title: 'before', items: [
    { id: 'captain', icon: IconArmband, href: '#/captain' },
    { id: 'transfers', icon: IconTransfer, href: '#/transfers' },
    { id: 'wildcard', icon: IconStar },
    { id: 'chips', icon: IconChip },
    { id: 'deadline', icon: IconClock },
  ] },
  { title: 'discover', items: [
    { id: 'compare', icon: IconBall, href: '#/compare', isNew: true },
    { id: 'defcon', icon: IconShield, isNew: true },
    { id: 'setpieces', icon: IconBall, isNew: true },
    { id: 'differentials', icon: IconDiamond, key: 'diffs' },
    { id: 'fixtures', icon: IconCalendar },
    { id: 'prices', icon: IconTag },
    { id: 'injuries', icon: IconCross },
    { id: 'dream', icon: IconStar },
  ] },
  { title: 'analysis', items: [
    { id: 'hindsight', icon: IconRewind },
    { id: 'journal', icon: IconBook },
    { id: 'chaos', icon: IconStorm },
    { id: 'story', icon: IconPhone },
  ] },
  { title: 'app', items: [
    { id: 'method', icon: IconAlert },
    { id: 'settings', icon: IconGear },
  ] },
];

export function More() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('more.title')} />
      <PlayerSearch />
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="section-title">{t(`more.grp.${g.title}`)}</h2>
          <div className="tiles">
            {g.items.map((it) => {
              const key = it.key ?? it.id;
              return (
                <a key={it.id} href={it.href ?? `#/more/${it.id}`} className={`tile ${it.isNew ? 'new' : ''}`}>
                  <div className="row between"><it.icon />{it.isNew && <span className="tag">{t('new')}</span>}</div>
                  <b>{t(`more.${key}`)}</b>
                  <span>{t(`more.${key}Sub`)}</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
