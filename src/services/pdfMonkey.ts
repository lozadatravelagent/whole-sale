import { FlightData, PdfMonkeyResponse } from '@/types';

// PdfMonkey API configuration
const PDFMONKEY_API_BASE = 'https://api.pdfmonkey.io/api/v1/documents';
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

    console.log('Generating PDF with data:', JSON.stringify(request, null, 2));

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

    // PdfMonkey returns the document ID immediately, but generation is async
    // We need to check the status or construct the download URL
    const documentUrl = result.download_url || `${PDFMONKEY_API_BASE}/documents/${result.id}/download`;

    return {
      success: true,
      document_url: documentUrl
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
  // Transform flight data to match the template structure
  const selected_flights = flights.map(flight => ({
    airline: {
      code: flight.airline.code,
      name: flight.airline.name
    },
    price: {
      amount: flight.price.amount.toFixed(2),
      currency: flight.price.currency
    },
    adults: flight.adults,
    childrens: flight.childrens,
    departure_date: flight.departure_date,
    return_date: flight.return_date,
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
        destination_city: layover.destination_city,
        destination_code: layover.destination_code,
        waiting_time: layover.waiting_time
      })) || []
    })),
    luggage: flight.luggage || false,
    travel_assistance: flight.travel_assistance || 0,
    transfers: flight.transfers || 0
  }));

  return {
    selected_flights
  };
}

export async function checkPdfStatus(documentId: string): Promise<{
  status: 'pending' | 'processing' | 'success' | 'failure';
  download_url?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${PDFMONKEY_API_BASE}/documents/${documentId}`, {
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

    return {
      status: result.status,
      download_url: result.download_url,
      error: result.error
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