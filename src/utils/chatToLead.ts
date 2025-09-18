import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { createLead, getSections, getLeads, updateLead } from '@/lib/supabase-leads';
import type { Database } from '@/integrations/supabase/types';
import type { FlightData, HotelData } from '@/types';

type MessageRow = Database['public']['Tables']['messages']['Row'];
type ConversationRow = Database['public']['Tables']['conversations']['Row'];

// Dummy data para el demo - en producción vendrían del usuario autenticado
const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DUMMY_AGENCY_ID = '00000000-0000-0000-0000-000000000002';

export interface ExtractedTravelInfo {
  destination?: string;
  dates?: {
    checkin?: string;
    checkout?: string;
  };
  travelers?: {
    adults?: number;
    children?: number;
  };
  budget?: number;
  tripType?: 'hotel' | 'flight' | 'package';
  contactInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  description?: string;
  // Additional properties for comprehensive lead creation
  flightDetails?: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    adults?: number;
    children?: number;
    luggage?: string;
    stops?: string;
    departureTimePreference?: string;
    arrivalTimePreference?: string;
    preferredAirline?: string;
  };
  hotelDetails?: {
    city?: string;
    hotelName?: string;
    checkinDate?: string;
    checkoutDate?: string;
    adults?: number;
    children?: number;
    roomType?: string;
    hotelChain?: string;
    mealPlan?: string;
    freeCancellation?: boolean;
    roomView?: string;
    roomCount?: number;
  };
}

// Mapea requestType de ai-message-parser a tripType esperado
function mapRequestTypeToTripType(requestType: string): 'hotel' | 'flight' | 'package' {
  switch (requestType) {
    case 'flights': return 'flight';
    case 'hotels': return 'hotel';
    case 'packages': return 'package';
    case 'services': return 'package'; // Services se trata como package
    case 'combined': return 'package'; // Combined se trata como package
    default: return 'package';
  }
}

// Función para extraer información de viaje de los mensajes usando AI
export async function extractTravelInfoFromMessages(messages: MessageRow[]): Promise<ExtractedTravelInfo> {
  if (messages.length === 0) return {};

  // Combinar todos los mensajes del usuario para análisis
  const userMessages = Array.isArray(messages) ? messages
    .filter(msg => msg.role === 'user')
    .map(msg => {
      if (typeof msg.content === 'object' && msg.content && 'text' in msg.content) {
        return (msg.content as any).text || '';
      }
      return '';
    })
    .join(' ') : '';

  if (!userMessages.trim()) return {};

  console.log('🔍 Processing user messages for extraction:', userMessages);

  // SIEMPRE usar extracción básica primero como garantía
  const basicInfo = extractBasicInfo(userMessages);
  console.log('📊 Basic extraction result:', basicInfo);

  try {
    // Intentar mejorar con AI
    console.log('🤖 Attempting AI extraction...');
    const { data, error } = await supabase.functions.invoke('ai-message-parser', {
      body: {
        message: userMessages,
        language: 'es',
        currentDate: new Date().toISOString().split('T')[0]
      }
    });

    console.log('🤖 AI extraction response:', { data, error });

    if (error) {
      console.warn('⚠️ AI extraction failed, using basic extraction:', error);
      return basicInfo;
    }

    const aiParsed = data?.parsed || {};

    // Mapear respuesta de ai-message-parser al formato esperado
    const aiInfo = {
      destination: aiParsed.flights?.destination || aiParsed.hotels?.city || '',
      dates: {
        checkin: aiParsed.flights?.departureDate || aiParsed.hotels?.checkinDate || '',
        checkout: aiParsed.flights?.returnDate || aiParsed.hotels?.checkoutDate || ''
      },
      travelers: {
        adults: aiParsed.flights?.adults || aiParsed.hotels?.adults || 1,
        children: aiParsed.flights?.children || aiParsed.hotels?.children || basicInfo.travelers?.children || 0
      },
      budget: basicInfo.budget || 0,
      tripType: mapRequestTypeToTripType(aiParsed.requestType) || basicInfo.tripType || 'package',
      contactInfo: basicInfo.contactInfo || {},
      description: basicInfo.description || `Consulta: ${userMessages}`
    };

    // Combinar información: AI primero, básica como respaldo
    const combinedInfo = {
      destination: aiInfo.destination || basicInfo.destination,
      dates: {
        checkin: aiInfo.dates.checkin || basicInfo.dates?.checkin || '',
        checkout: aiInfo.dates.checkout || basicInfo.dates?.checkout || ''
      },
      travelers: {
        adults: aiInfo.travelers.adults || basicInfo.travelers?.adults || 1,
        children: aiInfo.travelers.children || basicInfo.travelers?.children || 0
      },
      budget: aiInfo.budget || basicInfo.budget || 0,
      tripType: aiInfo.tripType || basicInfo.tripType || 'package',
      contactInfo: aiInfo.contactInfo || basicInfo.contactInfo || {},
      description: aiInfo.description || basicInfo.description || `Consulta: ${userMessages}`
    };

    console.log('✅ Final combined extraction result:', combinedInfo);
    return combinedInfo;
  } catch (error) {
    console.warn('❌ AI extraction completely failed, using basic extraction:', error);
    return basicInfo;
  }
}

