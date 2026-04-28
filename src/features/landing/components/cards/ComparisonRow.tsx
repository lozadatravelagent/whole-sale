import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface ComparisonRowProps {
  from: string;
  to: string;
  index: number;
}

export function ComparisonRow({ from, to, index }: ComparisonRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-between rounded-2xl glass px-5 py-4 hover:bg-white/80 transition-colors"
    >
      <span className="text-[15px] text-muted-foreground line-through decoration-muted-foreground/40">
        {from}
      </span>
      <ArrowRight className="h-4 w-4 text-primary mx-3 shrink-0" />
      <span className="text-[15px] font-semibold text-foreground tracking-tight">{to}</span>
    </motion.div>
  );
}
