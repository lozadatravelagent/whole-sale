import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ChatPreviewProps {
  className?: string;
}

export function ChatPreview({ className }: ChatPreviewProps) {
  const { t } = useTranslation('landing');
  const userMessage = t('hero.chatPreview.userMessage');
  const assistantMessage = t('hero.chatPreview.assistantMessage');
  const assistantLabel = t('hero.chatPreview.assistantLabel');
  const userLabel = t('hero.chatPreview.userLabel');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border border-border bg-muted/10 p-5 shadow-card backdrop-blur-sm',
        className,
      )}
      aria-label="Emilia chat preview"
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="flex max-w-[90%] flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">{userLabel}</span>
            <div className="rounded-2xl rounded-br-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-relaxed text-foreground">
              {userMessage}
            </div>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="flex max-w-[90%] items-start gap-3">
            <div
              aria-hidden="true"
              className="mt-5 h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
            />
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-muted-foreground">
                {assistantLabel}
              </span>
              <div className="rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                {assistantMessage}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