// Función de respaldo para extraer información básica sin AI - MEJORADA
function extractBasicInfo(text: string): ExtractedTravelInfo {
  const info: ExtractedTravelInfo = {};
  const lowerText = text.toLowerCase();

  console.log('Extracting basic info from:', text);

  // Extraer destinos (lista ampliada)
  const destinations = [
    'parís', 'londres', 'tokyo', 'nueva york', 'roma', 'barcelona', 'ámsterdam',
    'berlín', 'dubai', 'tailandia', 'méxico', 'argentina', 'brasil', 'perú',
    'cancún', 'playa del carmen', 'buenos aires', 'machu picchu', 'cusco',
    'miami', 'los angeles', 'san francisco', 'las vegas', 'orlando',
    'madrid', 'sevilla', 'valencia', 'bilbao', 'lisboa', 'oporto',
    'río de janeiro', 'são paulo', 'santiago', 'bogotá', 'lima',
    'nueva delhi', 'mumbai', 'bangkok', 'singapur', 'hong kong'
  ];

  const foundDestination = destinations.find(dest =>
    lowerText.includes(dest)
  );

  if (foundDestination) {
    // Capitalizar correctamente
    info.destination = foundDestination.charAt(0).toUpperCase() + foundDestination.slice(1);
  }

  // Extraer números de personas (MEJORADO)
  const travelersPatterns = [
    /(\d+)\s*adult[oa]s?/i,
    /(\d+)\s*personas?/i,
    /somos\s*(\d+)/i,
    /(\d+)\s*person[ao]s?/i,
    /para\s*(\d+)/i,
    /family.*?(\d+)/i,
    /(\d+)\s*travelers?/i
  ];

  let adults = 1;
  for (const pattern of travelersPatterns) {
    const match = text.match(pattern);
    if (match) {
      adults = parseInt(match[1]);
      break;
    }
  }

  const childrenPatterns = [
    /(\d+)\s*niñ[oa]s?/i,
    /(\d+)\s*child(?:ren)?/i,
    /(\d+)\s*kids?/i,
    /(\d+)\s*bebés?/i,
    /(\d+)\s*babies?/i
  ];

  let children = 0;
  for (const pattern of childrenPatterns) {
    const match = text.match(pattern);
    if (match) {
      children = parseInt(match[1]);
      break;
    }
  }

  info.travelers = { adults, children };

  // Extraer presupuesto (MEJORADO)
  const budgetPatterns = [
    /(?:presupuesto|budget).*?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(\d+(?:,\d{3})*)\s*(?:usd|dólares|dollars|pesos)/i,
    /(\d+(?:,\d{3})*)\s*de\s*presupuesto/i,
    /con\s*(\d+(?:,\d{3})*)/i,
    /hasta\s*(\d+(?:,\d{3})*)/i
  ];

  for (const pattern of budgetPatterns) {
    const match = text.match(pattern);
    if (match) {
      const budgetStr = match[1].replace(/,/g, '');
      info.budget = parseInt(budgetStr);
      break;
    }
  }

  // Determinar tipo de viaje (MEJORADO)
  if (lowerText.includes('vuelo') || lowerText.includes('flight') || lowerText.includes('avión')) {
    info.tripType = 'flight';
  } else if (lowerText.includes('hotel') || lowerText.includes('alojamiento') || lowerText.includes('hospedaje')) {
    info.tripType = 'hotel';
  } else {
    info.tripType = 'package';
  }

  // Extraer fechas (MEJORADO)
  const monthNames = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  // Buscar fechas como "15 de enero" o "enero 15"
  for (const [month, monthNum] of Object.entries(monthNames)) {
    const dayMonthPattern = new RegExp(`(\\d{1,2})\\s*de\\s*${month}`, 'i');
    const monthDayPattern = new RegExp(`${month}\\s*(\\d{1,2})`, 'i');
    const monthOnlyPattern = new RegExp(`${month}`, 'i');

    const dayMonthMatch = text.match(dayMonthPattern);
    const monthDayMatch = text.match(monthDayPattern);
    const monthOnlyMatch = text.match(monthOnlyPattern);

    if (dayMonthMatch) {
      const day = dayMonthMatch[1].padStart(2, '0');
      info.dates = { checkin: `2024-${monthNum}-${day}`, checkout: '' };
      break;
    } else if (monthDayMatch) {
      const day = monthDayMatch[1].padStart(2, '0');
      info.dates = { checkin: `2024-${monthNum}-${day}`, checkout: '' };
      break;
    } else if (monthOnlyMatch && !info.dates) {
      info.dates = { checkin: `2024-${monthNum}-01`, checkout: '' };
    }
  }

  // Crear descripción detallada
  const details = [];
  if (info.destination) details.push(`Destino: ${info.destination}`);
  if (info.budget) details.push(`Presupuesto: $${info.budget.toLocaleString()} USD`);
  if (info.travelers) {
    const travelers = `${info.travelers.adults} adulto${info.travelers.adults > 1 ? 's' : ''}`;
    const kids = info.travelers.children > 0 ? ` y ${info.travelers.children} niño${info.travelers.children > 1 ? 's' : ''}` : '';
    details.push(`Viajeros: ${travelers}${kids}`);
  }
  if (info.tripType) details.push(`Tipo: ${info.tripType === 'flight' ? 'Vuelo' : info.tripType === 'hotel' ? 'Hotel' : 'Paquete'}`);

  info.description = details.length > 0
    ? `Consulta automática: ${details.join(' | ')}\n\nTexto original: ${text}`
    : `Consulta de viaje: ${text}`;

  console.log('Extracted info:', info);
  return info;
}

