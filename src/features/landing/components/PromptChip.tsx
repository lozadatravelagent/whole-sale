import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PromptChipProps {
  label: string;
  prompt: string;
  className?: string;
}

export function PromptChip({ label, prompt, className }: PromptChipProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/emilia/chat?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      {label}
    </button>
  );
}
