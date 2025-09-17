import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { parseMessageWithAI, getFallbackParsing, formatForEurovips, formatForStarling } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
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

interface StarlingData {
  results?: {
    Fares?: StarlingFare[];
  };
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

const transformStarlingResults = (starlingData: StarlingData, parsedRequest?: ParsedTravelRequest): FlightData[] => {
  const fares = starlingData?.results?.Fares || [];
  return fares.map((fare: StarlingFare) => ({
    id: fare.Token || Math.random().toString(36),
    airline: {
      code: fare.Legs?.[0]?.Segments?.[0]?.Airline || 'N/A',
      name: fare.Legs?.[0]?.Segments?.[0]?.AirlineName || 'Unknown'
    },
    price: {
      amount: fare.TotalFare || 0,
      currency: fare.Currency || 'USD'
    },
    adults: parsedRequest?.flights?.adults || 1,
    childrens: parsedRequest?.flights?.children || 0,
    departure_date: fare.Legs?.[0]?.Segments?.[0]?.DepartureDate || '',
    return_date: fare.Legs?.[1]?.Segments?.[0]?.DepartureDate,
    legs: (fare.Legs || []).map(leg => ({
      segments: (leg.Segments || []).map(segment => ({
        airline: segment.Airline || '',
        departure_date: segment.DepartureDate || '',
        arrival_date: segment.DepartureDate || '', // Using same date as fallback
        origin: parsedRequest?.flights?.origin || '',
        destination: parsedRequest?.flights?.destination || ''
      }))
    })),
    luggage: false,
    provider: 'STARLING'
  }));
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
  const navigate = useNavigate();

  // Use our hooks
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

  // Create new chat function (defined before useEffects that use it)
  const createNewChat = useCallback(async (initialTitle?: string) => {
    if (!user) return;

    try {
      // Generate a dynamic title based on time or use provided title
      const currentTime = new Date();
      const defaultTitle = `Chat ${currentTime.toLocaleDateString('es-ES')} ${currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

      const newConversation = await createConversation({
        user_id: user.id,
        status: 'active',
        channel: 'web',
        meta: {
          created_by: user.id,
          created_from: 'chat_interface',
          timestamp: currentTime.toISOString(),
          user_email: user.email,
          session_id: `session_${Date.now()}`,
          display_title: initialTitle || defaultTitle
        }
      });

      if (newConversation) {
        setSelectedConversation(newConversation.id);
        await updateConversationState(newConversation.id, 'active');

        // Show success toast
        toast({
          title: "Nueva Conversación",
          description: "Se ha creado una nueva conversación exitosamente",
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
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
  }, [loadConversations]);

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

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isLoading) return;

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      // 1. Save user message
      const userMessage = await saveMessage({
        conversation_id: selectedConversation,
        role: 'user',
        content: { text: currentMessage },
        meta: { status: 'sending' }
      });

      await updateMessageStatus(userMessage.id, 'sent');

      // 2. Update conversation title if first message
      if (messages.length === 0) {
        const title = generateChatTitle(currentMessage);
        try {
          await updateConversationTitle(selectedConversation, title);
          console.log(`✅ Conversation title updated to: "${title}"`);
        } catch (titleError) {
          console.error('Error updating conversation title:', titleError);
          // Don't fail the whole process if title update fails
        }
      }

      // 3. Use AI Parser to classify request
      let parsedRequest: ParsedTravelRequest;
      try {
        parsedRequest = await parseMessageWithAI(currentMessage);
        console.log('✅ AI parsing result:', parsedRequest);
      } catch (aiError) {
        console.error('❌ AI parsing failed, using fallback');
        parsedRequest = getFallbackParsing(currentMessage);
      }

      // 4. Execute searches based on type (WITHOUT N8N)
      let assistantResponse = '';
      let structuredData = null;

      switch (parsedRequest.requestType) {
        case 'flights': {
          const flightResult = await handleFlightSearch(parsedRequest);
          assistantResponse = flightResult.response;
          structuredData = flightResult.data;
          break;
        }
        case 'hotels': {
          const hotelResult = await handleHotelSearch(parsedRequest);
          assistantResponse = hotelResult.response;
          structuredData = hotelResult.data;
          break;
        }
        case 'packages': {
          const packageResult = await handlePackageSearch(parsedRequest);
          assistantResponse = packageResult.response;
          structuredData = packageResult.data;
          break;
        }
        case 'services': {
          const serviceResult = await handleServiceSearch(parsedRequest);
          assistantResponse = serviceResult.response;
          break;
        }
        case 'combined': {
          const combinedResult = await handleCombinedSearch(parsedRequest);
          assistantResponse = combinedResult.response;
          structuredData = combinedResult.data;
          break;
        }
        default:
          assistantResponse = await handleGeneralQuery(parsedRequest);
      }

      // 5. Save response with structured data
      const assistantMessage = await saveMessage({
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { text: assistantResponse },
        meta: structuredData ? {
          source: 'AI_PARSER + EUROVIPS',
          ...structuredData
        } : {}
      });

      // 6. Lead generation (MAINTAIN EXACT)
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (conversation) {
        const allMessages = [...messages, userMessage, assistantMessage];
        const leadId = await createLeadFromChat(conversation, allMessages);
        if (leadId) {
          toast({
            title: "Lead Actualizado",
            description: "Se ha creado/actualizado automáticamente tu lead en el CRM.",
          });
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Handler functions WITHOUT N8N
  const handleFlightSearch = async (parsed: ParsedTravelRequest) => {
    try {
      const starlingParams = formatForStarling(parsed);
      const response = await supabase.functions.invoke('starling-flights', {
        body: starlingParams
      });

      if (response.error) throw new Error(response.error.message);

      const flights = transformStarlingResults(response.data, parsed);

      return {
        response: formatFlightResponse(flights, parsed),
        data: {
          combinedData: {
            flights,
            hotels: [],
            requestType: 'flights-only' as const
          }
        }
      };
    } catch (error) {
      return {
        response: '❌ Error buscando vuelos. Intenta con fechas y destinos específicos.',
        data: null
      };
    }
  };

  const handleHotelSearch = async (parsed: ParsedTravelRequest) => {
    try {
      const eurovipsParams = formatForEurovips(parsed);

      // Get city code first
      const cityCode = await getCityCode(eurovipsParams.hotelParams.cityCode);

      const response = await supabase.functions.invoke('eurovips-soap', {
        body: {
          action: 'searchHotels',
          data: {
            ...eurovipsParams.hotelParams,
            cityCode: cityCode
          }
        }
      });

      if (response.error) throw new Error(response.error.message);

      const hotels = response.data.results || [];

      return {
        response: formatHotelResponse(hotels, parsed),
        data: {
          eurovipsData: { hotels },
          combinedData: {
            flights: [],
            hotels,
            requestType: 'hotels-only' as const
          }
        }
      };
    } catch (error) {
      return {
        response: '❌ Error buscando hoteles. Verifica la ciudad y fechas.',
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
        response: formatPackageResponse(packages, parsed),
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
        response: formatServiceResponse(services, parsed),
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
    try {
      // Parallel searches
      const [flightResult, hotelResult] = await Promise.all([
        handleFlightSearch(parsed),
        handleHotelSearch(parsed)
      ]);

      const combinedData = {
        flights: flightResult.data?.combinedData?.flights || [],
        hotels: hotelResult.data?.combinedData?.hotels || [],
        requestType: 'combined' as const
      };

      return {
        response: formatCombinedResponse(combinedData, parsed),
        data: { combinedData }
      };
    } catch (error) {
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
  const formatFlightResponse = (flights: FlightData[], parsed: ParsedTravelRequest) => {
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

  const formatHotelResponse = (hotels: LocalHotelData[], parsed: ParsedTravelRequest) => {
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

  const formatPackageResponse = (packages: LocalPackageData[], parsed: ParsedTravelRequest) => {
    if (packages.length === 0) {
      return '🎒 **Búsqueda de Paquetes**\n\nNo encontré paquetes disponibles. Intenta con otro destino o fechas.';
    }

    let response = `🎒 **${packages.length} Paquetes Disponibles**\n\n`;

    packages.slice(0, 5).forEach((pkg, index) => {
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

  const formatServiceResponse = (services: LocalServiceData[], parsed: ParsedTravelRequest) => {
    if (services.length === 0) {
      return '🚌 **Búsqueda de Servicios**\n\nNo encontré servicios disponibles. Verifica la ciudad y fechas.';
    }

    let response = `🚌 **${services.length} Servicios Disponibles**\n\n`;

    services.slice(0, 5).forEach((service, index) => {
      response += `---\n\n`;
      response += `🚌 **${service.name}**\n`;
      response += `📍 ${service.city}\n`;
      response += `💰 **Precio:** ${service.price} ${service.currency}\n`;
      response += `⏰ **Duración:** ${service.duration}\n\n`;
    });

    response += '\n📋 Selecciona los servicios que prefieras para tu cotización.';
    return response;
  };

  const formatCombinedResponse = (combinedData: LocalCombinedTravelResults, parsed: ParsedTravelRequest) => {
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

  const handlePdfGenerated = (pdfUrl: string) => {
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={disabled}
          onKeyPress={(e) => e.key === 'Enter' && onSend()}
          className="flex-1"
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
        <Button onClick={(e) => createNewChat()} size="sm" variant="outline">
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
                                    combinedData={convertToGlobalCombinedData(combinedTravelData)}
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