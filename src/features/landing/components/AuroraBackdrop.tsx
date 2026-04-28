import { cn } from '@/lib/utils';

type AuroraVariant = 'hero' | 'soft' | 'intense';

interface AuroraBackdropProps {
  className?: string;
  variant?: AuroraVariant;
}

const INTENSITY: Record<AuroraVariant, string> = {
  hero: 'opacity-75',
  soft: 'opacity-50',
  intense: 'opacity-90',
};

export function AuroraBackdrop({ className, variant = 'hero' }: AuroraBackdropProps) {
  const intensity = INTENSITY[variant];
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 gradient-hero" />
      <div className={cn('absolute -top-32 left-[10%] h-[520px] w-[520px] rounded-full bg-aurora-violet blur-[120px] animate-aurora', intensity)} />
      <div
        className={cn('absolute top-[20%] right-[-8%] h-[480px] w-[480px] rounded-full bg-aurora-blue blur-[110px] animate-aurora-slow', intensity)}
        style={{ animationDelay: '-7s' }}
      />
      <div
        className={cn('absolute bottom-[-10%] left-[30%] h-[420px] w-[420px] rounded-full bg-aurora-coral blur-[120px] animate-aurora', intensity)}
        style={{ animationDelay: '-14s' }}
      />
      <div
        className="absolute top-[40%] left-[50%] h-[300px] w-[300px] rounded-full bg-aurora-pink blur-[100px] animate-aurora-slow opacity-40"
        style={{ animationDelay: '-3s' }}
      />
    </div>
  );
}
