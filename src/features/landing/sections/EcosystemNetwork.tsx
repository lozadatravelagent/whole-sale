import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { NetworkNodes } from '../components/NetworkNodes';

const NODE_KEYS = [
  'hotels',
  'flights',
  'transfers',
  'activities',
  'tours',
  'insurance',
] as const;

export function EcosystemNetwork() {
  const { t } = useTranslation('landing');
  const satellites = NODE_KEYS.map((key) => t(`ecosystemNetwork.nodes.${key}`));

  return (
    <motion.section
      id="ecosystem-network"
      aria-labelledby="ecosystem-network-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="landing-section-light scroll-mt-20 py-24 lg:py-32"
    >
      <div className="container mx-auto px-6 lg:px-8">
        <SectionHeading
          id="ecosystem-network-heading"
          eyebrow={t('ecosystemNetwork.eyebrow')}
          title={t('ecosystemNetwork.headline')}
          subtitle={t('ecosystemNetwork.subheadline')}
          align="center"
          className="mb-14 lg:mb-16"
        />
        <NetworkNodes
          centerLabel={t('ecosystemNetwork.centerLabel')}
          satellites={satellites}
          ariaLabel={t('ecosystemNetwork.headline')}
        />
      </div>
    </motion.section>
  );
}
