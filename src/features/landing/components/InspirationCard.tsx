import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildPromptChatPath } from '../lib/buildPromptChatPath';
import { writePendingPrompt } from '../lib/pendingPrompt';

interface InspirationCardProps {
  title: string;
  prompt: string;
  ctaLabel: string;
  className?: string;
}

export function InspirationCard({
  title,
  prompt,
  ctaLabel,
  className,
}: InspirationCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    writePendingPrompt(prompt);
    navigate(buildPromptChatPath(prompt));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={title}
      className={cn(
        'group flex h-full w-full flex-col items-start gap-5 rounded-2xl border border-border bg-muted/10 p-7 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-transform group-hover:translate-x-0.5">
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}
