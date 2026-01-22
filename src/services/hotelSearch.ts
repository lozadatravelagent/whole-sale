import { HotelData, HotelRoom, HotelSearchParams } from '@/types';
import { getCityCode } from '@/services/cityCodeMapping';

// ===== MAKE BUDGET TYPES =====
export interface MakeBudgetParams {
  fareId: string;           // UniqueId del hotel (ej: "AP|5168-59588")
  fareIdBroker: string;     // FareIdBroker de la habitación seleccionada
  checkinDate: string;      // Fecha check-in YYYY-MM-DD
  checkoutDate: string;     // Fecha check-out YYYY-MM-DD
  occupancies: Array<{
    occupancyId: string;
    passengers: Array<{ type: 'ADT' | 'CHD' | 'INF'; age?: number }>
  }>;
  reference?: string;       // Referencia opcional para tracking
}

export interface MakeBudgetResponse {
  success: boolean;
  budgetId?: string;
  subTotalAmount?: number;  // NETO AGENCIA EXACTO
  totalAmount?: number;
  fareIdInternal?: string;
  currency?: string;
  error?: string;
  errorCode?: string;
  timestamp?: string;
}

// Configuration for LOZADA WebService
const WS_CONFIG = {
  url: import.meta.env.DEV ? '/api/hotel' : 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap',
  username: 'WSLOZADA',
  password: 'ROS.9624+',
  agency: '96175',
  currency: 'USD'
};

// Cache for country/city codes to avoid repeated API calls
let countryListCache: Array<{ code: string, name: string }> | null = null;

