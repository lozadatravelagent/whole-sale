import { motion } from 'framer-motion';
import { PROPOSAL_ITEMS } from '../../../data/proposalSample';
import { ProposalHeader } from './ProposalHeader';
import { ProposalSummaryChips } from './ProposalSummaryChips';
import { ProposalItemRow } from './ProposalItemRow';
import { ProposalTotal } from './ProposalTotal';

export function ProposalCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mt-2 rounded-2xl border border-border/60 bg-white/95 backdrop-blur shadow-md overflow-hidden"
    >
      <ProposalHeader />
      <ProposalSummaryChips />
      <div className="px-3 sm:px-4 py-3 space-y-1.5">
        {PROPOSAL_ITEMS.map((entry, i) => (
          <ProposalItemRow key={entry.id} entry={entry} index={i} />
        ))}
      </div>
      <ProposalTotal />
    </motion.div>
  );
}