// Función para crear un lead desde una conversación
export async function createLeadFromChat(
  conversation: ConversationRow,
  messages: MessageRow[] = []
): Promise<string | null> {
  try {
    console.log('=== CREATING LEAD FROM CHAT ===');
    console.log('Conversation:', conversation.external_key);
    console.log('Messages count:', messages.length);

    // Obtener información de la conversación
    const travelInfo = await extractTravelInfoFromMessages(messages);

    console.log('Extracted travel info:', travelInfo);

    // Obtener la primera sección (Nuevos) para asignar el lead
    const sections = await getSections(DUMMY_AGENCY_ID);
    const firstSectionId = sections.length > 0 ? sections[0].id : undefined;

    console.log('Target section ID:', firstSectionId);

    // Generar nombre del contacto secuencial
    const allLeads = await getLeads();
    const chatLeads = allLeads.filter(lead =>
      lead.contact.name.startsWith('Chat-')
    );
    const nextChatNumber = chatLeads.length + 1;
    const contactName = travelInfo.contactInfo?.name || `Chat-${nextChatNumber}`;

    // Asegurar valores por defecto
    const safeInfo = {
      destination: travelInfo.destination || 'Por definir',
      checkin: travelInfo.dates?.checkin || '',
      checkout: travelInfo.dates?.checkout || '',
      adults: travelInfo.travelers?.adults || 1,
      children: travelInfo.travelers?.children || 0,
      budget: travelInfo.budget || 0,
      tripType: travelInfo.tripType || 'package',
      description: travelInfo.description || `Lead generado desde chat: ${conversation.external_key}`
    };

    console.log('Safe info for lead creation:', safeInfo);

    // Crear el lead
    const leadData = {
      contact: {
        name: contactName,
        phone: travelInfo.contactInfo?.phone || 'No especificado',
        email: travelInfo.contactInfo?.email || ''
      },
      trip: {
        type: safeInfo.tripType,
        city: safeInfo.destination,
        dates: {
          checkin: safeInfo.checkin,
          checkout: safeInfo.checkout
        },
        adults: safeInfo.adults,
        children: safeInfo.children
      },
      tenant_id: DUMMY_TENANT_ID,
      agency_id: DUMMY_AGENCY_ID,
      status: 'new' as const,
      section_id: firstSectionId,
      budget: safeInfo.budget,
      description: safeInfo.description,
      conversation_id: conversation.id,
      checklist: [
        { id: '1', text: 'Chat iniciado', completed: true },
        { id: '2', text: 'Información recopilada', completed: safeInfo.destination !== 'Por definir' },
        { id: '3', text: 'Presupuesto definido', completed: safeInfo.budget > 0 },
        { id: '4', text: 'Contacto pendiente', completed: false }
      ]
    };

    console.log('Creating lead with data:', leadData);

    const newLead = await createLead(leadData);

    if (newLead) {
      console.log('✅ Lead created successfully:', newLead.id);
      return newLead.id;
    } else {
      console.error('❌ Failed to create lead');
      return null;
    }

  } catch (error) {
    console.error('❌ Error creating lead from chat:', error);
    return null;
  }
}

