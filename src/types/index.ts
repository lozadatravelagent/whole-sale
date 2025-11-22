// VBOOK Types - Multi-tenant Travel SaaS

export type Role = 'OWNER' | 'SUPERADMIN' | 'ADMIN' | 'SELLER';
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
  agency_id: string | null; // Nullable for OWNER/SUPERADMIN
  tenant_id: string | null; // Nullable for OWNER (sees all tenants)
  name?: string; // Added for display purposes
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

// New types for enhanced CRM
// NOTE: Seller interface deprecated - now use User interface with role='SELLER'
// Kept for backward compatibility during migration
/** @deprecated Use User with role='SELLER' instead */
export interface Seller {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  agency_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
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
  status: LeadStatus; // Keep for backward compatibility
  section_id?: string;
  conversation_id?: string;
  pdf_urls: string[];
  assigned_user_id?: string; // User ID of assigned seller (from users table with role='SELLER')
  /** @deprecated Use assigned_user_id instead */
  seller_id?: string; // Deprecated: kept for backward compatibility
  budget?: number;
  description?: string;
  due_date?: string;
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
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

// Tenant with aggregated metrics (for OWNER dashboard)
export interface TenantWithMetrics extends Tenant {
  agencies_count: number;
  users_count: number;
  total_revenue: number;
  total_leads: number;
  conversion_rate: number;
}

// Agency performance metrics (for SUPERADMIN/OWNER)
export interface AgencyPerformance {
  agency_id: string;
  agency_name: string;
  tenant_id?: string;
  tenant_name?: string;
  sellers_count: number;
  leads_count: number;
  revenue: number;
  conversion_rate: number;
  active_conversations: number;
}

// Seller performance metrics (for ADMIN)
export interface SellerPerformance {
  seller_id: string;
  seller_name: string;
  agency_id: string;
  agency_name?: string;
  leads_count: number;
  won_count: number;
  lost_count: number;
  revenue: number;
  conversion_rate: number;
  avg_budget: number;
}

// Personal metrics (for SELLER)
export interface SellerPersonalMetrics {
  my_leads: number;
  my_won: number;
  my_revenue: number;
  my_conversion_rate: number;
  my_leads_by_section: { [section_name: string]: number };
  upcoming_deadlines: Array<{
    lead_id: string;
    contact_name: string;
    destination: string;
    due_date: string;
  }>;
  monthly_goal?: number;
  monthly_progress?: number;
}

// Flight and PDF types
export interface AirportInfo {
  city_code: string;
  city_name: string;
  time: string;
}

export interface LayoverInfo {
  destination_city: string;
  destination_code: string;
  waiting_time: string;
}

export interface FlightLeg {
  departure: AirportInfo;
  arrival: AirportInfo;
  duration: string;
  flight_type: string;
  layovers?: LayoverInfo[];
  arrival_next_day?: boolean;
}

export interface FlightData {
  id?: string;
  airline: {
    code: string;
    name: string;
  };
  price: {
    amount: number;
    currency: string;
  };
  adults: number;
  childrens: number;
  departure_date: string;
  return_date?: string;
  legs: FlightLeg[];
  luggage?: boolean;
  travel_assistance?: number;
  transfers?: number;
}

export interface PdfGenerationRequest {
  document_template_id: string;
  payload: {
    selected_flights: FlightData[];
  };
}

export interface PdfMonkeyResponse {
  success: boolean;
  document_url?: string;
  error?: string;
}

// Hotel types
export interface HotelSearchParams {
  dateFrom: string;
  dateTo: string;
  city?: string;
  hotelName?: string;
  adults?: number;
  children?: number;
  occupancy?: number;
}

export interface HotelRoom {
  type: string;
  description: string;
  price_per_night: number;
  total_price: number;
  currency: string;
  availability: number;
  occupancy_id: string;
  fare_id_broker?: string;
}

export interface PackageFare {
  type: 'SGL' | 'DWL' | 'TPL' | 'CHD' | 'INF' | 'CPL';
  passengerType: 'ADT' | 'CHD' | 'INF' | 'CNN';
  availability: number;
  base: number;
  taxes: Array<{
    type: string;
    amount: number;
  }>;
  total: number;
  currency: string;
}

export interface PackageCompositionHotel {
  itemId: string;
  code: string;
  name: string;
  category: string;
  location: {
    code: string;
    name: string;
  };
  roomType: {
    code: string;
    name: string;
  };
  checkin: string;
  checkout: string;
  roomsAvailable: number;
}

export interface PackageCompositionFlight {
  itemId: string;
  departure: string;
  airline: {
    code: string;
    iata: string;
    name: string;
  };
  flight: {
    number: string;
    category: string;
    seatAvailable: number;
  };
  departureInfo: {
    time: string;
    city: { code: string; name: string };
    airport: { code: string; name: string };
  };
  arrivalInfo: {
    time: string;
    city: { code: string; name: string };
    airport: { code: string; name: string };
  };
}

export interface PackageOperationDay {
  date: string;
  seatAvailable: number;
  roomsAvailable: number;
  composition: {
    hotels: PackageCompositionHotel[];
    flights: PackageCompositionFlight[];
  };
}

export interface PackageData {
  id: string;
  unique_id: string;
  backOfficeCode: string;
  backOfficeOperatorCode: string;
  name: string;
  category: string;
  destination: string;
  description?: string;
  class: 'AEROTERRESTRE' | 'TERRESTRE' | 'AEREO';
  operationItems: string[]; // Days like 'sat', 'sun', etc.
  lodgedNights: number;
  lodgedDays: number;
  policies: {
    cancellation?: string;
    lodging?: string;
    children?: string;
  };
  fares: PackageFare[];
  operationDays: PackageOperationDay[];
  itinerary?: string;
  details?: string;
}

export interface HotelData {
  id: string;
  unique_id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone?: string;
  website?: string;
  description?: string;
  images?: string[];
  rooms: HotelRoom[];
  check_in: string;
  check_out: string;
  nights: number;
  policy_cancellation?: string;
  policy_lodging?: string;
}

// Extended hotel data with selected room for PDF generation
export interface HotelDataWithSelectedRoom extends HotelData {
  selectedRoom: HotelRoom;
}

// Combined travel service types
export interface AirfareSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
}

export interface CombinedTravelRequest {
  flights: AirfareSearchParams;
  hotels: HotelSearchParams;
  requestType: 'combined' | 'flights-only' | 'hotels-only';
}

export interface CombinedTravelResults {
  flights: FlightData[];
  hotels: HotelData[];
  requestType: 'combined' | 'flights-only' | 'hotels-only';
  // Hotel filter preferences from user request
  requestedRoomType?: 'single' | 'double' | 'triple';
  requestedMealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';
}

// EUROVIPS WebService types
export interface EurovipsSearchParams {
  dateFrom: string;
  dateTo: string;
  origin?: string;
  destination?: string;
  city?: string;
  hotelName?: string;
  adults?: number;
  children?: number;
  currency?: string;
}

// Service types (transfers, excursions, etc.)
export interface ServiceData {
  id: string;
  unique_id: string;
  name: string;
  type: '1' | '2' | '3'; // 1=Transfer, 2=Excursion, 3=Other
  category: string;
  city: string;
  description?: string;
  price_per_person: number;
  currency: string;
  availability: number;
  date_from: string;
  date_to?: string;
  duration?: string;
  policy_cancellation?: string;
}

export interface EurovipsResult {
  success: boolean;
  flights?: FlightData[];
  hotels?: HotelData[];
  services?: ServiceData[];
  error?: string;
}