import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MessageSquareText,
  LayoutPanelTop,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { FeatureCard } from '../components/FeatureCard';

const ICONS: LucideIcon[] = [MessageSquareText, LayoutPanelTop, Receipt];

interface CardEntry {
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

export function WhatIsEmilia() {
  const { t } = useTranslation('landing');
  const cards = t('whatIsEmilia.cards', { returnObjects: true }) as CardEntry[];

  return (
    <motion.section
      id="what-is-emilia"
      aria-labelledby="what-is-emilia-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="what-is-emilia-heading"
          eyebrow={t('whatIsEmilia.eyebrow')}
          title={t('whatIsEmilia.headline')}
          subtitle={t('whatIsEmilia.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8"
        >
          {cards.map((card, i) => (
            <motion.div key={card.title} variants={CARD_VARIANTS}>
              <FeatureCard icon={ICONS[i]} title={card.title} copy={card.copy} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
