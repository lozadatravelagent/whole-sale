import type { MessageRow } from '../types/chat';

// Message display helpers
export const getMessageContent = (msg: MessageRow): string => {
  if (typeof msg.content === 'string') return msg.content;
  if (typeof msg.content === 'object' && msg.content && 'text' in msg.content) {
    return (msg.content as { text?: string }).text || '';
  }
  return '';
};

export const getMessageStatus = (msg: MessageRow): string => {
  if (typeof msg.meta === 'object' && msg.meta && 'status' in msg.meta) {
    return (msg.meta as { status?: string }).status || 'sent';
  }
  return 'sent';
};

export const getMessageStatusIconType = (status: string): 'sending' | 'sent' | 'delivered' => {
  switch (status) {
    case 'sending':
      return 'sending';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    default:
      return 'sent';
  }
};

export const formatTime = (timestampOrTime: string): string => {
  // If it's a plain HH:mm (or H:mm) time string, return as-is
  if (/^\d{1,2}:\d{2}$/.test(timestampOrTime)) {
    return timestampOrTime;
  }
  const d = new Date(timestampOrTime);
  if (isNaN(d.getTime())) {
    // Fallback: return original if not parseable
    return timestampOrTime;
  }
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export const generateChatTitle = (message: string): string => {
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