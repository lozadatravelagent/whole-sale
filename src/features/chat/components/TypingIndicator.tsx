import React from 'react';
import { Bot } from 'lucide-react';

// Typing indicator component - memoized to prevent re-renders
const TypingIndicator = React.memo(() => (
  <div className="flex justify-start">
    <div className="max-w-lg flex items-start space-x-2">
      <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
        <Bot className="h-4 w-4 text-accent" />
      </div>
      <div className="rounded-lg p-4 bg-muted">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  </div>
));

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;