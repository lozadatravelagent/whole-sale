// Travel selector types for CRM feature
import type { FlightData, HotelData, CombinedTravelResults } from '@/types';

export type { FlightData, HotelData, CombinedTravelResults };

// Travel selection state
export interface TravelSelectionState {
  selectedFlights: FlightData[];
  selectedHotels: HotelData[];
  isGeneratingPdf: boolean;
  activeTab: 'flights' | 'hotels' | 'combined';
}

// Travel selector props
export interface TravelSelectorProps {
  combinedData: CombinedTravelResults;
  onPdfGenerated?: (pdfUrl: string, selectedFlights: FlightData[], selectedHotels: HotelData[]) => Promise<void>;
  onSelectionChange?: (state: TravelSelectionState) => void;
}

export interface FlightSelectorProps {
  flights: FlightData[];
  selectedFlights: FlightData[];
  onSelectionChange: (flights: FlightData[]) => void;
  maxSelections?: number;
}

export interface HotelSelectorProps {
  hotels: HotelData[];
  selectedHotels: HotelData[];
  onSelectionChange: (hotels: HotelData[]) => void;
  maxSelections?: number;
}

// Flight-specific types
export interface FlightLeg {
  departure: {
    city_code: string;
    city_name: string;
    time: string;
  };
  arrival: {
    city_code: string;
    city_name: string;
    time: string;
  };
  duration: string;
  flight_type: 'outbound' | 'return';
}

export interface FlightItineraryProps {
  flight: FlightData;
  showDetails?: boolean;
  compact?: boolean;
}

// Hotel-specific types
export interface HotelRoom {
  type: string;
  description: string;
  price_per_night: number;
  total_price: number;
  currency: string;
  availability: number;
  occupancy_id: string;
}

export interface HotelDetailsProps {
  hotel: HotelData;
  showRooms?: boolean;
  compact?: boolean;
}

// Travel summary types
export interface TravelSummaryProps {
  selectedFlights: FlightData[];
  selectedHotels: HotelData[];
  onGeneratePdf: () => void;
  isGenerating: boolean;
}

// Connection time calculation
export interface ConnectionTimeProps {
  segment1: any;
  segment2: any;
}