// Función para actualizar un lead existente con nueva información del chat
export async function updateLeadFromChatMessages(
  leadId: string,
  messages: MessageRow[]
): Promise<boolean> {
  try {
    const travelInfo = await extractTravelInfoFromMessages(messages);

    // Aquí podrías implementar lógica para actualizar el lead existente
    // con nueva información extraída de los mensajes más recientes

    console.log('Would update lead', leadId, 'with info:', travelInfo);

    return true;
  } catch (error) {
    console.error('Error updating lead from chat messages:', error);
    return false;
  }
}

// Función para actualizar el lead con los datos del PDF generado
export async function updateLeadWithPdfData(
  conversationId: string,
  pdfUrl: string,
  flightData: FlightData[],
  hotelData: HotelData[]
): Promise<string | null> {
  try {
    console.log('🔍 [LEAD UPDATE] Starting lead update process');
    console.log('📋 [LEAD UPDATE] Conversation ID:', conversationId);
    console.log('📄 [LEAD UPDATE] PDF URL:', pdfUrl);
    console.log('✈️ [LEAD UPDATE] Flights count:', flightData.length);
    console.log('🏨 [LEAD UPDATE] Hotels count:', hotelData.length);

    // Buscar el lead asociado con esta conversación
    const { data: leads, error: searchError } = await supabase
      .from('leads')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (searchError) {
      console.error('❌ [LEAD UPDATE] Error searching for lead:', searchError);
      return null;
    }

    console.log('🔍 [LEAD UPDATE] Search results:', {
      leads_found: leads?.length || 0,
      leads_data: leads
    });

    if (!leads || leads.length === 0) {
      console.warn('⚠️ [LEAD UPDATE] No lead found for conversation:', conversationId);
      console.log('💡 [LEAD UPDATE] This might be normal if no lead was created yet from this chat');
      return null;
    }

    const lead = leads[0];
    console.log('✅ [LEAD UPDATE] Found lead to update:', {
      lead_id: lead.id,
      current_status: lead.status,
      current_budget: lead.budget,
      conversation_id: lead.conversation_id
    });

    // Extraer información de los datos de vuelos y hoteles
    const firstFlight = flightData[0];
    const firstHotel = hotelData[0];

    // Determinar el tipo de viaje
    let tripType: 'hotel' | 'flight' | 'package' = 'package';
    if (flightData.length > 0 && hotelData.length === 0) {
      tripType = 'flight';
    } else if (flightData.length === 0 && hotelData.length > 0) {
      tripType = 'hotel';
    }

    // Parse trip data safely
    let tripData: any = {};
    try {
      tripData = typeof lead.trip === 'string' ? JSON.parse(lead.trip) : (lead.trip || {});
    } catch (error) {
      console.warn('Error parsing trip data:', error);
      tripData = {};
    }

    // Calcular fechas
    const checkin = firstHotel?.check_in || firstFlight?.departure_date || tripData.dates?.checkin || '';
    const checkout = firstHotel?.check_out || firstFlight?.return_date || tripData.dates?.checkout || '';

    // Calcular ciudad de destino
    let destination = tripData.city || 'Por definir';
    if (firstFlight) {
      // Usar ciudad de llegada del primer vuelo
      const arrivalCity = firstFlight.legs?.[0]?.arrival?.city_name;
      if (arrivalCity) {
        destination = arrivalCity;
      }
    } else if (firstHotel) {
      destination = firstHotel.city;
    }

    // Calcular presupuesto total
    let totalBudget = 0;
    flightData.forEach(flight => {
      totalBudget += flight.price?.amount || 0;
    });
    hotelData.forEach(hotel => {
      const cheapestRoom = hotel.rooms?.reduce((cheapest, room) =>
        room.total_price < cheapest.total_price ? room : cheapest
      );
      if (cheapestRoom) {
        totalBudget += cheapestRoom.total_price;
      }
    });

    // Crear descripción detallada
    const flightSummary = flightData.length > 0
      ? `✈️ ${flightData.length} vuelo(s) - ${firstFlight?.airline?.name || 'N/A'} - $${flightData[0]?.price?.amount || 0} ${flightData[0]?.price?.currency || 'USD'}`
      : '';

    const hotelSummary = hotelData.length > 0
      ? `🏨 ${hotelData.length} hotel(es) - ${firstHotel?.name || 'N/A'} - ${firstHotel?.nights || 0} noches`
      : '';

    const description = `PDF generado - Cotización de viaje combinado\n${flightSummary}\n${hotelSummary}\nPresupuesto total: $${totalBudget.toFixed(2)} USD\nPDF: ${pdfUrl}`;

    // Obtener attachments actuales
    const currentAttachments = (lead.attachments as any) || [];

    // Agregar el PDF como attachment
    const pdfAttachment = {
      id: Date.now().toString(),
      name: `Cotización Viaje - ${new Date().toLocaleDateString('es-ES')}.pdf`,
      url: pdfUrl,
      type: 'pdf',
      size: 0, // No conocemos el tamaño
      uploaded_at: new Date().toISOString()
    };

    const updatedAttachments = [...currentAttachments, pdfAttachment];

    // Actualizar checklist
    const currentChecklist = (lead.checklist as any) || [];
    const updatedChecklist = [
      ...currentChecklist,
      {
        id: Date.now().toString(),
        text: 'PDF de cotización generado',
        completed: true
      }
    ];

    // Preparar datos para actualización
    const updateData = {
      id: lead.id,
      trip: {
        type: tripType,
        city: destination,
        dates: {
          checkin,
          checkout
        },
        adults: firstFlight?.adults || tripData.adults || 1,
        children: firstFlight?.childrens || tripData.children || 0
      },
      budget: totalBudget > 0 ? totalBudget : lead.budget,
      description: description,
      attachments: updatedAttachments,
      checklist: updatedChecklist,
      status: 'quoted' as const // Cambiar estado a "cotizado"
    };

    console.log('📝 Updating lead with PDF data:', {
      leadId: lead.id,
      tripType,
      destination,
      totalBudget,
      attachmentsCount: updatedAttachments.length
    });

    const updatedLead = await updateLead(updateData);

    if (updatedLead) {
      console.log('✅ [LEAD UPDATE] Lead updated successfully with PDF data');
      console.log('📋 [LEAD UPDATE] Updated lead details:', {
        lead_id: updatedLead.id,
        new_status: updatedLead.status,
        new_budget: updatedLead.budget,
        attachments_count: updatedLead.attachments?.length || 0,
        checklist_items: updatedLead.checklist?.length || 0
      });
      return updatedLead.id;
    } else {
      console.error('❌ [LEAD UPDATE] Failed to update lead with PDF data');
      return null;
    }

  } catch (error) {
    console.error('❌ [LEAD UPDATE] Error updating lead with PDF data:', error);
    return null;
  }
}

