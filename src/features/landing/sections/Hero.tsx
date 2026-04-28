import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuroraBackdrop } from '../components/AuroraBackdrop';
import { PrimaryButton } from '../components/PrimaryButton';
import { ChatMockup } from '../components/chat-mockup/ChatMockup';

export function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation('landing');
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const mockupScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  const handleStartChat = () => navigate('/emilia/whitelist');

  return (
    <section
      ref={ref}
      id="hero"
      aria-labelledby="hero-heading"
      className="relative pt-24 md:pt-32 pb-16 md:pb-20 overflow-hidden grain"
    >
      <AuroraBackdrop variant="hero" />

      <div className="container-page relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            id="hero-heading"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="display-lg text-[34px] sm:text-6xl lg:text-[80px] xl:text-[88px] text-foreground"
          >
            {t('hero.headline')} <span className="text-gradient">{t('hero.headlineHighlight')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto"
          >
            {t('hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex justify-center"
          >
            <PrimaryButton size="lg" onClick={handleStartChat}>
              {t('hero.primaryCta')}
            </PrimaryButton>
          </motion.div>
        </div>

        <motion.div
          style={{ y: mockupY, scale: mockupScale }}
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 md:mt-20 max-w-2xl mx-auto"
        >
          <ChatMockup />
        </motion.div>
      </div>
    </section>
  );
}
