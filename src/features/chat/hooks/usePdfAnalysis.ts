import { useState, useEffect, useCallback } from 'react';
import { analyzePdfContent, generatePriceChangeSuggestions, searchCheaperFlights, processPriceChangeRequest } from '@/services/pdfProcessor';
import { addMessageViaSupabase } from '../services/messageService';
import { generateChatTitle } from '../utils/messageHelpers';
import type { MessageRow } from '../types/chat';

const usePdfAnalysis = (
  selectedConversation: string | null,
  messages: MessageRow[],
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>,
  setIsTyping: (isTyping: boolean, conversationId?: string | null) => void,
  setTypingMessage: (message: string, conversationId?: string | null) => void,
  addOptimisticMessage: (message: any) => void,
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
) => {
  // Save message to DB and immediately add assistant messages to local state (no Realtime dependency)
  const saveAndDisplayMessage = useCallback(async (messageData: Parameters<typeof addMessageViaSupabase>[0]) => {
    const saved = await addMessageViaSupabase(messageData);
    if (saved && messageData.role === 'assistant') {
      addOptimisticMessage(saved);
    }
    return saved;
  }, [addOptimisticMessage]);

  const [lastPdfAnalysis, setLastPdfAnalysis] = useState<any>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Rehydrate last PDF analysis from the latest assistant message with pdf_analysis metadata
  useEffect(() => {
    if (!selectedConversation || !messages || messages.length === 0) return;

    try {
      const lastPdfAnalysisMsg = [...messages]
        .filter(m => {
          if (m.role !== 'assistant') return false;
          const content = m.content as any;
          const metadata = content?.metadata as any;
          return metadata?.type === 'pdf_analysis' && metadata?.analysis;
        })
        .pop();

      if (lastPdfAnalysisMsg) {
        const metadata = (lastPdfAnalysisMsg.content as any)?.metadata as any;
        setLastPdfAnalysis({
          analysis: {
            success: true,
            content: metadata.analysis,
            suggestions: metadata.suggestions || []
          },
          conversationId: selectedConversation,
          timestamp: lastPdfAnalysisMsg.created_at
        });
      }
    } catch (e) {
      console.warn('⚠️ [PDF ANALYSIS REHYDRATE] Could not rehydrate last analysis:', e);
    }
  }, [selectedConversation, messages]);

  // Process PDF content and generate response
  const processPdfContent = useCallback(async (file: File, conversationId: string, isFirstMessage: boolean) => {
    try {
      console.log('📄 Starting PDF analysis for:', file.name);

      // Update typing message to show analysis progress
      setTypingMessage('Analizando contenido del PDF...', conversationId);

      // Analyze PDF content using the new service
      const analysis = await analyzePdfContent(file);

      if (analysis.success) {
        // Generate structured response based on analysis
        const analysisResponse = generatePriceChangeSuggestions(analysis);

        // Add AI response with analysis
        await saveAndDisplayMessage({
          conversation_id: conversationId,
          role: 'assistant' as const,
          content: {
            text: analysisResponse,
            metadata: {
              type: 'pdf_analysis',
              analysis: analysis.content,
              suggestions: analysis.suggestions
            }
          },
          meta: {
            status: 'sent',
            messageType: 'pdf_analysis',
            client_id: crypto.randomUUID() // Add client_id for idempotency
          }
        });

        // Clear typing IMMEDIATELY after assistant message is added
        // This prevents race conditions with subsequent async operations (like title update)
        setTypingMessage('', conversationId);
        setIsTyping(false, conversationId);

        console.log('✅ PDF analysis completed successfully');

        // Update conversation title if this is the first message
        if (isFirstMessage) {
          console.log('🏷️ [PDF UPLOAD] First message - setting conversation title to "Análisis de Cotización"');

          const title = '📄 Análisis de Cotización';

          try {
            await updateConversationTitle(conversationId, title);
            console.log(`✅ [PDF UPLOAD] Conversation title updated to: "${title}"`);
          } catch (titleError) {
            console.error('❌ [PDF UPLOAD] Error updating conversation title:', titleError);
            // Don't fail the whole process if title update fails
          }
        }

        // Store the analysis for future price change requests
        setLastPdfAnalysis({
          analysis,
          conversationId,
          timestamp: new Date().toISOString()
        });

      } else {
        throw new Error(analysis.error || 'PDF analysis failed');
      }

    } catch (error) {
      console.error('❌ Error processing PDF content:', error);

      // Add error response
      await saveAndDisplayMessage({
        conversation_id: conversationId,
        role: 'assistant' as const,
        content: {
          text: `❌ **Error analizando PDF**\n\nNo pude procesar el archivo "${file.name}". Esto puede deberse a:\n\n• El PDF está protegido o encriptado\n• El formato no es compatible\n• El archivo está dañado\n\n¿Podrías intentar con otro archivo o verificar que el PDF se abra correctamente?`
        },
        meta: {
          status: 'sent',
          messageType: 'error',
          client_id: crypto.randomUUID() // Add client_id for idempotency
        }
      });
    }
  }, [updateConversationTitle, setTypingMessage, setIsTyping, saveAndDisplayMessage]);

  // Handle PDF upload
  const handlePdfUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({
        title: "Archivo no válido",
        description: "Por favor selecciona un archivo PDF.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "Archivo muy grande",
        description: "El archivo no puede ser mayor a 10MB.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedConversation) {
      toast({
        title: "Error",
        description: "No hay conversación seleccionada.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPdf(true);

    try {
      // Check if this is the first message in the conversation
      const isFirstMessage = messages.length === 0;
      console.log('📊 [PDF UPLOAD] Is first message:', isFirstMessage, 'Message count:', messages.length);

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log('📎 PDF uploaded:', file.name, 'Size:', file.size);

      // Send PDF analysis request
      const analysisMessage = `He subido el PDF "${file.name}" para análisis. ¿Podrías revisar el contenido y ayudarme con cualquier cambio que necesite?`;
      const clientId = crypto.randomUUID();

      // Add OPTIMISTIC user message - appears IMMEDIATELY
      const optimisticUserMessage = {
        id: `temp-${clientId}`,
        conversation_id: selectedConversation,
        role: 'user' as const,
        content: {
          text: analysisMessage,
          metadata: {
            type: 'pdf_upload',
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
          }
        },
        meta: { status: 'sending', client_id: clientId },
        created_at: new Date().toISOString()
      };

      addOptimisticMessage(optimisticUserMessage);

      // Show typing indicator while processing PDF
      setIsTyping(true, selectedConversation);
      setTypingMessage('Estoy leyendo el PDF...', selectedConversation);

      // Add user message with PDF attachment info (DB save - realtime will replace optimistic)
      await saveAndDisplayMessage({
        conversation_id: selectedConversation,
        role: 'user' as const,
        content: {
          text: analysisMessage,
          metadata: {
            type: 'pdf_upload',
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
          }
        },
        meta: {
          status: 'sent',
          messageType: 'pdf_upload',
          client_id: clientId
        }
      });

      // Process PDF content with first message flag
      await processPdfContent(file, selectedConversation, isFirstMessage);

      toast({
        title: "PDF subido exitosamente",
        description: `${file.name} ha sido analizado y procesado.`,
      });

    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast({
        title: "Error al subir PDF",
        description: "No se pudo procesar el archivo. Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      // Clear typing indicator AND message to prevent stale message from showing
      setTypingMessage('', selectedConversation);
      setIsTyping(false, selectedConversation);
      setIsUploadingPdf(false);
    }
  }, [selectedConversation, messages, processPdfContent, toast, setIsTyping, addOptimisticMessage, setTypingMessage, saveAndDisplayMessage]);

  // Handle cheaper flights search
  const handleCheaperFlightsSearch = useCallback(async (message: string) => {
    if (!lastPdfAnalysis || lastPdfAnalysis.conversationId !== selectedConversation) {
      return null;
    }

    try {
      const cheaperFlightResult = await searchCheaperFlights(lastPdfAnalysis.analysis);
      let responseMessage = '';

      if (cheaperFlightResult.success) {
        if (cheaperFlightResult.alternativeFlights && cheaperFlightResult.alternativeFlights.length > 0) {
          responseMessage = `🔍 **Búsqueda de Vuelos Más Baratos**\n\n`;

          if (cheaperFlightResult.savings && cheaperFlightResult.savings > 0) {
            responseMessage += `💰 **¡Buenas noticias!** ${cheaperFlightResult.message}\n\n`;
          } else {
            responseMessage += `📊 **Comparación:** ${cheaperFlightResult.message}\n\n`;
          }

          responseMessage += `**📋 Vuelos del PDF:**\n`;
          cheaperFlightResult.originalFlights?.forEach((flight, index) => {
            responseMessage += `   ${index + 1}. ${flight.airline} - ${flight.route}\n`;
            responseMessage += `      📅 ${flight.dates} | 💰 $${flight.price}\n`;
          });

          responseMessage += `\n**✈️ Alternativas encontradas:**\n`;
          cheaperFlightResult.alternativeFlights.slice(0, 5).forEach((flight, index) => {
            const price = flight.price?.amount || 0;
            const currency = flight.price?.currency || 'USD';
            responseMessage += `   ${index + 1}. ${flight.airline?.name || 'Aerolínea'}\n`;
            responseMessage += `      📅 ${flight.departure_date} | 💰 $${price} ${currency}\n`;
            if (flight.legs && flight.legs.length > 0) {
              responseMessage += `      🛫 ${flight.legs[0].departure?.city_code} → ${flight.legs[0].arrival?.city_code}\n`;
            }
          });

          if (cheaperFlightResult.savings && cheaperFlightResult.savings > 0) {
            responseMessage += `\n💡 **¿Te interesa alguna de estas opciones?** Puedo generar un nuevo PDF con los vuelos que prefieras.`;
          }

        } else {
          responseMessage = `🔍 **Búsqueda de Vuelos Más Baratos**\n\n${cheaperFlightResult.message || 'No se encontraron opciones más baratas para estas fechas, pero los precios del PDF son competitivos.'}\n\n💡 **Sugerencias:**\n• Intenta con fechas flexibles (+/- 3 días)\n• Considera aeropuertos alternativos\n• ¿Te interesa cambiar el presupuesto?`;
        }
      } else {
        responseMessage = `❌ **Error en la búsqueda**\n\n${cheaperFlightResult.error}\n\n💡 **Alternativas:**\n• Verifica que el PDF contenga información de vuelos\n• Intenta subir el PDF nuevamente\n• Puedo ayudarte a buscar vuelos manualmente si me das los detalles`;
      }

      return responseMessage;
    } catch (error) {
      console.error('❌ Error searching for cheaper flights:', error);
      return `❌ **Error en la búsqueda de vuelos**\n\nNo pude buscar vuelos alternativos en este momento. Esto puede deberse a:\n\n• Problemas temporales con el servicio de búsqueda\n• El PDF no contiene información de vuelos válida\n• Error de conectividad\n\n¿Podrías intentarlo nuevamente o proporcionarme manualmente los detalles del vuelo?`;
    }
  }, [lastPdfAnalysis, selectedConversation]);

  // Handle price change request
  const handlePriceChangeRequest = useCallback(async (message: string) => {
    if (!lastPdfAnalysis || lastPdfAnalysis.conversationId !== selectedConversation) {
      return null;
    }

    try {
      const result = await processPriceChangeRequest(
        message.trim(),
        lastPdfAnalysis.analysis,
        selectedConversation!
      );

      return {
        response: result.response,
        modifiedPdfUrl: result.modifiedPdfUrl
      };
    } catch (error) {
      console.error('❌ Error processing price change request:', error);
      throw error;
    }
  }, [lastPdfAnalysis, selectedConversation]);

  return {
    lastPdfAnalysis,
    isUploadingPdf,
    handlePdfUpload,
    handleCheaperFlightsSearch,
    handlePriceChangeRequest,
    setLastPdfAnalysis
  };
};

export default usePdfAnalysis;
