import React, { useEffect } from 'react';
import { useMessages } from '@/hooks/useChat';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import type { MessageRow } from '../types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';

interface ChatInterfaceProps {
  selectedConversation: string | null;
  message: string;
  isLoading: boolean;
  isTyping: boolean;
  isUploadingPdf: boolean;
  isAddingToCRM: boolean;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAddToCRM: () => void;
  onPdfGenerated: (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => Promise<void>;
}

const ChatInterface = React.memo(({
  selectedConversation,
  message,
  isLoading,
  isTyping,
  isUploadingPdf,
  isAddingToCRM,
  onMessageChange,
  onSendMessage,
  onPdfUpload,
  onAddToCRM,
  onPdfGenerated
}: ChatInterfaceProps) => {
  const { messages } = useMessages(selectedConversation);

  // Filter out system contextual memory messages
  const visibleMessages = messages.filter((m: MessageRow) => {
    const meta = (m as any).meta;
    // Hide system memory/context messages
    if (m.role === 'system' && meta && meta.messageType === 'contextual_memory') return false;
    return true;
  });

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

  return (
    <div className="flex-1 flex flex-col">
      <ChatHeader
        isTyping={isTyping}
        isAddingToCRM={isAddingToCRM}
        selectedConversation={selectedConversation}
        messagesCount={messages.length}
        onAddToCRM={onAddToCRM}
      />

      {/* Messages area - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {visibleMessages.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              onPdfGenerated={onPdfGenerated}
            />
          ))}

          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Input area - fixed at bottom */}
      <MessageInput
        value={message}
        onChange={onMessageChange}
        onSend={onSendMessage}
        disabled={isLoading}
        isUploadingPdf={isUploadingPdf}
        onPdfUpload={onPdfUpload}
      />
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;