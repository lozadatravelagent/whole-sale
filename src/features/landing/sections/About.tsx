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
          <p
            id="sobre-heading"
            className="text-2xl md:text-3xl text-foreground leading-snug font-semibold tracking-tight"
          >
            {t('about.headline')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
