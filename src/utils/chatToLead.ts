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

  try {
    // Llamar a una edge function para extraer información estructurada
    const { data, error } = await supabase.functions.invoke('extract-travel-info', {
      body: { messages: userMessages }
    });

    if (error) {
      console.warn('Error extracting travel info:', error);
      return extractBasicInfo(userMessages);
    }

    return data.travelInfo || extractBasicInfo(userMessages);
  } catch (error) {
    console.warn('Failed to extract travel info via AI, using basic extraction:', error);
    return extractBasicInfo(userMessages);
  }
}

// Función de respaldo para extraer información básica sin AI
function extractBasicInfo(text: string): ExtractedTravelInfo {
  const info: ExtractedTravelInfo = {};
  
  // Extraer posibles destinos (ciudades/países comunes)
  const destinations = [
    'París', 'Londres', 'Tokyo', 'Nueva York', 'Roma', 'Barcelona', 'Ámsterdam', 
    'Berlín', 'Dubai', 'Tailandia', 'México', 'Argentina', 'Brasil', 'Perú',
    'Cancún', 'Playa del Carmen', 'Buenos Aires', 'Machu Picchu', 'Cusco',
    'Miami', 'Los Angeles', 'San Francisco', 'Las Vegas', 'Orlando'
  ];
  
  const foundDestination = destinations.find(dest => 
    text.toLowerCase().includes(dest.toLowerCase())
  );
  
  if (foundDestination) {
    info.destination = foundDestination;
  }

  // Extraer números de personas
  const adultMatch = text.match(/(\d+)\s*adult[oa]s?/i);
  const childMatch = text.match(/(\d+)\s*niñ[oa]s?/i) || text.match(/(\d+)\s*child/i);
  const peopleMatch = text.match(/(\d+)\s*person[ao]s?/i) || text.match(/somos\s*(\d+)/i);

  if (adultMatch) {
    info.travelers = { adults: parseInt(adultMatch[1]) };
  } else if (peopleMatch) {
    info.travelers = { adults: parseInt(peopleMatch[1]) };
  }

  if (childMatch) {
    info.travelers = { ...info.travelers, children: parseInt(childMatch[1]) };
  }

  // Extraer presupuesto
  const budgetMatch = text.match(/(?:presupuesto|budget).*?(\d+(?:,\d{3})*)/i) ||
                     text.match(/\$\s*(\d+(?:,\d{3})*)/i) ||
                     text.match(/(\d+(?:,\d{3})*)\s*(?:usd|dólares|dollars)/i);

  if (budgetMatch) {
    const budgetStr = budgetMatch[1].replace(/,/g, '');
    info.budget = parseInt(budgetStr);
  }

  // Determinar tipo de viaje
  if (text.toLowerCase().includes('hotel')) {
    info.tripType = 'hotel';
  } else if (text.toLowerCase().includes('vuelo') || text.toLowerCase().includes('flight')) {
    info.tripType = 'flight';
  } else {
    info.tripType = 'package';
  }

  // Usar el texto como descripción inicial
  info.description = text.length > 200 ? text.substring(0, 200) + '...' : text;

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