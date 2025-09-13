import React, { useState, useRef, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useConversations, useMessages } from '@/hooks/useChat';
import { createLeadFromChat } from '@/utils/chatToLead';
import { parseFlightsFromMessage, isFlightMessage } from '@/utils/flightParser';
import { parseHotelsFromMessage, isHotelMessage } from '@/utils/hotelParser';
import { searchHotelFares } from '@/services/hotelSearch';
import { searchAirFares } from '@/services/airfareSearch';
import { isCombinedTravelMessage, parseCombinedTravelRequest } from '@/utils/combinedTravelParser';
import type { CombinedTravelResults } from '@/types';
import FlightSelector from '@/components/crm/FlightSelector';
import HotelSelector from '@/components/crm/HotelSelector';
import CombinedTravelSelector from '@/components/crm/CombinedTravelSelector';
import {
  Send,
  MessageSquare,
  Phone,
  Globe,
  FileText,
  Clock,
  User,
  Bot,
  Plane,
  Hotel,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Star,
  Loader2,
  Plus,
  ChevronDown,
  Archive,
  Check,
  CheckCheck,
  Download
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Database } from '@/integrations/supabase/types';

type ConversationRow = Database['public']['Tables']['conversations']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Limit how many conversations are shown in the sidebar (like ChatGPT)
  const [sidebarLimit, setSidebarLimit] = useState(5);

  // Use our new hooks
  const { user } = useAuth();
  const {
    conversations,
    loading: conversationsLoading,
    loadConversations,
    createConversation,
    updateConversationState,
    updateConversationTitle
  } = useConversations();
  const {
    messages,
    loading: messagesLoading,
    saveMessage,
    updateMessageStatus
  } = useMessages(selectedConversation);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // No auto-scroll - user controls scroll manually

  // Control typing indicator based on new messages from n8n workflows
  useEffect(() => {
    if (!selectedConversation || messages.length === 0) return;

    // Get the last message
    const lastMessage = messages[messages.length - 1];

    // If the last message is from assistant and was just received, start typing timer
    if (lastMessage.role === 'assistant') {
      const messageAge = Date.now() - new Date(lastMessage.created_at).getTime();

      // If message is less than 2 seconds old, it might be followed by more messages
      if (messageAge < 2000) {
        setIsTyping(true);

        // Set timeout to stop typing indicator
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 5000);

        return () => clearTimeout(timeout);
      }
    }
  }, [messages, selectedConversation]);

  const generateChatTitle = (text: string) => {
    // Generate a meaningful title from the first message
    const words = text.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  };

  const extractHotelSearchParams = (message: string) => {
    const lowerMessage = message.toLowerCase();

    // Extract hotel name
    const hotelNameMatches = [
      /necesito\s+el\s+(hotel\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*?)(?:\s+desde|\s+del|\s+para|$)/i,
      /busco\s+(?:el\s+)?(hotel\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*?)(?:\s+desde|\s+del|\s+para|$)/i,
      /quiero\s+(?:el\s+)?(hotel\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*?)(?:\s+desde|\s+del|\s+para|$)/i,
      /(hotel\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*?)(?:\s+desde|\s+del|\s+para|$)/i
    ];

    let hotelName = '';
    for (const pattern of hotelNameMatches) {
      const match = message.match(pattern);
      if (match) {
        hotelName = match[1].trim();
        break;
      }
    }

    // Extract city
    const cityPatterns = [
      /en\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*?)(?:\s+desde|\s+del|\s+para|\s+,|$)/i,
      /ciudad[:\s]+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*)/i
    ];

    let city = 'Buenos Aires'; // Default
    for (const pattern of cityPatterns) {
      const match = message.match(pattern);
      if (match) {
        city = match[1].trim();
        break;
      }
    }

    // Extract dates
    const datePatterns = [
      /desde\s+el\s+(\d{4}-\d{2}-\d{2})\s+hasta\s+el?\s+(\d{4}-\d{2}-\d{2})/i,
      /del\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+al\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(\d{4}-\d{2}-\d{2})\s+hasta\s+(\d{4}-\d{2}-\d{2})/i,
      // Spanish date formats
      /desde\s+el\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+hasta\s+el\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i,
      /del\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+al\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i,
      /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+hasta\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i
    ];

    let dateFrom = '';
    let dateTo = '';

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        // Check if it's a Spanish date format (has month names)
        if (match.length > 4 && match[2] && match[4]) {
          // Spanish format: "15 de octubre" "25 de octubre"
          const spanishMonths: Record<string, string> = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
          };

          const fromDay = match[1].padStart(2, '0');
          const fromMonth = spanishMonths[match[2].toLowerCase()] || '01';
          const toDay = match[3].padStart(2, '0');
          const toMonth = spanishMonths[match[4].toLowerCase()] || '01';
          const currentYear = new Date().getFullYear();

          dateFrom = `${currentYear}-${fromMonth}-${fromDay}`;
          dateTo = `${currentYear}-${toMonth}-${toDay}`;
        } else {
          // Regular format
          dateFrom = match[1];
          dateTo = match[2];

          // Convert date formats if needed
          if (dateFrom.includes('/') || dateFrom.includes('-')) {
            const fromParts = dateFrom.split(/[\/\-]/);
            const toParts = dateTo.split(/[\/\-]/);

            // If format is dd/mm/yyyy, convert to yyyy-mm-dd
            if (fromParts.length === 3 && fromParts[2].length === 4) {
              dateFrom = `${fromParts[2]}-${fromParts[1].padStart(2, '0')}-${fromParts[0].padStart(2, '0')}`;
              dateTo = `${toParts[2]}-${toParts[1].padStart(2, '0')}-${toParts[0].padStart(2, '0')}`;
            }
          }
        }
        break;
      }
    }

    // Default dates if not found and ensure minimum 1 night stay
    if (!dateFrom || !dateTo) {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 3);

      dateFrom = today.toISOString().split('T')[0];
      dateTo = futureDate.toISOString().split('T')[0];
    } else {
      // Ensure check-out is at least 1 day after check-in
      const checkInDate = new Date(dateFrom);
      const checkOutDate = new Date(dateTo);

      if (checkOutDate <= checkInDate) {
        console.log('🔧 Adjusting checkout date to be at least 1 day after checkin');
        const adjustedCheckOut = new Date(checkInDate);
        adjustedCheckOut.setDate(checkInDate.getDate() + 1);
        dateTo = adjustedCheckOut.toISOString().split('T')[0];
      }
    }

    console.log('🔍 Extracted hotel search params:', { hotelName, city, dateFrom, dateTo });

    return { hotelName, city, dateFrom, dateTo };
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isLoading) return;

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Save user message to database
      const userMessage = await saveMessage({
        conversation_id: selectedConversation,
        role: 'user',
        content: { text: currentMessage },
        meta: { status: 'sending' }
      });

      // Update message status to sent
      setTimeout(async () => {
        await updateMessageStatus(userMessage.id, 'sent');
      }, 500);

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = generateChatTitle(currentMessage);
        await updateConversationTitle(selectedConversation, title);
      }

      console.log('Sending message to travel-chat:', currentMessage);

      // Check what type of travel request this is
      const isCombinedRequest = isCombinedTravelMessage(currentMessage);
      const isHotelOnlyRequest = !isCombinedRequest && (
        currentMessage.toLowerCase().includes('quiero un hotel') ||
        currentMessage.toLowerCase().includes('busco hotel') ||
        currentMessage.toLowerCase().includes('necesito hotel')
      );

      let assistantResponse;
      let combinedDataToAttach: CombinedTravelResults | null = null;

      // Get conversation info (needed for all requests)
      const conversation = conversations.find(c => c.id === selectedConversation);

      if (isCombinedRequest) {
        console.log('🌟 Combined travel request detected (flights + hotels via EUROVIPS)');
        console.log('🔄 Flow: 1) Parse request 2) Search flights 3) Search hotels');

        try {
          // Parse the combined travel request
          const travelRequest = parseCombinedTravelRequest(currentMessage);
          console.log('🔍 Parsed travel request:', travelRequest);

          if (!travelRequest) {
            assistantResponse = '🌟 **Viaje Combinado**\n\nNo pude entender completamente tu solicitud de viaje. Por favor, incluye:\n\n✈️ **Vuelos:** origen, destino y fechas\n🏨 **Hotels:** ciudad y fechas\n\n**Ejemplo:** "Quiero un viaje de Buenos Aires a Madrid saliendo el 1 de Julio con vuelta el 10 de Julio y necesito hotel"';
          } else {
            // Execute searches based on request type
            const results: CombinedTravelResults = {
              flights: [],
              hotels: [],
              requestType: travelRequest.requestType
            };

            // Search flights if requested (via EUROVIPS, not Starling)
            if (travelRequest.requestType === 'combined' || travelRequest.requestType === 'flights-only') {
              console.log('✈️ Searching flights via EUROVIPS WebService...');
              try {
                const flights = await searchAirFares(travelRequest.flights);
                results.flights = flights;
                console.log(`✅ Found ${flights.length} flights via EUROVIPS`);
              } catch (flightError) {
                console.error('❌ Error searching flights via EUROVIPS:', flightError);
              }
            }

            // Search hotels if requested
            if (travelRequest.requestType === 'combined' || travelRequest.requestType === 'hotels-only') {
              console.log('🏨 Searching hotels via EUROVIPS WebService...');
              try {
                const hotels = await searchHotelFares(travelRequest.hotels);
                results.hotels = hotels;
                console.log(`✅ Found ${hotels.length} hotels via EUROVIPS`);
              } catch (hotelError) {
                console.error('❌ Error searching hotels via EUROVIPS:', hotelError);
              }
            }

            // Format combined response
            assistantResponse = formatCombinedTravelResponse(results, travelRequest);
            combinedDataToAttach = results;
          }
        } catch (error) {
          console.error('Error processing combined travel request:', error);
          assistantResponse = '🌟 Disculpa, hay un problema temporal procesando tu solicitud de viaje combinado. Por favor, intenta nuevamente.';
        }
      } else if (isHotelOnlyRequest) {
        console.log('🏨 Hotel-only request detected, searching via WebService');
        console.log('🔄 Flow: 1) Get country codes 2) Search hotels');

        try {
          // Extract hotel search parameters from user message
          const { hotelName, city, dateFrom, dateTo } = extractHotelSearchParams(currentMessage);
          console.log('🔍 Extracted parameters:', { hotelName, city, dateFrom, dateTo });

          // Search for hotels using WebService (this will automatically call getCountryList first)
          console.log('📞 Calling searchHotelFares...');
          const hotels = await searchHotelFares({
            dateFrom,
            dateTo,
            city,
            hotelName: hotelName || undefined
          });

          if (hotels.length > 0) {
            // Format hotels into message structure
            let hotelMessage = `🏨 **Hoteles disponibles**\n\n`;

            hotels.forEach((hotel, index) => {
              hotelMessage += `---\n\n`;
              hotelMessage += `🏨 **${hotel.name}**`;
              if (hotel.category) hotelMessage += ` - ${hotel.category}`;
              hotelMessage += `\n`;
              if (hotel.city) hotelMessage += `📍 **Ubicación:** ${hotel.city}\n`;
              if (hotel.address) hotelMessage += `📧 **Dirección:** ${hotel.address}\n`;
              if (hotel.phone) hotelMessage += `📞 **Teléfono:** ${hotel.phone}\n`;
              hotelMessage += `🛏️ **Check-in:** ${hotel.check_in}\n`;
              hotelMessage += `🚪 **Check-out:** ${hotel.check_out}\n`;

              if (hotel.rooms.length > 0) {
                hotelMessage += `\n**Habitaciones disponibles:**\n\n`;
                hotel.rooms.forEach(room => {
                  hotelMessage += `🛏️ **Habitación:** ${room.type}\n`;
                  if (room.description !== room.type) {
                    hotelMessage += `📝 **Descripción:** ${room.description}\n`;
                  }
                  hotelMessage += `💰 **Precio:** ${room.total_price} ${room.currency}`;
                  if (hotel.nights > 1) hotelMessage += ` (${hotel.nights} noches)`;
                  hotelMessage += `\n`;

                  const availabilityText = room.availability >= 3 ? 'Disponible' :
                    room.availability >= 2 ? 'Consultar' : 'No disponible';
                  const availabilityEmoji = room.availability >= 3 ? '✅' :
                    room.availability >= 2 ? '⚠️' : '❌';
                  hotelMessage += `${availabilityEmoji} **Disponibilidad:** ${availabilityText}\n\n`;
                });
              }

              if (hotel.policy_cancellation) {
                hotelMessage += `📋 **Política de Cancelación:** ${hotel.policy_cancellation}\n`;
              }
              if (hotel.policy_lodging) {
                hotelMessage += `🏨 **Políticas:** ${hotel.policy_lodging}\n`;
              }
              hotelMessage += `\n`;
            });

            hotelMessage += `\nSelecciona las opciones que más te gusten para generar tu cotización en PDF.`;
            assistantResponse = hotelMessage;
          } else {
            // Extract city from the search to provide more specific feedback
            const { city } = extractHotelSearchParams(currentMessage);

            assistantResponse = `🏨 **Búsqueda de Hoteles**\n\n` +
              `He recibido tu solicitud de hotel${city ? ` para ${city}` : ''}.\n\n` +
              `✅ **Estado del sistema:** WebService configurado correctamente\n` +
              `⏳ **En proceso:** Esperando códigos de destino válidos de EUROVIPS\n\n` +
              `Te notificaremos cuando el servicio de búsqueda esté completamente operativo.\n\n` +
              `**Parámetros detectados:**\n` +
              `- Destino: ${city || 'No especificado'}\n` +
              `- Fechas: ${extractHotelSearchParams(currentMessage).dateFrom} al ${extractHotelSearchParams(currentMessage).dateTo}`;
          }
        } catch (error) {
          console.error('Error searching hotels via WebService:', error);
          assistantResponse = '🏨 Disculpa, hay un problema temporal con la búsqueda de hoteles. Por favor, intenta nuevamente en unos minutos.';
        }
      } else {
        // Call travel chat API for general conversation
        const { data, error } = await supabase.functions.invoke('travel-chat', {
          body: {
            message: currentMessage,
            conversationId: selectedConversation,
            userId: user?.id,
            userName: user?.email || user?.user_metadata?.full_name,
            leadId: (conversation as any)?.meta?.lead_id || null,
            agencyId: user?.user_metadata?.agency_id
          }
        });

        console.log('Travel-chat response:', data, error);

        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }

        assistantResponse = data?.message || 'Perfecto, estoy procesando tu consulta. Te enviaré las opciones disponibles en un momento...';
      }

      // Mark message as delivered
      await updateMessageStatus(userMessage.id, 'delivered');

      // Turn off immediate typing indicator
      setIsTyping(false);

      // Save AI response to database - the real-time subscription will handle displaying it
      const assistantMessage = await saveMessage({
        conversation_id: selectedConversation,
        role: 'assistant',
        content: {
          text: assistantResponse
        },
        meta: combinedDataToAttach ? { combinedData: combinedDataToAttach } : {}
      });

      // NUEVO: Crear o actualizar lead con información extraída después del primer mensaje del usuario
      if (conversation) {
        console.log('Processing lead creation/update from user message');

        // Obtener todos los mensajes actuales incluyendo el que acabamos de guardar
        const allMessages = [...messages,
        {
          id: 'temp-user',
          role: 'user' as const,
          content: { text: currentMessage },
          conversation_id: selectedConversation,
          created_at: new Date().toISOString(),
          meta: {}
        } as MessageRow,
          assistantMessage
        ];

        const leadId = await createLeadFromChat(conversation, allMessages);
        if (leadId) {
          console.log('Lead created/updated from chat with ID:', leadId);
          toast({
            title: "Lead Actualizado",
            description: "Se ha creado/actualizado automáticamente tu lead en el CRM con la información del chat.",
          });
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });

      // Save error response - real-time subscription will handle displaying it
      await saveMessage({
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { text: 'Lo siento, hubo un error procesando tu mensaje. ¿Puedes intentarlo de nuevo?' },
        meta: {}
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="inline h-3 w-3 animate-spin" />;
      case 'sent':
        return <Check className="inline h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="inline h-3 w-3" />;
      case 'failed':
        return <Clock className="inline h-3 w-3 text-destructive" />;
      default:
        return <Clock className="inline h-3 w-3" />;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChannelIcon = (channel: string) => {
    return channel === 'wa' ? Phone : Globe;
  };

  const getChatNumber = (convId: string) => {
    const index = conversations.findIndex(c => c.id === convId);
    return conversations.length - index;
  };

  const createNewChat = async () => {
    try {
      // Crear la conversación
      const newConversation = await createConversation();
      setSelectedConversation(newConversation.id);

      // Crear mensaje de bienvenida
      const welcomeMessage = await saveMessage({
        conversation_id: newConversation.id,
        role: 'assistant',
        content: {
          text: '¡Hola! Soy **Emilia**, tu asistente de viajes. Puedo ayudarte con:\n\n🌍 **Recomendaciones de destinos**\n✈️ **Búsqueda de vuelos**\n🏨 **Búsqueda de hoteles**\n🎒 **Consejos de viaje**\n💰 **Presupuestos de viaje**\n\nPuedes decirme "Quiero un hotel" para buscar alojamiento.\n\n¿En qué puedo ayudarte hoy?'
        },
        meta: {}
      });

      toast({
        title: "Nuevo Chat",
        description: "Chat creado. ¡Cuéntame sobre tu viaje para crear tu lead automáticamente!",
      });

    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el chat.",
        variant: "destructive",
      });
    }
  };

  const getMessageContent = (msg: MessageRow): string => {
    console.log('📝 Getting message content for:', msg.id);
    console.log('📝 Raw content:', msg.content);
    console.log('📝 Content type:', typeof msg.content);

    // Handle if content is a string (JSON serialized)
    if (typeof msg.content === 'string') {
      try {
        const parsed = JSON.parse(msg.content);
        console.log('📝 Parsed content:', parsed);
        return parsed.text || '';
      } catch (e) {
        console.log('📝 Failed to parse content as JSON, treating as plain text');
        return msg.content;
      }
    }

    // Handle if content is already an object
    if (typeof msg.content === 'object' && msg.content && 'text' in msg.content) {
      const text = (msg.content as any).text || '';
      console.log('📝 Extracted text from object:', text.substring(0, 100));
      return text;
    }

    console.log('📝 No text content found');
    return '';
  };

  const getMessageStatus = (msg: MessageRow): string | undefined => {
    if (typeof msg.meta === 'object' && msg.meta && 'status' in msg.meta) {
      return (msg.meta as any).status;
    }
    return undefined;
  };

  const formatCombinedTravelResponse = (results: CombinedTravelResults, request: any): string => {
    console.log('🎨 Formatting combined travel response:', results);

    let response = '';

    // Header
    if (results.requestType === 'combined') {
      response += '🌟 **Viaje Combinado - EUROVIPS WebService**\n\n';
      response += 'He encontrado opciones para tu viaje completo:\n\n';
    } else if (results.requestType === 'flights-only') {
      response += '✈️ **Vuelos - EUROVIPS WebService**\n\n';
      response += 'He encontrado opciones de vuelos para ti:\n\n';
    } else {
      response += '🏨 **Hoteles - EUROVIPS WebService**\n\n';
      response += 'He encontrado opciones de hoteles para ti:\n\n';
    }

    // Flight Results
    if (results.flights && results.flights.length > 0) {
      response += `✈️ **${results.flights.length} Vuelos Disponibles**\n\n`;

      results.flights.forEach((flight, index) => {
        response += `---\n\n`;
        response += `✈️ **Opción ${index + 1}** - ${flight.airline.name}\n`;
        response += `💰 **Precio:** ${flight.price.amount} ${flight.price.currency}\n`;

        flight.legs.forEach((leg, legIndex) => {
          if (leg.flight_type === 'outbound') {
            response += `\n🛫 **Ida** (${flight.departure_date})\n`;
          } else {
            response += `\n🛬 **Regreso** (${flight.return_date})\n`;
          }
          response += `**Origen:** ${leg.departure.city_name} (${leg.departure.city_code})\n`;
          response += `**Salida:** ${leg.departure.time}\n`;
          response += `**Destino:** ${leg.arrival.city_name} (${leg.arrival.city_code})\n`;
          response += `**Llegada:** ${leg.arrival.time}\n`;
          response += `**Duración:** ${leg.duration}\n`;
        });

        response += `\n👥 **Pasajeros:** ${flight.adults} adulto${flight.adults > 1 ? 's' : ''}`;
        if (flight.childrens > 0) {
          response += `, ${flight.childrens} niño${flight.childrens > 1 ? 's' : ''}`;
        }
        response += '\n\n';
      });
    } else if (results.requestType === 'combined' || results.requestType === 'flights-only') {
      response += '✈️ **Vuelos**\n';
      response += '⏳ No se encontraron vuelos disponibles para las fechas solicitadas.\n';
      response += '🔄 Los servicios de vuelos están siendo configurados en el WebService EUROVIPS.\n\n';
    }

    // Hotel Results  
    if (results.hotels && results.hotels.length > 0) {
      response += `🏨 **${results.hotels.length} Hoteles Disponibles**\n\n`;

      results.hotels.forEach((hotel, index) => {
        response += `---\n\n`;
        response += `🏨 **${hotel.name}**`;
        if (hotel.category) response += ` - ${hotel.category}`;
        response += `\n`;
        if (hotel.city) response += `📍 **Ubicación:** ${hotel.city}\n`;
        if (hotel.address) response += `📧 **Dirección:** ${hotel.address}\n`;
        response += `🛏️ **Check-in:** ${hotel.check_in}\n`;
        response += `🚪 **Check-out:** ${hotel.check_out}\n`;

        if (hotel.rooms.length > 0) {
          response += `\n**Habitaciones disponibles:**\n\n`;
          hotel.rooms.forEach(room => {
            response += `🛏️ **Habitación:** ${room.type}\n`;
            response += `💰 **Precio:** ${room.total_price} ${room.currency}`;
            if (hotel.nights > 1) response += ` (${hotel.nights} noches)`;
            response += `\n`;

            const availabilityText = room.availability >= 3 ? 'Disponible' :
              room.availability >= 2 ? 'Consultar' : 'No disponible';
            const availabilityEmoji = room.availability >= 3 ? '✅' :
              room.availability >= 2 ? '⚠️' : '❌';
            response += `${availabilityEmoji} **Disponibilidad:** ${availabilityText}\n\n`;
          });
        }
        response += `\n`;
      });
    } else if (results.requestType === 'combined' || results.requestType === 'hotels-only') {
      response += '🏨 **Hoteles**\n';
      response += '⏳ No se encontraron hoteles disponibles para las fechas solicitadas.\n';
      response += '🔄 Verificando códigos de destino en el WebService EUROVIPS.\n\n';
    }

    // Footer
    if ((results.flights && results.flights.length > 0) || (results.hotels && results.hotels.length > 0)) {
      response += `\n📋 **Siguiente Paso**\n`;
      response += `Selecciona las opciones que más te gusten para generar tu cotización en PDF.\n`;
      response += `🌟 *Powered by EUROVIPS WebService*`;
    } else {
      response += `\n🔧 **Estado del Sistema**\n`;
      response += `✅ WebService EUROVIPS configurado correctamente\n`;
      response += `⏳ Servicios de búsqueda en proceso de optimización\n\n`;
      response += `Te notificaremos cuando el servicio esté completamente operativo.`;
    }

    return response;
  };

  const handlePdfGenerated = async (pdfUrl: string) => {
    if (!selectedConversation) return;

    try {
      // Save the PDF as a new message
      await saveMessage({
        conversation_id: selectedConversation,
        role: 'assistant',
        content: {
          text: '📄 **Tu cotización de vuelos está lista para descargar:**',
          pdfUrl
        },
        meta: {}
      });

      toast({
        title: "PDF Generado",
        description: "Tu cotización ha sido agregada al chat. Puedes descargarla cuando quieras.",
      });
    } catch (error) {
      console.error('Error saving PDF message:', error);
    }
  };

  const getPdfUrl = (msg: MessageRow): string | undefined => {
    if (typeof msg.content === 'object' && msg.content && 'pdfUrl' in msg.content) {
      return (msg.content as any).pdfUrl;
    }
    return undefined;
  };

  const sidebarExtra = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold"></h2>
            <p className="text-sm text-muted-foreground">Chats</p>
          </div>
          {/* Botón Nuevo Chat movido al dropdown del menú lateral */}
        </div>

        {/* Tabs for Active/Closed */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" className="text-xs">
              Chats Activos
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              <Archive className="h-3 w-3 mr-1" />
              Archivados
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} className="h-full">
          <TabsContent value="active" className="m-0 h-full">
            <div className="p-2 space-y-2">
              {[...conversations]
                .filter(conv => conv.state === 'active')
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
                .slice(0, sidebarLimit)
                .map((conv) => {
                  const ChannelIcon = getChannelIcon(conv.channel);
                  const isSelected = selectedConversation === conv.id;

                  return (
                    <Card
                      key={conv.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedConversation(conv.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm truncate">
                              {conv.external_key}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateConversationState(conv.id, 'closed');
                                }}
                              >
                                <Archive className="h-3 w-3 mr-2" />
                                Archivar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Último mensaje
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              {conversations.filter(conv => conv.state === 'active').length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No hay chats activos.
                  <br />
                  Crea uno nuevo para comenzar.
                </div>
              )}
              {conversations.filter(conv => conv.state === 'active').length > sidebarLimit && (
                <div className="pt-2 flex justify-center">
                  <Button variant="link" className="px-0" onClick={() => setSidebarLimit(prev => prev + 10)}>
                    Mostrar más chats
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="closed" className="m-0 h-full">
            <div className="p-2 space-y-2">
              {[...conversations]
                .filter(conv => conv.state === 'closed')
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
                .slice(0, sidebarLimit)
                .map((conv) => {
                  const ChannelIcon = getChannelIcon(conv.channel);
                  const isSelected = selectedConversation === conv.id;

                  return (
                    <Card
                      key={conv.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedConversation(conv.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm truncate">
                              {conv.external_key}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateConversationState(conv.id, 'active');
                                }}
                              >
                                <MessageSquare className="h-3 w-3 mr-2" />
                                Activar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Último mensaje
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              {conversations.filter(conv => conv.state === 'closed').length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No hay chats archivados.
                </div>
              )}
              {conversations.filter(conv => conv.state === 'closed').length > sidebarLimit && (
                <div className="pt-2 flex justify-center">
                  <Button variant="link" className="px-0" onClick={() => setSidebarLimit(prev => prev + 10)}>
                    Mostrar más chats
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );

  return (
    <MainLayout userRole="ADMIN" sidebarExtra={sidebarExtra}>
      <div className="min-h-screen flex">

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Emilia</h3>
                      <p className="text-sm text-muted-foreground">
                        chat-{getChatNumber(selectedConversation)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {conversations.find(c => c.id === selectedConversation)?.state === 'active' ? 'Active' : 'Archived'}
                        <ChevronDown className="h-3 w-3 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => updateConversationState(selectedConversation!, 'active')}
                      >
                        Active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateConversationState(selectedConversation!, 'closed')}
                      >
                        Archived
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages (scrollable history) */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const messageText = getMessageContent(msg);
                    const pdfUrl = getPdfUrl(msg);

                    console.log('💬 Processing message:', msg.id, 'Role:', msg.role);
                    console.log('💬 Message text preview:', messageText.substring(0, 100));

                    const hasFlights = msg.role === 'assistant' && isFlightMessage(messageText);
                    console.log('🔍 Has flights:', hasFlights);

                    const parsedFlights = hasFlights ? parseFlightsFromMessage(messageText) : [];
                    console.log('📊 Parsed flights count:', parsedFlights.length);

                    const hasHotels = msg.role === 'assistant' && isHotelMessage(messageText);
                    console.log('🔍 Has hotels:', hasHotels);

                    const parsedHotels = hasHotels ? parseHotelsFromMessage(messageText) : [];
                    console.log('📊 Parsed hotels count:', parsedHotels.length);

                    // Check for combined travel messages (flights + hotels via EUROVIPS)
                    const hasCombinedTravel = msg.role === 'assistant' && (
                      (typeof msg.meta === 'object' && msg.meta && 'combinedData' in msg.meta) ||
                      messageText.includes('🌟 **Viaje Combinado') ||
                      messageText.includes('EUROVIPS WebService') ||
                      (messageText.includes('Vuelos Disponibles') && messageText.includes('Hoteles Disponibles'))
                    );
                    console.log('🔍 Has combined travel:', hasCombinedTravel);

                    // Parse combined travel data if available
                    let combinedTravelData = null;
                    if (hasCombinedTravel) {

                      // Prefer structured combinedData attached in content
                      if (typeof msg.meta === 'object' && msg.meta && 'combinedData' in msg.meta) {
                        combinedTravelData = (msg.meta as any).combinedData as CombinedTravelResults;
                        console.log('📊 Combined travel data (attached):', combinedTravelData);
                      } else {
                        // Fallback: parse from text
                        const combinedFlights = hasFlights ? parseFlightsFromMessage(messageText) : [];
                        const combinedHotels = hasHotels ? parseHotelsFromMessage(messageText) : [];
                        combinedTravelData = {
                          flights: combinedFlights,
                          hotels: combinedHotels,
                          requestType: combinedFlights.length > 0 && combinedHotels.length > 0 ? 'combined' :
                            combinedFlights.length > 0 ? 'flights-only' : 'hotels-only'
                        };
                        console.log('📊 Combined travel data (parsed):', combinedTravelData);
                      }
                    }

                    return (
                      <div key={msg.id}>
                        <div
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-lg flex items-start space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                            }`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
                              {msg.role === 'user' ? (
                                <User className="h-4 w-4 text-primary" />
                              ) : (
                                <Bot className="h-4 w-4 text-accent" />
                              )}
                            </div>
                            <div className={`rounded-lg p-4 ${msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                              }`}>
                              {/* Show CombinedTravelSelector for combined travel messages */}
                              {hasCombinedTravel && combinedTravelData ? (
                                <div className="space-y-3">
                                  <div className="text-sm font-medium text-muted-foreground">
                                    🌟 {combinedTravelData.requestType === 'combined' ?
                                      `Viaje completo: ${combinedTravelData.flights.length} vuelos y ${combinedTravelData.hotels.length} hoteles` :
                                      combinedTravelData.requestType === 'flights-only' ?
                                        `${combinedTravelData.flights.length} opciones de vuelos vía EUROVIPS` :
                                        `${combinedTravelData.hotels.length} opciones de hoteles vía EUROVIPS`
                                    }
                                  </div>
                                  <CombinedTravelSelector
                                    combinedData={combinedTravelData}
                                    onPdfGenerated={handlePdfGenerated}
                                  />
                                </div>
                              ) : hasFlights && parsedFlights.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="text-sm font-medium text-muted-foreground">
                                    ✈️ Encontré {parsedFlights.length} opciones de vuelos para ti
                                  </div>
                                  <FlightSelector
                                    flights={parsedFlights}
                                    onPdfGenerated={handlePdfGenerated}
                                  />
                                </div>
                              ) : hasHotels && parsedHotels.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="text-sm font-medium text-muted-foreground">
                                    🏨 Encontré {parsedHotels.length} opciones de hoteles para ti
                                  </div>
                                  <HotelSelector
                                    hotels={parsedHotels}
                                    onPdfGenerated={handlePdfGenerated}
                                  />
                                </div>
                              ) : (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  className={`${msg.role === 'user'
                                    ? 'prose prose-invert prose-sm max-w-none text-primary-foreground'
                                    : 'emilia-message prose prose-neutral prose-sm max-w-none'
                                    }`}
                                >
                                  {messageText}
                                </ReactMarkdown>
                              )}

                              {/* PDF Download Button */}
                              {pdfUrl && (
                                <div className="mt-3 pt-3 border-t border-border/20">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => window.open(pdfUrl, '_blank')}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Descargar Cotización PDF
                                  </Button>
                                </div>
                              )}

                              <p className="text-xs opacity-70 mt-1 flex items-center justify-between">
                                <span className="flex items-center">
                                  {getMessageStatusIcon(getMessageStatus(msg))}
                                  <span className="ml-1">{formatTime(msg.created_at)}</span>
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>


                      </div>
                    );
                  })}

                  {/* Emilia is typing indicator - appears after messages */}
                  {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="max-w-lg flex items-start space-x-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
                          <Bot className="h-4 w-4 text-accent" />
                        </div>
                        <div className="rounded-lg p-3 bg-muted">
                          <div className="flex items-center space-x-1">
                            <div className="typing-dots">
                              <span>Emilia está escribiendo</span>
                              <div className="dots">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <Separator />

              {/* Message Input */}
              <div className="p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="px-3"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ninguna conversación seleccionada</h3>
                <p className="text-muted-foreground mb-4">Elige una conversación del sidebar o crea una nueva para comenzar.</p>
                <Button onClick={createNewChat} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Nuevo Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;