import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Compass, Calculator, ArrowRight } from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';

const GRID_VARIANTS: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export function TwoModes() {
  const { t } = useTranslation('landing');

  return (
    <motion.section
      id="two-modes"
      aria-labelledby="two-modes-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="two-modes-heading"
          eyebrow={t('twoModes.eyebrow')}
          title={t('twoModes.headline')}
          subtitle={t('twoModes.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="relative mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-4"
        >
          <motion.article
            variants={CARD_VARIANTS}
            className="flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-primary"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('twoModes.modes.planner.title')}
            </h3>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t('twoModes.modes.planner.copy')}
            </p>
          </motion.article>

          <motion.div
            variants={CARD_VARIANTS}
            className="flex flex-col items-center justify-center gap-2 lg:px-2"
          >
            <ArrowRight
              className="h-6 w-6 rotate-90 text-primary lg:rotate-0"
              aria-hidden="true"
            />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('twoModes.connector')}
            </span>
          </motion.div>

          <motion.article
            variants={CARD_VARIANTS}
            className="flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-primary"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calculator className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('twoModes.modes.quoter.title')}
            </h3>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t('twoModes.modes.quoter.copy')}
            </p>
          </motion.article>
        </motion.div>
      </div>
    </motion.section>
  );
}
