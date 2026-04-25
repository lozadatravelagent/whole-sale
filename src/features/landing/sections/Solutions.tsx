import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { SolutionCard } from '../components/SolutionCard';

const GRID_VARIANTS: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export function Solutions() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const handleStartChat = () => navigate('/emilia/chat');

  return (
    <motion.section
      id="solutions"
      aria-labelledby="solutions-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="solutions-heading"
          eyebrow={t('solutions.eyebrow')}
          title={t('solutions.headline')}
          subtitle={t('solutions.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <motion.div
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8"
        >
          <motion.div variants={CARD_VARIANTS}>
            <SolutionCard
              id="solution-travelers"
              title={t('solutions.cards.travelers.title')}
              copy={t('solutions.cards.travelers.copy')}
              ctaLabel={t('solutions.cards.travelers.ctaLabel')}
              onCtaClick={handleStartChat}
            />
          </motion.div>
          <motion.div variants={CARD_VARIANTS}>
            <SolutionCard
              id="solution-agencies"
              title={t('solutions.cards.agencies.title')}
              copy={t('solutions.cards.agencies.copy')}
              ctaLabel={t('solutions.cards.agencies.ctaLabel')}
              comingSoonBadge={t('solutions.cards.agencies.comingSoonBadge')}
            />
          </motion.div>
          <motion.div variants={CARD_VARIANTS}>
            <SolutionCard
              id="solution-wholesalers"
              title={t('solutions.cards.wholesalers.title')}
              copy={t('solutions.cards.wholesalers.copy')}
              ctaLabel={t('solutions.cards.wholesalers.ctaLabel')}
              comingSoonBadge={t('solutions.cards.wholesalers.comingSoonBadge')}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
