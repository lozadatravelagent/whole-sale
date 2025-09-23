// PDF generation service for travel quotes
import { generateFlightPdf, generateCombinedTravelPdf } from '@/services/pdfMonkey';
import type { FlightData, HotelData } from '@/types';

export class PdfService {
  // Generate flight quote PDF
  static async generateFlightQuote(
    selectedFlights: FlightData[],
    customerInfo?: {
      name: string;
      email?: string;
      phone: string;
    }
  ): Promise<string | null> {
    try {
      if (selectedFlights.length === 0) {
        throw new Error('No flights selected for PDF generation');
      }

      const pdfUrl = await generateFlightPdf(selectedFlights);
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
    }
  ): Promise<string | null> {
    try {
      if (selectedFlights.length === 0 && selectedHotels.length === 0) {
        throw new Error('No flights or hotels selected for PDF generation');
      }

      const pdfUrl = await generateCombinedTravelPdf(selectedFlights, selectedHotels);
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
    }
  ): Promise<string | null> {
    try {
      if (selectedHotels.length === 0) {
        throw new Error('No hotels selected for PDF generation');
      }

      // For now, use combined PDF with empty flights array
      const pdfUrl = await generateCombinedTravelPdf([], selectedHotels);
      return pdfUrl;
    } catch (error) {
      console.error('Error generating hotel PDF:', error);
      return null;
    }
  }

  // Calculate total cost for quote
  static calculateQuoteTotal(
    selectedFlights: FlightData[],
    selectedHotels: HotelData[]
  ): {
    flightTotal: number;
    hotelTotal: number;
    grandTotal: number;
    currency: string;
  } {
    const flightTotal = selectedFlights.reduce((sum, flight) => {
      return sum + (parseFloat(flight.price?.replace(/[^\d.]/g, '') || '0') || 0);
    }, 0);

    const hotelTotal = selectedHotels.reduce((sum, hotel) => {
      const bestRoom = hotel.rooms?.[0];
      return sum + (bestRoom?.total_price || 0);
    }, 0);

    const grandTotal = flightTotal + hotelTotal;

    return {
      flightTotal,
      hotelTotal,
      grandTotal,
      currency: 'USD' // Default currency
    };
  }

  // Format quote summary for display
  static formatQuoteSummary(
    selectedFlights: FlightData[],
    selectedHotels: HotelData[]
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

    // Add flights
    selectedFlights.forEach(flight => {
      const price = parseFloat(flight.price?.replace(/[^\d.]/g, '') || '0') || 0;
      let description = 'Vuelo';

      if (flight.segments && flight.segments.length > 0) {
        const firstSegment = flight.segments[0];
        const lastSegment = flight.segments[flight.segments.length - 1];
        description = `Vuelo ${firstSegment.departure.city_code} - ${lastSegment.arrival.city_code}`;
      }

      items.push({
        type: 'flight',
        description,
        price
      });
    });

    // Add hotels
    selectedHotels.forEach(hotel => {
      const bestRoom = hotel.rooms?.[0];
      const price = bestRoom?.total_price || 0;
      const description = `Hotel ${hotel.name}`;

      items.push({
        type: 'hotel',
        description,
        price
      });
    });

    const totals = this.calculateQuoteTotal(selectedFlights, selectedHotels);

    return { items, totals };
  }
}