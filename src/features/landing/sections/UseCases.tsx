import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../components/SectionHeader';
import { UseCaseCard } from '../components/cards/UseCaseCard';
import { USE_CASES } from '../data/useCases';
import { writePendingPrompt } from '../lib/pendingPrompt';

export function UseCases() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  const handleCta = () => {
    writePendingPrompt('');
    navigate('/emilia/whitelist');
  };

  return (
    <section id="usos" aria-labelledby="usos-heading" className="py-14 md:py-20 relative">
      <div className="container-page">
        <SectionHeader
          eyebrow={t('useCases.eyebrow')}
          title={t('useCases.title')}
          highlight={t('useCases.highlight')}
          subtitle={t('useCases.subtitle')}
        />

        <LayoutGroup>
          <motion.div layout className="mt-14 grid gap-4 md:grid-cols-3 max-w-6xl mx-auto items-stretch">
            {USE_CASES.map((useCase, i) => {
              const isOpen = openId === useCase.id;
              return (
                <UseCaseCard
                  key={useCase.id}
                  useCase={useCase}
                  index={i}
                  isOpen={isOpen}
                  anyOpen={openId !== null}
                  onToggle={() => setOpenId(isOpen ? null : useCase.id)}
                  onCta={handleCta}
                />
              );
            })}
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  );
}
