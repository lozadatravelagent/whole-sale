import { motion } from 'framer-motion';

export function OrbitCenter() {
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
        <div className="relative inline-flex items-center justify-center rounded-full bg-white/95 backdrop-blur p-2 sm:p-2.5 shadow-glow ring-1 ring-aurora-violet/30">
          <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
            <circle cx="40" cy="40" r="32" stroke="rgba(124,58,237,0.18)" strokeWidth="1" fill="none" />
            <circle cx="40" cy="40" r="22" stroke="rgba(124,58,237,0.45)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
            <path d="M 40 8 A 32 32 0 0 1 72 40 A 32 32 0 0 1 40 72 A 32 32 0 0 0 8 40 A 32 32 0 0 0 40 8" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="72" cy="40" r="8" fill="rgba(124,58,237,0.25)" />
            <circle cx="72" cy="40" r="4" fill="#7c3aed" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
