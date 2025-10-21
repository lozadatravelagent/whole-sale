import { Switch } from '@/components/ui/switch';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ variant = 'default', className, showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const sizes = {
    default: {
      container: 'px-3 py-2',
      icon: 'h-4 w-4',
      gap: 'gap-2',
      scale: '',
    },
    compact: {
      container: 'px-2 py-1',
      icon: 'h-3.5 w-3.5',
      gap: 'gap-1.5',
      scale: 'scale-75',
    },
    minimal: {
      container: 'px-1.5 py-1',
      icon: 'h-3 w-3',
      gap: 'gap-1',
      scale: 'scale-[0.65]',
    },
  };

  const currentSize = sizes[variant];

  return (
    <div
      className={cn(
        'flex items-center rounded-lg bg-muted/50',
        currentSize.container,
        currentSize.gap,
        className
      )}
    >
      {showLabel && <span className="text-xs text-muted-foreground hidden sm:inline">Tema:</span>}
      <Sun className={cn(currentSize.icon, 'text-muted-foreground')} />
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label="Cambiar tema"
        className={currentSize.scale}
      />
      <Moon className={cn(currentSize.icon, 'text-muted-foreground')} />
    </div>
  );
}
