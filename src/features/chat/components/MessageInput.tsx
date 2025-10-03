import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Paperclip } from 'lucide-react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  isUploadingPdf: boolean;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// Message input component - memoized to prevent unnecessary re-renders
const MessageInput = React.memo(({
  value,
  onChange,
  onSend,
  disabled,
  isUploadingPdf,
  onPdfUpload
}: MessageInputProps) => {
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when component mounts or when user starts typing
  React.useEffect(() => {
    if (value.length > 0 && messageInputRef.current && !disabled) {
      messageInputRef.current.focus();
    }
  }, [value.length > 0, disabled]);

  return (
    <div className="border-t bg-background p-2 md:p-4 shadow-lg">
      <div className="flex space-x-1.5 md:space-x-2">
        <Textarea
          ref={messageInputRef}
          id="chat-message-input"
          name="message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey || e.altKey) {
                // In textarea, newline is native; do not send
                return;
              }
              e.preventDefault();
              onSend();
            }
          }}
          onBlur={(e) => {
            // Prevent blur if user is still typing
            if (value.length > 0 && !disabled) {
              setTimeout(() => {
                if (messageInputRef.current && value.length > 0) {
                  messageInputRef.current.focus();
                }
              }, 50);
            }
          }}
          className="flex-1 min-h-[50px] md:min-h-[60px] resize-y text-sm md:text-base"
          autoComplete="off"
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onPdfUpload}
          style={{ display: 'none' }}
        />

        {/* PDF Upload button */}
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploadingPdf}
          size="sm"
          variant="outline"
          className="px-2 md:px-3 flex-shrink-0"
        >
          {isUploadingPdf ? (
            <Loader2 className="h-3.5 md:h-4 w-3.5 md:w-4 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 md:h-4 w-3.5 md:w-4" />
          )}
        </Button>

        {/* Send button */}
        <Button
          onClick={onSend}
          className="px-2 md:px-3 flex-shrink-0"
          disabled={disabled || !value.trim()}
        >
          {disabled ? (
            <Loader2 className="h-3.5 md:h-4 w-3.5 md:w-4 animate-spin" />
          ) : (
            <Send className="h-3.5 md:h-4 w-3.5 md:w-4" />
          )}
        </Button>
      </div>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;