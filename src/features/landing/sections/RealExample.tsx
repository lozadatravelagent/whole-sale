import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BedDouble, Calendar, MapPin, Users } from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { StructuredCard } from '../components/StructuredCard';

const GRID_VARIANTS: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

const CARDS = [
  { icon: MapPin, key: 'destination' },
  { icon: Calendar, key: 'dates' },
  { icon: Users, key: 'guests' },
  { icon: BedDouble, key: 'room' },
] as const;

export function RealExample() {
  const { t } = useTranslation('landing');

  return (
    <motion.section
      id="real-example"
      aria-labelledby="real-example-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="real-example-heading"
          eyebrow={t('realExample.eyebrow')}
          title={t('realExample.headline')}
          subtitle={t('realExample.subheadline')}
          align="center"
          className="mb-12 lg:mb-14"
        />
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-muted/10 p-6 shadow-card backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35 }}
              className="flex justify-end"
            >
              <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                {t('realExample.userMessage')}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="flex items-start gap-3"
            >
              <div
                aria-hidden="true"
                className="mt-1 h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
              />
              <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                <span className="block text-xs font-semibold text-foreground/80">
                  {t('realExample.assistantLabel')}
                </span>
                <span className="mt-1 block">
                  {t('realExample.assistantMessage')}
                </span>
              </div>
            </motion.div>
          </div>

          <motion.div
            variants={GRID_VARIANTS}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {CARDS.map(({ icon, key }) => (
              <motion.div key={key} variants={ITEM_VARIANTS}>
                <StructuredCard
                  icon={icon}
                  label={t(`realExample.cards.${key}.label`)}
                  value={t(`realExample.cards.${key}.value`)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
