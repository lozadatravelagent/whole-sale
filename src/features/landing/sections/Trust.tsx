import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';

export function Trust() {
  const { t } = useTranslation('landing');

  return (
    <motion.section
      id="trust"
      aria-labelledby="trust-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-20 lg:py-24"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
          <img
            src="/vibook-white.png"
            alt={t('footer.vibookLogoAlt')}
            loading="lazy"
            className="h-10 w-auto opacity-90"
          />
          <SectionHeading
            id="trust-heading"
            eyebrow={t('trust.eyebrow')}
            title={t('trust.headline')}
            subtitle={t('trust.subheadline')}
            align="center"
          />
        </div>
      </div>
    </motion.section>
  );
}
