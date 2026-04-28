import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ChatHeader() {
  const { t } = useTranslation('landing');
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
      <div className="relative">
        <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center shadow-md">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-foreground tracking-tight">
          {t('mockup.header.title')}
        </div>
        <div className="text-[11px] text-muted-foreground">{t('mockup.header.status')}</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
      </div>
    </div>
  );
}
