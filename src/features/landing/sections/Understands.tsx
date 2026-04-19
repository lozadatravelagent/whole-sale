import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { UnderstandPill } from '../components/UnderstandPill';

export function Understands() {
  const { t } = useTranslation('landing');
  const pills = t('understands.pills', { returnObjects: true }) as string[];

  return (
    <motion.section
      id="understands"
      aria-labelledby="understands-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="understands-heading"
          eyebrow={t('understands.eyebrow')}
          title={t('understands.headline')}
          subtitle={t('understands.subheadline')}
          align="center"
          className="mb-12 lg:mb-14"
        />
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2 md:gap-3">
          {pills.map((pill) => (
            <UnderstandPill key={pill} label={pill} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
