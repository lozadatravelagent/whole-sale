import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  
  // Contador de profundidad para manejar drag sobre elementos hijos
  const dragDepthRef = useRef(0);

  // Filter out system contextual memory messages
  const visibleMessages = messages.filter((m: MessageRow) => {
    const meta = (m as any).meta;
    // Hide system memory/context messages
    if (m.role === 'system' && meta && (meta.messageType === 'contextual_memory' || meta.messageType === 'context_state')) return false;
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

  // Función para resetear el estado de drag (usada por múltiples handlers)
  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
  }, []);

  // Handle drag and drop for PDF files
  // Usamos dragenter/dragleave con contador de profundidad para detectar correctamente
  // cuando el cursor entra/sale del contenedor vs elementos hijos
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragDepthRef.current++;
    
    // Solo mostrar overlay si hay archivos en el drag
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Necesario para permitir el drop, pero no cambiamos estado aquí
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragDepthRef.current--;
    
    // Solo ocultar cuando realmente salimos del contenedor (depth = 0)
    if (dragDepthRef.current <= 0) {
      resetDragState();
    }
  }, [resetDragState]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resetDragState();

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
  }, [onPdfUpload, resetDragState]);

  // Listeners globales para casos edge: drop fuera de ventana, ESC, cambio de pestaña
  useEffect(() => {
    // Handler para drop en window (usuario suelta fuera del área de chat)
    const handleWindowDrop = (e: DragEvent) => {
      // Solo resetear si estamos mostrando el overlay
      if (isDraggingOver) {
        resetDragState();
      }
    };

    // Handler para dragend (drag cancelado o terminado)
    const handleWindowDragEnd = () => {
      resetDragState();
    };

    // Handler para ESC key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingOver) {
        resetDragState();
      }
    };

    // Handler para blur/visibilitychange (cambio de pestaña o ventana)
    const handleVisibilityChange = () => {
      if (document.hidden && isDraggingOver) {
        resetDragState();
      }
    };

    const handleWindowBlur = () => {
      // Pequeño delay para evitar falsos positivos al hacer click en el overlay
      setTimeout(() => {
        if (isDraggingOver) {
          resetDragState();
        }
      }, 100);
    };

    // Handler para cuando el mouse sale de la ventana completamente
    const handleMouseLeave = (e: MouseEvent) => {
      // Si salimos de la ventana mientras arrastramos
      if (isDraggingOver && !e.relatedTarget) {
        resetDragState();
      }
    };

    // Registrar listeners
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragend', handleWindowDragEnd);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Cleanup
    return () => {
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragend', handleWindowDragEnd);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDraggingOver, resetDragState]);

  return (
    <div
      className="flex-1 flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
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

      {/* Drag and Drop Overlay - pointer-events-none para no interferir con drag events */}
      {isDraggingOver && (
        <div 
          className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none"
          aria-live="polite"
          role="status"
        >
          <div className="text-center">
            <FileUp className="h-16 w-16 text-primary mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-semibold text-primary">Suelta el PDF aquí</p>
            <p className="text-sm text-muted-foreground mt-2">Solo archivos PDF (máx. 10MB)</p>
            <p className="text-xs text-muted-foreground mt-1">Presiona ESC para cancelar</p>
          </div>
        </div>
      )}

      {/* Messages area - scrollable with fixed height */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0"
      >
        <div className="space-y-3 md:space-y-4">
          {/* Inline skeleton while loading messages - only for existing conversations */}
          {isLoading && visibleMessages.length === 0 && selectedConversation && !selectedConversation.startsWith('temp-') ? (
            <div className="space-y-4" aria-busy="true" aria-label="Cargando mensajes">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-8 w-8 bg-muted/50 animate-pulse rounded-full" />
                  <div className={`flex-1 space-y-2 ${i % 2 === 0 ? 'ml-auto max-w-[75%]' : 'max-w-[75%]'}`}>
                    <div className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {visibleMessages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  onPdfGenerated={onPdfGenerated}
                />
              ))}</>
          )}

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