import type { Database } from '@/integrations/supabase/types';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

export type MessageRow = Database['public']['Tables']['messages']['Row'];

export interface FlightData {
  id: string;
  airline: { code: string; name: string };
  price: {
    amount: number;
    currency: string;
    netAmount?: number;
    fareAmount?: number;
    taxAmount?: number;
    baseCurrency?: string;
    localAmount?: number;
    localCurrency?: string;
    serviceAmount?: number;
    commissionAmount?: number;
    breakdown?: {
      fareAmount: number;
      taxAmount: number;
      serviceAmount: number;
      commissionAmount: number;
    };
  };
  adults: number;
  childrens: number;
  departure_date: string;
  departure_time?: string;
  arrival_date?: string;
  arrival_time?: string;
  return_date?: string;
  duration?: {
    total: number;
    formatted: string;
  };
  stops?: {
    count: number;
    direct: boolean;
    // Number of connections across all legs (segment changes)
    connections?: number;
    // Number of technical stops within segments across all legs
    technical?: number;
  };
  baggage?: {
    included: boolean;
    details: string;
    carryOn: string;
    carryOnQuantity?: string;
    carryOnWeight?: string;
    carryOnDimensions?: string;
  };
  cabin?: {
    class: string;
    brandName: string;
  };
  booking?: {
    validatingCarrier: string;
    lastTicketingDate: string;
    fareType: string;
    fareSupplier: string;
    fareSupplierCode: string;
    cancelPolicy: string;
    maxInstallments: number;
    allowedFOPs: string[];
    iataCountry: string;
    iataCurrency: string;
    iataAmount: number;
  };
  commission?: {
    percentage: number;
    amount: number;
    over: number;
    overCalculation?: string;
    passengerTypes?: string[];
  };
  passengerFares?: Array<{
    fareAmount: number;
    taxAmount: number;
    commissionAmount: number;
    totalAmount: number;
    passengerType: string;
    passengerSubType?: string;
    count: number;
    taxDetails: Array<{
      code: string;
      amount: number;
      currency: string;
      description?: string;
    }>;
  }>;
  extendedFareInfo?: {
    ruleId?: string;
    netFareAmount: number;
    netTaxAmount: number;
    netTotalAmount: number;
    netTotalAmountWithFee: number;
    additionalTaxes?: any;
    fee: {
      amount: number;
      paxDetail: Array<{
        ptc: string;
        amountPerPax: number;
      }>;
    };
    commission: {
      amount: number;
      paxDetail: Array<{
        ptc: string;
        amountPerPax: number;
      }>;
    };
    over: {
      amount: number;
      paxDetail: Array<{
        ptc: string;
        amountPerPax: number;
      }>;
    };
  };
  commissionPolicyInfo?: {
    ruleId: string;
    allowedFOPs: string[];
    commissionPct: number;
    overPct: number;
    overCalculation?: string;
  };
  legs: Array<{
    legNumber: number;
    options: Array<{
      optionId: string;
      duration: number;
      segments: Array<{
        segmentNumber: number;
        airline: string;
        operatingAirline: string;
        operatingAirlineName?: string;
        flightNumber: string;
        bookingClass: string;
        cabinClass: string;
        departure: {
          airportCode: string;
          date: string;
          time: string;
        };
        arrival: {
          airportCode: string;
          date: string;
          time: string;
        };
        stops: Array<{
          airportCode: string;
          date: string;
          time: string;
          duration: string;
        }>;
        duration: number;
        equipment: string;
        status: string;
        baggage: string;
        carryOnBagInfo: {
          quantity?: string;
          weight?: string;
          dimensions?: string;
        };
        fareBasis: string;
        brandName: string;
        features: any;
        airRecLoc?: string;
        availStatus?: string;
      }>;
    }>;
  }>;
  taxes?: Array<{
    code: string;
    amount: number;
    currency: string;
    description?: string;
  }>;
  luggage?: boolean;
  provider: string;
  contentOwner?: string;
  ownContent?: boolean;
  transactionId?: string;
  fareMessages?: any;
  fareCode?: string;
  fareFeatures?: any;
  fareCategory?: string;
}

export interface LocalHotelData {
  name: string;
  city: string;
  nights: number;
  check_in: string;
  check_out: string;
  rooms: Array<{
    type?: string;
    description?: string;
    price_per_night?: number;
    total_price: number;
    currency: string;
    availability?: number;
    occupancy_id?: string;
  }>;
  // Search params - occupancy requested by user (for PDF generation)
  search_adults?: number;
  search_children?: number;
}

export interface LocalCombinedTravelResults {
  flights: FlightData[];
  hotels: LocalHotelData[];
  requestType: 'combined' | 'flights-only' | 'hotels-only';
  // Hotel filter preferences from user request
  requestedRoomType?: 'single' | 'double' | 'triple';
  requestedMealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';
  // Flight search ID for localStorage lookup (dynamic filtering)
  flightSearchId?: string;
}

export interface LocalPackageData {
  name: string;
  destination: string;
  price: number;
  currency: string;
  duration: number;
}

export interface LocalServiceData {
  name: string;
  city: string;
  price: number;
  currency: string;
  duration: string;
}

export interface ChatState {
  selectedConversation: string | null;
  message: string;
  isLoading: boolean;
  isUploadingPdf: boolean;
  lastPdfAnalysis: any;
  showInspirationText: boolean;
  activeTab: string;
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