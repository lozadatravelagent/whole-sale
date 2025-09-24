import { FlightData, FlightLeg, AirportInfo } from '@/types';

// Configuration for LOZADA WebService (same as hotelSearch.ts)
const WS_CONFIG = {
  url: import.meta.env.DEV ? '/api/airfare' : 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap',
  username: 'LOZADAWS',
  password: '.LOZAWS23.',
  agency: '20350',
  currency: 'USD'
};

export interface AirfareSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
}

// Get available airline list from WebService  
export async function getAirlineList(): Promise<Array<{ code: string, name: string }>> {

  try {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <getAirlineList xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${WS_CONFIG.username}</id>
        <clave>${WS_CONFIG.password}</clave>
      </pos>
    </getAirlineList>
  </soap:Body>
</soap:Envelope>`;

    console.log('📝 Airline List SOAP Request:', soapRequest);

    const response = await fetch(WS_CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'getAirlineList',
        'Accept': 'text/xml, application/xml, application/soap+xml'
      },
      body: soapRequest,
      mode: import.meta.env.DEV ? 'cors' : 'no-cors'
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return [];
    }

    const xmlResponse = await response.text();
    console.log('📝 Airline List SOAP Response:', xmlResponse.substring(0, 1000));

    // Parse the XML response to extract airline codes and names
    const airlines = parseAirlineListResponse(xmlResponse);

    return airlines;
  } catch (error) {
    console.error('❌ Error getting airline list:', error);
    return [];
  }
}

function parseAirlineListResponse(xmlResponse: string): Array<{ code: string, name: string }> {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return [];
    }

    const airlines: Array<{ code: string, name: string }> = [];

    // Look for airline elements 
    const airlineElements = xmlDoc.querySelectorAll('Airline, airline, AirlineInfo, airlineinfo');

    airlineElements.forEach(airlineEl => {
      const code = airlineEl.getAttribute('code') || airlineEl.getAttribute('Code') || '';
      const name = airlineEl.textContent?.trim() || airlineEl.getAttribute('name') || '';

      if (code && name) {
        airlines.push({ code, name });
      }
    });

    return airlines;
  } catch (error) {
    console.error('❌ Error parsing airline list response:', error);
    return [];
  }
}

function validateAndFormatDate(dateStr: string): string {
  if (!dateStr) {
    console.warn('⚠️ Empty date provided, using default');
    return new Date().toISOString().split('T')[0];
  }

  // Check if already in YYYY-MM-DD format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateStr)) {
    return dateStr;
  }

  // Try to parse and convert other formats
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn(`⚠️ Invalid date: ${dateStr}, using default`);
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('❌ Date parsing error:', error);
    return new Date().toISOString().split('T')[0];
  }
}

async function getCityCodeForFlight(cityName: string): Promise<string> {
  try {
    // Import the getCountryList function from hotelSearch to reuse the same city codes
    const { getCountryList } = await import('./hotelSearch');
    const countries = await getCountryList();

    // Validate that countries is an array and has data
    if (!Array.isArray(countries) || countries.length === 0) {
      // Fallback to static airport mapping if WebService fails
      const FALLBACK_AIRPORT_CODES: Record<string, string> = {
        // Spain
        'madrid': 'MAD',
        'barcelona': 'BCN',
        'valencia': 'VLC',
        'sevilla': 'SVQ',
        'bilbao': 'BIO',
        'malaga': 'AGP',
        // Argentina
        'buenos aires': 'EZE',
        'buenos aires aeropuerto': 'EZE',
        'ezeiza': 'EZE',
        'jorge newbery': 'AEP',
        'aeroparque': 'AEP',
        'cordoba': 'COR',
        'mendoza': 'MDZ',
        'bariloche': 'BRC',
        'ushuaia': 'USH',
        // Brazil
        'sao paulo': 'GRU',
        'sÃ£o paulo': 'GRU',
        'rio de janeiro': 'GIG',
        'brasilia': 'BSB',
        'salvador': 'SSA',
        'recife': 'REC',
        'fortaleza': 'FOR',
        'belo horizonte': 'CNF',
        'porto alegre': 'POA',
        // Mexico
        'ciudad de mexico': 'MEX',
        'mexico city': 'MEX',
        'cancun': 'CUN',
        'guadalajara': 'GDL',
        'monterrey': 'MTY',
        'puerto vallarta': 'PVR',
        'acapulco': 'ACA',
        'tijuana': 'TIJ',
        // Chile
        'santiago': 'SCL',
        'valparaiso': 'SCL',
        // Peru
        'lima': 'LIM',
        'cusco': 'CUZ',
        'arequipa': 'AQP',
        // Colombia
        'bogota': 'BOG',
        'medellin': 'MDE',
        'cartagena': 'CTG',
        'cali': 'CLO',
        'barranquilla': 'BAQ',
        // Europe
        'paris': 'CDG',
        'londres': 'LHR',
        'london': 'LHR',
        'roma': 'FCO',
        'rome': 'FCO',
        'amsterdam': 'AMS',
        'berlin': 'BER',
        'frankfurt': 'FRA',
        'munich': 'MUC',
        'zurich': 'ZUR',
        'viena': 'VIE',
        'vienna': 'VIE',
        'milan': 'MXP',
        'lisboa': 'LIS',
        'lisbon': 'LIS',
        // USA
        'nueva york': 'JFK',
        'new york': 'JFK',
        'miami': 'MIA',
        'los angeles': 'LAX',
        'chicago': 'ORD',
        'las vegas': 'LAS',
        'orlando': 'MCO',
        'boston': 'BOS',
        'san francisco': 'SFO',
        'washington': 'DCA'
      };

      const city = cityName.toLowerCase().trim();
      return FALLBACK_AIRPORT_CODES[city] || city.substring(0, 3).toUpperCase();
    }

    // Search for the city in the WebService response (reuse hotel logic)
    const cityLower = cityName.toLowerCase().trim();

    // Try exact match first
    let foundCountry = countries.find(country =>
      country.name.toLowerCase() === cityLower
    );

    // If not found, try partial match
    if (!foundCountry) {
      foundCountry = countries.find(country =>
        country.name.toLowerCase().includes(cityLower) ||
        cityLower.includes(country.name.toLowerCase())
      );
    }

    if (foundCountry) {
      return foundCountry.code;
    }

    // If still not found, use first 3 letters as fallback
    return cityName.substring(0, 3).toUpperCase();

  } catch (error) {
    console.error('❌ Error getting city code for flight:', error);
    return cityName.substring(0, 3).toUpperCase();
  }
}

export async function searchAirFares(params: AirfareSearchParams): Promise<FlightData[]> {

  try {
    // Use Edge Function in production, proxy in development
    const isProduction = !import.meta.env.DEV;

    if (isProduction) {
      // Use Supabase Edge Function
      try {
        console.log('🚀 Starting flight search via Edge Function...');
        console.log('📥 Original params from chat:', JSON.stringify(params, null, 2));
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

        console.log('🔑 Using hardcoded SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
        console.log('🌐 Final Edge Function URL:', WS_CONFIG.url);

        const originCode = await getCityCodeForFlight(params.origin);
        const destinationCode = await getCityCodeForFlight(params.destination);

        console.log('🗺️ Resolved city codes - Origin:', originCode, 'Destination:', destinationCode);

        // Validate and format dates
        const departureDate = validateAndFormatDate(params.departureDate);
        const returnDate = params.returnDate ? validateAndFormatDate(params.returnDate) : undefined;

        console.log(`✈️ REQUEST - Origin: ${params.origin} -> ${originCode}, Destination: ${params.destination} -> ${destinationCode}, Dates: ${departureDate} to ${returnDate || 'One-way'}, Adults: ${params.adults || 1}, Children: ${params.children || 0}`);

        const requestPayload = {
          action: 'searchFlights',
          data: {
            originCode,
            destinationCode,
            departureDate,
            returnDate,
            adults: params.adults || 1,
            children: params.children || 0
          }
        };

        console.log('📦 Edge Function request payload:', JSON.stringify(requestPayload, null, 2));

        const response = await fetch(WS_CONFIG.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
          console.error(`❌ Flights Edge Function HTTP Error: ${response.status} ${response.statusText}`);

          // Try to read error response body
          try {
            const errorBody = await response.text();
            console.error('❌ Error response body:', errorBody);
          } catch (e) {
            console.error('❌ Could not read error response body');
          }
          return [];
        }

        const responseText = await response.text();
        console.log('📥 Flights Edge Function raw response length:', responseText.length);
        console.log('📥 Flights Edge Function raw response (first 500 chars):', responseText.substring(0, 500));

        let result;
        try {
          result = JSON.parse(responseText);
          console.log('✅ Parsed Edge Function response:', {
            success: result.success,
            resultsCount: result.results?.length || 0,
            provider: result.provider,
            timestamp: result.timestamp,
            hasError: !!result.error
          });
        } catch (parseError) {
          console.error('❌ Flights Edge Function returned non-JSON response:', responseText.substring(0, 500));
          console.error('❌ Parse error:', parseError);
          return [];
        }

        if (result.success) {
          console.log(`✈️ RESPONSE - Found ${result.results?.length || 0} flights`);
          if (result.results?.length > 0) {
            console.log('✈️ Sample flight:', JSON.stringify(result.results[0], null, 2));
          }
          return result.results;
        } else {
          console.error('❌ Flights Edge Function error:', result.error);
          return [];
        }
      } catch (error) {
        console.error('Flights search failed:', error);
        return [];
      }
    } else {
      // Use direct SOAP request in development (via proxy)
      const soapRequest = await buildAirfareSearchRequest(params);
      console.log('📝 SOAP Request:', soapRequest);

      const response = await fetch(WS_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'searchAirFares',
          'Accept': 'text/xml, application/xml, application/soap+xml'
        },
        body: soapRequest,
        mode: 'cors'
      });

      if (!response.ok) {
        // Try to read the error response
        try {
          const errorText = await response.text();
          console.error('📝 Error Response Body:', errorText);
        } catch (e) {
          console.error('❌ Could not read error response body');
        }

        // If WebService is not accessible, return empty array instead of throwing
        return [];
      }

      const xmlResponse = await response.text();
      console.log('📝 SOAP Response:', xmlResponse.substring(0, 1000));

      // Parse XML response
      const flights = parseAirfareSearchResponse(xmlResponse, params);

      return flights;
    }
  } catch (error) {
    console.error('❌ Error searching flights:', error);

    // Return empty array instead of throwing to avoid breaking the chat
    return [];
  }
}

async function buildAirfareSearchRequest(params: AirfareSearchParams): Promise<string> {
  const { origin, destination, departureDate, returnDate, adults = 1, children = 0 } = params;

  // Get correct airport codes from WebService country list or fallback
  const originCode = await getCityCodeForFlight(origin);
  const destinationCode = await getCityCodeForFlight(destination);

  // Build request according to EUROVIPS documentation
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <searchAirFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <originLocationCode code="${originCode}" xmlns="" />
      <destinationLocationCode code="${destinationCode}" xmlns="" />
      <departureDateTime xmlns="">${departureDate}</departureDateTime>
      ${returnDate ? `<returnDateTime xmlns="">${returnDate}</returnDateTime>` : ''}
      <adultCount xmlns="">${adults}</adultCount>
      <childCount xmlns="">${children}</childCount>
      <pos xmlns="">
        <id>${WS_CONFIG.username}</id>
        <clave>${WS_CONFIG.password}</clave>
      </pos>
      <currency xmlns="">${WS_CONFIG.currency}</currency>
    </searchAirFaresRQ1>
  </soap:Body>
</soap:Envelope>`;
}

function parseAirfareSearchResponse(xmlResponse: string, params: AirfareSearchParams): FlightData[] {

  try {
    // Create XML parser using DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      throw new Error('Failed to parse XML response');
    }

    const flights: FlightData[] = [];

    // Check for result code first
    const resultElement = xmlDoc.querySelector('resultado');
    if (resultElement) {
      const codigo = getTextContent(resultElement, 'codigo');
      const texto = getTextContent(resultElement, 'texto');

      // codigo = "0" means communication success, but check texto for business errors
      if (codigo !== '0') {
        return [];
      }

      // If texto has content, it's usually an error message
      if (texto && (texto.includes('Error de consumer') || texto.includes('No existe Código Homólogo'))) {
        return [];
      }
    }

    // Look for flight elements in response
    // Response structure: ArrayOfAirFare1 -> AirFares
    const flightElements = xmlDoc.querySelectorAll('ArrayOfAirFare1 AirFares, AirFares');

    flightElements.forEach((flightEl, index) => {
      try {
        const flight = parseAirfareElement(flightEl, params, index);
        if (flight) {
          flights.push(flight);
        }
      } catch (error) {

      }
    });

    return flights;
  } catch (error) {
    console.error('❌ Error parsing XML response:', error);
    return [];
  }
}

