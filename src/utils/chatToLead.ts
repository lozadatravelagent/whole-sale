import { supabase } from '@/integrations/supabase/client';
import { createLead, getSections } from '@/lib/supabase-leads';
import type { Database } from '@/integrations/supabase/types';

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

// Función para extraer información de viaje de los mensajes usando AI
export async function extractTravelInfoFromMessages(messages: MessageRow[]): Promise<ExtractedTravelInfo> {
  if (messages.length === 0) return {};

  // Combinar todos los mensajes del usuario para análisis
  const userMessages = messages
    .filter(msg => msg.role === 'user')
    .map(msg => {
      if (typeof msg.content === 'object' && msg.content && 'text' in msg.content) {
        return (msg.content as any).text || '';
      }
      return '';
    })
    .join(' ');

  if (!userMessages.trim()) return {};

  console.log('Processing user messages:', userMessages);

  try {
    // Llamar a una edge function para extraer información estructurada
    const { data, error } = await supabase.functions.invoke('extract-travel-info', {
      body: { messages: userMessages }
    });

    console.log('Extract travel info response:', data, error);

    if (error) {
      console.warn('Error extracting travel info via AI, using basic extraction:', error);
      return extractBasicInfo(userMessages);
    }

    const extractedInfo = data?.travelInfo || {};
    
    // Si la extracción AI no devolvió información útil, usar extracción básica
    if (!extractedInfo.destination && !extractedInfo.budget && !extractedInfo.travelers) {
      console.log('AI extraction incomplete, falling back to basic extraction');
      return extractBasicInfo(userMessages);
    }

    console.log('Successfully extracted info via AI:', extractedInfo);
    return extractedInfo;
  } catch (error) {
    console.warn('Failed to extract travel info via AI, using basic extraction:', error);
    return extractBasicInfo(userMessages);
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
    // Obtener información de la conversación
    const travelInfo = await extractTravelInfoFromMessages(messages);
    
    // Obtener la primera sección (Nuevos) para asignar el lead
    const sections = await getSections(DUMMY_AGENCY_ID);
    const firstSectionId = sections.length > 0 ? sections[0].id : undefined;

    // Generar nombre del contacto desde el chat
    const contactName = `Cliente Chat ${conversation.external_key}`;
    
    // Crear el lead
    const leadData = {
      contact: {
        name: travelInfo.contactInfo?.name || contactName,
        phone: travelInfo.contactInfo?.phone || 'No especificado',
        email: travelInfo.contactInfo?.email || ''
      },
      trip: {
        type: travelInfo.tripType || 'package',
        city: travelInfo.destination || 'Por definir',
        dates: {
          checkin: travelInfo.dates?.checkin || '',
          checkout: travelInfo.dates?.checkout || ''
        },
        adults: travelInfo.travelers?.adults || 1,
        children: travelInfo.travelers?.children || 0
      },
      tenant_id: DUMMY_TENANT_ID,
      agency_id: DUMMY_AGENCY_ID,
      status: 'new' as const,
      section_id: firstSectionId,
      budget: travelInfo.budget || 0,
      description: `Lead generado automáticamente desde chat: ${conversation.external_key}\n\n${travelInfo.description || 'Sin descripción adicional.'}`,
      conversation_id: conversation.id,
      checklist: [
        { id: '1', text: 'Chat iniciado', completed: true },
        { id: '2', text: 'Usuario Contactado', completed: false },
        { id: '3', text: 'Presupuesto Enviado', completed: false },
        { id: '4', text: 'Presupuesto Pagado', completed: false }
      ]
    };

    console.log('Creating lead from chat with data:', leadData);

    const newLead = await createLead(leadData);
    
    if (newLead) {
      console.log('Lead created successfully:', newLead.id);
      return newLead.id;
    }
    
    return null;
  } catch (error) {
    console.error('Error creating lead from chat:', error);
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