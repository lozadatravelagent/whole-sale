import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuroraBackdrop } from '../components/AuroraBackdrop';
import { PrimaryButton } from '../components/PrimaryButton';

export function CtaFinal() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const handleStartChat = () => navigate('/emilia/chat');

  return (
    <section
      id="cta-final"
      aria-labelledby="cta-final-heading"
      className="py-16 md:py-24 relative overflow-hidden grain"
    >
      <AuroraBackdrop variant="intense" />

      <div className="container-page relative">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2
            id="cta-final-heading"
            className="display-lg text-[34px] sm:text-5xl md:text-6xl lg:text-7xl text-foreground"
          >
            {t('ctaFinal.headline')} <span className="text-gradient">{t('ctaFinal.highlight')}</span>
          </h2>
          <p className="mt-6 text-base md:text-xl text-muted-foreground">{t('ctaFinal.subtitle')}</p>
          <div className="mt-10 flex justify-center">
            <PrimaryButton size="lg" onClick={handleStartChat}>
              {t('ctaFinal.cta')}
            </PrimaryButton>
          </div>
          <p className="mt-5 text-[12px] text-muted-foreground/70">{t('ctaFinal.microcopy')}</p>
        </motion.div>
      </div>
    </section>
  );
}
