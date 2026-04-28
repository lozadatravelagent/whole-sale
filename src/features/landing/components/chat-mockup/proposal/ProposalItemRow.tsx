import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProposalItemEntry } from '../../../data/proposalSample';

interface ProposalItemRowProps {
  entry: ProposalItemEntry;
  index: number;
}

export function ProposalItemRow({ entry, index }: ProposalItemRowProps) {
  const { t } = useTranslation('landing');
  const Icon = entry.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 + 0.1 * index, duration: 0.35 }}
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-white px-3 py-2 hover:border-primary/30 transition-colors"
    >
      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/15 to-aurora-blue/20 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="text-[12px] font-semibold text-foreground truncate tracking-tight">
            {t(entry.titleKey)}
          </div>
          {entry.stars && (
            <div className="flex">
              {Array.from({ length: entry.stars }).map((_, s) => (
                <Star key={s} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate">{t(entry.metaKey)}</span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/50" />
          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
            <Check className="h-2.5 w-2.5" /> {t(entry.tagKey)}
          </span>
        </div>
      </div>
      <div className="text-[12px] font-semibold text-foreground tabular-nums shrink-0">
        {entry.price}
      </div>
    </motion.div>
  );
}