// Get available country/city list from WebService
export async function getCountryList(): Promise<Array<{ code: string, name: string }>> {
  // Return cached data if available
  if (countryListCache) {
    return countryListCache;
  }

  try {
    // Use Edge Function in production, proxy in development
    const isProduction = !import.meta.env.DEV;

    let response;
    if (isProduction) {
      // Try Edge Function first, fallback if it fails
      try {
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

        console.log('🔑 Using hardcoded SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
        console.log('🌐 Edge Function URL:', WS_CONFIG.url);

        response = await fetch(WS_CONFIG.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'getCountryList'
          })
        });

        if (!response.ok) {
          console.error(`Edge Function HTTP Error: ${response.status} ${response.statusText}`);
          throw new Error(`Edge Function failed: ${response.status}`);
        }

        const responseText = await response.text();
        console.log('Edge Function raw response:', responseText.substring(0, 200));

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Edge Function returned non-JSON response:', responseText.substring(0, 500));
          throw new Error('Invalid JSON response from Edge Function');
        }

        if (result.success) {
          // result.results is an object with rawResponse and parsedData, we need the parsedData array
          const countries = result.results?.parsedData || [];
          console.log('📊 Parsed countries from Edge Function:', countries.length);
          countryListCache = countries;
          return countries;
        } else {
          console.error('Edge Function business error:', result.error);
          throw new Error(`Edge Function error: ${result.error}`);
        }
      } catch (error) {
        console.error('Edge Function failed:', error);
        return [];
      }
    } else {
      // Use direct SOAP request in development (via proxy)
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <xsstring7 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${WS_CONFIG.username}</id>
        <clave>${WS_CONFIG.password}</clave>
      </pos>
      <dateFrom xmlns="">2025-12-01</dateFrom>
      <dateTo xmlns="">2025-12-31</dateTo>
      <activeFareType xmlns="">HOTEL</activeFareType>
      <activeFareSubtype xmlns=""></activeFareSubtype>
    </xsstring7>
  </soap:Body>
</soap:Envelope>`;

      console.log('📝 Country List SOAP Request:', soapRequest);

      response = await fetch(WS_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'getCountryList',
          'Accept': 'text/xml, application/xml, application/soap+xml'
        },
        body: soapRequest,
        mode: 'cors'
      });

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        return [];
      }

      const xmlResponse = await response.text();
      console.log('📝 Country List SOAP Response:', xmlResponse.substring(0, 1000));

      // Parse the XML response to extract country codes and names
      const countries = parseCountryListResponse(xmlResponse);

      // Cache the result
      countryListCache = countries;

      return countries;
    }
  } catch (error) {
    console.error('❌ Error getting country list:', error);
    return [];
  }
}

function parseCountryListResponse(xmlResponse: string): Array<{ code: string, name: string }> {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return [];
    }

    const results: Array<{ code: string, name: string }> = [];

    // New robust parsing for structure:
    // soap:Envelope > soap:Body > ArrayOfCountryInfo1 > CountryInfos
    //   CountryInfos/Code, CountryInfos/Name, CountryInfos/CityList/City(Code, Name)
    const countryInfoElements = Array.from(xmlDoc.getElementsByTagName('*'))
      .filter(el => el.localName === 'CountryInfos');

    countryInfoElements.forEach((countryInfoEl) => {
      // Collect country (optional)
      const countryCodeEl = Array.from(countryInfoEl.getElementsByTagName('*'))
        .find(e => e.parentElement === countryInfoEl && e.localName === 'Code');
      const countryNameEl = Array.from(countryInfoEl.getElementsByTagName('*'))
        .find(e => e.parentElement === countryInfoEl && e.localName === 'Name');

      const countryCode = countryCodeEl?.textContent?.trim();
      const countryName = countryNameEl?.textContent?.trim();
      if (countryCode && countryName) {
        results.push({ code: countryCode, name: countryName });
      }

      // Collect cities
      const cityElements = Array.from(countryInfoEl.getElementsByTagName('*'))
        .filter(e => e.localName === 'City');

      cityElements.forEach((cityEl) => {
        const cityCodeEl = Array.from(cityEl.children).find(c => c.localName === 'Code');
        const cityNameEl = Array.from(cityEl.children).find(c => c.localName === 'Name');
        const code = cityCodeEl?.textContent?.trim() || '';
        const name = cityNameEl?.textContent?.trim() || '';
        if (code && name) {
          results.push({ code, name });
        }
      });
    });

    // Fallback to previous generic parsing if nothing found
    if (results.length === 0) {
      const fallback: Array<{ code: string, name: string }> = [];
      const genericElements = xmlDoc.querySelectorAll('Country, country, Location, location');
      genericElements.forEach(el => {
        const code = el.getAttribute('code') || el.getAttribute('Code') || '';
        const name = el.textContent?.trim() || el.getAttribute('name') || '';
        if (code && name) fallback.push({ code, name });
      });
      return fallback;
    }

    return results;
  } catch (error) {
    console.error('❌ Error parsing country list response:', error);
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

/*
 * ⚠️ DEPRECATED: Old getCityCode function (replaced by @/services/cityCodeMapping)
 *
 * This function has been replaced by a more efficient system:
 * - Uses eurovips-cities.json (766 cities from EUROVIPS)
 * - O(1) lookup instead of WebService calls
 * - Better error handling and disambiguation
 *
 * Use: import { getCityCode } from '@/services/cityCodeMapping'
 *
 * This old code is kept commented for reference only.
 */

/*
async function getCityCode(cityName: string): Promise<string> {
  try {
    // Define static mapping FIRST for priority lookup
    const STATIC_CITY_CODES: Record<string, string> = {
        // España
        'madrid': 'MAD',
        'barcelona': 'BCN',
        'sevilla': 'SVQ',
        'valencia': 'VLC',
        'bilbao': 'BIO',
        'malaga': 'AGP',
        'palma': 'PMI',
        'palma de mallorca': 'PMI',
        'las palmas': 'LPA',
        'santiago de compostela': 'SCQ',
        'san sebastian': 'EAS',

        // Argentina
        'buenos aires': 'EZE',
        'buenos aires aeropuerto': 'EZE',
        'ezeiza': 'EZE',
        'jorge newbery': 'AEP',
        'aeroparque': 'AEP',
        'cordoba': 'COR',
        'mendoza': 'MDZ',
        'rosario': 'ROS',
        'bariloche': 'BRC',
        'ushuaia': 'USH',
        'salta': 'SLA',
        'iguazu': 'IGR',

        // Mexico
        'cancun': 'CUN',
        'cancún': 'CUN',
        'playa del carmen': 'CZM',
        'playa': 'CZM',
        'cozumel': 'CZM',
        'riviera maya': 'CZM',
        'mexico city': 'MEX',
        'ciudad de mexico': 'MEX',
        'guadalajara': 'GDL',
        'puerto vallarta': 'PVR',
        'acapulco': 'ACA',
        'cabo san lucas': 'SJD',
        'los cabos': 'SJD',
        'merida': 'MID',
        'oaxaca': 'OAX',
        'veracruz': 'VER',

        // República Dominicana
        'punta cana': 'PUJ',
        'santo domingo': 'SDQ',
        'puerto plata': 'POP',

        // Europa
        'viena': 'VIE',
        'vienna': 'VIE',
        'bruselas': 'BRU',
        'brussels': 'BRU',
        'paris': 'PAR',
        'londres': 'LON',
        'london': 'LON',
        'roma': 'ROM',
        'rome': 'ROM',
        'amsterdam': 'AMS',
        'berlin': 'BER',
        'praga': 'PRG',
        'prague': 'PRG',
        'estambul': 'IST',
        'istanbul': 'IST',
        'munich': 'MUC',
        'frankfurt': 'FRA',
        'zurich': 'ZUR',
        'ginebra': 'GVA',
        'geneva': 'GVA',
        'milan': 'MIL',
        'venecia': 'VCE',
        'venice': 'VCE',
        'florencia': 'FLR',
        'florence': 'FLR',
        'napoles': 'NAP',
        'naples': 'NAP',
        'atenas': 'ATH',
        'athens': 'ATH',
        'lisboa': 'LIS',
        'lisbon': 'LIS',
        'oporto': 'OPO',
        'porto': 'OPO',

        // Brasil
        'sao paulo': 'GRU',
        'são paulo': 'GRU',
        'rio de janeiro': 'GIG',
        'brasilia': 'BSB',
        'salvador': 'SSA',
        'belo horizonte': 'CNF',
        'fortaleza': 'FOR',
        'recife': 'REC',
        'manaus': 'MAO',
        'florianopolis': 'FLN',
        'porto alegre': 'POA',
        'curitiba': 'CWB',
        'natal': 'NAT',
        'maceio': 'MCZ',

        // Estados Unidos
        'new york': 'NYC',
        'nueva york': 'NYC',
        'los angeles': 'LAX',
        'chicago': 'CHI',
        'miami': 'MIA',
        'las vegas': 'LAS',
        'san francisco': 'SFO',
        'boston': 'BOS',
        'washington': 'DCA',
        'seattle': 'SEA',
        'orlando': 'MCO',
        'denver': 'DEN',
        'atlanta': 'ATL',
        'philadelphia': 'PHL',
        'phoenix': 'PHX',
        'dallas': 'DFW',
        'houston': 'IAH',

        // Otros destinos populares
        'tokyo': 'TYO',
        'tokio': 'TYO',
        'bangkok': 'BKK',
        'singapur': 'SIN',
        'singapore': 'SIN',
        'dubai': 'DXB',
        'sydney': 'SYD',
        'melbourne': 'MEL',
        'cairo': 'CAI',
        'el cairo': 'CAI',
        'mumbai': 'BOM',
        'delhi': 'DEL',
        'beijing': 'PEK',
        'pekin': 'PEK',
        'shanghai': 'PVG',
        'hong kong': 'HKG',
        'seoul': 'ICN',
        'seul': 'ICN'
      };

    // PRIORITY 1: Check static mapping first (most reliable, fast)
    const cityLower = cityName.toLowerCase().trim();
    if (STATIC_CITY_CODES[cityLower]) {
      console.log(`✅ [STATIC MAP] Found city code: ${cityName} -> ${STATIC_CITY_CODES[cityLower]}`);
      return STATIC_CITY_CODES[cityLower];
    }

    // PRIORITY 2: Get the country list from WebService (may have more cities)
    const countries = await getCountryList();

    if (countries.length === 0) {
      // WebService failed, use first 3 letters as last resort
      const fallbackCode = cityName.substring(0, 3).toUpperCase();
      console.log(`⚠️ [FALLBACK] WebService empty, using: ${cityName} -> ${fallbackCode}`);
      return fallbackCode;
    }

    // PRIORITY 3: Search for the city in the WebService response

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
      console.log(`✅ Found city code: ${cityName} -> ${foundCountry.code}`);
      return foundCountry.code;
    }

    // If still not found, use first 3 letters as fallback
    const fallbackCode = cityName.substring(0, 3).toUpperCase();
    console.log(`⚠️ City not found in WebService, using fallback: ${cityName} -> ${fallbackCode}`);
    return fallbackCode;

  } catch (error) {
    console.error('❌ Error getting city code:', error);
    return cityName.substring(0, 3).toUpperCase();
  }
}
*/

export async function searchHotelFares(params: HotelSearchParams): Promise<HotelData[]> {

  try {
    // Use Edge Function in production, proxy in development
    const isProduction = !import.meta.env.DEV;

    if (isProduction) {
      // Use Supabase Edge Function
      try {
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';
        const cityCode = await getCityCode(params.city || '');

        // Validate and format dates
        const checkinDate = validateAndFormatDate(params.dateFrom);
        const checkoutDate = validateAndFormatDate(params.dateTo);

        console.log(`🏨 REQUEST - City: ${params.city} -> ${cityCode}, Dates: ${checkinDate} to ${checkoutDate}, Adults: ${params.adults || 1}, Children: ${params.children || 0}`);

        const requestData = {
          action: 'searchHotels',
          data: {
            cityCode,
            checkinDate,
            checkoutDate,
            adults: params.adults || 1,
            children: params.children || 0,
            rooms: 1
          }
        };

        console.log('🚀 Hotel search request:', JSON.stringify(requestData, null, 2));

        const response = await fetch(WS_CONFIG.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          console.error(`Edge Function HTTP Error: ${response.status} ${response.statusText}`);
          return [];
        }

        const responseText = await response.text();
        console.log('Hotels Edge Function raw response:', responseText.substring(0, 200));

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Hotels Edge Function returned non-JSON response:', responseText.substring(0, 500));
          return [];
        }

        if (result.success) {
          return result.results;
        } else {
          console.error('Hotels Edge Function error:', result.error);
          return [];
        }
      } catch (error) {
        console.error('Hotels search failed:', error);
        return [];
      }
    } else {
      // Use direct SOAP request in development (via proxy)
      const soapRequest = await buildHotelSearchRequest(params);
      console.log('📝 SOAP Request:', soapRequest);

      const response = await fetch(WS_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'searchHotelFares',
          'Accept': 'text/xml, application/xml, application/soap+xml'
        },
        body: soapRequest,
        mode: 'cors'
      });

      if (!response.ok) {
        // Try to read the error response to understand what's happening
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
      const hotels = parseHotelSearchResponse(xmlResponse, params);

      return hotels;
    }
  } catch (error) {
    console.error('❌ Error searching hotels:', error);

    // Return empty array instead of throwing to avoid breaking the chat
    return [];
  }
}

async function buildHotelSearchRequest(params: HotelSearchParams): Promise<string> {
  const { dateFrom, dateTo, city, hotelName } = params;

  // Get correct city code from WebService country list or fallback
  const cityCode = city ? await getCityCode(city) : 'VIE'; // Default to Vienna which we know works

  // Sanitize hotel name: avoid passing values como "en Madrid" que restringen demasiado la búsqueda
  const lowerCity = (city || '').toLowerCase().trim();
  let nameFilter = (hotelName || '').trim();
  const lowerName = nameFilter.toLowerCase();
  if (
    !nameFilter ||
    lowerName.length < 3 ||
    lowerName === lowerCity ||
    lowerName === `hotel ${lowerCity}` ||
    lowerName.startsWith('en ') ||
    lowerName.includes(lowerCity)
  ) {
    nameFilter = '';
  }

  // Build occupancy based on adults/children/infants (matching production Edge Function)
  const adults = params.adults || 1; // Default to 1 adult
  const children = params.children || 0;
  const infants = params.infants || 0;

  // Create occupants XML
  let occupantsXml = '';
  for (let i = 0; i < adults; i++) {
    occupantsXml += '        <Occupants type="ADT" />\n';
  }
  for (let i = 0; i < children; i++) {
    occupantsXml += '        <Occupants type="CHD" />\n';
  }
  for (let i = 0; i < infants; i++) {
    occupantsXml += '        <Occupants type="INF" Age="1" />\n';
  }

  // Build request with working format discovered from testing
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${cityCode}" xmlns="" />
      <dateFrom xmlns="">${dateFrom}</dateFrom>
      <dateTo xmlns="">${dateTo}</dateTo>
      <name Code="${nameFilter}" xmlns="" />
      <pos xmlns="">
        <id>${WS_CONFIG.username}</id>
        <clave>${WS_CONFIG.password}</clave>
      </pos>
      <currency xmlns="">${WS_CONFIG.currency}</currency>
      <OtherBroker xmlns="">true</OtherBroker>
      <FareTypeSelectionList xmlns="http://www.softur.com.ar/wsbridge/budget.xsd">
        <FareTypeSelection OccupancyId="1">1</FareTypeSelection>
        <Ocuppancy OccupancyId="1">
${occupantsXml}        </Ocuppancy>
      </FareTypeSelectionList>
    </searchHotelFaresRQ1>
  </soap:Body>
</soap:Envelope>`;
}

