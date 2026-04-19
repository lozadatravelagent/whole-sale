import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkles, MessagesSquare, Compass } from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { StepCard } from '../components/StepCard';

const STEP_META = [
  { number: '01', icon: Sparkles },
  { number: '02', icon: MessagesSquare },
  { number: '03', icon: Compass },
] as const;

interface StepEntry {
  title: string;
  copy: string;
}

export function HowItWorks() {
  const { t } = useTranslation('landing');
  const steps = t('howItWorks.steps', { returnObjects: true }) as StepEntry[];

  return (
    <motion.section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="how-it-works-heading"
          eyebrow={t('howItWorks.eyebrow')}
          title={t('howItWorks.headline')}
          subtitle={t('howItWorks.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {steps.map((step, idx) => {
            const meta = STEP_META[idx];
            return (
              <StepCard
                key={meta.number}
                number={meta.number}
                icon={meta.icon}
                title={step.title}
                copy={step.copy}
              />
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
