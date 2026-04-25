import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '../components/SectionHeading';

export function FinalCta() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const handleStartChat = () => navigate('/emilia/chat');

  return (
    <motion.section
      id="final-cta"
      aria-labelledby="final-cta-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
          <SectionHeading
            id="final-cta-heading"
            title={t('finalCta.headline')}
            align="center"
          />
          <div className="flex flex-col items-center gap-3">
            <Button size="lg" onClick={handleStartChat}>
              {t('finalCta.primaryCta')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t('finalCta.microcopy')}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
