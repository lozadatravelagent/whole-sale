import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { InspirationCard } from '../components/InspirationCard';

const INSPIRATION_PHOTO_IDS = [
  'photo-1483729558449-99ef09a8c325', // 7 days in Rio
  'photo-1533105079780-92b9be482077', // 10 days in Italy
  'photo-1555881400-74d7acaacd8b', // Spain + Portugal
  'photo-1507525428034-b723cf961d3e', // Family beach escape
  'photo-1502602898657-3e91760cbb34', // Romantic Europe
  'photo-1545569341-9eb8b30979d9', // Japan for first-timers
] as const;

const GRID_VARIANTS: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

interface InspirationEntry {
  title: string;
  prompt: string;
  alt: string;
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
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cards.map((card, idx) => (
            <motion.div key={card.title} variants={CARD_VARIANTS}>
              <InspirationCard
                photoId={INSPIRATION_PHOTO_IDS[idx]}
                alt={card.alt}
                title={card.title}
                prompt={card.prompt}
                ctaLabel={ctaLabel}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
