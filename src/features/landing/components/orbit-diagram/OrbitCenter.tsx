import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function OrbitCenter() {
  const { t } = useTranslation('landing');
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', damping: 18, delay: 0.2 }}
      className="absolute left-[38%] top-[38%] sm:left-[45%] sm:top-[43%] -translate-x-1/2 -translate-y-1/2 z-20"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl scale-[2]" />
        <div className="absolute -inset-3 rounded-full border border-primary/20 animate-pulse-ring-out" />
        <div className="relative px-4 py-2 sm:px-6 sm:py-3 rounded-2xl gradient-primary text-white text-[12px] sm:text-sm font-bold tracking-tight shadow-glow text-center">
          {t('mockup.header.title')}
        </div>
      </div>
    </motion.div>
  );
}
