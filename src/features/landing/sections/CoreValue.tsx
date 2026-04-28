import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../components/SectionHeader';
import { ValueCard } from '../components/cards/ValueCard';
import { CORE_VALUE_ITEMS } from '../data/coreValueItems';

export function CoreValue() {
  const { t } = useTranslation('landing');

  return (
    <section id="valor" aria-labelledby="valor-heading" className="py-14 md:py-20 relative">
      <div className="container-page">
        <SectionHeader
          eyebrow={t('coreValue.eyebrow')}
          title={t('coreValue.title')}
          highlight={t('coreValue.highlight')}
          subtitle={t('coreValue.subtitle')}
        />
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {CORE_VALUE_ITEMS.map((item, i) => (
            <ValueCard
              key={item.id}
              icon={item.icon}
              title={t(item.titleKey)}
              description={t(item.descKey)}
              toneClass={item.toneClass}
              iconBgClass={item.iconBgClass}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
