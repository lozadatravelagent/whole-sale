import { cn } from '@/lib/utils';

interface EcosystemCardProps {
  id: string;
  title: string;
  copy: string;
  ctaLabel: string;
  comingSoonBadge: string;
  className?: string;
}

export function EcosystemCard({
  id,
  title,
  copy,
  ctaLabel,
  comingSoonBadge,
  className,
}: EcosystemCardProps) {
  return (
    <article
      id={id}
      className={cn(
        'scroll-mt-20 flex h-full flex-col gap-5 rounded-2xl border border-border bg-muted/10 p-8 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30',
        className,
      )}
    >
      <h3 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="flex-1 text-base leading-relaxed text-muted-foreground">
        {copy}
      </p>
      <div className="flex items-center gap-3 pt-2">
        <a
          href="#"
          aria-disabled="true"
          tabIndex={-1}
          onClick={(event) => event.preventDefault()}
          className="pointer-events-none inline-flex select-none items-center text-sm font-medium text-muted-foreground/70"
        >
          {ctaLabel}
        </a>
        <span className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground">
          {comingSoonBadge}
        </span>
      </div>
    </article>
  );
}