// Alternative function to test WebService connectivity
export async function testHotelWebService(): Promise<boolean> {
  console.log('🧪 Testing hotel WebService connectivity...');

  try {
    // First test getCountryList to ensure we can get valid city codes
    console.log('🧪 Testing getCountryList first...');
    const countries = await getCountryList();
    console.log('✅ getCountryList returned:', countries.length, 'entries');

    if (countries.length === 0) {
      console.log('⚠️ No countries returned, but continuing with hotel search test...');
    }

    const testParams: HotelSearchParams = {
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      city: 'Buenos Aires'
    };

    const hotels = await searchHotelFares(testParams);
    console.log(`🏨 RESPONSE - Found ${hotels.length} hotels`);
    return true;
  } catch (error) {
    console.error('❌ WebService test failed:', error);
    return false;
  }
}

function parseHotelSearchResponse(xmlResponse: string, params: HotelSearchParams): HotelData[] {
  console.log('🔄 Parsing hotel search response...');

  try {
    // Create a simple XML parser using DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      throw new Error('Failed to parse XML response');
    }

    const hotels: HotelData[] = [];

    // Check for result code first
    const resultElement = xmlDoc.querySelector('resultado');
    if (resultElement) {
      const codigo = getTextContent(resultElement, 'codigo');
      const texto = getTextContent(resultElement, 'texto');

      // codigo = "0" means communication success, but check texto for business errors
      if (codigo !== '0') {
        console.warn('⚠️ WebService communication error - código:', codigo, 'texto:', texto);
        return [];
      }

      // If texto has content, it's usually an error message
      if (texto && (texto.includes('Error de consumer') || texto.includes('No existe Código Homólogo'))) {
        console.warn('⚠️ WebService business error:', texto);
        return [];
      }
    }

    // Look for hotel elements in response 
    // Response structure: ArrayOfHotelFare1 -> HotelFares
    const hotelElements = xmlDoc.querySelectorAll('ArrayOfHotelFare1 HotelFares, HotelFares');

    console.log(`🏨 Found ${hotelElements.length} HotelFares elements`);

    hotelElements.forEach((hotelEl, index) => {
      try {
        const hotel = parseHotelElement(hotelEl, params, index);
        if (hotel) {
          hotels.push(hotel);
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing hotel ${index}:`, error);
      }
    });

    return hotels;
  } catch (error) {
    console.error('❌ Error parsing XML response:', error);
    return [];
  }
}

function parseHotelElement(hotelEl: Element, params: HotelSearchParams, index: number): HotelData | null {
  try {
    // Extract hotel data according to updated documentation structure
    const uniqueId = hotelEl.getAttribute('UniqueId') || `hotel_${Date.now()}_${index}`;
    const name = getTextContent(hotelEl, 'Name') || 'Hotel sin nombre';
    const category = getTextContent(hotelEl, 'Category') || '';

    // Location has code attribute and city name as text content
    const locationEl = hotelEl.querySelector('Location');
    const city = locationEl ? locationEl.textContent?.trim() || params.city || '' : params.city || '';

    const address = getTextContent(hotelEl, 'HotelAddress') || '';
    const phone = getTextContent(hotelEl, 'HotelPhone') || '';
    const roomFeatures = getTextContent(hotelEl, 'RoomFeatures') || '';
    const roomType = getTextContent(hotelEl, 'RoomType') || '';

    // Calculate nights BEFORE parsing fares (needed for price_per_night calculation)
    const checkIn = params.dateFrom;
    const checkOut = params.dateTo;
    const nights = calculateNights(checkIn, checkOut);

    // Parse fare information from FareList
    const rooms: HotelRoom[] = [];
    const fareList = hotelEl.querySelector('FareList');

    if (fareList) {
      const fareElements = fareList.querySelectorAll('Fare');

      fareElements.forEach((fareEl, roomIndex) => {
        // ✅ Pass hotelEl and nights to parseFareElement for correct pricing
        const room = parseFareElement(fareEl, roomIndex, roomType, hotelEl, nights);
        if (room) {
          rooms.push(room);
        }
      });
    }

    // If no fare elements found, try alternative room parsing or create default
    if (rooms.length === 0) {
      // Try parsing with the old room element structure as fallback
      const roomElements = hotelEl.querySelectorAll('Room, Rooms');
      roomElements.forEach((roomEl, roomIndex) => {
        const room = parseRoomElement(roomEl, roomIndex);
        if (room) {
          rooms.push(room);
        }
      });

      // If still no rooms and we have basic room info, create default
      if (rooms.length === 0 && roomType) {
        const defaultRoom: HotelRoom = {
          type: roomType,
          description: roomFeatures || roomType,
          price_per_night: 0,
          total_price: 0,
          currency: 'USD',
          availability: 2,
          occupancy_id: '1'
        };
        rooms.push(defaultRoom);
      }
    }

    if (rooms.length === 0) {
      console.warn(`⚠️ No rooms found for hotel: ${name}`);
      return null;
    }

    const hotel: HotelData = {
      id: `hotel_${uniqueId}`,
      unique_id: uniqueId,
      name,
      category,
      city,
      address,
      phone: phone || undefined,
      description: roomFeatures || undefined,
      images: [], // Could be extracted from Pictures elements if available
      rooms,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      policy_cancellation: getTextContent(hotelEl, 'CancelationPolicy'),
      policy_lodging: getTextContent(hotelEl, 'LodgingPolicy')
    };

    console.log('✅ Parsed hotel:', hotel.name, `- ${rooms.length} room(s)`);
    return hotel;
  } catch (error) {
    console.error('❌ Error parsing hotel element:', error);
    return null;
  }
}

interface AdditionalCostsResult {
  fixedCosts: number;      // XRVA: Cargos fijos (ej: $5 USD)
  percentageCosts: number; // PORC: Porcentaje administrativo (ej: 2.2%)
}

// Constantes de pricing para LOZADA según acuerdo comercial con SOFTUR/Eurovips
const AGENCY_COMMISSION_RATE = 0.15; // 15% comisión agencia
const IVA_RATE = 0.21; // 21% IVA sobre gastos

/**
 * Parse AdditionalCosts from hotel element (AdditionalCostsList)
 *
 * Tipos de costos según documentación SOFTUR/Eurovips:
 * - XRVA: Cargo fijo por reserva (ej: $5 USD) → Se suma directamente
 * - PORC: Porcentaje administrativo (ej: 2.2%) → Se calcula sobre el neto sin comisión
 */
function parseAdditionalCosts(hotelEl: Element): AdditionalCostsResult {
  try {
    let fixedCosts = 0;
    let percentageCosts = 0;
    const costElements = hotelEl.querySelectorAll('AdditionalCostsList AdditionalCost');

    costElements.forEach(costEl => {
      const type = costEl.getAttribute('type') || '';
      const amount = parseFloat(costEl.querySelector('Amount')?.textContent || '0');
      const description = costEl.querySelector('Description')?.textContent || 'Unknown';

      if (amount > 0) {
        if (type === 'PORC') {
          // Porcentaje: se acumula para calcular después sobre el neto
          percentageCosts += amount;
          console.log(`💰 [ADDITIONAL COST - PERCENTAGE] ${amount}% (${description})`);
        } else {
          // XRVA u otros tipos: cargo fijo
          fixedCosts += amount;
          console.log(`💰 [ADDITIONAL COST - FIXED] +$${amount} (${description})`);
        }
      }
    });

    if (fixedCosts > 0 || percentageCosts > 0) {
      console.log(`💰 [TOTAL ADDITIONAL COSTS] Fixed: $${fixedCosts}, Percentage: ${percentageCosts}%`);
    }

    return { fixedCosts, percentageCosts };
  } catch (error) {
    console.error('❌ Error parsing additional costs:', error);
    return { fixedCosts: 0, percentageCosts: 0 };
  }
}

/**
 * Calcula el Neto Agencia según la fórmula de SOFTUR/Eurovips
 *
 * Fórmula:
 * 1. netoSinComision = Base × (1 - 15%)     // Restar comisión de agencia
 * 2. gastoPorcentaje = netoSinComision × PORC%  // Gasto administrativo
 * 3. baseGravada = gastosFijos + gastoPorcentaje
 * 4. iva = baseGravada × 21%
 * 5. netoAgencia = netoSinComision + gastosFijos + gastoPorcentaje + iva
 */
function calculateAgencyNetPrice(
  basePrice: number,
  fixedCosts: number,
  percentageCosts: number
): { netoAgencia: number; breakdown: { bruto: number; comision: number; netoSinComision: number; gastoFijo: number; gastoPorcentaje: number; baseGravada: number; iva: number } } {
  // 1. Calcular neto sin comisión (Base - 15%)
  const comision = basePrice * AGENCY_COMMISSION_RATE;
  const netoSinComision = basePrice - comision;

  // 2. Calcular gasto porcentaje sobre el neto sin comisión
  const gastoPorcentaje = netoSinComision * (percentageCosts / 100);

  // 3. Calcular base gravada (gastos sobre los que se aplica IVA)
  const baseGravada = fixedCosts + gastoPorcentaje;

  // 4. Calcular IVA sobre los gastos
  const iva = baseGravada * IVA_RATE;

  // 5. Calcular neto agencia final
  const netoAgencia = netoSinComision + fixedCosts + gastoPorcentaje + iva;

  return {
    netoAgencia,
    breakdown: {
      bruto: basePrice,
      comision,
      netoSinComision,
      gastoFijo: fixedCosts,
      gastoPorcentaje,
      baseGravada,
      iva
    }
  };
}

function parseFareElement(fareEl: Element, index: number, defaultRoomType: string, hotelEl: Element, nights: number): HotelRoom | null {
  try {
    // Parse according to updated documentation: <Fare type="SGL" PassengerType="ADT" Availability="2">
    const fareType = fareEl.getAttribute('type') || 'STD';
    const availability = parseInt(fareEl.getAttribute('Availability') || '1');

    // ✅ FIX #3: Get the CORRECT FareIdBroker from attribute (not fare type)
    // This is CRITICAL for makeBudget → convertToBooking workflow
    const fareIdBroker = fareEl.getAttribute('FareIdBroker') || fareType;
    console.log(`🔑 [FARE ID BROKER] ${fareIdBroker}`);

    // Extract pricing information from XML
    // IMPORTANTE: <Base> es el Importe Bruto (CommissionablePrice)
    // <Tax> son impuestos adicionales del XML (no se usan en el cálculo del Neto Agencia)
    const basePrice = parseFloat(getTextContent(fareEl, 'Base') || '0');
    const taxPrice = parseFloat(getTextContent(fareEl, 'Tax') || '0');

    // Parse additional costs (XRVA fijo, PORC porcentaje)
    const { fixedCosts, percentageCosts } = parseAdditionalCosts(hotelEl);

    // ✅ Calcular NETO AGENCIA según fórmula SOFTUR/Eurovips:
    // Neto = (Base - 15% comisión) + GastosFijos + GastosPorcentaje + IVA_sobre_gastos
    const { netoAgencia, breakdown } = calculateAgencyNetPrice(basePrice, fixedCosts, percentageCosts);
    const totalPrice = netoAgencia;

    console.log(`💵 [PRICE BREAKDOWN - NETO AGENCIA]`);
    console.log(`   Importe Bruto (Base XML):     ${breakdown.bruto.toFixed(2)}`);
    console.log(`   - Comisión 15%:               -${breakdown.comision.toFixed(2)}`);
    console.log(`   = Neto sin comisión:          ${breakdown.netoSinComision.toFixed(2)}`);
    console.log(`   + Gasto fijo (XRVA):          +${breakdown.gastoFijo.toFixed(2)}`);
    console.log(`   + Gasto admin (${percentageCosts}%):        +${breakdown.gastoPorcentaje.toFixed(2)}`);
    console.log(`   + IVA 21% s/gastos:           +${breakdown.iva.toFixed(2)}`);
    console.log(`   = NETO AGENCIA:               ${netoAgencia.toFixed(2)}`);
    console.log(`   (Tax XML ignorado: ${taxPrice.toFixed(2)})`);

    // Get currency from parent FareList element
    const fareList = fareEl.closest('FareList');
    const currency = fareList?.getAttribute('currency') || 'USD';

    // Get the actual room description
    // For external brokers (EUROVIPS, etc.), the room info is in <Description>
    // For internal BackOffice fares, it may be in <Offer> (for promotions)
    const description = getTextContent(fareEl, 'Description') ||
                        getTextContent(fareEl, 'Offer') ||
                        defaultRoomType || '';

    // Determine room type from the description, not from fare type
    // The fare type (SGL, DWL, etc.) represents passenger type, not room type
    const roomType = extractRoomTypeFromDescription(description, defaultRoomType);

    if (totalPrice <= 0) {
      console.warn(`⚠️ Fare ${fareType} has no valid price`);
      return null;
    }

    // Calcular precio por noche basado en el Neto Agencia
    const pricePerNight = nights > 0 ? totalPrice / nights : totalPrice;
    console.log(`🏷️ [NETO AGENCIA PER NIGHT] ${totalPrice.toFixed(2)} / ${nights} nights = ${pricePerNight.toFixed(2)} per night`);

    // Extract OccupancyId from Fare element for makeBudget
    // Note: OccupancyId in XML is the requested occupancy, not a unique room identifier
    const xmlOccupancyId = fareEl.getAttribute('OccupancyId') || '1';

    // Use index+1 as unique identifier for UI selection
    const uniqueRoomId = (index + 1).toString();

    console.log(`🔑 [FARE] type=${fareType}, uniqueRoomId=${uniqueRoomId}, xmlOccupancyId=${xmlOccupancyId}, FareIdBroker=${fareIdBroker}`);

    return {
      type: roomType,
      description: description,
      price_per_night: pricePerNight, // Neto Agencia por noche
      total_price: totalPrice, // NETO AGENCIA: (Base - 15% comisión) + gastos + IVA
      currency: currency,
      availability: availability,
      occupancy_id: uniqueRoomId,
      xml_occupancy_id: xmlOccupancyId,
      fare_id_broker: fareIdBroker
    };
  } catch (error) {
    console.error('❌ Error parsing fare element:', error);
    return null;
  }
}

// Helper function to extract room type from description
function extractRoomTypeFromDescription(description: string, fallback: string): string {
  if (!description) return fallback || 'Habitación Estándar';

  const desc = description.toLowerCase();

  // Check for specific room types in the description
  // Order matters: check more specific patterns first
  if (desc.includes('apartment three bedroom') || desc.includes('three bedroom')) {
    return 'Apartamento 3 Dormitorios';
  }
  if (desc.includes('apartment two bedroom') || desc.includes('two bedroom')) {
    return 'Apartamento 2 Dormitorios';
  }
  if (desc.includes('apartment one bedroom') || desc.includes('one bedroom')) {
    return 'Apartamento 1 Dormitorio';
  }
  if (desc.includes('apartment')) {
    return 'Apartamento';
  }
  if (desc.includes('junior suite')) {
    return 'Junior Suite';
  }
  if (desc.includes('suite')) {
    return 'Suite';
  }
  if (desc.includes('triple')) {
    return 'Habitación Triple';
  }
  if (desc.includes('cuadruple') || desc.includes('quad')) {
    return 'Habitación Cuádruple';
  }
  if (desc.includes('doble') || desc.includes('double')) {
    return 'Habitación Doble';
  }
  if (desc.includes('individual') || desc.includes('single')) {
    return 'Habitación Individual';
  }
  if (desc.includes('deluxe')) {
    return 'Habitación Deluxe';
  }
  if (desc.includes('superior')) {
    return 'Habitación Superior';
  }
  if (desc.includes('tropical')) {
    return 'Habitación Tropical';
  }

  // If no specific type found, return a generic name based on the description
  return fallback || 'Habitación Estándar';
}

// Keep the old parseRoomElement for backward compatibility (not used now)
function parseRoomElement(roomEl: Element, index: number): HotelRoom | null {
  try {
    const type = getTextContent(roomEl, 'RoomType, Type') || `Habitación ${index + 1}`;
    const description = getTextContent(roomEl, 'Description, RoomDescription') || type;
    const priceText = getTextContent(roomEl, 'Price, TotalPrice, Amount');
    const pricePerNightText = getTextContent(roomEl, 'PricePerNight, NightlyPrice');

    const totalPrice = parseFloat(priceText || '0') || 0;
    const pricePerNight = parseFloat(pricePerNightText || '0') || totalPrice;

    const currency = getTextContent(roomEl, 'Currency') || 'USD';
    const availabilityText = getTextContent(roomEl, 'Availability') || '1';
    const availability = parseInt(availabilityText) || 1;
    const occupancyId = getTextContent(roomEl, 'OccupancyId') || '1';
    const fareIdBroker = getTextContent(roomEl, 'FareIdBroker');

    if (totalPrice <= 0 && pricePerNight <= 0) {
      console.warn(`⚠️ Room ${type} has no valid price`);
      return null;
    }

    return {
      type,
      description,
      price_per_night: pricePerNight,
      total_price: totalPrice,
      currency,
      availability,
      occupancy_id: occupancyId,
      fare_id_broker: fareIdBroker || undefined
    };
  } catch (error) {
    console.error('❌ Error parsing room element:', error);
    return null;
  }
}

function parseDefaultRoom(hotelEl: Element): HotelRoom | null {
  try {
    // Try to extract price from hotel level elements
    const priceText = getTextContent(hotelEl, 'Price, TotalPrice, Amount');
    const totalPrice = parseFloat(priceText || '0') || 0;

    if (totalPrice <= 0) {
      return null;
    }

    return {
      type: 'Habitación Estándar',
      description: 'Habitación Estándar',
      price_per_night: totalPrice,
      total_price: totalPrice,
      currency: 'USD',
      availability: 3,
      occupancy_id: '1'
    };
  } catch (error) {
    console.error('❌ Error parsing default room:', error);
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

function calculateNights(checkIn: string, checkOut: string): number {
  try {
    const dateIn = new Date(checkIn);
    const dateOut = new Date(checkOut);
    const diffTime = dateOut.getTime() - dateIn.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  } catch (error) {
    console.warn('⚠️ Error calculating nights:', error);
    return 1;
  }
}


// ===== MAKE BUDGET - GET EXACT PRICE =====

// Cache for makeBudget results to avoid repeated API calls
const makeBudgetCache = new Map<string, { data: MakeBudgetResponse; timestamp: number }>();
const MAKE_BUDGET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * makeBudget - Obtiene el precio EXACTO (Neto Agencia) de EUROVIPS
 *
 * Este método es CRÍTICO para obtener el precio final exacto que se muestra al cliente.
 * Los precios de searchHotelFares son aproximados (fórmula: Base - 15% + gastos).
 * makeBudget devuelve el precio exacto calculado por EUROVIPS.
 *
 * @param params - Parámetros de la reserva
 * @returns Promise<MakeBudgetResponse> con el precio exacto
 */
export async function makeBudget(params: MakeBudgetParams): Promise<MakeBudgetResponse> {
  console.log('💰 [MAKE_BUDGET] Requesting exact price for:', {
    fareId: params.fareId,
    fareIdBroker: params.fareIdBroker,
    dates: `${params.checkinDate} -> ${params.checkoutDate}`
  });

  // Generate cache key
  const cacheKey = `${params.fareId}|${params.fareIdBroker}|${params.checkinDate}|${params.checkoutDate}`;

  // Check cache first
  const cached = makeBudgetCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < MAKE_BUDGET_CACHE_TTL) {
    console.log('✅ [MAKE_BUDGET] Cache hit for:', cacheKey);
    return cached.data;
  }

  try {
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

    // IMPORTANT: Always use Edge Function for makeBudget (even in dev mode)
    // The dev proxy doesn't handle SOAP conversion for makeBudget
    const EDGE_FUNCTION_URL = 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap';

    const requestData = {
      action: 'makeBudget',
      data: params
    };

    console.log('🚀 [MAKE_BUDGET] Request:', JSON.stringify(requestData, null, 2));

    // Set timeout for makeBudget (35 seconds to allow for Edge Function's 30s internal timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ [MAKE_BUDGET] HTTP Error: ${response.status} ${response.statusText}`);
      return {
        success: false,
        error: `HTTP Error: ${response.status}`
      };
    }

    const result = await response.json();
    console.log('📥 [MAKE_BUDGET] Response:', result);

    if (result.success && result.results) {
      const budgetResult: MakeBudgetResponse = result.results;

      // Cache successful results
      if (budgetResult.success) {
        makeBudgetCache.set(cacheKey, { data: budgetResult, timestamp: Date.now() });
        console.log('💾 [MAKE_BUDGET] Cached result for:', cacheKey);
      }

      return budgetResult;
    } else {
      return {
        success: false,
        error: result.error || 'Unknown error from makeBudget'
      };
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏱️ [MAKE_BUDGET] Request timed out');
      return {
        success: false,
        error: 'La solicitud tardó demasiado. Intente nuevamente.'
      };
    }

    console.error('❌ [MAKE_BUDGET] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error getting exact price'
    };
  }
}

/**
 * Helper function to build passenger list for makeBudget from hotel data
 */
export function buildPassengerList(
  adults: number = 1,
  children: number = 0,
  infants: number = 0,
  childrenAges?: number[]
): Array<{ type: 'ADT' | 'CHD' | 'INF'; age?: number }> {
  const passengers: Array<{ type: 'ADT' | 'CHD' | 'INF'; age?: number }> = [];

  // Add adults
  for (let i = 0; i < adults; i++) {
    passengers.push({ type: 'ADT' });
  }

  // Add children with ages
  for (let i = 0; i < children; i++) {
    const age = childrenAges?.[i] || 8; // Default age 8 if not specified
    passengers.push({ type: 'CHD', age });
  }

  // Add infants
  for (let i = 0; i < infants; i++) {
    passengers.push({ type: 'INF', age: 1 });
  }

  return passengers;
}
