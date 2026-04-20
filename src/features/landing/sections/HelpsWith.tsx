import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Route,
  Scale,
  Lightbulb,
  Feather,
  Waypoints,
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { FeatureCard } from '../components/FeatureCard';

const FEATURE_ICONS = [
  MapPin,
  Route,
  Scale,
  Lightbulb,
  Feather,
  Waypoints,
] as const;

const GRID_VARIANTS: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

interface FeatureEntry {
  title: string;
  copy: string;
}

export function HelpsWith() {
  const { t } = useTranslation('landing');
  const features = t('helpsWith.features', {
    returnObjects: true,
  }) as FeatureEntry[];

  return (
    <motion.section
      id="helps-with"
      aria-labelledby="helps-with-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="helps-with-heading"
          eyebrow={t('helpsWith.eyebrow')}
          title={t('helpsWith.headline')}
          subtitle={t('helpsWith.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature, idx) => {
            const Icon = FEATURE_ICONS[idx];
            return (
              <motion.div key={feature.title} variants={CARD_VARIANTS}>
                <FeatureCard
                  icon={Icon}
                  title={feature.title}
                  copy={feature.copy}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.section>
  );
}
