import { supabase } from '@/integrations/supabase/client';
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
    console.log('🔍 Searching for lead with conversation_id:', conversationId);

    // Buscar el lead asociado con esta conversación
    const { data: leads, error: searchError } = await supabase
      .from('leads')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (searchError) {
      console.error('Error searching for lead:', searchError);
      return null;
    }

    if (!leads || leads.length === 0) {
      console.warn('No lead found for conversation:', conversationId);
      return null;
    }

    const lead = leads[0];
    console.log('✅ Found lead to update:', lead.id);

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
      console.log('✅ Lead updated successfully with PDF data');
      return updatedLead.id;
    } else {
      console.error('❌ Failed to update lead with PDF data');
      return null;
    }

  } catch (error) {
    console.error('❌ Error updating lead with PDF data:', error);
    return null;
  }
}