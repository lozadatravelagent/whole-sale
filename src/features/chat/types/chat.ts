import type { Database } from '@/integrations/supabase/types';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type ConversationRow = Database['public']['Tables']['conversations']['Row'];
export type ConversationWorkspaceMode = Database['public']['Enums']['conversation_workspace_mode'];

export interface ConversationWithAgency extends ConversationRow {
  agency_name?: string | null;
  tenant_name?: string | null;
  creator_email?: string | null;
  creator_role?: Database['public']['Enums']['user_role'] | null;
}

export interface ChatState {
  selectedConversation: string | null;
  message: string;
  isLoading: boolean;
  isUploadingPdf: boolean;
  lastPdfAnalysis: any;
  showInspirationText: boolean;
  activeTab: string;
  workspaceMode: 'standard' | 'planner';
  historyMode: 'standard' | 'planner';
  // ✅ Typing state per conversation (not global)
  typingByConversation: Record<string, { isTyping: boolean; message: string }>;
  sidebarLimit: number;
  previousParsedRequest: ParsedTravelRequest | null;
  isAddingToCRM: boolean;
}

export interface SearchResult {
  response: string;
  data: any;
}

// Price Change Types
export interface HotelPriceChange {
  hotelIndex: number;           // 0-based index
  hotelName?: string;           // Nombre detectado
  referenceType: 'position' | 'name' | 'price_order';
  newPrice: number;
}

export interface RelativeAdjustment {
  operation: 'add' | 'subtract' | 'percent_add' | 'percent_subtract';
  value: number;
  target: 'total' | 'hotel' | 'flights' | 'hotel_1' | 'hotel_2';
}

export interface HotelReference {
  position?: number;            // 1-based (primer=1, segundo=2)
  priceOrder?: 'cheapest' | 'expensive';
  chainName?: string;
}
