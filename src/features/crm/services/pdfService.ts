// PDF generation service for travel quotes
import { generateFlightPdf, generateCombinedTravelPdf } from '@/services/pdfMonkey';
import { calculateTotalPrice, generatePriceBreakdown } from './priceCalculator';
import type { FlightData, HotelData, HotelDataWithSelectedRoom } from '@/types';

export class PdfService {
  // Generate flight quote PDF
  static async generateFlightQuote(
    selectedFlights: FlightData[],
    customerInfo?: {
      name: string;
      email?: string;
      phone: string;
    },
    agencyId?: string
  ): Promise<string | null> {
    try {
      if (selectedFlights.length === 0) {
        throw new Error('No flights selected for PDF generation');
      }

      const pdfUrl = await generateFlightPdf(selectedFlights, agencyId);
      return pdfUrl;
    } catch (error) {
      console.error('Error generating flight PDF:', error);
      return null;
    }
  }

  // Generate combined travel quote PDF
  static async generateCombinedQuote(
    selectedFlights: FlightData[],
    selectedHotels: HotelData[],
    customerInfo?: {
      name: string;
      email?: string;
      phone: string;
    },
    agencyId?: string
  ): Promise<string | null> {
    try {
      if (selectedFlights.length === 0 && selectedHotels.length === 0) {
        throw new Error('No flights or hotels selected for PDF generation');
      }

      const pdfUrl = await generateCombinedTravelPdf(selectedFlights, selectedHotels, agencyId);
      return pdfUrl;
    } catch (error) {
      console.error('Error generating combined PDF:', error);
      return null;
    }
  }

  // Generate hotel quote PDF (if needed separately)
  static async generateHotelQuote(
    selectedHotels: HotelData[],
    customerInfo?: {
      name: string;
      email?: string;
      phone: string;
    },
    agencyId?: string
  ): Promise<string | null> {
    try {
      if (selectedHotels.length === 0) {
        throw new Error('No hotels selected for PDF generation');
      }

      // For now, use combined PDF with empty flights array
      const pdfUrl = await generateCombinedTravelPdf([], selectedHotels, agencyId);
      return pdfUrl;
    } catch (error) {
      console.error('Error generating hotel PDF:', error);
      return null;
    }
  }

  // Calculate total cost for quote
  static calculateQuoteTotal(
    selectedFlights: FlightData[],
    selectedHotels: (HotelData | HotelDataWithSelectedRoom)[],
    selectedRooms?: Record<string, string>
  ): {
    flightTotal: number;
    hotelTotal: number;
    grandTotal: number;
    currency: string;
  } {
    const breakdown = calculateTotalPrice(selectedFlights, selectedHotels, selectedRooms);

    return {
      flightTotal: breakdown.flightSubtotal,
      hotelTotal: breakdown.hotelSubtotal,
      grandTotal: breakdown.grandTotal,
      currency: breakdown.currency
    };
  }

  // Format quote summary for display
  static formatQuoteSummary(
    selectedFlights: FlightData[],
    selectedHotels: (HotelData | HotelDataWithSelectedRoom)[],
    selectedRooms?: Record<string, string>
  ): {
    items: Array<{
      type: 'flight' | 'hotel';
      description: string;
      price: number;
    }>;
    totals: {
      flightTotal: number;
      hotelTotal: number;
      grandTotal: number;
      currency: string;
    };
  } {
    const items: Array<{
      type: 'flight' | 'hotel';
      description: string;
      price: number;
    }> = [];

    // Use price calculator for accurate breakdown
    const breakdown = generatePriceBreakdown(selectedFlights, selectedHotels, selectedRooms);

    // Add flights from breakdown
    breakdown.flights.forEach(flightResult => {
      items.push({
        type: 'flight',
        description: `Vuelo ${flightResult.airline}`,
        price: flightResult.total
      });
    });

    // Add hotels from breakdown
    breakdown.hotels.forEach(hotelResult => {
      items.push({
        type: 'hotel',
        description: `Hotel ${hotelResult.hotelName}`,
        price: hotelResult.total
      });
    });

    const totals = this.calculateQuoteTotal(selectedFlights, selectedHotels, selectedRooms);

    return { items, totals };
  }
}