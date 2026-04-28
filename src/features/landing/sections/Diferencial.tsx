import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../components/SectionHeader';
import { ComparisonRow } from '../components/cards/ComparisonRow';
import { DIFFERENTIATOR_PAIRS } from '../data/differentiatorPairs';

export function Diferencial() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="diferencial"
      aria-labelledby="diferencial-heading"
      className="py-14 md:py-20 bg-muted/30 relative overflow-hidden"
    >
      <div aria-hidden className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-aurora-violet/20 blur-[100px]" />
      <div className="container-page relative">
        <SectionHeader
          eyebrow={t('diferencial.eyebrow')}
          title={t('diferencial.title')}
          highlight={t('diferencial.highlight')}
          subtitle={t('diferencial.subtitle')}
        />
        <div className="mt-14 grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {DIFFERENTIATOR_PAIRS.map((pair, i) => (
            <ComparisonRow
              key={pair.id}
              from={t(pair.fromKey)}
              to={t(pair.toKey)}
              index={i}
            />
          ))}
        </div>
        <p className="mt-12 text-center text-muted-foreground max-w-xl mx-auto text-[15px]">
          {t('diferencial.tagline')}
        </p>
      </div>
    </section>
  );
}
