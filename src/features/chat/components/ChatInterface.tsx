import React, { useEffect, useRef, useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import type { MessageRow } from '../types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import { FileUp } from 'lucide-react';

interface ChatInterfaceProps {
  selectedConversation: string | null;
  message: string;
  isLoading: boolean;
  isTyping: boolean;
  typingMessage?: string;
  isUploadingPdf: boolean;
  isAddingToCRM: boolean;
  messages: MessageRow[];
  refreshMessages: () => void;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAddToCRM: () => void;
  onPdfGenerated: (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => Promise<void>;
  onBackToList?: () => void;
}

const ChatInterface = React.memo(({
  selectedConversation,
  message,
  isLoading,
  isTyping,
  typingMessage,
  isUploadingPdf,
  isAddingToCRM,
  messages,
  refreshMessages,
  onMessageChange,
  onSendMessage,
  onPdfUpload,
  onAddToCRM,
  onPdfGenerated,
  onBackToList
}: ChatInterfaceProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Filter out system contextual memory messages
  const visibleMessages = messages.filter((m: MessageRow) => {
    const meta = (m as any).meta;
    // Hide system memory/context messages
    if (m.role === 'system' && meta && meta.messageType === 'contextual_memory') return false;
    return true;
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleMessages.length, isTyping]);

  // ⚡ OPTIMIZATION: Removed redundant refreshMessages call
  // Messages are already loaded by useMessages hook in useChat.ts (line 394)
  // This was causing DOUBLE SELECT on every conversation change (~50-150ms wasted)

  // Add CSS animations to head (only once)
  useEffect(() => {
    if (document.querySelector('#chat-animations')) return; // Already added

    const style = document.createElement('style');
    style.id = 'chat-animations';
    style.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes fadeInOut {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.querySelector('#chat-animations');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  // Handle drag and drop for PDF files
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the main container
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check if it's a PDF
      if (file.type === 'application/pdf') {
        // Create a synthetic event to match the expected type
        const syntheticEvent = {
          target: {
            files: files
          }
        } as React.ChangeEvent<HTMLInputElement>;

        onPdfUpload(syntheticEvent);
      } else {
        // You could show a toast here for invalid file type
        console.warn('Only PDF files are supported');
      }
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChatHeader
        isTyping={isTyping}
        isAddingToCRM={isAddingToCRM}
        selectedConversation={selectedConversation}
        messagesCount={messages.length}
        onAddToCRM={onAddToCRM}
        onBackToList={onBackToList}
      />

      {/* Drag and Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg flex items-center justify-center">
          <div className="text-center">
            <FileUp className="h-16 w-16 text-primary mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-semibold text-primary">Suelta el PDF aquí</p>
            <p className="text-sm text-muted-foreground mt-2">Solo archivos PDF (máx. 10MB)</p>
          </div>
        </div>
      )}

      {/* Messages area - scrollable with fixed height */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0"
      >
        <div className="space-y-3 md:space-y-4">
          {visibleMessages.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              onPdfGenerated={onPdfGenerated}
            />
          ))}

          {isTyping && (
            <div className="flex items-start gap-2 md:gap-3 animate-in fade-in duration-300">
              <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <span className="text-base md:text-lg">🤖</span>
              </div>
              <div className="flex-1 bg-muted/50 border border-primary/10 rounded-2xl p-3 md:p-4 max-w-[85%] md:max-w-[80%]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex gap-1 md:gap-1.5">
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }}></div>
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '0.6s' }}></div>
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '0.6s' }}></div>
                    </div>
                    <span className="text-xs md:text-sm font-medium text-foreground/80 animate-pulse">
                      {typingMessage || 'Pensando...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area - always fixed at bottom */}
      <div className="flex-shrink-0">
        <MessageInput
          value={message}
          onChange={onMessageChange}
          onSend={onSendMessage}
          disabled={isLoading}
          isUploadingPdf={isUploadingPdf}
          onPdfUpload={onPdfUpload}
          selectedConversation={selectedConversation}
        />
      </div>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;