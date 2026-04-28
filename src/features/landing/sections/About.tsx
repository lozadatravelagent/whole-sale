import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function About() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="sobre"
      aria-labelledby="sobre-heading"
      className="py-14 md:py-20 bg-muted/30 relative overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-aurora-violet/15 blur-[100px]"
      />
      <div className="container-page relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-primary">
              {t('about.badge')}
            </span>
          </div>
          <p
            id="sobre-heading"
            className="text-2xl md:text-3xl text-foreground leading-snug font-semibold tracking-tight"
          >
            {t('about.headline')}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">{t('about.signature')}</p>
        </motion.div>
      </div>
    </section>
  );
}
