import { FlightData, HotelData, PdfMonkeyResponse } from '@/types';

// PdfMonkey API configuration
const PDFMONKEY_API_BASE = 'https://api.pdfmonkey.io/api/v1/documents';
const PDFMONKEY_SYNC_BASE = 'https://api.pdfmonkey.io/api/v1/documents/sync';
const FLIGHT_TEMPLATE_ID = '67B7F3A5-7BFE-4F52-BE6B-110371CB9376';
const COMBINED_TEMPLATE_ID = '3E8394AC-84D4-4286-A1CD-A12D1AB001D5';

// Get API key from environment variables
const getApiKey = (): string => {
  // Try VITE_ prefixed first (for client-side), then fallback to regular env var
  const apiKey = import.meta.env.VITE_PDFMONKEY_API_KEY || import.meta.env.PDFMONKEY_API_KEY || 'M-t6H2L_yhtxmDEek_76';
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('Using fallback API key:', apiKey === 'M-t6H2L_yhtxmDEek_76');

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('PDFMONKEY_API_KEY not configured. Please add your real API key to your environment variables.');
  }
  return apiKey.trim();
};

// New function for combined travel PDF (flights + hotels)
export async function generateCombinedTravelPdf(
  selectedFlights: FlightData[],
  selectedHotels: HotelData[]
): Promise<PdfMonkeyResponse> {
  try {
    if (selectedFlights.length === 0 && selectedHotels.length === 0) {
      return {
        success: false,
        error: 'No flights or hotels selected for PDF generation'
      };
    }

    // Prepare combined data for PdfMonkey template
    const pdfData = prepareCombinedPdfData(selectedFlights, selectedHotels);

    console.log('🔍 SELECTED FLIGHTS:', selectedFlights.length);
    console.log('🔍 SELECTED HOTELS:', selectedHotels.length);
    console.log('🔍 PREPARED COMBINED PDF DATA:', JSON.stringify(pdfData, null, 2));

    // Use combined template ID
    const request = {
      document: {
        document_template_id: COMBINED_TEMPLATE_ID,
        status: "pending",
        payload: pdfData,
        meta: {
          _filename: `viaje-combinado-cotizacion-${Date.now()}.pdf`,
          generated_by: "wholesale-connect-ai"
        }
      }
    };

    console.log('📄 FULL COMBINED PDF REQUEST:', JSON.stringify(request, null, 2));

    return await generatePdfDocument(request);

  } catch (error) {
    console.error('Error generating combined PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function generateFlightPdf(selectedFlights: FlightData[]): Promise<PdfMonkeyResponse> {
  try {
    if (selectedFlights.length === 0) {
      return {
        success: false,
        error: 'No flights selected for PDF generation'
      };
    }

    if (selectedFlights.length > 2) {
      return {
        success: false,
        error: 'Maximum 2 flights can be selected for PDF generation'
      };
    }

    // Prepare data for PdfMonkey template
    const pdfData = preparePdfData(selectedFlights);

    console.log('🔍 RAW SELECTED FLIGHTS:', JSON.stringify(selectedFlights, null, 2));
    console.log('🔍 PREPARED PDF DATA:', JSON.stringify(pdfData, null, 2));

    // Correct PdfMonkey API structure
    const request = {
      document: {
        document_template_id: FLIGHT_TEMPLATE_ID,
        status: "pending",
        payload: pdfData,
        meta: {
          _filename: `vuelos-cotizacion-${Date.now()}.pdf`,
          generated_by: "wholesale-connect-ai"
        }
      }
    };

    console.log('📄 FULL PDF REQUEST:', JSON.stringify(request, null, 2));

    return await generatePdfDocument(request);

  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

function preparePdfData(flights: FlightData[]) {
  console.log('🔧 PREPARING PDF DATA - Input flights count:', flights.length);

  // Transform flight data to match the template structure exactly
  const selected_flights = flights.map((flight, index) => {
    console.log(`🔧 Processing flight ${index + 1}:`, {
      airline: flight.airline,
      price: flight.price,
      dates: { departure: flight.departure_date, return: flight.return_date },
      legs_count: flight.legs?.length || 0
    });

    return {
      airline: {
        code: flight.airline.code,
        name: flight.airline.name
      },
      departure_date: flight.departure_date,
      return_date: flight.return_date || flight.departure_date,
      luggage: flight.luggage || false,
      adults: flight.adults,
      childrens: flight.childrens,
      legs: flight.legs.map(leg => ({
        departure: {
          city_code: leg.departure.city_code,
          city_name: leg.departure.city_name,
          time: leg.departure.time
        },
        arrival: {
          city_code: leg.arrival.city_code,
          city_name: leg.arrival.city_name,
          time: leg.arrival.time
        },
        duration: leg.duration,
        flight_type: leg.flight_type,
        layovers: leg.layovers?.map(layover => ({
          waiting_time: layover.waiting_time,
          destination_city: layover.destination_city,
          destination_code: layover.destination_code
        })) || []
      })),
      price: {
        amount: flight.price.amount.toFixed(2),
        currency: flight.price.currency
      },
      // Optional fields for template compatibility
      travel_assistance: flight.travel_assistance || 0,
      transfers: flight.transfers || 0
    };
  });

  console.log('✅ PREPARED SELECTED FLIGHTS:', selected_flights.length, 'flights');

  // Since template expects direct access (not in a loop), send first flight's data at root level
  const firstFlight = selected_flights[0];

  const flightData = {
    // Direct flight data for template access
    airline: firstFlight.airline,
    price: firstFlight.price,
    adults: firstFlight.adults,
    childrens: firstFlight.childrens,
    departure_date: firstFlight.departure_date,
    return_date: firstFlight.return_date,
    luggage: firstFlight.luggage,
    legs: firstFlight.legs,
    travel_assistance: firstFlight.travel_assistance,
    transfers: firstFlight.transfers
  };

  console.log('🎯 SENDING FLIGHT DATA AT ROOT LEVEL:', flightData);
  return flightData;
}

export async function checkPdfStatus(documentId: string): Promise<{
  status: 'pending' | 'processing' | 'success' | 'failure';
  download_url?: string;
  error?: string;
}> {
  try {
    // Use document_cards endpoint as shown in documentation
    const response = await fetch(`https://api.pdfmonkey.io/api/v1/document_cards/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${getApiKey()}`
      }
    });

    if (!response.ok) {
      return {
        status: 'failure',
        error: `Status check failed: ${response.status}`
      };
    }

    const result = await response.json();
    const documentCard = result.document_card || result;

    return {
      status: documentCard.status,
      download_url: documentCard.download_url,
      error: documentCard.failure_cause
    };

  } catch (error) {
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Common function to handle PDF document generation
async function generatePdfDocument(request: any): Promise<PdfMonkeyResponse> {
  // Make API call to PdfMonkey
  const response = await fetch(PDFMONKEY_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PdfMonkey API error:', response.status, errorText);

    return {
      success: false,
      error: `PDF generation failed: ${response.status} ${response.statusText}`
    };
  }

  const result = await response.json();
  console.log('PdfMonkey response:', result);

  // Extract document data from response
  const document = result.document;
  if (!document || !document.id) {
    return {
      success: false,
      error: 'No se pudo crear el documento en PdfMonkey'
    };
  }

  const documentId = document.id;
  console.log('Document created with ID:', documentId);

  // Check if PDF is already ready (sometimes happens immediately)
  if (document.status === 'success' && document.download_url) {
    console.log('✅ PDF generated immediately! Download URL:', document.download_url);
    return {
      success: true,
      document_url: document.download_url
    };
  }

  // Wait for the PDF to be ready (max 60 seconds)
  console.log('Waiting for PDF generation to complete...');
  let attempts = 0;
  const maxAttempts = 15; // 60 seconds with 4-second intervals

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    attempts++;

    const statusResponse = await checkPdfStatus(documentId);
    console.log(`PDF status check ${attempts}/${maxAttempts}:`, statusResponse);

    if (statusResponse.status === 'success' && statusResponse.download_url) {
      console.log('✅ PDF ready! Download URL:', statusResponse.download_url);
      return {
        success: true,
        document_url: statusResponse.download_url
      };
    }

    if (statusResponse.status === 'failure') {
      console.log('❌ PDF generation failed:', statusResponse.error);
      return {
        success: false,
        error: statusResponse.error || 'Error generando el PDF'
      };
    }
  }

  // Timeout
  return {
    success: false,
    error: 'El PDF está tardando más de lo esperado. Intenta de nuevo en unos minutos.'
  };
}

// Helper function to safely convert price to clean string
function cleanPriceString(price: number | string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(numPrice) ? '0' : numPrice.toString();
}

// Function to prepare combined travel data (flights + hotels) for the specific template
function prepareCombinedPdfData(flights: FlightData[], hotels: HotelData[]) {
  console.log('🔧 PREPARING COMBINED PDF DATA FOR TEMPLATE');
  console.log('📊 Input:', { flights: flights.length, hotels: hotels.length });

  // Transform flight data (same structure as before)
  const selected_flights = flights.map((flight, index) => {
    console.log(`🔧 Processing flight ${index + 1}:`, {
      airline: flight.airline,
      price: flight.price,
      dates: { departure: flight.departure_date, return: flight.return_date },
      legs_count: flight.legs?.length || 0
    });

    return {
      airline: {
        code: flight.airline.code,
        name: flight.airline.name
      },
      departure_date: flight.departure_date,
      return_date: flight.return_date || flight.departure_date,
      luggage: flight.luggage || false,
      adults: flight.adults,
      childrens: flight.childrens,
      legs: flight.legs.map(leg => ({
        departure: {
          city_code: leg.departure.city_code,
          city_name: leg.departure.city_name,
          time: leg.departure.time
        },
        arrival: {
          city_code: leg.arrival.city_code,
          city_name: leg.arrival.city_name,
          time: leg.arrival.time
        },
        duration: leg.duration,
        flight_type: leg.flight_type
      })),
      price: {
        amount: cleanPriceString(flight.price.amount), // String limpio para el template
        currency: flight.price.currency
      }
    };
  });

  // Transform hotel data to match template expectations
  const best_hotels = hotels.map((hotel, index) => {
    console.log(`🔧 Processing hotel ${index + 1} for template:`, {
      name: hotel.name,
      city: hotel.city,
      nights: hotel.nights,
      rooms_count: hotel.rooms?.length || 0
    });

    // Find the cheapest room for main recommendation
    const cheapestRoom = hotel.rooms.reduce((cheapest, room) =>
      room.total_price < cheapest.total_price ? room : cheapest
    );

    // Create alternatives from other rooms (up to 2 alternatives)
    const otherRooms = hotel.rooms
      .filter(room => room !== cheapestRoom)
      .sort((a, b) => a.total_price - b.total_price)
      .slice(0, 2);

    return {
      name: hotel.name,
      location: hotel.city,
      stars: hotel.category || "4", // Default to 4 stars if no category
      price: cleanPriceString(cheapestRoom.total_price), // String limpio para el template
      currency: cheapestRoom.currency,
      room_type: cheapestRoom.type,
      description: cheapestRoom.description,
      // Add alternatives if available
      alternatives: otherRooms.map(room => ({
        name: `${hotel.name} - ${room.type}`,
        price: cleanPriceString(room.total_price), // String limpio para el template
        currency: room.currency,
        room_type: room.type,
        description: room.description
      }))
    };
  });

  // Extract key dates from first hotel or flight
  const firstHotel = hotels[0];
  const firstFlight = flights[0];

  const checkin = firstHotel?.check_in || firstFlight?.departure_date || new Date().toISOString().split('T')[0];
  const checkout = firstHotel?.check_out || firstFlight?.return_date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

  // Calculate duration in nights (usar Math.floor para evitar redondeos incorrectos)
  const checkinDate = new Date(checkin);
  const checkoutDate = new Date(checkout);
  const nights = Math.floor((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));

  // Get passenger info from first flight
  const adults = firstFlight?.adults || 1;
  const childrens = firstFlight?.childrens || 0;

  // Template-specific data structure
  const template_data = {
    // Core flight data (as expected by template)
    selected_flights,

    // Core hotel data (as expected by template)  
    best_hotels,

    // Template-specific variables
    checkin,
    checkout,
    adults,
    childrens,
    nights,

    // Optional services (can be added later)
    travel_assistance: 0, // Can be set if needed
    transfers: 0,         // Can be set if needed

    // Metadata
    generated_date: new Date().toLocaleDateString('es-ES'),
    generated_time: new Date().toLocaleTimeString('es-ES'),

    // Root level data for template compatibility (from first flight/hotel)
    ...(selected_flights.length > 0 && {
      airline: selected_flights[0].airline,
      departure_date: selected_flights[0].departure_date,
      return_date: selected_flights[0].return_date,
      luggage: selected_flights[0].luggage
    }),

    ...(best_hotels.length > 0 && {
      hotel_name: best_hotels[0].name,
      hotel_location: best_hotels[0].location,
      hotel_stars: best_hotels[0].stars,
      hotel_price: best_hotels[0].price
    })
  };

  console.log('✅ PREPARED TEMPLATE DATA:', {
    selected_flights: template_data.selected_flights.length,
    best_hotels: template_data.best_hotels.length,
    checkin: template_data.checkin,
    checkout: template_data.checkout,
    adults: template_data.adults,
    childrens: template_data.childrens,
    nights: template_data.nights
  });

  // Debug pricing para verificar cálculos
  if (template_data.selected_flights.length > 0) {
    console.log('🔍 FLIGHT PRICE DEBUG:', {
      original_amount: flights[0]?.price?.amount,
      original_type: typeof flights[0]?.price?.amount,
      mapped_amount: template_data.selected_flights[0]?.price?.amount,
      mapped_type: typeof template_data.selected_flights[0]?.price?.amount,
      currency: template_data.selected_flights[0]?.price?.currency
    });
  }

  if (template_data.best_hotels.length > 0) {
    const hotel = template_data.best_hotels[0];
    console.log('🔍 HOTEL PRICE DEBUG:', {
      hotel_name: hotel.name,
      main_price: hotel.price,
      main_price_type: typeof hotel.price,
      currency: hotel.currency,
      alternatives_count: hotel.alternatives?.length || 0,
      alternatives_prices: hotel.alternatives?.map(alt => `${alt.price} ${alt.currency}`) || []
    });
  }

  // Debug template data structure
  console.log('🔍 TEMPLATE STRUCTURE DEBUG:', {
    has_selected_flights: !!template_data.selected_flights,
    has_best_hotels: !!template_data.best_hotels,
    checkin: template_data.checkin,
    checkout: template_data.checkout,
    nights: template_data.nights,
    adults: template_data.adults,
    childrens: template_data.childrens
  });

  return template_data;
}

// Helper to extract document ID from PdfMonkey URL
export function extractDocumentId(url: string): string | null {
  const match = url.match(/\/documents\/([^/]+)/);
  return match ? match[1] : null;
}