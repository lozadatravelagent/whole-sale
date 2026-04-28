import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ChatInputPreview() {
  const { t } = useTranslation('landing');
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background pl-4 pr-1.5 py-1.5">
        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-[13px] text-muted-foreground flex-1 truncate">
          {t('mockup.input.placeholder')}
        </span>
        <span className="h-8 w-8 rounded-full gradient-cta flex items-center justify-center text-white shadow-cta text-xs">
          ↑
        </span>
      </div>
    </div>
  );
}