// Función para crear un lead completo desde toda la información del chat
export async function createComprehensiveLeadFromChat(
  conversation: ConversationRow,
  messages: MessageRow[],
  parsedRequest?: ParsedTravelRequest
): Promise<string | null> {
  try {
    console.log('=== CREATING COMPREHENSIVE LEAD FROM CHAT ===');
    console.log('Conversation:', conversation.external_key);
    console.log('Messages count:', messages.length);
    console.log('Parsed request:', parsedRequest);

    // Extraer información básica de los mensajes
    const travelInfo = await extractTravelInfoFromMessages(messages);

    // Si tenemos un parsedRequest, usar esa información como prioritaria
    let comprehensiveInfo = { ...travelInfo };

    if (parsedRequest) {
      console.log('📊 Using parsed request information for lead creation');

      // Extraer información de vuelos si existe
      if (parsedRequest.flights) {
        comprehensiveInfo.destination = parsedRequest.flights.destination || travelInfo.destination;
        comprehensiveInfo.dates = {
          checkin: parsedRequest.flights.departureDate || travelInfo.dates?.checkin || '',
          checkout: parsedRequest.flights.returnDate || travelInfo.dates?.checkout || ''
        };
        comprehensiveInfo.travelers = {
          adults: parsedRequest.flights.adults || travelInfo.travelers?.adults || 1,
          children: parsedRequest.flights.children || travelInfo.travelers?.children || 0
        };
        comprehensiveInfo.tripType = 'flight';

        // Agregar información específica de vuelos
        comprehensiveInfo.flightDetails = {
          origin: parsedRequest.flights.origin,
          destination: parsedRequest.flights.destination,
          departureDate: parsedRequest.flights.departureDate,
          returnDate: parsedRequest.flights.returnDate,
          adults: parsedRequest.flights.adults,
          children: parsedRequest.flights.children,
          luggage: parsedRequest.flights.luggage,
          stops: parsedRequest.flights.stops,
          departureTimePreference: parsedRequest.flights.departureTimePreference,
          arrivalTimePreference: parsedRequest.flights.arrivalTimePreference,
          preferredAirline: parsedRequest.flights.preferredAirline
        };
      }

      // Extraer información de hoteles si existe
      if (parsedRequest.hotels) {
        comprehensiveInfo.destination = parsedRequest.hotels.city || travelInfo.destination;
        comprehensiveInfo.dates = {
          checkin: parsedRequest.hotels.checkinDate || travelInfo.dates?.checkin || '',
          checkout: parsedRequest.hotels.checkoutDate || travelInfo.dates?.checkout || ''
        };
        comprehensiveInfo.travelers = {
          adults: parsedRequest.hotels.adults || travelInfo.travelers?.adults || 1,
          children: parsedRequest.hotels.children || travelInfo.travelers?.children || 0
        };
        comprehensiveInfo.tripType = 'hotel';

        // Agregar información específica de hoteles
        comprehensiveInfo.hotelDetails = {
          city: parsedRequest.hotels.city,
          hotelName: parsedRequest.hotels.hotelName,
          checkinDate: parsedRequest.hotels.checkinDate,
          checkoutDate: parsedRequest.hotels.checkoutDate,
          adults: parsedRequest.hotels.adults,
          children: parsedRequest.hotels.children,
          roomType: parsedRequest.hotels.roomType,
          hotelChain: parsedRequest.hotels.hotelChain,
          mealPlan: parsedRequest.hotels.mealPlan,
          freeCancellation: parsedRequest.hotels.freeCancellation,
          roomView: parsedRequest.hotels.roomView,
          roomCount: parsedRequest.hotels.roomCount
        };
      }

      // Si es combined, determinar el tipo de viaje
      if (parsedRequest.requestType === 'combined') {
        comprehensiveInfo.tripType = 'package';
      }
    }

    console.log('📋 Comprehensive travel info:', comprehensiveInfo);

    // Obtener la primera sección (Nuevos) para asignar el lead
    const sections = await getSections(DUMMY_AGENCY_ID);
    const firstSectionId = sections.length > 0 ? sections[0].id : undefined;

    // Generar nombre del contacto secuencial
    const allLeads = await getLeads();
    const chatLeads = allLeads.filter(lead =>
      lead.contact.name.startsWith('Chat-')
    );
    const nextChatNumber = chatLeads.length + 1;
    const contactName = comprehensiveInfo.contactInfo?.name || `Chat-${nextChatNumber}`;

    // Crear descripción detallada
    let description = `Conversación iniciada: ${conversation.external_key}\n\n`;

    if (comprehensiveInfo.flightDetails) {
      description += `✈️ VUELO:\n`;
      description += `- Origen: ${comprehensiveInfo.flightDetails.origin}\n`;
      description += `- Destino: ${comprehensiveInfo.flightDetails.destination}\n`;
      description += `- Fecha salida: ${comprehensiveInfo.flightDetails.departureDate}\n`;
      if (comprehensiveInfo.flightDetails.returnDate) {
        description += `- Fecha regreso: ${comprehensiveInfo.flightDetails.returnDate}\n`;
      }
      description += `- Pasajeros: ${comprehensiveInfo.flightDetails.adults} adultos, ${comprehensiveInfo.flightDetails.children} niños\n`;
      if (comprehensiveInfo.flightDetails.luggage) {
        description += `- Equipaje: ${comprehensiveInfo.flightDetails.luggage}\n`;
      }
      if (comprehensiveInfo.flightDetails.stops) {
        description += `- Tipo vuelo: ${comprehensiveInfo.flightDetails.stops}\n`;
      }
      if (comprehensiveInfo.flightDetails.preferredAirline) {
        description += `- Aerolínea preferida: ${comprehensiveInfo.flightDetails.preferredAirline}\n`;
      }
      description += `\n`;
    }

    if (comprehensiveInfo.hotelDetails) {
      description += `🏨 HOTEL:\n`;
      description += `- Ciudad: ${comprehensiveInfo.hotelDetails.city}\n`;
      if (comprehensiveInfo.hotelDetails.hotelName) {
        description += `- Hotel: ${comprehensiveInfo.hotelDetails.hotelName}\n`;
      }
      description += `- Check-in: ${comprehensiveInfo.hotelDetails.checkinDate}\n`;
      description += `- Check-out: ${comprehensiveInfo.hotelDetails.checkoutDate}\n`;
      description += `- Pasajeros: ${comprehensiveInfo.hotelDetails.adults} adultos, ${comprehensiveInfo.hotelDetails.children} niños\n`;
      if (comprehensiveInfo.hotelDetails.roomType) {
        description += `- Tipo habitación: ${comprehensiveInfo.hotelDetails.roomType}\n`;
      }
      if (comprehensiveInfo.hotelDetails.mealPlan) {
        description += `- Modalidad: ${comprehensiveInfo.hotelDetails.mealPlan}\n`;
      }
      if (comprehensiveInfo.hotelDetails.hotelChain) {
        description += `- Cadena hotelera: ${comprehensiveInfo.hotelDetails.hotelChain}\n`;
      }
      if (comprehensiveInfo.hotelDetails.freeCancellation) {
        description += `- Cancelación gratuita: Sí\n`;
      }
      if (comprehensiveInfo.hotelDetails.roomView) {
        description += `- Vista: ${comprehensiveInfo.hotelDetails.roomView}\n`;
      }
      if (comprehensiveInfo.hotelDetails.roomCount) {
        description += `- Cantidad habitaciones: ${comprehensiveInfo.hotelDetails.roomCount}\n`;
      }
      description += `\n`;
    }

    // Agregar información de contacto si está disponible
    if (comprehensiveInfo.contactInfo?.phone) {
      description += `📞 Teléfono: ${comprehensiveInfo.contactInfo.phone}\n`;
    }
    if (comprehensiveInfo.contactInfo?.email) {
      description += `📧 Email: ${comprehensiveInfo.contactInfo.email}\n`;
    }

    // Agregar presupuesto si está disponible
    if (comprehensiveInfo.budget && comprehensiveInfo.budget > 0) {
      description += `💰 Presupuesto: $${comprehensiveInfo.budget}\n`;
    }

    // Asegurar valores por defecto
    const safeInfo = {
      destination: comprehensiveInfo.destination || 'Por definir',
      checkin: comprehensiveInfo.dates?.checkin || '',
      checkout: comprehensiveInfo.dates?.checkout || '',
      adults: comprehensiveInfo.travelers?.adults || 1,
      children: comprehensiveInfo.travelers?.children || 0,
      budget: comprehensiveInfo.budget || 0,
      tripType: comprehensiveInfo.tripType || 'package',
      description: description
    };

    console.log('📋 Safe info for lead creation:', safeInfo);

    // Crear el lead
    const leadData = {
      contact: {
        name: contactName,
        phone: comprehensiveInfo.contactInfo?.phone || 'No especificado',
        email: comprehensiveInfo.contactInfo?.email || ''
      },
      trip: {
        type: safeInfo.tripType,
        city: safeInfo.destination,
        dates: {
          checkin: safeInfo.checkin,
          checkout: safeInfo.checkout
        },
        adults: safeInfo.adults,
        children: safeInfo.children
      },
      tenant_id: DUMMY_TENANT_ID,
      agency_id: DUMMY_AGENCY_ID,
      status: 'new' as const,
      section_id: firstSectionId,
      budget: safeInfo.budget,
      description: safeInfo.description,
      conversation_id: conversation.id,
      checklist: [
        { id: '1', text: 'Chat iniciado', completed: true },
        { id: '2', text: 'Información recopilada', completed: safeInfo.destination !== 'Por definir' },
        { id: '3', text: 'Presupuesto definido', completed: safeInfo.budget > 0 },
        { id: '4', text: 'Contacto pendiente', completed: false },
        { id: '5', text: 'Lead creado manualmente', completed: true }
      ]
    };

    console.log('📋 Creating comprehensive lead with data:', leadData);

    const newLead = await createLead(leadData);

    if (newLead) {
      console.log('✅ Comprehensive lead created successfully:', newLead.id);
      return newLead.id;
    } else {
      console.error('❌ Failed to create comprehensive lead');
      return null;
    }

  } catch (error) {
    console.error('❌ Error creating comprehensive lead from chat:', error);
    return null;
  }
}