function parseAirfareElement(flightEl: Element, params: AirfareSearchParams, index: number): FlightData | null {
  try {
    // Extract flight data according to WebService documentation structure
    const uniqueId = flightEl.getAttribute('UniqueId') || `flight_${Date.now()}_${index}`;
    const airlineCode = getTextContent(flightEl, 'AirlineCode') || 'XX';
    const airlineName = getTextContent(flightEl, 'AirlineName') || 'Unknown Airline';

    // Extract pricing information
    const totalPrice = parseFloat(getTextContent(flightEl, 'TotalFare, TotalPrice') || '0');
    const currency = getTextContent(flightEl, 'Currency') || WS_CONFIG.currency;

    if (totalPrice <= 0) {
      return null;
    }

    // Parse flight legs
    const legs: FlightLeg[] = [];

    // Outbound flight
    const outboundLeg = parseFlightLeg(flightEl, 'outbound', params.origin, params.destination, params.departureDate);
    if (outboundLeg) {
      legs.push(outboundLeg);
    }

    // Return flight if dates are provided
    if (params.returnDate) {
      const returnLeg = parseFlightLeg(flightEl, 'return', params.destination, params.origin, params.returnDate);
      if (returnLeg) {
        legs.push(returnLeg);
      }
    }

    if (legs.length === 0) {
      return null;
    }

    const flight: FlightData = {
      id: `flight_${uniqueId}`,
      airline: {
        code: airlineCode,
        name: airlineName
      },
      price: {
        amount: totalPrice,
        currency: currency
      },
      adults: params.adults || 1,
      childrens: params.children || 0,
      departure_date: params.departureDate,
      return_date: params.returnDate,
      legs,
      luggage: false,
      travel_assistance: 0,
      transfers: 0
    };

    return flight;
  } catch (error) {
    console.error('❌ Error parsing flight element:', error);
    return null;
  }
}

