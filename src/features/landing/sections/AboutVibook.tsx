import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionEyebrow } from '../components/SectionEyebrow';

export function AboutVibook() {
  const { t } = useTranslation('landing');

  return (
    <motion.section
      id="about-vibook"
      aria-labelledby="about-vibook-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-20 lg:py-24"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <img
            src="/vibook-white.png"
            alt={t('footer.vibookLogoAlt')}
            loading="lazy"
            className="h-10 w-auto opacity-90"
          />
          <SectionEyebrow>{t('aboutVibook.eyebrow')}</SectionEyebrow>
          <h2
            id="about-vibook-heading"
            className="text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            {t('aboutVibook.headline')}
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t('aboutVibook.copy')}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
