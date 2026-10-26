import { useI18n } from '../i18n';
import { PageHeader } from '../components/ui';
import { IconBook, IconCalendar, IconChip, IconClock, IconCross, IconDiamond, IconGear, IconPhone, IconReport, IconRewind, IconStar, IconStorm, IconTag } from '../components/icons';

const ITEMS = [
  { id: 'hindsight', icon: IconRewind, isNew: true },
  { id: 'journal', icon: IconBook, isNew: true },
  { id: 'chaos', icon: IconStorm, isNew: true },
  { id: 'story', icon: IconPhone, isNew: true },
  { id: 'deadline', icon: IconClock },
  { id: 'prices', icon: IconTag },
  { id: 'differentials', icon: IconDiamond, key: 'diffs' },
  { id: 'fixtures', icon: IconCalendar },
  { id: 'chips', icon: IconChip },
  { id: 'dream', icon: IconStar },
  { id: 'injuries', icon: IconCross },
  { id: 'report', icon: IconReport },
  { id: 'settings', icon: IconGear },
];

export function More() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('more.title')} />
      <div className="tiles">
        {ITEMS.map((it) => {
          const key = it.key ?? it.id;
          return (
            <a key={it.id} href={`#/more/${it.id}`} className={`tile ${it.isNew ? 'new' : ''}`}>
              <div className="row between"><it.icon />{it.isNew && <span className="tag">{t('new')}</span>}</div>
              <b>{t(`more.${key}`)}</b>
              <span>{t(`more.${key}Sub`)}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
