import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '../components/SectionHeading';

function scrollToSection(id: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function FinalCta() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const handleStartChat = () => navigate('/emilia/chat');
  const handleSeeHow = () => scrollToSection('how-it-works');

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
            subtitle={t('finalCta.subheadline')}
            align="center"
          />
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              onClick={handleStartChat}
              className="w-full sm:w-auto"
            >
              {t('finalCta.primaryCta')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleSeeHow}
              className="w-full sm:w-auto"
            >
              {t('finalCta.secondaryCta')}
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