function parseFlightLeg(flightEl: Element, type: 'outbound' | 'return', origin: string, destination: string, date: string): FlightLeg | null {
  try {
    // Extract flight leg information
    const departureTime = getTextContent(flightEl, `${type}DepartureTime, DepartureTime`) || '00:00';
    const arrivalTime = getTextContent(flightEl, `${type}ArrivalTime, ArrivalTime`) || '00:00';
    const duration = getTextContent(flightEl, `${type}Duration, Duration`) || '0h 0m';

    const leg: FlightLeg = {
      departure: {
        city_code: origin.substring(0, 3).toUpperCase(),
        city_name: origin,
        time: departureTime
      },
      arrival: {
        city_code: destination.substring(0, 3).toUpperCase(),
        city_name: destination,
        time: arrivalTime
      },
      duration: duration,
      flight_type: type,
      layovers: [] // Could be extracted from Stops elements if available
    };

    return leg;
  } catch (error) {
    console.error(`❌ Error parsing ${type} flight leg:`, error);
    return null;
  }
}

function getTextContent(element: Element, selectors: string): string {
  const selectorList = selectors.split(', ');

  for (const selector of selectorList) {
    const found = element.querySelector(selector);
    if (found && found.textContent?.trim()) {
      return found.textContent.trim();
    }
  }

  return '';
}

// Test function to verify WebService connectivity
export async function testAirfareWebService(): Promise<boolean> {
  console.log('🧪 Testing airfare WebService connectivity...');

  try {
    // First test getAirlineList
    console.log('🧪 Testing getAirlineList first...');
    const airlines = await getAirlineList();
    console.log('✅ getAirlineList returned:', airlines.length, 'entries');

    const testParams: AirfareSearchParams = {
      origin: 'Buenos Aires',
      destination: 'Madrid',
      departureDate: new Date().toISOString().split('T')[0],
      returnDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // 7 days later
      adults: 1
    };

    const flights = await searchAirFares(testParams);
    console.log(`✈️ RESPONSE - Found ${flights.length} flights`);
    return true;
  } catch (error) {
    console.error('❌ WebService test failed:', error);
    return false;
  }
}