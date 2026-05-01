import React from 'react';
import { OrbitMark } from '@/components/meridian';

interface TypingIndicatorProps {
  message?: string;
}

// Meridian typing indicator — OrbitMark + glass bubble + bouncing dots
const TypingIndicator = React.memo(({ message }: TypingIndicatorProps) => (
  <div className="flex justify-start">
    <div className="flex items-start gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <OrbitMark size={32} animated />
      </div>
      <div className="meridian-glass rounded-3xl p-3 md:p-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }}></div>
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.6s' }}></div>
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.6s' }}></div>
          </div>
          {message && (
            <span className="font-utility text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
));

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
