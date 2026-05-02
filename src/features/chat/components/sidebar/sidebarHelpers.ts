import type { ConversationWithAgency } from '@/features/chat/types/chat';

// Aurora-tinted trip gradients — Meridian palette (violet / cobalt / lilac
// / coral / mint), no slate-blue legacy.
const TRIP_GRADIENTS = [
  'linear-gradient(135deg, hsl(248 60% 12%) 0%, hsl(262 75% 55%) 100%)',
  'linear-gradient(135deg, hsl(248 50% 7%) 0%, hsl(220 70% 60%) 100%)',
  'linear-gradient(135deg, hsl(258 50% 14%) 0%, hsl(255 80% 72%) 100%)',
  'linear-gradient(135deg, hsl(252 38% 22%) 0%, hsl(14 65% 70%) 100%)',
  'linear-gradient(135deg, hsl(248 50% 10%) 0%, hsl(175 40% 60%) 100%)',
];

const formatConversationDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
};

export const getConversationTitle = (conversation: ConversationWithAgency) =>
  conversation.external_key || `Chat ${new Date(conversation.created_at).toLocaleDateString()}`;

export const getConversationSubtitle = (conversation: ConversationWithAgency) =>
  formatConversationDate(conversation.last_message_at || conversation.created_at);

export const getTripGradient = (value: string) => {
  const hash = Array.from(value).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
  return TRIP_GRADIENTS[hash % TRIP_GRADIENTS.length];
};

export const getTitleInitials = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'VB';
