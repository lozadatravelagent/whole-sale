import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Sparkles,
  Calendar,
  Users,
  Settings2,
  Heart,
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { PersonalizationPoint } from '../components/PersonalizationPoint';

const POINT_ICONS = [
  Clock,
  Sparkles,
  Calendar,
  Users,
  Settings2,
  Heart,
] as const;

interface PointEntry {
  label: string;
  caption: string;
}

export function Personalized() {
  const { t } = useTranslation('landing');
  const points = t('personalized.points', {
    returnObjects: true,
  }) as PointEntry[];

  return (
    <motion.section
      id="personalized"
      aria-labelledby="personalized-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="personalized-heading"
          eyebrow={t('personalized.eyebrow')}
          title={t('personalized.headline')}
          subtitle={t('personalized.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {points.map((point, idx) => {
            const Icon = POINT_ICONS[idx];
            return (
              <PersonalizationPoint
                key={point.label}
                icon={Icon}
                label={point.label}
                caption={point.caption}
              />
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
