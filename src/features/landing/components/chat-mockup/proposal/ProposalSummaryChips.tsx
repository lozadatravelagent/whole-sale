import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PROPOSAL_SUMMARY } from '../../../data/proposalSample';

export function ProposalSummaryChips() {
  const { t } = useTranslation('landing');
  return (
    <div className="grid grid-cols-2 gap-1.5 px-3 pt-3">
      {PROPOSAL_SUMMARY.map((entry, i) => {
        const Icon = entry.icon;
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5"
          >
            <Icon className="h-3 w-3 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
                {t(entry.labelKey)}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {t(entry.subKey)}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
