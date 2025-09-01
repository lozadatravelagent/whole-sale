// VBOOK Types - Multi-tenant Travel SaaS

export type Role = 'SUPERADMIN' | 'ADMIN';
export type ConversationChannel = 'wa' | 'web';
export type ConversationState = 'active' | 'closed' | 'pending';
export type MessageRole = 'user' | 'assistant' | 'system';
export type LeadStatus = 'new' | 'quoted' | 'negotiating' | 'won' | 'lost';
export type IntegrationStatus = 'active' | 'pending' | 'disabled';
export type ProviderCode = 'EUROVIPS' | 'LOZADA' | 'DELFOS' | 'ICARO' | 'STARLING';

// Database entities
export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Agency {
  id: string;
  tenant_id: string;
  name: string;
  status: 'active' | 'suspended';
  branding: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    contact: {
      name: string;
      email: string;
      phone: string;
    };
  };
  phones: string[];
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  agency_id: string;
  tenant_id: string;
  email: string;
  role: Role;
  provider: 'email' | 'google';
  created_at: string;
}

export interface WhatsAppNumber {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  waba_id: string;
  token_encrypted: string;
  quality_state: 'GREEN' | 'YELLOW' | 'RED';
  meta: any;
}

export interface Integration {
  id: string;
  agency_id: string;
  provider_code: ProviderCode;
  credentials_encrypted: any;
  status: IntegrationStatus;
  meta: any;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  agency_id: string;
  channel: ConversationChannel;
  external_key: string;
  phone_number_id?: string;
  state: ConversationState;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: {
    text?: string;
    cards?: any[];
    pdfUrl?: string;
    metadata?: any;
  };
  meta: any;
  created_at: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  agency_id: string;
  contact: {
    name: string;
    phone: string;
    email?: string;
  };
  trip: {
    type: 'hotel' | 'flight' | 'package';
    dates: {
      checkin: string;
      checkout: string;
    };
    city: string;
    adults: number;
    children: number;
  };
  status: LeadStatus;
  conversation_id?: string;
  pdf_urls: string[];
  assigned_user_id?: string;
  created_at: string;
  updated_at: string;
}

// Orchestrator API types
export interface AgentRequest {
  tenantId: string;
  agencyId: string;
  channel: ConversationChannel;
  userKey: string;
  message: string;
  context?: {
    branding: Agency['branding'];
    integrations: Integration[];
    locale: string;
  };
}

export interface TaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    text: string;
    cards?: any[];
    pdfUrl?: string;
    telemetry?: any;
  };
}

// Provider types
export interface HotelOption {
  id: string;
  name: string;
  location: string;
  price: number;
  currency: string;
  roomType: string;
  availability: boolean;
  provider: ProviderCode;
}

export interface QuoteData {
  lead: Lead;
  options: HotelOption[];
  branding: Agency['branding'];
}

// Dashboard metrics
export interface DashboardMetrics {
  conversations_today: number;
  quotes_generated: number;
  pdfs_created: number;
  leads_won: number;
  leads_lost: number;
  conversion_rate: number;
}