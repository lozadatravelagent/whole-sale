import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SectionEyebrow } from '../components/SectionEyebrow';
import { AnimatedChatScene } from '../components/AnimatedChatScene';
import { HeroAurora } from '../components/HeroAurora';

export function Hero() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const handleStartChat = () => navigate('/emilia/chat');

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden scroll-mt-20 pt-16 pb-24 lg:pt-24 lg:pb-32"
    >
      <HeroAurora className="absolute inset-0 h-full w-full opacity-60" />
      <div className="container relative z-10 mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-16">
          <div className="flex flex-col gap-6 lg:gap-7">
            <SectionEyebrow>{t('hero.eyebrow')}</SectionEyebrow>
            <h1
              id="hero-heading"
              className="text-5xl font-semibold tracking-tight leading-[1.05] text-foreground sm:text-6xl lg:text-7xl"
            >
              {t('hero.headline')}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
              {t('hero.subheadline')}
            </p>
            <p className="max-w-xl border-l-2 border-primary/60 pl-4 text-base italic leading-relaxed text-foreground/90">
              {t('hero.moat')}
            </p>
            <div className="flex flex-col items-start gap-3 pt-2">
              <Button size="lg" onClick={handleStartChat}>
                {t('hero.primaryCta')}
              </Button>
              <p className="text-sm text-muted-foreground">{t('hero.microcopy')}</p>
            </div>
          </div>
          <div>
            <AnimatedChatScene />
          </div>
        </div>
      </div>
    </section>
  );
}
