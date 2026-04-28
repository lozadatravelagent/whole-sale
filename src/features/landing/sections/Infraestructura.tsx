import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../components/SectionHeader';
import { OrbitDiagram } from '../components/orbit-diagram/OrbitDiagram';

export function Infraestructura() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="infraestructura"
      aria-labelledby="infraestructura-heading"
      className="py-14 md:py-20 relative overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[900px] rounded-full bg-primary/[0.06] blur-[140px]"
      />

      <div className="container-page relative">
        <SectionHeader
          eyebrow={t('infraestructura.eyebrow')}
          title={t('infraestructura.title')}
          highlight={t('infraestructura.highlight')}
          subtitle={t('infraestructura.subtitle')}
        />

        <div className="mt-14 mx-auto max-w-5xl">
          <OrbitDiagram />
        </div>
      </div>
    </section>
  );
}
