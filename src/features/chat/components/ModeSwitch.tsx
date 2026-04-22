import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { deriveModeSwitchState, type ChatMode } from '../utils/deriveModeSwitchState';

interface ModeSwitchProps {
  mode: ChatMode;
  hasAgency: boolean;
  onModeChange: (next: ChatMode) => void;
  className?: string;
}

export default function ModeSwitch({ mode, hasAgency, onModeChange, className }: ModeSwitchProps) {
  const { t } = useTranslation('chat');
  const items = deriveModeSwitchState(mode, hasAgency);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        role="group"
        aria-label={t('mode.ariaGroup')}
        className={cn(
          'inline-flex items-center rounded-md border border-input bg-background p-0.5',
          className,
        )}
      >
        {items.map((item) => {
          const button = (
            <Button
              type="button"
              size="sm"
              variant={item.selected ? 'default' : 'ghost'}
              disabled={item.disabled}
              aria-pressed={item.selected}
              onClick={() => onModeChange(item.mode)}
              className={cn('h-7 px-3 text-xs font-medium', item.selected && 'shadow-sm')}
            >
              {t(item.labelKey)}
            </Button>
          );

          if (item.tooltipKey) {
            return (
              <Tooltip key={item.mode}>
                <TooltipTrigger asChild>
                  {/* span wrapper: disabled buttons don't dispatch pointer events,
                      so Radix Tooltip needs a focusable proxy to surface the
                      keyboard-accessible tooltip. */}
                  <span className="inline-flex" tabIndex={0}>
                    {button}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t(item.tooltipKey)}</TooltipContent>
              </Tooltip>
            );
          }

          return <React.Fragment key={item.mode}>{button}</React.Fragment>;
        })}
      </div>
    </TooltipProvider>
  );
}
