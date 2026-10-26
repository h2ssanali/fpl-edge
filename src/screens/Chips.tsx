import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Empty, PageHeader } from '../components/ui';
import { IconChip } from '../components/icons';

export function Chips() {
  const { t, fmt } = useI18n();
  const { analysis: a, phase2 } = useStore();
  if (!a) return null;
  const chips = phase2?.chips;
  const anyAvail = chips?.some((c) => c.available);
  return (
    <div>
      <PageHeader title={t('ch.title')} sub={t('ch.sub')} back="#/more" />
      {!a.me ? <Empty>{t('tr.noSquad')}</Empty> : !chips ? <div className="card"><div className="skeleton" style={{ height: 120 }} /><p className="small muted">{t('ch.computing')}</p></div> : (
        <div className="stack">
          {!anyAvail && <div className="banner"><IconChip /><div>{t('ch.noneAvail')}</div></div>}
          {chips.map((c) => {
            const vals = c.values.filter((v) => !c.window || (v.gw >= c.window[0] && v.gw <= c.window[1]));
            const max = Math.max(1, ...vals.map((v) => v.value));
            return (
              <article key={c.chip} className={`card ${c.best ? 'accent' : ''}`}>
                <div className="row between">
                  <div>
                    <div className="display" style={{ fontSize: '1.1rem' }}>{t(`ch.${c.chip}`)}</div>
                    <div className="tiny muted">{c.available && c.window ? t('ch.available', { gw: c.window[1] }) : t('ch.used')}</div>
                  </div>
                  {c.best && (
                    <div style={{ textAlign: 'end' }}>
                      <div className="card-label">{t('ch.best')}</div>
                      <div className="mid-num accent-text">{t('gwShort')}{c.best.gw}</div>
                      <div className="tiny">{t('ch.value', { v: fmt(c.best.value) })}</div>
                    </div>
                  )}
                </div>
                {vals.length > 0 && (
                  <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 70, marginTop: 10 }} dir="ltr">
                    {vals.map((v) => (
                      <div key={v.gw} style={{ flex: 1, textAlign: 'center' }} title={`GW${v.gw}: ${fmt(v.value)}`}>
                        <div style={{ height: `${Math.max(4, (Math.max(0, v.value) / max) * 48)}px`, background: v.gw === c.best?.gw ? 'var(--accent)' : 'var(--surface-2)', borderRadius: 4, border: v.dgwTeams ? '1px solid var(--accent)' : undefined }} />
                        <div className="tiny num muted">{v.gw}</div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
