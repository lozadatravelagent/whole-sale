import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ProposalHeader() {
  const { t } = useTranslation('landing');
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/10 via-aurora-blue/10 to-aurora-coral/10">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-foreground tracking-tight">
            {t('mockup.proposal.header.id')}
          </div>
          <div className="text-[10px] text-muted-foreground">{t('mockup.proposal.header.meta')}</div>
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
        {t('mockup.proposal.header.live')}
      </span>
    </div>
  );
}
