import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { InspirationCard } from '../components/InspirationCard';

interface InspirationEntry {
  title: string;
  prompt: string;
}

export function Inspiration() {
  const { t } = useTranslation('landing');
  const cards = t('inspiration.cards', {
    returnObjects: true,
  }) as InspirationEntry[];
  const ctaLabel = t('inspiration.ctaLabel');

  return (
    <motion.section
      id="inspiration"
      aria-labelledby="inspiration-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="inspiration-heading"
          eyebrow={t('inspiration.eyebrow')}
          title={t('inspiration.headline')}
          subtitle={t('inspiration.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <InspirationCard
              key={card.title}
              title={card.title}
              prompt={card.prompt}
              ctaLabel={ctaLabel}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
