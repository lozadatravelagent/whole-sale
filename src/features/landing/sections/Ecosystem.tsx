import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { EcosystemCard } from '../components/EcosystemCard';

export function Ecosystem() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="ecosystem"
      aria-labelledby="ecosystem-heading"
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="ecosystem-heading"
          eyebrow={t('ecosystem.eyebrow')}
          title={t('ecosystem.headline')}
          subtitle={t('ecosystem.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          <EcosystemCard
            id="ecosystem-agencies"
            title={t('ecosystem.cards.agencies.title')}
            copy={t('ecosystem.cards.agencies.copy')}
            ctaLabel={t('ecosystem.cards.agencies.ctaLabel')}
            comingSoonBadge={t('ecosystem.cards.agencies.comingSoonBadge')}
          />
          <EcosystemCard
            id="ecosystem-wholesalers"
            title={t('ecosystem.cards.wholesalers.title')}
            copy={t('ecosystem.cards.wholesalers.copy')}
            ctaLabel={t('ecosystem.cards.wholesalers.ctaLabel')}
            comingSoonBadge={t('ecosystem.cards.wholesalers.comingSoonBadge')}
          />
        </div>
      </div>
    </section>
  );
}
