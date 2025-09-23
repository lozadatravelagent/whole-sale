import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when component mounts or when user starts typing
  React.useEffect(() => {
    if (value.length > 0 && messageInputRef.current && !disabled) {
      messageInputRef.current.focus();
    }
  }, [value.length > 0, disabled]);

  return (
    <div className="border-t bg-background p-4">
      <div className="flex space-x-2">
        <Input
          ref={messageInputRef}
          id="chat-message-input"
          name="message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={disabled}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
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
          className="flex-1"
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
          className="px-3"
        >
          {isUploadingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>

        {/* Send button */}
        <Button
          onClick={onSend}
          className="px-3"
          disabled={disabled || !value.trim()}
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;