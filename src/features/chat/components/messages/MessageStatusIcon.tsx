import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMessageStatusIconType } from '../../utils/messageHelpers';

interface MessageStatusIconProps {
  status?: string;
  className?: string;
}

/**
 * Renders the small status indicator next to a message timestamp.
 * Solid `text-muted-foreground` (no opacity) — must remain readable in both modes.
 */
const MessageStatusIcon = React.memo(({ status, className }: MessageStatusIconProps) => {
  const type = getMessageStatusIconType(status || 'sent');
  const baseClass = cn('h-2.5 md:h-3 w-2.5 md:w-3 text-muted-foreground', className);

  if (type === 'sending') return <Clock className={baseClass} />;
  if (type === 'delivered') return <CheckCheck className={baseClass} />;
  return <Check className={baseClass} />;
});

MessageStatusIcon.displayName = 'MessageStatusIcon';

export default MessageStatusIcon;
