import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { PromptChip } from '../components/PromptChip';

export function PromptDemo() {
  const { t } = useTranslation('landing');
  const prompts = t('promptDemo.prompts', {
    returnObjects: true,
  }) as string[];

  return (
    <motion.section
      id="prompt-demo"
      aria-labelledby="prompt-demo-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="prompt-demo-heading"
          eyebrow={t('promptDemo.eyebrow')}
          title={t('promptDemo.headline')}
          subtitle={t('promptDemo.subheadline')}
          align="center"
          className="mb-12 lg:mb-14"
        />
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
          {prompts.map((prompt) => (
            <PromptChip key={prompt} label={prompt} prompt={prompt} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
