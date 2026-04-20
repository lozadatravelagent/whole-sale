import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildPromptChatPath } from '../lib/buildPromptChatPath';
import { writePendingPrompt } from '../lib/pendingPrompt';

interface ChatPreviewProps {
  className?: string;
}

export function ChatPreview({ className }: ChatPreviewProps) {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  const assistantMessage = t('hero.chatPreview.assistantMessage');
  const assistantLabel = t('hero.chatPreview.assistantLabel');
  const status = t('hero.chatPreview.status');
  const inputPlaceholder = t('hero.chatPreview.inputPlaceholder');
  const sendLabel = t('hero.chatPreview.sendLabel');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const prompt = value.trim();
    if (!prompt) return;
    writePendingPrompt(prompt);
    navigate(buildPromptChatPath(prompt));
  };

  const canSubmit = value.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-muted/10 p-5 shadow-card backdrop-blur-sm',
        className,
      )}
      aria-label="Emilia chat preview"
    >
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <div
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
        />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {assistantLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            />
            {status}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="mt-2 h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
        />
        <div className="rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
          {assistantMessage}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2">
        <label htmlFor="hero-chat-input" className="sr-only">
          {inputPlaceholder}
        </label>
        <input
          id="hero-chat-input"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={inputPlaceholder}
          autoComplete="off"
          className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label={sendLabel}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </motion.div>
  );
}
