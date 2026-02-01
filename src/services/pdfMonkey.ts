import { FlightData, HotelData, HotelDataWithSelectedRoom, PdfMonkeyResponse } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// PdfMonkey API configuration
const PDFMONKEY_API_BASE = 'https://api.pdfmonkey.io/api/v1/documents';
const PDFMONKEY_SYNC_BASE = 'https://api.pdfmonkey.io/api/v1/documents/sync';

// Default template IDs (fallback when no custom template exists)
// Template files: src/templates/pdf/
const DEFAULT_FLIGHT_TEMPLATE_ID = '67B7F3A5-7BFE-4F52-BE6B-110371CB9376'; // flights-simple.html (single flight)
const DEBUG_TEMPLATE_ID = '67B7F3A5-7BFE-4F52-BE6B-110371CB9376'; // Same ID for now
const DEFAULT_COMBINED_TEMPLATE_ID = '3E8394AC-84D4-4286-A1CD-A12D1AB001D5'; // combined-flight-hotel.html
const DEFAULT_FLIGHTS_TEMPLATE_ID = '30B142BF-1DD9-432D-8261-5287556DC9FC'; // flights-multiple.html (2-4 flights)

// Default template IDs map for cloning
export const DEFAULT_TEMPLATE_IDS = {
  combined: DEFAULT_COMBINED_TEMPLATE_ID,
  flights: DEFAULT_FLIGHT_TEMPLATE_ID,
  flights2: DEFAULT_FLIGHTS_TEMPLATE_ID,
  hotels: DEFAULT_COMBINED_TEMPLATE_ID // Hotels use combined template
} as const;

// Legacy exports for backward compatibility
const FLIGHT_TEMPLATE_ID = DEFAULT_FLIGHT_TEMPLATE_ID;
const COMBINED_TEMPLATE_ID = DEFAULT_COMBINED_TEMPLATE_ID;
const FLIGHTS_TEMPLATE_ID = DEFAULT_FLIGHTS_TEMPLATE_ID;

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

/**
 * Get custom template ID for an agency, with fallback to default
 * @param agencyId - The agency ID to lookup
 * @param templateType - Type of template: 'combined', 'flights', 'flights2', 'hotels'
 * @param defaultTemplateId - Default template ID to use if no custom template exists
 * @returns Promise<string> - Template ID to use
 */
async function getTemplateId(
  agencyId: string | undefined,
  templateType: 'combined' | 'flights' | 'flights2' | 'hotels',
  defaultTemplateId: string
): Promise<string> {
  // If no agency ID provided, use default template
  if (!agencyId) {
    console.log(`ℹ️ [PDF] No agencyId provided, using default ${templateType} template`);
    return defaultTemplateId;
  }

  try {
    // Fetch agency's custom template IDs (with fallback if column doesn't exist)
    const { data: agency, error } = await supabase
      .from('agencies')
      .select('custom_template_ids')
      .eq('id', agencyId)
      .single();

    if (error) {
      console.warn(`⚠️ [PDF] Error fetching agency templates:`, error.message);

      // Check if error is due to missing column
      if (error.message.includes('custom_template_ids') || error.message.includes('column')) {
        console.log(`ℹ️ [PDF] Custom templates column not available, using default ${templateType} template`);
      } else {
        console.log(`ℹ️ [PDF] Database error, falling back to default ${templateType} template`);
      }
      return defaultTemplateId;
    }

    // Check if agency has a custom template for this type
    const customTemplateId = (agency as any)?.custom_template_ids?.[templateType];

    if (customTemplateId) {
      console.log(`✅ [PDF] Using custom ${templateType} template for agency ${agencyId}:`, customTemplateId);
      return customTemplateId;
    } else {
      console.log(`ℹ️ [PDF] No custom ${templateType} template for agency ${agencyId}, using default`);
      return defaultTemplateId;
    }
  } catch (error) {
    console.error(`❌ [PDF] Unexpected error fetching agency template:`, error);
    console.log(`ℹ️ [PDF] Falling back to default ${templateType} template`);
    return defaultTemplateId;
  }
}

