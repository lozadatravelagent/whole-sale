import { FlightData, PdfMonkeyResponse } from '@/types';

// PdfMonkey API configuration
const PDFMONKEY_API_BASE = 'https://api.pdfmonkey.io/api/v1/documents';
const PDFMONKEY_SYNC_BASE = 'https://api.pdfmonkey.io/api/v1/documents/sync';
const FLIGHT_TEMPLATE_ID = '67B7F3A5-7BFE-4F52-BE6B-110371CB9376';

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
  
  // Return the data directly at root level for PdfMonkey
  const finalData = {
    selected_flights
  };
  
  console.log('📦 FINAL PDF DATA STRUCTURE:', Object.keys(finalData));
  return finalData;
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

// Helper to extract document ID from PdfMonkey URL
export function extractDocumentId(url: string): string | null {
  const match = url.match(/\/documents\/([^/]+)/);
  return match ? match[1] : null;
}