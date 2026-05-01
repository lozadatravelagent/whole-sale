import React from 'react';
import { CircleUser } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrbitMark } from '@/components/meridian';
import { formatTime } from '../../utils/messageHelpers';
import MessageStatusIcon from './MessageStatusIcon';

interface MessageHeaderProps {
  role: 'user' | 'assistant' | 'system';
  createdAt?: string;
  status?: string;
  /** Whether to show timestamp + status row (footer mode). When false, only the avatar is rendered. */
  showFooter?: boolean;
  className?: string;
}

/**
 * Message avatar + (optional) timestamp/status footer line.
 *
 * - Assistant → animated `OrbitMark` (Meridian branded mark) inside a glass circle.
 * - User → `CircleUser` icon inside a gradient violet circle (full-opacity foreground).
 * - System → small muted dot (rare path).
 *
 * Solid color tokens only. No opacity on text.
 */
export const MessageAvatar = React.memo(({ role }: { role: MessageHeaderProps['role'] }) => {
  if (role === 'assistant') {
    return (
      <div className="meridian-glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-9 md:w-9">
        <OrbitMark size={28} animated />
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent md:h-8 md:w-8">
        <CircleUser className="h-3.5 w-3.5 text-primary-foreground md:h-4 md:w-4" />
      </div>
    );
  }

  return (
    <div className="meridian-glass-dark flex h-7 w-7 shrink-0 items-center justify-center rounded-full md:h-8 md:w-8">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden />
    </div>
  );
});
MessageAvatar.displayName = 'MessageAvatar';

const MessageHeader = React.memo(({ role, createdAt, status, showFooter = false, className }: MessageHeaderProps) => {
  if (!showFooter) {
    return <MessageAvatar role={role} />;
  }

  return (
    <p
      className={cn(
        'mt-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground md:text-[11px]',
        className
      )}
    >
      <span className="flex items-center gap-1">
        <MessageStatusIcon status={status} />
        {createdAt && <span>{formatTime(createdAt)}</span>}
      </span>
    </p>
  );
});

MessageHeader.displayName = 'MessageHeader';

export default MessageHeader;