// New function for combined travel PDF (flights + hotels)
export async function generateCombinedTravelPdf(
  selectedFlights: FlightData[],
  selectedHotels: HotelData[] | HotelDataWithSelectedRoom[],
  agencyId?: string,
  isPriceModified?: boolean
): Promise<PdfMonkeyResponse> {
  try {
    if (selectedFlights.length === 0 && selectedHotels.length === 0) {
      return {
        success: false,
        error: 'No flights or hotels selected for PDF generation'
      };
    }

    // Prepare combined data for PdfMonkey template
    const pdfData = prepareCombinedPdfData(selectedFlights, selectedHotels, isPriceModified);

    console.log('🔍 SELECTED FLIGHTS:', selectedFlights.length);
    console.log('🔍 SELECTED HOTELS:', selectedHotels.length);
    console.log('🔍 PREPARED COMBINED PDF DATA:', JSON.stringify(pdfData, null, 2));

    // Get template ID (custom or default)
    const templateId = await getTemplateId(agencyId, 'combined', DEFAULT_COMBINED_TEMPLATE_ID);

    // Use combined template ID
    const request = {
      document: {
        document_template_id: templateId,
        status: "pending",
        payload: pdfData,
        meta: {
          _filename: `viaje-combinado-cotizacion-${Date.now()}.pdf`,
          generated_by: "wholesale-connect-ai",
          agency_id: agencyId || 'default'
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

export async function generateFlightPdf(selectedFlights: FlightData[], agencyId?: string): Promise<PdfMonkeyResponse> {
  try {
    if (selectedFlights.length === 0) {
      return {
        success: false,
        error: 'No flights selected for PDF generation'
      };
    }

    if (selectedFlights.length > 4) {
      return {
        success: false,
        error: 'Maximum 4 flights can be selected for PDF generation'
      };
    }

    // Analyze flight structure to determine appropriate template
    const flightAnalysis = analyzeFlightStructure(selectedFlights);
    const templateType = flightAnalysis.templateType;
    const defaultTemplateId = flightAnalysis.defaultTemplateId;
    const templateName = flightAnalysis.templateName;

    // Get template ID (custom or default)
    const templateId = await getTemplateId(agencyId, templateType, defaultTemplateId);

    console.log(`🎯 Using template: ${templateName} (${templateId}) for ${selectedFlights.length} flight(s)`);

    // Prepare data for PdfMonkey template
    const pdfData = preparePdfData(selectedFlights);

    console.log('🔍 RAW SELECTED FLIGHTS:', JSON.stringify(selectedFlights, null, 2));
    console.log('🔍 PREPARED PDF DATA:', JSON.stringify(pdfData, null, 2));

    // Correct PdfMonkey API structure
    const request = {
      document: {
        document_template_id: templateId,
        status: "pending",
        payload: pdfData,
        meta: {
          _filename: `vuelos-cotizacion-${Date.now()}.pdf`,
          generated_by: "wholesale-connect-ai",
          agency_id: agencyId || 'default'
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

/**
 * Analyze flight structure to determine the appropriate template
 */
function analyzeFlightStructure(flights: FlightData[]): {
  templateType: 'flights' | 'flights2';
  defaultTemplateId: string;
  templateName: string;
  description: string;
} {
  console.log('🔍 ANALYZING FLIGHT STRUCTURE:', {
    flights_count: flights.length,
    flights_details: flights.map(f => ({
      departure_date: f.departure_date,
      return_date: f.return_date,
      legs_count: f.legs?.length || 0,
      is_round_trip: f.departure_date !== f.return_date,
      has_multiple_legs: (f.legs?.length || 0) > 1
    }))
  });

  // Case 1: Multiple separate flights (2 or more different flight objects)
  // When user selects 2+ flights, ALWAYS use flights2 template regardless of dates/routes
  if (flights.length >= 2) {
    console.log(`📋 MULTIPLE FLIGHTS detected (${flights.length} flights) - using flights2 template`);
    return {
      templateType: 'flights2',
      defaultTemplateId: DEFAULT_FLIGHTS_TEMPLATE_ID,
      templateName: 'flights-multiple.html',
      description: `Multiple flights (${flights.length} flight options selected)`
    };
  }

  // Case 2: Single flight analysis
  if (flights.length === 1) {
    const flight = flights[0];
    const isRoundTrip = flight.departure_date !== flight.return_date;
    const hasMultipleLegs = (flight.legs?.length || 0) > 1;

    // Check if it's a complex multi-leg journey (like EZE → GRU → DOH → SVO)
    const isComplexJourney = hasMultipleLegs && flight.legs.some(leg =>
      leg.departure.city_code !== flight.legs[0].departure.city_code ||
      leg.arrival.city_code !== flight.legs[flight.legs.length - 1].arrival.city_code
    );

    // Check if flight has layovers (escalas)
    const hasLayovers = flight.legs.some(leg => leg.layovers && leg.layovers.length > 0);

    console.log('🔍 Flight complexity analysis:', {
      isRoundTrip,
      hasMultipleLegs,
      isComplexJourney,
      hasLayovers,
      legs_count: flight.legs?.length || 0,
      total_layovers: flight.legs?.reduce((sum, leg) => sum + (leg.layovers?.length || 0), 0) || 0
    });

    // Check if this is a complex flight that needs flights2 template
    const isComplexFlight = isRoundTrip || hasMultipleLegs || hasLayovers || isComplexJourney;

    if (isComplexFlight) {
      console.log('📋 COMPLEX SINGLE FLIGHT detected:', {
        isRoundTrip,
        hasMultipleLegs,
        isComplexJourney,
        hasLayovers,
        legs: flight.legs?.length || 0,
        totalLayovers: flight.legs?.reduce((sum, leg) => sum + (leg.layovers?.length || 0), 0) || 0
      });

      return {
        templateType: 'flights2',
        defaultTemplateId: DEFAULT_FLIGHTS_TEMPLATE_ID, // Use flights-multiple.html template for complex flights
        templateName: 'flights-multiple.html',
        description: 'Complex single flight (round trip, multi-leg, or with layovers)'
      };
    }

    console.log('📋 SIMPLE SINGLE FLIGHT detected');
    return {
      templateType: 'flights',
      defaultTemplateId: DEFAULT_FLIGHT_TEMPLATE_ID,
      templateName: 'flights-simple.html',
      description: 'Simple single flight (one-way or simple round trip)'
    };
  }

  // Default fallback
  console.log('📋 DEFAULT TEMPLATE (fallback)');
  return {
    templateType: 'flights',
    defaultTemplateId: DEFAULT_FLIGHT_TEMPLATE_ID,
    templateName: 'flights-simple.html',
    description: 'Default template (fallback)'
  };
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

    // Process legs and ensure we have proper outbound/return structure
    const processedLegs = flight.legs.map((leg, legIndex) => {
      console.log(`🔧 Processing leg ${legIndex + 1}:`, {
        departure: leg.departure,
        arrival: leg.arrival,
        layovers: leg.layovers?.length || 0,
        flight_type: leg.flight_type
      });

      return {
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
        flight_type: leg.flight_type || (legIndex === 0 ? 'outbound' : 'return'),
        layovers: leg.layovers?.map(layover => {
          console.log('🔧 Processing layover:', layover);
          return {
            waiting_time: layover.waiting_time,
            destination_city: layover.destination_city,
            destination_code: layover.destination_code
          };
        }) || []
      };
    });

    // Ensure we have at least 2 legs for round trip flights
    // If we only have 1 leg but have a return_date, create a placeholder return leg
    let finalLegs = processedLegs;
    if (processedLegs.length === 1 && flight.return_date && flight.return_date !== flight.departure_date) {
      console.log(`🔄 Creating return leg for flight ${index + 1} - original leg was outbound only`);

      // Create a return leg by reversing the outbound leg
      const outboundLeg = processedLegs[0];
      const returnLeg = {
        departure: {
          city_code: outboundLeg.arrival.city_code,
          city_name: outboundLeg.arrival.city_name,
          time: outboundLeg.arrival.time // This should be updated with actual return time
        },
        arrival: {
          city_code: outboundLeg.departure.city_code,
          city_name: outboundLeg.departure.city_name,
          time: outboundLeg.departure.time // This should be updated with actual return time
        },
        duration: outboundLeg.duration,
        flight_type: 'return',
        layovers: []
      };

      finalLegs = [outboundLeg, returnLeg];
    }

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
      legs: finalLegs,
      price: {
        amount: formatPriceForTemplate(flight.price.amount),
        currency: flight.price.currency
      },
      // 🏥 ASISTENCIA MÉDICA / SEGURO - Only include if user requested it (for legend in PDF)
      travel_assistance: flight.travel_assistance?.included ? 1 : 0,
      // 🚗 TRASLADOS - Only include if user requested it (for legend in PDF)
      transfers: flight.transfers?.included ? 1 : 0
    };
  });

  console.log('✅ PREPARED SELECTED FLIGHTS:', selected_flights.length, 'flights');

  // Calculate root-level travel_assistance and transfers from any flight
  // (these are used by the template for the INCLUDES box)
  let hasTravelAssistance = false;
  let hasTransfers = false;
  flights.forEach(flight => {
    if (flight.travel_assistance?.included) {
      hasTravelAssistance = true;
    }
    if (flight.transfers?.included) {
      hasTransfers = true;
    }
  });

  // For multiple flights (2-4), use flights-multiple.html template structure
  if (flights.length >= 2) {
    console.log(`🎯 USING FLIGHTS-MULTIPLE.HTML TEMPLATE STRUCTURE - Sending ${flights.length} flights`);

    const multiFlightData = {
      selected_flights: selected_flights,
      // Root-level flags for the INCLUDES box in the template
      travel_assistance: hasTravelAssistance ? 1 : 0,
      transfers: hasTransfers ? 1 : 0
    };

    console.log('🎯 SENDING MULTI-FLIGHT DATA:', {
      template: 'flights-multiple.html',
      flights_count: multiFlightData.selected_flights.length,
      travel_assistance: multiFlightData.travel_assistance,
      transfers: multiFlightData.transfers,
      flights_preview: multiFlightData.selected_flights.map((flight, i) => ({
        index: i,
        airline: flight.airline.name,
        route: flight.legs.length > 0 ? `${flight.legs[0].departure.city_code} → ${flight.legs[0].arrival.city_code}` : 'Unknown route',
        price: `${flight.price.amount} ${flight.price.currency}`,
        legs_count: flight.legs.length
      }))
    });

    return multiFlightData;
  }

  // For single flight, use flights-simple.html template structure (template expects selected_flights array)
  console.log('🎯 USING FLIGHTS-SIMPLE.HTML TEMPLATE STRUCTURE - Sending selected_flights array');

  const singleFlightData = {
    selected_flights: selected_flights,
    // Root-level flags for the INCLUDES box in the template
    travel_assistance: hasTravelAssistance ? 1 : 0,
    transfers: hasTransfers ? 1 : 0
  };

  console.log('🎯 SENDING SINGLE FLIGHT DATA AS ARRAY:', {
    template: 'flights-simple.html',
    flights_count: singleFlightData.selected_flights.length,
    travel_assistance: singleFlightData.travel_assistance,
    transfers: singleFlightData.transfers,
    legs_count: singleFlightData.selected_flights[0].legs.length,
    legs_preview: singleFlightData.selected_flights[0].legs.map((leg, i) => ({
      index: i,
      type: leg.flight_type,
      route: `${leg.departure.city_code} → ${leg.arrival.city_code}`
    }))
  });

  return singleFlightData;
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

// Helper function to convert price to European format (with comma as decimal separator)
// FIXED: Now handles European format string input (1.577,18) correctly
function formatPriceForTemplate(price: number | string): string {
  let numPrice: number;

  if (typeof price === 'string') {
    // Handle European format input (1.577,18 -> 1577.18)
    const cleaned = price
      .replace(/[^\d.,]/g, '')           // Remove currency symbols and spaces
      .replace(/\.(?=.*,)/g, '')         // Remove thousands dots (dots that appear before a comma)
      .replace(',', '.');                 // Convert decimal comma to dot
    numPrice = parseFloat(cleaned);
  } else {
    numPrice = price;
  }

  if (isNaN(numPrice) || numPrice < 0) return '0,00';

  // Round to 2 decimals to avoid floating point issues
  numPrice = Math.round(numPrice * 100) / 100;

  // Convert to European format: 1577.18 -> "1.577,18"
  return numPrice.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Helper function to extract meal plan from room description or hotel data
// Returns: 'all_inclusive' | 'breakfast' | 'half_board' | 'full_board' | 'room_only' | null
// EXPANDED: Added more patterns for meal plan detection
function extractMealPlan(roomDescription?: string, hotelData?: any): string | null {
  const desc = (roomDescription || '').toLowerCase();
  const hotelName = (hotelData?.name || '').toLowerCase();
  const hotelDesc = (hotelData?.description || '').toLowerCase();
  const roomDesc = ((hotelData?.roomDescription) || '').toLowerCase();
  const combinedText = `${desc} ${hotelName} ${hotelDesc} ${roomDesc}`;

  // All Inclusive patterns - EXPANDED
  if (/todo\s*incluid[oa]?|all\s*inclusive|ai\b|ti\b|incluye\s*todo/i.test(combinedText)) {
    return 'all_inclusive';
  }

  // Full Board patterns (pensión completa) - EXPANDED with FAP
  if (/pensión?\s*completa|full\s*board|fb\b|pc\b|fap\b/i.test(combinedText)) {
    return 'full_board';
  }

  // Half Board patterns (media pensión) - EXPANDED with MAP
  if (/media\s*pensión?|half\s*board|hb\b|mp\b|map\b/i.test(combinedText)) {
    return 'half_board';
  }

  // Breakfast patterns (desayuno) - EXPANDED with continental
  if (/desayuno|breakfast|bb\b|bed\s*&?\s*breakfast|continental/i.test(combinedText)) {
    return 'breakfast';
  }

  // Room Only patterns (solo habitación) - EXPANDED with EP
  if (/solo\s*habitación?|room\s*only|ro\b|sin\s*comidas|ep\b/i.test(combinedText)) {
    return 'room_only';
  }

  return null;
}

// Helper function to extract star rating from EUROVIPS category format
// EUROVIPS returns category as "3*", "4*", "5*", "3EST", "H2_5", etc. or text like "Standard"
// Also tries to extract from hotel name if category is empty
// IMPROVED: Added support for H2_5 format (half stars, rounded up)
function extractStars(category: string | undefined, hotelName?: string): string {
  // First try to extract from category
  if (category && category.trim()) {
    // NEW: Handle H2_5 format (2.5 stars, round to 3)
    const halfMatch = category.match(/H(\d+)_5/i);
    if (halfMatch) {
      const stars = String(parseInt(halfMatch[1]) + 1); // Round up half stars
      console.log(`⭐ [EXTRACT STARS] Found half-star format, rounded to "${stars}" from category "${category}"`);
      return stars;
    }

    // Try to match numbers at the start (e.g., "3EST", "3*", "4*")
    const match = category.match(/^(\d+)/);
    if (match) {
      const stars = match[1];
      console.log(`⭐ [EXTRACT STARS] Found stars "${stars}" from category "${category}"`);
      return stars;
    }

    // Also try to match numbers anywhere in the string (fallback)
    const anyMatch = category.match(/(\d+)/);
    if (anyMatch) {
      const stars = anyMatch[1];
      console.log(`⭐ [EXTRACT STARS] Found stars "${stars}" from category "${category}" (anywhere match)`);
      return stars;
    }

    console.log(`⚠️ [EXTRACT STARS] No stars found in category "${category}"`);
  }

  // If category is empty, try to extract from hotel name (some hotels have stars in name)
  if (hotelName) {
    const nameMatch = hotelName.match(/(\d+)\s*(?:estrellas?|stars?|\*)/i);
    if (nameMatch) {
      const stars = nameMatch[1];
      console.log(`⭐ [EXTRACT STARS] Found stars "${stars}" from hotel name "${hotelName}"`);
      return stars;
    }
  }

  // If no stars found, return empty string (don't default to "5")
  console.log(`⚠️ [EXTRACT STARS] No stars found for category: "${category}", hotel: "${hotelName}"`);
  return "";
}

// Function to prepare combined travel data (flights + hotels) for the specific template
function prepareCombinedPdfData(flights: FlightData[], hotels: HotelData[] | HotelDataWithSelectedRoom[], isPriceModified: boolean = false) {
  console.log('🔧 PREPARING COMBINED PDF DATA FOR TEMPLATE');
  console.log('📊 Input:', { flights: flights.length, hotels: hotels.length });

  // Debug: Log hotel categories before processing
  console.log('🏨 [DEBUG] Hotel categories before processing:', hotels.map((h, i) => ({
    index: i + 1,
    name: h.name,
    category: h.category,
    category_type: typeof h.category,
    category_length: h.category?.length || 0
  })));

  // Transform flight data (same structure as before)
  const selected_flights = flights.map((flight, index) => {
    console.log(`🔧 Processing flight ${index + 1}:`, {
      airline: flight.airline,
      price: flight.price,
      dates: { departure: flight.departure_date, return: flight.return_date },
      legs_count: flight.legs?.length || 0,
      has_travel_assistance: !!flight.travel_assistance?.included,
      has_transfers: !!flight.transfers?.included
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
        // Preserve layovers (escalas) for combined PDF generation
        // Support both API format (waiting_time/destination_*) and AI format (duration/airport.*)
        layovers: leg.layovers?.map(layover => ({
          waiting_time: layover.waiting_time || layover.duration || '',
          destination_city: layover.destination_city || layover.airport?.city || '',
          destination_code: layover.destination_code || layover.airport?.code || ''
        })) || []
      })),
      price: {
        amount: formatPriceForTemplate(flight.price.amount), // Formato europeo con comas
        currency: flight.price.currency
      },
      // 🏥 ASISTENCIA MÉDICA / SEGURO - Copy from original flight data
      travel_assistance: flight.travel_assistance?.included ? 1 : 0,
      // 🚗 TRASLADOS - Copy from original flight data
      transfers: flight.transfers?.included ? 1 : 0
    };
  });

  // Transform hotel data to match template expectations (simplified structure)
  const best_hotels = hotels.map((hotel, index) => {
    // Extract stars from category or hotel name
    const extractedStars = extractStars(hotel.category, hotel.name);

    // Build location: combine address and city if both are available
    let location = hotel.city || '';
    if (hotel.address && hotel.address.trim()) {
      // If both address and city exist, combine them
      if (hotel.city && hotel.city.trim()) {
        location = `${hotel.address.trim()}, ${hotel.city.trim()}`;
      } else {
        // If only address exists, use it
        location = hotel.address.trim();
      }
    }

    console.log(`🔧 Processing hotel ${index + 1} for template:`, {
      name: hotel.name,
      category: hotel.category,
      extracted_stars: extractedStars,
      address: hotel.address,
      city: hotel.city,
      location: location,
      nights: hotel.nights,
      rooms_count: hotel.rooms?.length || 0,
      has_selected_room: !!(hotel as HotelDataWithSelectedRoom).selectedRoom
    });

    // Use the selected room if available, otherwise find the cheapest room
    const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
    const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
      room.total_price < cheapest.total_price ? room : cheapest
    );

    console.log(`🏨 Hotel ${hotel.name} room for PDF:`, {
      type: roomToUse.type,
      price_per_night: roomToUse.price_per_night,
      total_price: roomToUse.total_price,
      currency: roomToUse.currency,
      source: hotelWithRoom.selectedRoom ? 'SELECTED_BY_USER' : 'CHEAPEST_FALLBACK'
    });

    // Calculate total price for all nights - total_price is already calculated by EUROVIPS
    const priceForAllNights = roomToUse.total_price;

    console.log(`💰 Hotel ${hotel.name} FINAL CALCULATION:`, {
      hotel_nights: hotel.nights,
      room_price_per_night: roomToUse.price_per_night,
      room_total_price: roomToUse.total_price,
      calculated_price_for_all_nights: priceForAllNights,
      formatted_price_for_template: formatPriceForTemplate(priceForAllNights)
    });

    const hotelForTemplate: any = {
      name: hotel.name,
      stars: extractedStars, // Extract number from EUROVIPS format "3*", "4*", etc. or from hotel name
      location: location || hotel.city || 'Ubicación no especificada', // FIXED: Usar variable 'location' construida arriba
      // FIXED: Múltiples fuentes para roomDescription con prioridad
      roomDescription:
        roomToUse.description ||           // Priority 1: Selected room description
        (hotel as any).roomDescription ||  // Priority 2: Extracted from PDF analysis
        (hotel as any).roomType ||         // Priority 3: Room type from AI extraction
        hotel.description ||               // Priority 4: Hotel-level description
        '',
      price: formatPriceForTemplate(priceForAllNights), // Formato europeo - precio total por todas las noches
      link: `https://wholesale-connect.com/hotel/${hotel.id}` // Placeholder link
    };

    // Preserve mealPlan if available (from AI extraction or PDF analysis)
    if ((hotel as any).mealPlan) {
      hotelForTemplate.mealPlan = (hotel as any).mealPlan;
      console.log(`🍽️ [TEMPLATE] Preserved mealPlan for ${hotel.name}:`, (hotel as any).mealPlan);
    }

    // Preserve optionNumber if available (from AI extraction)
    if ((hotel as any).optionNumber !== undefined) {
      hotelForTemplate.optionNumber = (hotel as any).optionNumber;
      console.log(`🔢 [TEMPLATE] Preserved optionNumber for ${hotel.name}:`, (hotel as any).optionNumber);
    }

    // CRITICAL: Preserve _packageMetadata if it exists (from dual price change)
    if ((hotel as any)._packageMetadata) {
      hotelForTemplate._packageMetadata = (hotel as any)._packageMetadata;
      console.log(`✅ [TEMPLATE] Preserved _packageMetadata for ${hotel.name}:`, (hotel as any)._packageMetadata);
    }

    return hotelForTemplate;
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

  // Detect if this is a hotel-only PDF (no flights)
  const hasFlights = flights.length > 0;

  // Get passenger info: from flight if available, otherwise from hotel's search params
  let adults = 1;
  let childrens = 0;
  let infants = 0;

  if (firstFlight) {
    // Get from flight data (matches the search input)
    adults = firstFlight.adults ?? 1;
    childrens = firstFlight.childrens ?? 0;
    infants = firstFlight.infants ?? 0;
  } else if (firstHotel) {
    // For hotel-only PDFs, use search_adults/search_children from hotel
    // These come from the original search params, not from room capacity
    adults = firstHotel.search_adults ?? 1;
    childrens = firstHotel.search_children ?? 0;
    infants = firstHotel.search_infants ?? 0;

    console.log('👥 [HOTEL-ONLY] Using search params from hotel:', {
      hotel_name: firstHotel.name,
      search_adults: firstHotel.search_adults,
      search_children: firstHotel.search_children,
      search_infants: firstHotel.search_infants,
      final_adults: adults,
      final_children: childrens,
      final_infants: infants
    });
  }

  // Log the final occupancy being used
  console.log('👥 [PDF] Final occupancy for PDF:', {
    source: hasFlights ? 'flight' : 'hotel_search_params',
    adults,
    childrens,
    infants
  });

  // Calculate total price (flights + hotels)
  let totalFlightPrice = 0;
  let totalHotelPrice = 0;

  // Sum all flight prices
  flights.forEach(flight => {
    const flightPrice = typeof flight.price.amount === 'string' ? parseFloat(flight.price.amount) : flight.price.amount;
    totalFlightPrice += flightPrice || 0;
  });

  // Sum all hotel prices (using selected rooms and multiplying by nights)
  hotels.forEach(hotel => {
    const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
    const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
      room.total_price < cheapest.total_price ? room : cheapest
    );

    // Calculate total price: total_price is already calculated by EUROVIPS for all nights
    const priceForAllNights = roomToUse.total_price;

    console.log(`💰 Adding hotel ${hotel.name} price:`, {
      room_type: roomToUse.type,
      price_per_night: roomToUse.price_per_night,
      total_price_from_room: roomToUse.total_price,
      nights: hotel.nights,
      calculated_total: priceForAllNights,
      source: hotelWithRoom.selectedRoom ? 'SELECTED_BY_USER' : 'CHEAPEST_FALLBACK'
    });

    totalHotelPrice += priceForAllNights || 0;
  });

  const totalPrice = totalFlightPrice + totalHotelPrice;
  const currency = firstFlight?.price?.currency || 'USD';

  console.log('💰 PRICE CALCULATION:', {
    totalFlightPrice,
    totalHotelPrice,
    totalPrice,
    currency,
    flights_count: flights.length,
    hotels_count: hotels.length
  });

  // 🏥 Check if any flight includes travel assistance (for legend in PDF)
  let hasTravelAssistance = false;
  flights.forEach(flight => {
    if (flight.travel_assistance?.included) {
      hasTravelAssistance = true;
    }
  });

  // 🚗 Check if any flight includes transfers (for legend in PDF)
  let hasTransfers = false;
  flights.forEach(flight => {
    if (flight.transfers?.included) {
      hasTransfers = true;
    }
  });

  // Note: Total price remains unchanged since transfers and assistance are included in the package
  const grandTotalWithServices = totalPrice;

  // Detect multiple hotels and prepare comparative options
  const hasMultipleHotels = hotels.length >= 2;
  let option1Hotel = null;
  let option2Hotel = null;
  let option3Hotel = null;
  let option1Total = 0;
  let option2Total = 0;
  let option3Total = 0;

  if (hasMultipleHotels) {
    // Check if hotels have package metadata (from pdfProcessor when targetOption is used)
    console.log('🔍 [PDF GENERATION DEBUG] Checking for _packageMetadata in hotels:', best_hotels.map((h: any) => ({
      name: h.name,
      has_packageMetadata: !!h._packageMetadata,
      _packageMetadata: h._packageMetadata
    })));

    const hasPackageMetadata = best_hotels.some((h: any) => h._packageMetadata);
    console.log('🔍 [PDF GENERATION DEBUG] hasPackageMetadata:', hasPackageMetadata);

    if (hasPackageMetadata) {
      console.log('📦 [PDF GENERATION] Using package metadata for option totals');

      // Find hotels by option number
      const option1Data = best_hotels.find((h: any) => h._packageMetadata?.optionNumber === 1);
      const option2Data = best_hotels.find((h: any) => h._packageMetadata?.optionNumber === 2);
      const option3Data = best_hotels.find((h: any) => h._packageMetadata?.optionNumber === 3);

      if (option1Data && option2Data) {
        // Use metadata prices (already calculated in pdfProcessor.ts)
        option1Total = option1Data._packageMetadata.totalPackagePrice;
        option2Total = option2Data._packageMetadata.totalPackagePrice;

        // Extract hotel individual prices from the hotel data structure
        // (not from rooms array which may be outdated after price changes)
        const option1HotelPrice = typeof option1Data.price === 'string'
          ? parseFloat(option1Data.price.replace(/\./g, '').replace(',', '.'))
          : option1Data.price;

        const option2HotelPrice = typeof option2Data.price === 'string'
          ? parseFloat(option2Data.price.replace(/\./g, '').replace(',', '.'))
          : option2Data.price;

        // Prepare hotel data for template (remove "(Opción X)" from names)
        const option1Name = option1Data.name.replace(/\s*\(Opción\s+\d+\)/i, '');
        const option2Name = option2Data.name.replace(/\s*\(Opción\s+\d+\)/i, '');

        option1Hotel = {
          name: option1Name,
          stars: option1Data.stars || extractStars(option1Data.category, option1Name),
          location: option1Data.location || option1Data.city || 'Ubicación no especificada',
          roomDescription: option1Data.roomDescription || '',
          price: formatPriceForTemplate(option1HotelPrice)
        };

        option2Hotel = {
          name: option2Name,
          stars: option2Data.stars || extractStars(option2Data.category, option2Name),
          location: option2Data.location || option2Data.city || 'Ubicación no especificada',
          roomDescription: option2Data.roomDescription || '',
          price: formatPriceForTemplate(option2HotelPrice)
        };

        // Process option 3 if exists
        if (option3Data) {
          option3Total = option3Data._packageMetadata.totalPackagePrice;

          const option3HotelPrice = typeof option3Data.price === 'string'
            ? parseFloat(option3Data.price.replace(/\./g, '').replace(',', '.'))
            : option3Data.price;

          const option3Name = option3Data.name.replace(/\s*\(Opción\s+\d+\)/i, '');
          option3Hotel = {
            name: option3Name,
            stars: option3Data.stars || extractStars(option3Data.category, option3Name),
            location: option3Data.location || option3Data.city || 'Ubicación no especificada',
            roomDescription: option3Data.roomDescription || '',
            price: formatPriceForTemplate(option3HotelPrice)
          };
        }

        console.log('💰 [PACKAGE OPTIONS] Using metadata pricing:', {
          hotels_count: hotels.length,
          option_1_hotel: option1Hotel.name,
          option_1_hotel_price: option1Hotel.price,
          option_1_total: option1Total,
          option_1_modified: option1Data._packageMetadata.isModified,
          option_2_hotel: option2Hotel.name,
          option_2_hotel_price: option2Hotel.price,
          option_2_total: option2Total,
          option_2_modified: option2Data._packageMetadata.isModified,
          option_3_hotel: option3Hotel?.name || null,
          option_3_hotel_price: option3Hotel?.price || null,
          option_3_total: option3Total || null,
          option_3_modified: option3Data?._packageMetadata?.isModified || null
        });
      }
    } else {
      // ORIGINAL FLOW: Multiple different hotels (not package options)
      console.log('🏨 [PDF GENERATION] Using standard multiple hotels flow');

      // Sort hotels by price (cheapest first)
      const sortedHotels = [...best_hotels].sort((a, b) => {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price.replace(/\./g, '').replace(',', '.')) : a.price;
        const priceB = typeof b.price === 'string' ? parseFloat(b.price.replace(/\./g, '').replace(',', '.')) : b.price;
        return priceA - priceB;
      });

      // Extract cheapest and most expensive
      const cheapestHotel = sortedHotels[0];
      const mostExpensiveHotel = sortedHotels[sortedHotels.length - 1];

      // Parse hotel prices
      const cheapestPrice = typeof cheapestHotel.price === 'string'
        ? parseFloat(cheapestHotel.price.replace(/\./g, '').replace(',', '.'))
        : cheapestHotel.price;
      const expensivePrice = typeof mostExpensiveHotel.price === 'string'
        ? parseFloat(mostExpensiveHotel.price.replace(/\./g, '').replace(',', '.'))
        : mostExpensiveHotel.price;

      // Calculate totals for each option
      option1Total = totalFlightPrice + cheapestPrice;
      option2Total = totalFlightPrice + expensivePrice;

      // Prepare hotel data for template
      option1Hotel = {
        name: cheapestHotel.name,
        stars: cheapestHotel.stars,
        location: cheapestHotel.city || cheapestHotel.location,
        roomDescription: cheapestHotel.roomDescription || '',
        price: cheapestHotel.price
      };

      option2Hotel = {
        name: mostExpensiveHotel.name,
        stars: mostExpensiveHotel.stars,
        location: mostExpensiveHotel.city || mostExpensiveHotel.location,
        roomDescription: mostExpensiveHotel.roomDescription || '',
        price: mostExpensiveHotel.price
      };

      // Process option 3 if there are 3+ hotels (take middle hotel)
      if (sortedHotels.length >= 3) {
        const middleIndex = Math.floor(sortedHotels.length / 2);
        const middleHotel = sortedHotels[middleIndex];

        const middlePrice = typeof middleHotel.price === 'string'
          ? parseFloat(middleHotel.price.replace(/\./g, '').replace(',', '.'))
          : middleHotel.price;

        option3Total = totalFlightPrice + middlePrice;

        option3Hotel = {
          name: middleHotel.name,
          stars: middleHotel.stars,
          location: middleHotel.city || middleHotel.location,
          roomDescription: middleHotel.roomDescription || '',
          price: middleHotel.price
        };
      }

      console.log('💰 MULTIPLE HOTELS PRICING:', {
        hotels_count: hotels.length,
        cheapest_hotel: cheapestHotel.name,
        cheapest_price: cheapestPrice,
        expensive_hotel: mostExpensiveHotel.name,
        expensive_price: expensivePrice,
        middle_hotel: option3Hotel?.name || null,
        middle_price: option3Hotel?.price || null,
        flight_price: totalFlightPrice,
        option_1_total: option1Total,
        option_2_total: option2Total,
        option_3_total: option3Total || null
      });
    }
  }

  // Extract hotel destination for hotel-only PDFs
  const hotelDestination = firstHotel?.city || firstHotel?.address?.split(',')[0] || 'Destino';

  // Extract meal plan from first hotel's room description
  let mealPlan: string | null = null;
  if (firstHotel) {
    const hotelWithRoom = firstHotel as HotelDataWithSelectedRoom;
    const roomToCheck = hotelWithRoom.selectedRoom || firstHotel.rooms?.[0];
    mealPlan = extractMealPlan(roomToCheck?.description, firstHotel);
    console.log('🍽️ [MEAL PLAN] Extracted:', {
      roomDescription: roomToCheck?.description,
      hotelName: firstHotel.name,
      detectedMealPlan: mealPlan
    });
  }

  // Template-specific data structure (OBJETO DIRECTO, no array)
  const template_data = {
    // Core flight data (as expected by template)
    selected_flights,

    // Core hotel data (as expected by template)
    best_hotels,

    // ✈️ HOTEL-ONLY MODE SUPPORT - Flag to hide flight sections
    has_flights: hasFlights,

    // 🏨 Hotel destination for hotel-only PDFs
    hotel_destination: hotelDestination,

    // Template-specific variables
    checkin,
    checkout,
    adults,
    childrens,
    infants,

    // Total pricing (transfers and assistance are included in package price)
    total_price: formatPriceForTemplate(grandTotalWithServices),
    total_currency: currency,
    flight_price: formatPriceForTemplate(totalFlightPrice),
    hotel_price: formatPriceForTemplate(totalHotelPrice),

    // 🏥 ASISTENCIA MÉDICA / SEGURO - Boolean flag for legend in PDF (1 = included, 0 = not included)
    travel_assistance: hasTravelAssistance ? 1 : 0,

    // 🚗 TRASLADOS - Boolean flag for legend in PDF (1 = included, 0 = not included)
    transfers: hasTransfers ? 1 : 0,

    // 🏨 MULTI-HOTEL SUPPORT - Comparative options
    has_multiple_hotels: hasMultipleHotels,
    option_1_hotel: option1Hotel,
    option_1_total: hasMultipleHotels ? formatPriceForTemplate(option1Total) : null,
    option_2_hotel: option2Hotel,
    option_2_total: hasMultipleHotels ? formatPriceForTemplate(option2Total) : null,
    option_3_hotel: option3Hotel,
    option_3_total: option3Hotel ? formatPriceForTemplate(option3Total) : null,

    // 🔄 PRICE MODIFICATION FLAG - Hide hotel prices when regenerating PDF with new price
    is_price_modified: isPriceModified,

    // 🍽️ MEAL PLAN - For "INCLUYE" section in PDF
    meal_plan: mealPlan
  };

  console.log('✅ PREPARED TEMPLATE DATA:', {
    is_array: Array.isArray(template_data),
    has_flights: template_data.has_flights,
    hotel_only_mode: !template_data.has_flights,
    selected_flights: template_data.selected_flights.length,
    best_hotels: template_data.best_hotels.length,
    hotel_destination: template_data.hotel_destination,
    checkin: template_data.checkin,
    checkout: template_data.checkout,
    adults: template_data.adults,
    childrens: template_data.childrens,
    infants: template_data.infants,
    total_price: template_data.total_price,
    total_currency: template_data.total_currency,
    flight_price: template_data.flight_price,
    hotel_price: template_data.hotel_price
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
      stars: hotel.stars,
      location: hotel.location,
      has_link: !!hotel.link
    });
  }

  // Debug template data structure
  console.log('🔍 TEMPLATE STRUCTURE DEBUG:', {
    structure: 'OBJECT_FORMAT',
    has_selected_flights: !!template_data.selected_flights,
    has_best_hotels: !!template_data.best_hotels,
    checkin: template_data.checkin,
    checkout: template_data.checkout,
    adults: template_data.adults,
    childrens: template_data.childrens,
    travel_assistance: template_data.travel_assistance,
    transfers: template_data.transfers,
    total_with_services: template_data.total_price
  });

  // Log services summary for debugging
  if (hasTravelAssistance || hasTransfers) {
    console.log('🎯 [SERVICES] Additional services legends will be shown in PDF:');
    if (hasTravelAssistance) {
      console.log(`   🏥 Travel Assistance: INCLUDED (legend will be displayed in PDF)`);
    }
    if (hasTransfers) {
      console.log(`   🚗 Transfers: INCLUDED (legend will be displayed in PDF)`);
    }
    console.log(`   ℹ️ Note: Services are included in the package price, no additional cost`);
  }

  // 🔍 DEBUG: Log individual flights with their services
  console.log('🔍 [DEBUG] Selected flights services status:');
  template_data.selected_flights.forEach((flight: any, idx: number) => {
    console.log(`   Flight ${idx + 1}: travel_assistance=${flight.travel_assistance}, transfers=${flight.transfers}`);
  });

  return template_data;
}

// Helper to extract document ID from PdfMonkey URL
export function extractDocumentId(url: string): string | null {
  const match = url.match(/\/documents\/([^/]+)/);
  return match ? match[1] : null;
}