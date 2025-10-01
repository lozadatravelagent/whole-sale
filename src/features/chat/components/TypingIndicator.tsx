import React from 'react';
import { Bot } from 'lucide-react';

interface TypingIndicatorProps {
  message?: string;
}

// Typing indicator component with optional status message
const TypingIndicator = React.memo(({ message }: TypingIndicatorProps) => (
  <div className="flex justify-start">
    <div className="max-w-lg flex items-start space-x-2">
      <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
        <Bot className="h-4 w-4 text-accent" />
      </div>
      <div className="rounded-lg p-4 bg-muted">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          {message && (
            <span className="text-sm text-muted-foreground ml-2">{message}</span>
          )}
        </div>
      </div>
    </div>
  </div>
));

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
