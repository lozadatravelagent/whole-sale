import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  MessagesSquare,
  Receipt,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { FeatureCard } from '../components/FeatureCard';

const ICONS: LucideIcon[] = [Sparkles, MessagesSquare, Receipt, Layers];

interface ItemEntry {
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

export function Differentiator() {
  const { t } = useTranslation('landing');
  const items = t('differentiator.items', { returnObjects: true }) as ItemEntry[];

  return (
    <motion.section
      id="differentiator"
      aria-labelledby="differentiator-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="differentiator-heading"
          eyebrow={t('differentiator.eyebrow')}
          title={t('differentiator.headline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8"
        >
          {items.map((item, i) => (
            <motion.div key={item.title} variants={CARD_VARIANTS}>
              <FeatureCard icon={ICONS[i]} title={item.title} copy={item.copy} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
