import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ORBIT_STATS } from '../../data/ecosystemNodes';

export function OrbitStats() {
  const { t } = useTranslation('landing');
  return (
    <div className="mt-6 grid sm:grid-cols-3 gap-3">
      {ORBIT_STATS.map((stat, i) => (
        <motion.div
          key={stat.id}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl bg-white border border-border/60 px-5 py-4 shadow-sm flex items-baseline gap-3"
        >
          <span className="text-2xl font-bold tracking-tight text-gradient">{stat.k}</span>
          <span className="text-[13px] text-muted-foreground">{t(stat.vKey)}</span>
        </motion.div>
      ))}
    </div>
  );
}
