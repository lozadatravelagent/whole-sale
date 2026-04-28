import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  thinking?: boolean;
}

export function ChatHeader({ thinking = false }: ChatHeaderProps) {
  const { t } = useTranslation('landing');
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
      <div className="relative">
        <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-md ring-1 ring-aurora-violet/20">
          <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="h-7 w-7">
            <circle cx="40" cy="40" r="32" stroke="rgba(124,58,237,0.18)" strokeWidth="1" fill="none" />
            <circle cx="40" cy="40" r="22" stroke="rgba(124,58,237,0.45)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
            <path d="M 40 8 A 32 32 0 0 1 72 40 A 32 32 0 0 1 40 72 A 32 32 0 0 0 8 40 A 32 32 0 0 0 40 8" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="72" cy="40" r="8" fill="rgba(124,58,237,0.25)" />
            <circle cx="72" cy="40" r="4" fill="#7c3aed" />
          </svg>
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-foreground tracking-tight">
          {t('mockup.header.title')}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1.5" aria-hidden={!thinking}>
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-aurora-violet/70 transition-opacity',
            thinking ? 'opacity-100 animate-bounce' : 'opacity-0',
          )}
        />
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-aurora-violet/70 transition-opacity [animation-delay:150ms]',
            thinking ? 'opacity-100 animate-bounce' : 'opacity-0',
          )}
        />
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-aurora-violet/70 transition-opacity [animation-delay:300ms]',
            thinking ? 'opacity-100 animate-bounce' : 'opacity-0',
          )}
        />
      </div>
    </div>
  );
}
