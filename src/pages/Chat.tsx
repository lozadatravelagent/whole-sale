import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useConversations, useMessages } from '@/hooks/useChat';
import { createLeadFromChat } from '@/utils/chatToLead';
import { parseMessageWithAI, getFallbackParsing, formatForEurovips, formatForStarling } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { CombinedTravelResults } from '@/types';
import CombinedTravelSelector from '@/components/crm/CombinedTravelSelector';
import {
  Send,
  MessageSquare,
  Phone,
  Globe,
  Clock,
  User,
  Bot,
  Loader2,
  Plus,
  ChevronDown,
  Archive,
  Check,
  CheckCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';

type MessageRow = Database['public']['Tables']['messages']['Row'];

// City code service for EUROVIPS integration
const getCityCode = async (cityName: string): Promise<string> => {
  try {
    const response = await supabase.functions.invoke('eurovips-soap', {
      body: { action: 'getCountryList', data: {} }
    });

    const countries = response.data.results?.parsed || [];
    const city = countries.find((c: { name: string; code: string }) =>
      c.name.toLowerCase().includes(cityName.toLowerCase())
    );

    return city?.code || cityName;
  } catch (error) {
    console.error('Error getting city code:', error);
    return cityName;
  }
};

// Starling results transformer
interface StarlingFare {
  Token?: string;
  TotalFare?: number;
  Currency?: string;
  Legs?: Array<{
    Segments?: Array<{
      Airline?: string;
      AirlineName?: string;
      DepartureDate?: string;
    }>;
  }>;
}


interface FlightData {
  id: string;
  airline: { code: string; name: string };
  price: { amount: number; currency: string };
  adults: number;
  childrens: number;
  departure_date: string;
  return_date?: string;
  legs: Array<{
    segments: Array<{
      airline: string;
      departure_date: string;
      arrival_date: string;
      origin: string;
      destination: string;
    }>;
  }>;
  luggage?: boolean;
  provider: string;
}

interface LocalHotelData {
  name: string;
  city: string;
  nights: number;
  rooms: Array<{
    total_price: number;
    currency: string;
  }>;
}

interface LocalCombinedTravelResults {
  flights: FlightData[];
  hotels: LocalHotelData[];
  requestType: 'combined' | 'flights-only' | 'hotels-only';
}

const transformStarlingResults = (tvcData: any, parsedRequest?: ParsedTravelRequest): FlightData[] => {
  console.log('🔄 Transforming TVC API results:', tvcData);

  // TVC API returns recommendations in different structure
  const recommendations = tvcData?.Recommendations || [];

  return recommendations.map((recommendation: any, index: number) => {
    const firstFlight = recommendation.Flights?.[0] || {};
    const pricing = recommendation.Pricing || {};

    return {
      id: recommendation.Id || `tvc-${index}`,
      airline: {
        code: firstFlight.CarrierCode || 'N/A',
        name: firstFlight.CarrierName || 'Unknown'
      },
      price: {
        amount: pricing.TotalPrice || 0,
        currency: pricing.Currency || 'USD'
      },
      adults: parsedRequest?.flights?.adults || 1,
      childrens: parsedRequest?.flights?.children || 0,
      departure_date: firstFlight.DepartureDateTime || '',
      return_date: recommendation.Flights?.[1]?.DepartureDateTime,
      legs: (recommendation.Flights || []).map((flight: any) => ({
        segments: [{
          airline: flight.CarrierCode || '',
          departure_date: flight.DepartureDateTime || '',
          arrival_date: flight.ArrivalDateTime || '',
          origin: flight.DepartureAirport || parsedRequest?.flights?.origin || '',
          destination: flight.ArrivalAirport || parsedRequest?.flights?.destination || ''
        }]
      })),
      luggage: false,
      provider: 'TVC'
    };
  });
};

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarLimit, setSidebarLimit] = useState(5);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use our hooks
  const { user } = useAuth();
  const {
    conversations,
    loadConversations,
    createConversation,
    updateConversationState,
    updateConversationTitle
  } = useConversations();
  const {
    messages,
    updateMessageStatus
  } = useMessages(selectedConversation);

  // Create new chat function (defined before useEffects that use it)
  const createNewChat = useCallback(async (initialTitle?: string) => {
    console.log('🚀 [CHAT FLOW] Step 1: Starting createNewChat process');
    console.log('👤 User:', user?.id, user?.email);

    if (!user) {
      console.warn('❌ [CHAT FLOW] No user found, aborting chat creation');
      return;
    }

    try {
      // Generate a dynamic title based on time or use provided title
      const currentTime = new Date();
      const defaultTitle = `Chat ${currentTime.toLocaleDateString('es-ES')} ${currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

      console.log('📝 [CHAT FLOW] Step 2: Preparing conversation data');
      console.log('🏷️ Title:', initialTitle || defaultTitle);

      const conversationData = {
        channel: 'web' as const,
        status: 'active' as const
        // Note: removed meta field as it doesn't exist in database schema
        // User info can be tracked via messages or separate user tracking
      };

      console.log('📤 [CHAT FLOW] Step 3: About to call createConversation (Supabase INSERT)');
      console.log('📋 Data to insert:', conversationData);

      const newConversation = await createConversation(conversationData);

      console.log('✅ [CHAT FLOW] Step 4: Conversation created successfully');
      console.log('💾 New conversation:', newConversation);

      if (newConversation) {
        console.log('🎯 [CHAT FLOW] Step 5: Setting selected conversation');
        setSelectedConversation(newConversation.id);

        console.log('📤 [CHAT FLOW] Step 6: About to update conversation state (Supabase UPDATE)');
        await updateConversationState(newConversation.id, 'active');
        console.log('✅ [CHAT FLOW] Step 7: Conversation state updated successfully');

        // Show success toast
        console.log('🎉 [CHAT FLOW] Step 8: Showing success notification');
        toast({
          title: "Nueva Conversación",
          description: "Se ha creado una nueva conversación exitosamente",
        });
        console.log('✅ [CHAT FLOW] Chat creation process completed successfully');
      }
    } catch (error) {
      console.error('❌ [CHAT FLOW] Error in createNewChat process:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la conversación. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  }, [user, createConversation, updateConversationState, toast]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]); // Now stable with useCallback

  // Handle ?new=1 URL parameter to create new chat automatically
  useEffect(() => {
    const shouldCreateNew = searchParams.get('new') === '1';
    if (shouldCreateNew && conversations.length >= 0) {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      createNewChat();
    }
  }, [searchParams, conversations.length, setSearchParams, createNewChat]);

  // Typing indicator effect
  useEffect(() => {
    if (isTyping && messages.length > 0) {
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isTyping, messages.length, selectedConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Reset loading state when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      console.log('🔄 [CHAT] Conversation selected, resetting loading state');
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [selectedConversation]);

  const generateChatTitle = (message: string): string => {
    const lowerMessage = message.toLowerCase();

    // Generate intelligent titles based on message content
    if (lowerMessage.includes('vuelo') && lowerMessage.includes('hotel')) {
      return '🌟 Viaje Completo';
    } else if (lowerMessage.includes('vuelo')) {
      return '✈️ Búsqueda de Vuelos';
    } else if (lowerMessage.includes('hotel')) {
      return '🏨 Búsqueda de Hoteles';
    } else if (lowerMessage.includes('paquete')) {
      return '🎒 Búsqueda de Paquetes';
    } else if (lowerMessage.includes('transfer') || lowerMessage.includes('excursion')) {
      return '🚌 Servicios de Viaje';
    } else {
      // Fallback to first words if no travel keywords detected
      const words = message.split(' ').slice(0, 6).join(' ');
      const truncated = words.length > 30 ? words.substring(0, 30) + '...' : words;
      return `💬 ${truncated}`;
    }
  };

  // Use Supabase add-message function instead of direct saveMessage
  const addMessageViaSupabase = async (messageData: {
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: { text?: string; cards?: unknown[]; pdfUrl?: string; metadata?: Record<string, unknown>; };
    meta?: { status?: string; [key: string]: unknown; };
  }) => {
    console.log('📤 [SUPABASE FUNCTION] About to call add-message function');
    console.log('📋 Message data:', messageData);

    try {
      const response = await supabase.functions.invoke('add-message', {
        body: {
          conversationId: messageData.conversation_id,
          role: messageData.role,
          content: messageData.content,
          meta: messageData.meta
        }
      });

      if (response.error) {
        console.error('❌ [SUPABASE FUNCTION] add-message error:', response.error);
        throw response.error;
      }

      console.log('✅ [SUPABASE FUNCTION] add-message success:', response.data);
      return response.data.message;
    } catch (error) {
      console.error('❌ [SUPABASE FUNCTION] add-message failed:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    console.log('🚀 [MESSAGE FLOW] Starting handleSendMessage process');
    console.log('📝 Message content:', message);
    console.log('💬 Selected conversation:', selectedConversation);
    console.log('⏳ Is loading:', isLoading);

    if (!message.trim() || !selectedConversation || isLoading) {
      console.warn('❌ [MESSAGE FLOW] Validation failed - aborting send');
      return;
    }

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);
    setIsTyping(true);

    console.log('✅ [MESSAGE FLOW] Step 1: Message validation passed');
    console.log('📨 Processing message:', currentMessage);

    try {
      // 1. Save user message
      console.log('📤 [MESSAGE FLOW] Step 2: About to save user message (Supabase INSERT)');

      const userMessageData = {
        conversation_id: selectedConversation,
        role: 'user',
        content: { text: currentMessage },
        meta: { status: 'sending' }
      };
      console.log('📋 User message data:', userMessageData);

      const userMessage = await addMessageViaSupabase({
        conversation_id: selectedConversation,
        role: 'user' as const,
        content: { text: currentMessage },
        meta: { status: 'sending' }
      });

      console.log('✅ [MESSAGE FLOW] Step 3: User message saved successfully');
      console.log('💾 User message result:', userMessage);

      console.log('📤 [MESSAGE FLOW] Step 4: About to update message status (Supabase UPDATE)');
      await updateMessageStatus(userMessage.id, 'sent');
      console.log('✅ [MESSAGE FLOW] Step 5: Message status updated to "sent"');

      // 2. Update conversation title if first message
      if (messages.length === 0) {
        console.log('🏷️ [MESSAGE FLOW] Step 6: First message - updating conversation title');
        const title = generateChatTitle(currentMessage);
        console.log('📝 Generated title:', title);

        try {
          console.log('📤 [MESSAGE FLOW] About to update conversation title (Supabase UPDATE)');
          await updateConversationTitle(selectedConversation, title);
          console.log(`✅ [MESSAGE FLOW] Step 7: Conversation title updated to: "${title}"`);
        } catch (titleError) {
          console.error('❌ [MESSAGE FLOW] Error updating conversation title:', titleError);
          // Don't fail the whole process if title update fails
        }
      }

      // 3. Use AI Parser to classify request
      console.log('🤖 [MESSAGE FLOW] Step 8: Starting AI parsing process');
      let parsedRequest: ParsedTravelRequest;

      try {
        console.log('📤 [MESSAGE FLOW] About to call AI message parser (Supabase Edge Function)');
        console.log('🧠 Message to parse:', currentMessage);

        parsedRequest = await parseMessageWithAI(currentMessage);

        console.log('✅ [MESSAGE FLOW] Step 9: AI parsing completed successfully');
        console.log('🎯 AI parsing result:', parsedRequest);
      } catch (aiError) {
        console.error('❌ [MESSAGE FLOW] AI parsing failed, using fallback');
        console.log('🔄 [MESSAGE FLOW] Step 9b: Using fallback parsing');

        parsedRequest = getFallbackParsing(currentMessage);
        console.log('📋 Fallback parsing result:', parsedRequest);
      }

      // 4. Execute searches based on type (WITHOUT N8N)
      console.log('🔍 [MESSAGE FLOW] Step 10: Starting search process');
      console.log('📊 Request type detected:', parsedRequest.requestType);

      let assistantResponse = '';
      let structuredData = null;

      switch (parsedRequest.requestType) {
        case 'flights': {
          console.log('✈️ [MESSAGE FLOW] Step 11a: Processing flight search');
          const flightResult = await handleFlightSearch(parsedRequest);
          assistantResponse = flightResult.response;
          structuredData = flightResult.data;
          console.log('✅ [MESSAGE FLOW] Flight search completed');
          break;
        }
        case 'hotels': {
          console.log('🏨 [MESSAGE FLOW] Step 11b: Processing hotel search');
          const hotelResult = await handleHotelSearch(parsedRequest);
          assistantResponse = hotelResult.response;
          structuredData = hotelResult.data;
          console.log('✅ [MESSAGE FLOW] Hotel search completed');
          break;
        }
        case 'packages': {
          console.log('🎒 [MESSAGE FLOW] Step 11c: Processing package search');
          const packageResult = await handlePackageSearch(parsedRequest);
          assistantResponse = packageResult.response;
          structuredData = packageResult.data;
          console.log('✅ [MESSAGE FLOW] Package search completed');
          break;
        }
        case 'services': {
          console.log('🚌 [MESSAGE FLOW] Step 11d: Processing service search');
          const serviceResult = await handleServiceSearch(parsedRequest);
          assistantResponse = serviceResult.response;
          console.log('✅ [MESSAGE FLOW] Service search completed');
          break;
        }
        case 'combined': {
          console.log('🌟 [MESSAGE FLOW] Step 11e: Processing combined search');
          const combinedResult = await handleCombinedSearch(parsedRequest);
          assistantResponse = combinedResult.response;
          structuredData = combinedResult.data;
          console.log('✅ [MESSAGE FLOW] Combined search completed');
          break;
        }
        default:
          console.log('💬 [MESSAGE FLOW] Step 11f: Processing general query');
          assistantResponse = await handleGeneralQuery(parsedRequest);
          console.log('✅ [MESSAGE FLOW] General query completed');
      }

      console.log('📝 [MESSAGE FLOW] Step 12: Generated assistant response');
      console.log('💬 Response preview:', assistantResponse.substring(0, 100) + '...');
      console.log('📊 Structured data:', structuredData);

      // 5. Save response with structured data
      console.log('📤 [MESSAGE FLOW] Step 13: About to save assistant message (Supabase INSERT)');

      const assistantMessageData = {
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { text: assistantResponse },
        meta: structuredData ? {
          source: 'AI_PARSER + EUROVIPS',
          ...structuredData
        } : {}
      };
      console.log('📋 Assistant message data:', assistantMessageData);

      const assistantMessage = await addMessageViaSupabase({
        conversation_id: selectedConversation,
        role: 'assistant' as const,
        content: { text: assistantResponse },
        meta: structuredData ? {
          source: 'AI_PARSER + EUROVIPS',
          ...structuredData
        } : {}
      });

      console.log('✅ [MESSAGE FLOW] Step 14: Assistant message saved successfully');
      console.log('💾 Assistant message result:', assistantMessage);

      // 6. Lead generation (MAINTAIN EXACT)
      console.log('📋 [MESSAGE FLOW] Step 15: Starting lead generation process');
      const conversation = conversations.find(c => c.id === selectedConversation);

      if (conversation) {
        console.log('📤 [MESSAGE FLOW] About to create/update lead (CRM Integration)');
        const allMessages = [...messages, userMessage, assistantMessage];
        console.log('📊 Messages for lead generation:', allMessages.length);

        const leadId = await createLeadFromChat(conversation, allMessages);

        if (leadId) {
          console.log('✅ [MESSAGE FLOW] Step 16: Lead created/updated successfully');
          console.log('🆔 Lead ID:', leadId);

          toast({
            title: "Lead Actualizado",
            description: "Se ha creado/actualizado automáticamente tu lead en el CRM.",
          });
        }
      }

      console.log('🎉 [MESSAGE FLOW] Message processing completed successfully');

    } catch (error) {
      console.error('❌ [MESSAGE FLOW] Error in handleSendMessage process:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 [MESSAGE FLOW] Cleaning up - setting loading states to false');
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Handler functions WITHOUT N8N
  const handleFlightSearch = async (parsed: ParsedTravelRequest) => {
    console.log('✈️ [FLIGHT SEARCH] Starting flight search process');
    console.log('📋 Parsed request:', parsed);

    try {
      console.log('🔄 [FLIGHT SEARCH] Step 1: Formatting parameters for Starling API');
      const starlingParams = formatForStarling(parsed);
      console.log('📊 Starling parameters:', starlingParams);

      console.log('📤 [FLIGHT SEARCH] Step 2: About to call Starling API (Supabase Edge Function)');
      const response = await supabase.functions.invoke('starling-flights', {
        body: {
          action: 'searchFlights',
          data: starlingParams
        }
      });

      console.log('✅ [FLIGHT SEARCH] Step 3: Starling API response received');
      console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

      if (response.error) {
        console.error('❌ [FLIGHT SEARCH] Starling API error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('📊 [FLIGHT SEARCH] Raw response data:', response.data);

      console.log('🔄 [FLIGHT SEARCH] Step 4: Transforming Starling results');
      const flightData = response.data?.data || response.data;
      const flights = transformStarlingResults(flightData, parsed);
      console.log('✅ [FLIGHT SEARCH] Step 5: Flight data transformed successfully');
      console.log('✈️ Flights found:', flights.length);

      console.log('📝 [FLIGHT SEARCH] Step 6: Formatting response text');
      const formattedResponse = formatFlightResponse(flights);

      const result = {
        response: formattedResponse,
        data: {
          combinedData: {
            flights,
            hotels: [],
            requestType: 'flights-only' as const
          }
        }
      };

      console.log('🎉 [FLIGHT SEARCH] Flight search completed successfully');
      console.log('📋 Final result:', result);

      return result;
    } catch (error) {
      console.error('❌ [FLIGHT SEARCH] Error in flight search process:', error);
      return {
        response: '❌ **Servicio de vuelos temporalmente no disponible**\n\nNuestros servicios de búsqueda de vuelos están siendo actualizados. Mientras tanto:\n\n✈️ **Puedo ayudarte con:**\n- Información general sobre destinos\n- Consultas sobre hoteles\n- Paquetes turísticos\n\n📞 **Para búsquedas de vuelos inmediatas:**\nContacta a nuestro equipo directamente para asistencia personalizada.',
        data: null
      };
    }
  };

  const handleHotelSearch = async (parsed: ParsedTravelRequest) => {
    console.log('🏨 [HOTEL SEARCH] Starting hotel search process');
    console.log('📋 Parsed request:', parsed);

    try {
      console.log('🔄 [HOTEL SEARCH] Step 1: Formatting parameters for EUROVIPS API');
      const eurovipsParams = formatForEurovips(parsed);
      console.log('📊 EUROVIPS parameters:', eurovipsParams);

      // Get city code first
      console.log('📍 [HOTEL SEARCH] Step 2: Getting city code for location');
      console.log('🔍 Looking up city:', eurovipsParams.hotelParams.cityCode);

      const cityCode = await getCityCode(eurovipsParams.hotelParams.cityCode);
      console.log('✅ [HOTEL SEARCH] City code resolved:', cityCode);

      const requestBody = {
        action: 'searchHotels',
        data: {
          ...eurovipsParams.hotelParams,
          cityCode: cityCode
        }
      };

      console.log('📤 [HOTEL SEARCH] Step 3: About to call EUROVIPS API (Supabase Edge Function)');
      console.log('📋 Request body:', requestBody);

      const response = await supabase.functions.invoke('eurovips-soap', {
        body: requestBody
      });

      console.log('✅ [HOTEL SEARCH] Step 4: EUROVIPS API response received');
      console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

      if (response.error) {
        console.error('❌ [HOTEL SEARCH] EUROVIPS API error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('📊 [HOTEL SEARCH] Raw response data:', response.data);

      const hotels = response.data.results || [];
      console.log('✅ [HOTEL SEARCH] Step 5: Hotel data extracted');
      console.log('🏨 Hotels found:', hotels.length);

      console.log('📝 [HOTEL SEARCH] Step 6: Formatting response text');
      const formattedResponse = formatHotelResponse(hotels);

      const result = {
        response: formattedResponse,
        data: {
          eurovipsData: { hotels },
          combinedData: {
            flights: [],
            hotels,
            requestType: 'hotels-only' as const
          }
        }
      };

      console.log('🎉 [HOTEL SEARCH] Hotel search completed successfully');
      console.log('📋 Final result:', result);

      return result;
    } catch (error) {
      console.error('❌ [HOTEL SEARCH] Error in hotel search process:', error);
      return {
        response: '❌ **Servicio de hoteles temporalmente no disponible**\n\nNuestros servicios de búsqueda de hoteles están siendo configurados. Mientras tanto:\n\n🏨 **Puedo ayudarte con:**\n- Recomendaciones generales de destinos\n- Información sobre ciudades\n- Planificación de viajes\n\n📞 **Para reservas de hoteles:**\nNuestro equipo puede asistirte con cotizaciones personalizadas.',
        data: null
      };
    }
  };

  const handlePackageSearch = async (parsed: ParsedTravelRequest) => {
    try {
      const eurovipsParams = formatForEurovips(parsed);
      const cityCode = await getCityCode(eurovipsParams.packageParams.cityCode);

      const response = await supabase.functions.invoke('eurovips-soap', {
        body: {
          action: 'searchPackages',
          data: {
            ...eurovipsParams.packageParams,
            cityCode: cityCode
          }
        }
      });

      const packages = response.data.results || [];

      return {
        response: formatPackageResponse(packages),
        data: null
      };
    } catch (error) {
      return {
        response: '❌ Error buscando paquetes. Intenta con un destino específico.',
        data: null
      };
    }
  };

  const handleServiceSearch = async (parsed: ParsedTravelRequest) => {
    try {
      const eurovipsParams = formatForEurovips(parsed);
      const cityCode = await getCityCode(eurovipsParams.serviceParams.cityCode);

      const response = await supabase.functions.invoke('eurovips-soap', {
        body: {
          action: 'searchServices',
          data: {
            ...eurovipsParams.serviceParams,
            cityCode: cityCode
          }
        }
      });

      const services = response.data.results || [];

      return {
        response: formatServiceResponse(services),
        data: null
      };
    } catch (error) {
      return {
        response: '❌ Error buscando servicios. Verifica la ciudad y fechas.',
        data: null
      };
    }
  };

  const handleCombinedSearch = async (parsed: ParsedTravelRequest) => {
    console.log('🌟 [COMBINED SEARCH] Starting combined search process');
    console.log('📋 Parsed request:', parsed);

    try {
      console.log('🚀 [COMBINED SEARCH] Step 1: Starting parallel searches');
      console.log('⚡ Running flight and hotel searches simultaneously');

      // Parallel searches
      const [flightResult, hotelResult] = await Promise.all([
        handleFlightSearch(parsed),
        handleHotelSearch(parsed)
      ]);

      console.log('✅ [COMBINED SEARCH] Step 2: Parallel searches completed');
      console.log('✈️ Flight search result:', flightResult ? 'SUCCESS' : 'FAILED');
      console.log('🏨 Hotel search result:', hotelResult ? 'SUCCESS' : 'FAILED');

      console.log('🔄 [COMBINED SEARCH] Step 3: Combining search results');
      const combinedData = {
        flights: flightResult.data?.combinedData?.flights || [],
        hotels: hotelResult.data?.combinedData?.hotels || [],
        requestType: 'combined' as const
      };

      console.log('📊 [COMBINED SEARCH] Combined data summary:');
      console.log('✈️ Flights found:', combinedData.flights.length);
      console.log('🏨 Hotels found:', combinedData.hotels.length);

      console.log('📝 [COMBINED SEARCH] Step 4: Formatting combined response');
      const formattedResponse = formatCombinedResponse(combinedData);

      const result = {
        response: formattedResponse,
        data: { combinedData }
      };

      console.log('🎉 [COMBINED SEARCH] Combined search completed successfully');
      console.log('📋 Final combined result:', result);

      return result;
    } catch (error) {
      console.error('❌ [COMBINED SEARCH] Error in combined search process:', error);
      return {
        response: '❌ Error en búsqueda combinada. Intenta por separado.',
        data: null
      };
    }
  };

  const handleGeneralQuery = async (parsed: ParsedTravelRequest) => {
    // General response without N8N
    return '¡Hola! Soy Emilia, tu asistente de viajes. Puedo ayudarte con:\n\n' +
           '✈️ **Búsqueda de vuelos**\n' +
           '🏨 **Búsqueda de hoteles**\n' +
           '🎒 **Búsqueda de paquetes**\n' +
           '🚌 **Servicios y transfers**\n\n' +
           'Dime qué necesitas con fechas y destinos específicos.';
  };

  // Response formatters - using the main FlightData interface
  const formatFlightResponse = (flights: FlightData[]) => {
    if (flights.length === 0) {
      return '✈️ **Búsqueda de Vuelos**\n\nNo encontré vuelos disponibles para esas fechas y destino. Intenta con fechas alternativas.';
    }

    let response = `✈️ **${flights.length} Vuelos Disponibles**\n\n`;

    flights.slice(0, 5).forEach((flight, index) => {
      response += `---\n\n`;
      response += `✈️ **Opción ${index + 1}** - ${flight.airline.name}\n`;
      response += `💰 **Precio:** ${flight.price.amount} ${flight.price.currency}\n`;
      response += `🛫 **Salida:** ${flight.departure_date}\n`;
      response += `🛬 **Regreso:** ${flight.return_date || 'Solo ida'}\n\n`;
    });

    response += '\n📋 Selecciona las opciones que prefieras para generar tu cotización.';
    return response;
  };

  interface LocalHotelData {
    name: string;
    city: string;
    nights: number;
    rooms: Array<{
      total_price: number;
      currency: string;
    }>;
  }

  const formatHotelResponse = (hotels: LocalHotelData[]) => {
    if (hotels.length === 0) {
      return '🏨 **Búsqueda de Hoteles**\n\nNo encontré hoteles disponibles. Verifica la ciudad y fechas.';
    }

    let response = `🏨 **${hotels.length} Hoteles Disponibles**\n\n`;

    hotels.slice(0, 5).forEach((hotel, index) => {
      const minPrice = Math.min(...hotel.rooms.map((r) => r.total_price));
      response += `---\n\n`;
      response += `🏨 **${hotel.name}**\n`;
      response += `📍 ${hotel.city}\n`;
      response += `💰 Desde ${minPrice} ${hotel.rooms[0].currency}\n`;
      response += `🌙 ${hotel.nights} noches\n\n`;
    });

    response += '\n📋 Selecciona los hoteles que prefieras para tu cotización.';
    return response;
  };

  interface LocalPackageData {
    name: string;
    destination: string;
    price: number;
    currency: string;
    duration: number;
  }

  const formatPackageResponse = (packages: LocalPackageData[]) => {
    if (packages.length === 0) {
      return '🎒 **Búsqueda de Paquetes**\n\nNo encontré paquetes disponibles. Intenta con otro destino o fechas.';
    }

    let response = `🎒 **${packages.length} Paquetes Disponibles**\n\n`;

    packages.slice(0, 5).forEach((pkg) => {
      response += `---\n\n`;
      response += `🎒 **${pkg.name}**\n`;
      response += `📍 ${pkg.destination}\n`;
      response += `💰 **Precio:** ${pkg.price} ${pkg.currency}\n`;
      response += `📅 **Duración:** ${pkg.duration} días\n\n`;
    });

    response += '\n📋 Selecciona los paquetes que prefieras para tu cotización.';
    return response;
  };

  interface LocalServiceData {
    name: string;
    city: string;
    price: number;
    currency: string;
    duration: string;
  }

  const formatServiceResponse = (services: LocalServiceData[]) => {
    if (services.length === 0) {
      return '🚌 **Búsqueda de Servicios**\n\nNo encontré servicios disponibles. Verifica la ciudad y fechas.';
    }

    let response = `🚌 **${services.length} Servicios Disponibles**\n\n`;

    services.slice(0, 5).forEach((service) => {
      response += `---\n\n`;
      response += `🚌 **${service.name}**\n`;
      response += `📍 ${service.city}\n`;
      response += `💰 **Precio:** ${service.price} ${service.currency}\n`;
      response += `⏰ **Duración:** ${service.duration}\n\n`;
    });

    response += '\n📋 Selecciona los servicios que prefieras para tu cotización.';
    return response;
  };

  const formatCombinedResponse = (combinedData: LocalCombinedTravelResults) => {
    let response = '🌟 **Búsqueda Combinada Completada**\n\n';

    if (combinedData.flights.length > 0) {
      response += `✈️ **${combinedData.flights.length} vuelos encontrados**\n`;
    }

    if (combinedData.hotels.length > 0) {
      response += `🏨 **${combinedData.hotels.length} hoteles encontrados**\n`;
    }

    response += '\n📋 Usa los selectores interactivos para crear tu cotización personalizada.';
    return response;
  };

  // Message display helpers
  const getMessageContent = (msg: MessageRow): string => {
    if (typeof msg.content === 'string') return msg.content;
    if (typeof msg.content === 'object' && msg.content && 'text' in msg.content) {
      return (msg.content as { text?: string }).text || '';
    }
    return '';
  };

  const getMessageStatus = (msg: MessageRow): string => {
    if (typeof msg.meta === 'object' && msg.meta && 'status' in msg.meta) {
      return (msg.meta as { status?: string }).status || 'sent';
    }
    return 'sent';
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      default:
        return <Check className="h-3 w-3" />;
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePdfGenerated = () => {
    toast({
      title: "PDF Generado",
      description: "Tu cotización se ha generado exitosamente.",
    });
  };

  // Convert local combined data to global type for component compatibility
  const convertToGlobalCombinedData = (localData: LocalCombinedTravelResults): CombinedTravelResults => {
    return {
      flights: localData.flights.map(flight => ({
        id: flight.id,
        airline: flight.airline,
        price: flight.price,
        adults: flight.adults,
        childrens: flight.childrens,
        departure_date: flight.departure_date,
        return_date: flight.return_date,
        legs: flight.legs.map(leg => ({
          departure: {
            city_code: leg.segments[0]?.origin || '',
            city_name: leg.segments[0]?.origin || '',
            time: leg.segments[0]?.departure_date || ''
          },
          arrival: {
            city_code: leg.segments[0]?.destination || '',
            city_name: leg.segments[0]?.destination || '',
            time: leg.segments[0]?.arrival_date || ''
          },
          duration: '2h 30m', // Default duration
          flight_type: 'direct'
        })),
        luggage: flight.luggage || false
      })),
      hotels: localData.hotels.map(hotel => ({
        id: Math.random().toString(36),
        unique_id: Math.random().toString(36),
        name: hotel.name,
        category: '',
        city: hotel.city,
        address: '',
        rooms: hotel.rooms.map(room => ({
          type: 'Standard',
          description: 'Habitación estándar',
          price_per_night: room.total_price / hotel.nights,
          total_price: room.total_price,
          currency: room.currency,
          availability: 1,
          occupancy_id: Math.random().toString(36)
        })),
        check_in: new Date().toISOString().split('T')[0],
        check_out: new Date(Date.now() + 86400000 * hotel.nights).toISOString().split('T')[0],
        nights: hotel.nights
      })),
      requestType: localData.requestType
    };
  };

  // Typing indicator component
  const TypingIndicator = () => (
    <div className="flex justify-start">
      <div className="max-w-lg flex items-start space-x-2">
        <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
          <Bot className="h-4 w-4 text-accent" />
        </div>
        <div className="rounded-lg p-4 bg-muted">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Message input component
  const MessageInput = ({ value, onChange, onSend, disabled }: {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled: boolean;
  }) => (
    <div className="border-t bg-background p-4">
      <div className="flex space-x-2">
        <Input
          id="chat-message-input"
          name="message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={disabled}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          className="flex-1"
          autoComplete="off"
        />
        <Button
          onClick={onSend}
          className="px-3"
          disabled={disabled}
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

  // Chat header component
  const ChatHeader = () => (
    <div className="border-b bg-background p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bot className="h-8 w-8 text-accent" />
          <div>
            <h2 className="font-semibold">Emilia - Asistente de Viajes</h2>
            <p className="text-sm text-muted-foreground">
              {isTyping ? 'Escribiendo...' : 'En línea'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Empty state component
  const EmptyState = ({ onCreateChat }: { onCreateChat: () => void }) => (
    <div className="flex-1 flex items-center justify-center bg-muted/20">
      <div className="text-center">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Ninguna conversación seleccionada</h3>
        <p className="text-muted-foreground mb-4">Elige una conversación del sidebar o crea una nueva para comenzar.</p>
        <Button onClick={onCreateChat} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Crear Nuevo Chat
        </Button>
      </div>
    </div>
  );

  // Sidebar extra content (conversations list)
  const sidebarExtra = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Conversaciones</h3>
        <Button onClick={() => createNewChat()} size="sm" variant="outline">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="archived">Archivadas</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-2">
          <ScrollArea className="h-[400px]">
            {conversations
              .filter(conv => conv.state === 'active')
              .slice(0, sidebarLimit)
              .map((conversation) => (
                <Card
                  key={conversation.id}
                  className={`mb-2 cursor-pointer transition-colors ${
                    selectedConversation === conversation.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {conversation.external_key || `Chat ${new Date(conversation.created_at).toLocaleDateString()}`}
                        </h4>
                        <div className="flex items-center mt-1 text-xs text-muted-foreground">
                          {conversation.channel === 'wa' ? (
                            <Phone className="h-3 w-3 mr-1" />
                          ) : (
                            <Globe className="h-3 w-3 mr-1" />
                          )}
                          <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {conversation.channel}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </ScrollArea>

          {conversations.filter(conv => conv.state === 'active').length > sidebarLimit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarLimit(prev => prev + 5)}
              className="w-full"
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Mostrar más ({conversations.filter(conv => conv.state === 'active').length - sidebarLimit} restantes)
            </Button>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-2">
          <ScrollArea className="h-[400px]">
            {conversations
              .filter(conv => conv.state === 'closed')
              .slice(0, sidebarLimit)
              .map((conversation) => (
                <Card
                  key={conversation.id}
                  className={`mb-2 cursor-pointer transition-colors ${
                    selectedConversation === conversation.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {conversation.external_key || `Chat ${new Date(conversation.created_at).toLocaleDateString()}`}
                        </h4>
                        <div className="flex items-center mt-1 text-xs text-muted-foreground">
                          <Archive className="h-3 w-3 mr-1" />
                          <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        archivada
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <MainLayout userRole="ADMIN" sidebarExtra={sidebarExtra}>
      <div className="min-h-screen flex">
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <ChatHeader />

              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const messageText = getMessageContent(msg);

                    // Check for combined travel data (MAINTAIN EXACT LOGIC)
                    const hasCombinedTravel = msg.role === 'assistant' && (
                      (typeof msg.meta === 'object' && msg.meta && 'combinedData' in msg.meta)
                    );

                    let combinedTravelData = null;
                    if (hasCombinedTravel && typeof msg.meta === 'object' && msg.meta && 'combinedData' in msg.meta) {
                      combinedTravelData = (msg.meta as unknown as { combinedData: LocalCombinedTravelResults }).combinedData;
                    }

                    // Convert data directly (without useMemo inside map)
                    const memoizedCombinedData = combinedTravelData ? convertToGlobalCombinedData(combinedTravelData) : null;

                    return (
                      <div key={msg.id}>
                        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-lg flex items-start space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
                              {msg.role === 'user' ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-accent" />}
                            </div>
                            <div className={`rounded-lg p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>

                              {/* Interactive selectors (MAINTAIN EXACT) */}
                              {hasCombinedTravel && combinedTravelData ? (
                                <div className="space-y-3">
                                  <div className="text-sm font-medium text-muted-foreground">
                                    🌟 {combinedTravelData.requestType === 'combined' ?
                                      `Viaje completo: ${combinedTravelData.flights.length} vuelos y ${combinedTravelData.hotels.length} hoteles` :
                                      combinedTravelData.requestType === 'flights-only' ?
                                        `${combinedTravelData.flights.length} opciones de vuelos` :
                                        `${combinedTravelData.hotels.length} opciones de hoteles`
                                    }
                                  </div>
                                  <CombinedTravelSelector
                                    combinedData={memoizedCombinedData!}
                                    onPdfGenerated={handlePdfGenerated}
                                  />
                                </div>
                              ) : (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {messageText}
                                </ReactMarkdown>
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

                  {isTyping && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <MessageInput
                value={message}
                onChange={setMessage}
                onSend={handleSendMessage}
                disabled={isLoading}
              />
            </>
          ) : (
            <EmptyState onCreateChat={createNewChat} />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;