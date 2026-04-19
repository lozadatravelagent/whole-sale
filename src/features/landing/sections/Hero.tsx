import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SectionEyebrow } from '../components/SectionEyebrow';
import { PromptChip } from '../components/PromptChip';
import { ChatPreview } from '../components/ChatPreview';

function scrollToSection(id: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Hero() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const handleStartChat = () => navigate('/emilia/chat');
  const handleSeeHow = () => scrollToSection('how-it-works');

  const promptChips = t('hero.promptChips', {
    returnObjects: true,
  }) as string[];

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="scroll-mt-20 pt-16 pb-24 lg:pt-24 lg:pb-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-16">
          <div className="flex flex-col gap-6 lg:gap-8">
            <SectionEyebrow>{t('hero.eyebrow')}</SectionEyebrow>
            <h1
              id="hero-heading"
              className="text-4xl font-semibold tracking-tight leading-[1.05] text-foreground sm:text-5xl lg:text-6xl"
            >
              {t('hero.headline')}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
              {t('hero.subheadline')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={handleStartChat}>
                {t('hero.primaryCta')}
              </Button>
              <Button size="lg" variant="outline" onClick={handleSeeHow}>
                {t('hero.secondaryCta')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {promptChips.map((prompt) => (
                <PromptChip key={prompt} label={prompt} prompt={prompt} />
              ))}
            </div>
          </div>
          <div>
            <ChatPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
