import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Zap, Gauge, TrendingUp, Heart, type LucideIcon } from 'lucide-react';
import { SectionEyebrow } from '../components/SectionEyebrow';

const ICONS: LucideIcon[] = [Zap, Gauge, TrendingUp, Heart];

interface ImpactItem {
  title: string;
  copy: string;
}

const GRID_VARIANTS: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export function Impact() {
  const { t } = useTranslation('landing');
  const items = t('impact.items', { returnObjects: true }) as ImpactItem[];

  return (
    <motion.section
      id="impact"
      aria-labelledby="impact-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 bg-foreground py-24 text-background lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto mb-14 flex max-w-3xl flex-col items-center gap-4 text-center lg:mb-16">
          <SectionEyebrow>{t('impact.eyebrow')}</SectionEyebrow>
          <h2
            id="impact-heading"
            className="text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl"
          >
            {t('impact.headline')}
          </h2>
        </div>
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={item.title}
                variants={CARD_VARIANTS}
                className="flex flex-col gap-4 rounded-2xl border border-background/10 bg-background/5 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-background/30"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/10">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-background/70">
                  {item.copy}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.section>
  );
}
