import { useCallback, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useMessages } from '@/hooks/useChat';
import { updateLeadWithPdfData, diagnoseCRMIntegration, createComprehensiveLeadFromChat } from '@/utils/chatToLead';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';

// Import feature components and hooks
import ChatSidebar from './components/ChatSidebar';
import ChatInterface from './components/ChatInterface';
import EmptyState from './components/EmptyState';
import useChatState from './hooks/useChatState';
import useContextualMemory from './hooks/useContextualMemory';
import usePdfAnalysis from './hooks/usePdfAnalysis';
import useMessageHandler from './hooks/useMessageHandler';
import { addMessageViaSupabase } from './services/messageService';
import { generateChatTitle } from './utils/messageHelpers';
import { parseMessageWithAI } from '@/services/aiMessageParser';
import { handleFlightSearch, handleHotelSearch, handlePackageSearch, handleServiceSearch, handleCombinedSearch, handleGeneralQuery } from './services/searchHandlers';

const ChatFeature = () => {
  const {
    // State
    selectedConversation,
    message,
    isLoading,
    isTyping,
    typingMessage,
    activeTab,
    sidebarLimit,
    previousParsedRequest,
    isAddingToCRM,

    // Related data
    conversations,

    // Setters
    setSelectedConversation,
    setMessage,
    setIsLoading,
    setIsTyping,
    setTypingMessage,
    setActiveTab,
    setPreviousParsedRequest,
    setIsAddingToCRM,

    // Actions
    createNewChat,
    updateConversationState,
    updateConversationTitle,
    toast
  } = useChatState();

  const {
    messages,
    updateMessageStatus,
    loadMessages,
    refreshMessages,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage
  } = useMessages(selectedConversation);

  // Contextual memory hooks
  const { loadContextualMemory, saveContextualMemory, clearContextualMemory, loadContextState, saveContextState } = useContextualMemory();

  // PDF analysis hooks
  const {
    isUploadingPdf,
    handlePdfUpload,
    handleCheaperFlightsSearch,
    handlePriceChangeRequest: handlePdfPriceChange
  } = usePdfAnalysis(selectedConversation, messages);

  // Message handler hook
  const { handleSendMessage: handleSendMessageRaw } = useMessageHandler(
    selectedConversation,
    previousParsedRequest,
    setPreviousParsedRequest,
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    loadContextState,
    saveContextState,
    updateMessageStatus,
    updateConversationTitle,
    handleCheaperFlightsSearch,
    handlePdfPriceChange,
    setIsLoading,
    setIsTyping,
    setMessage,
    toast,
    setTypingMessage,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage
  );

  // CTA: Retry with stops when no direct flights
  useEffect(() => {
    const onRetryWithStops = () => {
      if (isLoading) return;
      // Send a minimal message that our parser understands to allow stops
      handleSendMessageRaw('con escalas');
      toast({ title: 'Buscando con escalas', description: 'Reintentando la búsqueda permitiendo conexiones.' });
    };
    window.addEventListener('chat:retryWithStops', onRetryWithStops);
    return () => window.removeEventListener('chat:retryWithStops', onRetryWithStops);
  }, [handleSendMessageRaw, isLoading, toast]);

  // Wrapper for handleSendMessage
  const handleSendMessage = useCallback(() => {
    if (!message.trim() || isLoading) return;
    handleSendMessageRaw(message);
  }, [message, isLoading, handleSendMessageRaw]);

  // Handle Add to CRM button click
  const handleAddToCRM = useCallback(async () => {
    if (!selectedConversation || !messages.length) {
      toast({
        title: "Error",
        description: "No hay conversación seleccionada o mensajes disponibles",
        variant: "destructive"
      });
      return;
    }

    setIsAddingToCRM(true);

    try {
      console.log('📋 [ADD TO CRM] Starting comprehensive lead creation');

      // Get current conversation
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }

      // Get the most recent parsed request from memory or messages
      let parsedRequest = previousParsedRequest;

      // If no parsed request in memory, try to find one in recent messages
      if (!parsedRequest) {
        console.log('🔍 [ADD TO CRM] No parsed request in memory, searching in messages...');

        // First, try to find in assistant messages
        const recentAssistantMessage = messages
          .filter(msg => msg.role === 'assistant')
          .reverse()
          .find(msg => {
            const meta = msg.meta as any;
            return meta?.originalRequest || meta?.parsedRequest;
          });

        if (recentAssistantMessage) {
          const meta = recentAssistantMessage.meta as any;
          parsedRequest = meta?.originalRequest || meta?.parsedRequest;
          console.log('📊 [ADD TO CRM] Found parsed request in assistant message:', parsedRequest);
        }

        // If still no parsed request, try to find in user messages
        if (!parsedRequest) {
          const recentUserMessage = messages
            .filter(msg => msg.role === 'user')
            .reverse()
            .find(msg => {
              const meta = msg.meta as any;
              return meta?.parsedRequest;
            });

          if (recentUserMessage) {
            const meta = recentUserMessage.meta as any;
            parsedRequest = meta?.parsedRequest;
            console.log('📊 [ADD TO CRM] Found parsed request in user message:', parsedRequest);
          }
        }
      }

      // Extract budget and flight data from latest PDF if available
      let budgetFromPdf = 0;
      const latestPdfMessage = messages
        .filter(msg => {
          const hasPdf = typeof msg.content === 'object' && msg.content && 'pdfUrl' in msg.content;
          const metadata = (msg.content as any)?.metadata;
          return hasPdf && metadata?.type === 'pdf_generated';
        })
        .reverse()[0]; // Get the most recent PDF

      if (latestPdfMessage) {
        console.log('📄 [ADD TO CRM] Found latest PDF message, extracting budget and flight data');
        try {
          // Look for combined travel results in the message metadata
          const metadata = (latestPdfMessage.content as any)?.metadata;
          if (metadata?.combinedResults) {
            const { flights, hotels } = metadata.combinedResults;

            // Calculate budget from flights
            if (flights && Array.isArray(flights)) {
              flights.forEach((flight: any) => {
                budgetFromPdf += flight.price?.amount || 0;
              });
            }

            // Calculate budget from hotels
            if (hotels && Array.isArray(hotels)) {
              hotels.forEach((hotel: any) => {
                const cheapestRoom = hotel.rooms?.reduce((cheapest: any, room: any) =>
                  room.total_price < cheapest.total_price ? room : cheapest
                );
                if (cheapestRoom) {
                  budgetFromPdf += cheapestRoom.total_price;
                }
              });
            }

            // If no parsed request found, try to construct one from PDF data
            if (!parsedRequest && flights && Array.isArray(flights) && flights.length > 0) {
              const firstFlight = flights[0];
              console.log('🔧 [ADD TO CRM] Constructing parsed request from PDF flight data:', firstFlight);

              parsedRequest = {
                requestType: 'flights' as const,
                flights: {
                  origin: firstFlight.legs?.[0]?.departure?.city_name || 'Unknown',
                  destination: firstFlight.legs?.[0]?.arrival?.city_name || 'Unknown',
                  departureDate: firstFlight.departure_date || '',
                  returnDate: firstFlight.return_date || undefined,
                  adults: firstFlight.adults || 1,
                  children: firstFlight.childrens || 0,
                  luggage: firstFlight.luggage ? 'checked' : 'none'
                },
                confidence: 0.9,
                originalMessage: 'Reconstructed from PDF data'
              };
              console.log('✅ [ADD TO CRM] Constructed parsed request from PDF:', parsedRequest);
            }
          }
        } catch (error) {
          console.warn('⚠️ [ADD TO CRM] Error extracting data from PDF:', error);
        }
      }

      console.log('📊 [ADD TO CRM] Final parsed request to use:', parsedRequest);
      console.log('💰 [ADD TO CRM] Budget from latest PDF:', budgetFromPdf);

      // Create comprehensive lead
      const leadId = await createComprehensiveLeadFromChat(
        conversation,
        messages,
        parsedRequest,
        budgetFromPdf > 0 ? budgetFromPdf : undefined
      );

      if (leadId) {
        toast({
          title: "¡Lead creado exitosamente!",
          description: `Lead agregado al CRM con ID: ${leadId}`,
        });

        console.log('✅ [ADD TO CRM] Lead created successfully:', leadId);
      } else {
        throw new Error('No se pudo crear el lead');
      }

    } catch (error) {
      console.error('❌ [ADD TO CRM] Error creating lead:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el lead. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsAddingToCRM(false);
    }
  }, [selectedConversation, messages, conversations, previousParsedRequest, toast, setIsAddingToCRM]);

  // Handle PDF generated from selectors
  const handlePdfGenerated = useCallback(async (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => {
    console.log('📄 PDF generated, adding to chat and updating lead:', pdfUrl);
    console.log('🛫 Selected flights:', selectedFlights.length);
    console.log('🏨 Selected hotels:', selectedHotels.length);

    if (!selectedConversation) {
      console.warn('❌ No conversation selected, cannot add PDF message');
      return;
    }

    try {
      // Add PDF message from Emilia (assistant)
      await addMessageViaSupabase({
        conversation_id: selectedConversation,
        role: 'assistant' as const,
        content: {
          text: '¡He generado tu cotización de viaje! 📄✈️🏨\n\nPuedes descargar el PDF con todos los detalles de tu viaje combinado.',
          pdfUrl: pdfUrl,
          metadata: {
            type: 'pdf_generated',
            source: 'combined_travel_pdf',
            timestamp: new Date().toISOString(),
            selectedFlights: selectedFlights.length,
            selectedHotels: selectedHotels.length,
            combinedResults: {
              flights: selectedFlights,
              hotels: selectedHotels
            }
          }
        },
        meta: {
          status: 'sent',
          messageType: 'pdf_delivery'
        }
      });

      // Run CRM diagnosis before updating
      console.log('🔍 Running CRM diagnosis...');
      await diagnoseCRMIntegration(selectedConversation);

      // Update lead with PDF data
      console.log('📋 Updating lead with PDF data...');
      const leadId = await updateLeadWithPdfData(
        selectedConversation,
        pdfUrl,
        selectedFlights,
        selectedHotels
      );

      if (leadId) {
        console.log('✅ Lead updated successfully with PDF data, Lead ID:', leadId);
        toast({
          title: "PDF Generado y Lead Actualizado",
          description: "Tu cotización se ha generado y el lead se ha actualizado en el CRM.",
        });
      } else {
        console.warn('⚠️ PDF generated but lead update failed');
        toast({
          title: "PDF Generado",
          description: "Tu cotización se ha generado y agregado al chat.",
        });
      }

      console.log('✅ PDF message added to chat successfully');

    } catch (error) {
      console.error('❌ Error adding PDF message to chat or updating lead:', error);
      toast({
        title: "PDF Generado",
        description: "Tu cotización se ha generado exitosamente.",
      });
    }
  }, [selectedConversation, toast]);

  // Process message directly with conversation ID (for EmptyState)
  const processMessageDirectly = useCallback(async (message: string, conversationId: string) => {
    console.log('🤖 [DIRECT PROCESS] Starting direct message processing');
    console.log('📝 Message:', message);
    console.log('💬 Conversation ID:', conversationId);

    try {
      // Parse the message with AI
      const parsedRequest = await parseMessageWithAI(message);
      console.log('🧠 [DIRECT PROCESS] AI parsing result:', parsedRequest);

      if (!parsedRequest) {
        console.warn('⚠️ [DIRECT PROCESS] AI parsing failed');
        return;
      }

      // Handle the parsed request based on type
      let response = '';
      let structuredData = null;

      if (parsedRequest.requestType === 'flights') {
        console.log('✈️ [DIRECT PROCESS] Processing flight search');
        const result = await handleFlightSearch(parsedRequest);
        response = result.response;
        structuredData = result.data;
      } else if (parsedRequest.requestType === 'hotels') {
        console.log('🏨 [DIRECT PROCESS] Processing hotel search');
        const result = await handleHotelSearch(parsedRequest);
        response = result.response;
        structuredData = result.data;
      } else if (parsedRequest.requestType === 'packages') {
        console.log('🎒 [DIRECT PROCESS] Processing package search');
        const result = await handlePackageSearch(parsedRequest);
        response = result.response;
        structuredData = result.data;
      } else if (parsedRequest.requestType === 'services') {
        console.log('🚌 [DIRECT PROCESS] Processing service search');
        const result = await handleServiceSearch(parsedRequest);
        response = result.response;
        structuredData = result.data;
      } else if (parsedRequest.requestType === 'combined') {
        console.log('🌟 [DIRECT PROCESS] Processing combined search');
        const result = await handleCombinedSearch(parsedRequest);
        response = result.response;
        structuredData = result.data;
      } else {
        console.log('💬 [DIRECT PROCESS] Processing general query');
        response = await handleGeneralQuery(parsedRequest);
        structuredData = null;
      }

      // Save the assistant response
      console.log('📤 [DIRECT PROCESS] Saving assistant response');
      await addMessageViaSupabase({
        conversation_id: conversationId,
        role: 'assistant' as const,
        content: { text: response },
        meta: structuredData ? {
          source: 'AI_PARSER + EUROVIPS',
          ...structuredData
        } : {}
      });

      console.log('✅ [DIRECT PROCESS] Message processing completed successfully');
    } catch (error) {
      console.error('❌ [DIRECT PROCESS] Error processing message:', error);
      throw error;
    }
  }, [parseMessageWithAI, handleFlightSearch, handleHotelSearch, handlePackageSearch, handleServiceSearch, handleCombinedSearch, handleGeneralQuery, addMessageViaSupabase]);

  // Handle new message from empty state
  const handleSendNewMessage = useCallback(async (messageToSend: string) => {
    console.log('🚀 [NEW CHAT] Creating new conversation with message:', messageToSend);

    try {
      // Create new conversation first
      const newConversation = await createNewChat();

      if (newConversation) {
        console.log('✅ [NEW CHAT] Conversation created:', newConversation.id);

        // Set as selected conversation
        setSelectedConversation(newConversation.id);
        await updateConversationState(newConversation.id, 'active');

        // Send the message directly using the same flow as handleSendMessage
        console.log('📤 [NEW CHAT] Sending initial message...');

        // Add user message
        const userMessage = await addMessageViaSupabase({
          conversation_id: newConversation.id,
          role: 'user' as const,
          content: { text: messageToSend },
          meta: { status: 'sending' }
        });

        console.log('✅ [NEW CHAT] User message saved:', userMessage.id);

        // Update message status
        await updateMessageStatus(userMessage.id, 'sent');

        // Update conversation title
        const title = generateChatTitle(messageToSend);
        await updateConversationTitle(newConversation.id, title);

        // Process the message with AI parser and send response immediately
        console.log('🤖 [NEW CHAT] Processing message with AI parser...');

        // Force refresh messages to ensure the conversation is loaded
        loadMessages();

        // Wait for the conversation state to update
        await new Promise(resolve => setTimeout(resolve, 200));

        // Process the message directly with the conversation ID
        console.log('🤖 [NEW CHAT] Processing message directly with conversation:', newConversation.id);
        await processMessageDirectly(messageToSend, newConversation.id);
      }
    } catch (error) {
      console.error('❌ [NEW CHAT] Error creating conversation or sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la conversación. Inténtalo de nuevo.",
        variant: "destructive",
      });
      throw error;
    }
  }, [createNewChat, setSelectedConversation, updateConversationState, updateMessageStatus, updateConversationTitle, setMessage, handleSendMessageRaw, toast]);

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-screen flex">
        {/* Conversations Sidebar */}
        <ChatSidebar
          conversations={conversations}
          selectedConversation={selectedConversation}
          activeTab={activeTab}
          sidebarLimit={sidebarLimit}
          onSelectConversation={setSelectedConversation}
          onCreateNewChat={createNewChat}
          onTabChange={setActiveTab}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedConversation ? (
            <ChatInterface
              selectedConversation={selectedConversation}
              message={message}
              isLoading={isLoading}
              isTyping={isTyping}
              typingMessage={typingMessage}
              isUploadingPdf={isUploadingPdf}
              isAddingToCRM={isAddingToCRM}
              messages={messages}
              refreshMessages={refreshMessages}
              onMessageChange={setMessage}
              onSendMessage={handleSendMessage}
              onPdfUpload={handlePdfUpload}
              onAddToCRM={handleAddToCRM}
              onPdfGenerated={handlePdfGenerated}
            />
          ) : (
            <EmptyState onSendNewMessage={handleSendNewMessage} />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ChatFeature;