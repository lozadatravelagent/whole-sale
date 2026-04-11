import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HandoffBannerProps {
  visible: boolean;
  onOpenModal: () => void;
  className?: string;
}

export default function HandoffBanner({ visible, onOpenModal, className }: HandoffBannerProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-t border-border bg-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      data-testid="handoff-banner"
    >
      <div className="flex items-start gap-2 sm:items-center">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary sm:mt-0" />
        <div className="flex flex-col">
          <p className="text-sm font-medium text-foreground">
            Tu viaje está tomando forma.
          </p>
          <p className="text-xs text-muted-foreground">
            ¿Querés que te ayude a buscar vuelos y hoteles?
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={onOpenModal}
        className="sm:flex-shrink-0"
      >
        Pedir ayuda humana
      </Button>
    </div>
  );
}
