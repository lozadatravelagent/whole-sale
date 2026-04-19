import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildPromptChatPath } from '../lib/buildPromptChatPath';
import { writePendingPrompt } from '../lib/pendingPrompt';
import { UnsplashImage } from './UnsplashImage';

interface InspirationCardProps {
  photoId: string;
  alt: string;
  title: string;
  prompt: string;
  ctaLabel: string;
  className?: string;
}

export function InspirationCard({
  photoId,
  alt,
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
        'group relative flex aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border/50 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <UnsplashImage
        photoId={photoId}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 motion-reduce:group-hover:scale-100"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent transition-colors duration-300 group-hover:from-black/70"
      />
      <div className="relative z-10 mt-auto flex flex-col gap-3 p-6 text-left">
        <h3 className="text-xl font-semibold tracking-tight text-white">
          {title}
        </h3>
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}
