import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PROPOSAL_TOTAL } from '../../../data/proposalSample';

export function ProposalTotal() {
  const { t } = useTranslation('landing');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.85 }}
      className="px-4 py-3 border-t border-border/50 bg-muted/40 flex items-center justify-between"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-emerald-600" />
        <span>{t('mockup.proposal.total.guarantee')}</span>
      </div>
      <div className="text-right">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {t('mockup.proposal.total.label')}
        </div>
        <div className="text-[15px] font-bold text-foreground tabular-nums">{PROPOSAL_TOTAL}</div>
      </div>
    </motion.div>
  );
}