// Función de diagnóstico para verificar leads en el CRM
export async function diagnoseCRMIntegration(conversationId?: string): Promise<void> {
  try {
    console.log('🔍 [CRM DIAGNOSIS] Starting CRM integration diagnosis...');

    // 1. Verificar leads totales
    const { data: allLeads, error: allLeadsError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (allLeadsError) {
      console.error('❌ [CRM DIAGNOSIS] Error fetching all leads:', allLeadsError);
      return;
    }

    console.log('📊 [CRM DIAGNOSIS] Total leads in database:', allLeads?.length || 0);

    // 2. Verificar leads con conversation_id
    const leadsWithConversation = allLeads?.filter(lead => lead.conversation_id) || [];
    console.log('💬 [CRM DIAGNOSIS] Leads with conversation_id:', leadsWithConversation.length);

    // 3. Verificar leads del chat actual (si se proporciona conversationId)
    if (conversationId) {
      const conversationLeads = allLeads?.filter(lead => lead.conversation_id === conversationId) || [];
      console.log('🎯 [CRM DIAGNOSIS] Leads for current conversation:', conversationLeads.length);

      if (conversationLeads.length > 0) {
        console.log('📋 [CRM DIAGNOSIS] Current conversation leads:', conversationLeads.map(lead => ({
          id: lead.id,
          status: lead.status,
          budget: lead.budget,
          created_at: lead.created_at,
          has_attachments: lead.attachments && JSON.parse(lead.attachments as string).length > 0
        })));
      }
    }

    // 4. Verificar leads recientes (últimas 24 horas)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentLeads = allLeads?.filter(lead => lead.created_at > yesterday) || [];
    console.log('🕐 [CRM DIAGNOSIS] Recent leads (last 24h):', recentLeads.length);

    // 5. Verificar leads con PDFs
    const leadsWithPDFs = allLeads?.filter(lead => {
      try {
        const attachments = JSON.parse(lead.attachments as string);
        return Array.isArray(attachments) && attachments.length > 0;
      } catch {
        return false;
      }
    }) || [];
    console.log('📄 [CRM DIAGNOSIS] Leads with PDF attachments:', leadsWithPDFs.length);

    console.log('✅ [CRM DIAGNOSIS] Diagnosis complete');

  } catch (error) {
    console.error('❌ [CRM DIAGNOSIS] Error during diagnosis:', error);
  }
}