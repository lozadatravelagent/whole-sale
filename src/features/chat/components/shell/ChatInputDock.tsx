import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Loader2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputDockProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  isUploadingPdf: boolean;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedConversation?: string | null;
  className?: string;
}

/**
 * Meridian message input dock — replaces legacy `MessageInput`.
 *
 * Visual: glass pill flotante con paperclip ghost button + textarea autogrow
 * + send button gradient violet. Easing `ease-out-expo` en focus / send.
 */
const ChatInputDock = React.memo(({
  value,
  onChange,
  onSend,
  disabled,
  isUploadingPdf,
  onPdfUpload,
  selectedConversation,
  className,
}: ChatInputDockProps) => {
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousConversationRef = useRef<string | null>(null);

  React.useEffect(() => {
    const isTransitioningFromTemp =
      previousConversationRef.current?.startsWith('temp-') &&
      selectedConversation &&
      !selectedConversation.startsWith('temp-');

    if (!isTransitioningFromTemp && selectedConversation && messageInputRef.current && !disabled) {
      if (document.activeElement !== messageInputRef.current) {
        setTimeout(() => {
          messageInputRef.current?.focus();
        }, 100);
      }
    }

    previousConversationRef.current = selectedConversation;
  }, [selectedConversation, disabled]);

  React.useEffect(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const isEmpty = !value.trim();

  return (
    <div
      className={cn(
        'relative px-3 pb-3 pt-2 md:px-4 md:pb-4',
        'bg-gradient-to-t from-background via-background/95 to-background/0',
        className
      )}
    >
      <div
        className={cn(
          'meridian-glass relative flex items-end gap-2 rounded-3xl px-3 py-2',
          'transition-all duration-300 ease-out-expo',
          'focus-within:border-primary/40 focus-within:shadow-glow'
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onPdfUpload}
          style={{ display: 'none' }}
        />

        {/* Paperclip ghost — left */}
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploadingPdf}
          variant="ghost"
          size="icon"
          aria-label="Adjuntar PDF"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          {isUploadingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>

        <Textarea
          ref={messageInputRef}
          id="chat-message-input"
          name="message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Pedime una idea, una ruta o una cotización…"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey || e.altKey) return;
              e.preventDefault();
              onSend();
            }
          }}
          className={cn(
            'min-h-[40px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm',
            'shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            'placeholder:text-muted-foreground/70'
          )}
          autoComplete="off"
        />

        {/* Send — Meridian gradient violet */}
        <Button
          type="button"
          onClick={onSend}
          disabled={disabled || isEmpty}
          variant="meridian"
          size="icon"
          aria-label="Enviar"
          className="h-9 w-9 shrink-0 rounded-full p-0"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
});

ChatInputDock.displayName = 'ChatInputDock';

export default ChatInputDock;
