import { HotelData, HotelRoom, HotelSearchParams } from '@/types';

// Configuration for LOZADA WebService
const WS_CONFIG = {
  url: import.meta.env.DEV ? '/api/hotel' : 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap',
  username: 'LOZADAWS',
  password: '.LOZAWS23.',
  agency: '20350',
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
          countryListCache = result.results;
          return result.results;
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

async function getCityCode(cityName: string): Promise<string> {
  try {
    // Get the country list first
    const countries = await getCountryList();

    if (countries.length === 0) {
      // Fallback to static mapping if WebService fails
      const FALLBACK_CITY_CODES: Record<string, string> = {
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
        'buenos aires': 'BUE',
        'buenos aires aeropuerto': 'EZE',
        'ezeiza': 'EZE',
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
        'londres': 'LON',
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

      const city = cityName.toLowerCase().trim();
      return FALLBACK_CITY_CODES[city] || city.substring(0, 3).toUpperCase();
    }

    // Search for the city in the WebService response
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

    // Parse fare information from FareList
    const rooms: HotelRoom[] = [];
    const fareList = hotelEl.querySelector('FareList');

    if (fareList) {
      const fareElements = fareList.querySelectorAll('Fare');

      fareElements.forEach((fareEl, roomIndex) => {
        const room = parseFareElement(fareEl, roomIndex, roomType);
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

    // Calculate nights
    const checkIn = params.dateFrom;
    const checkOut = params.dateTo;
    const nights = calculateNights(checkIn, checkOut);

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

function parseFareElement(fareEl: Element, index: number, defaultRoomType: string): HotelRoom | null {
  try {
    // Parse according to updated documentation: <Fare type="SGL" PassengerType="ADT" Availability="2">
    const fareType = fareEl.getAttribute('type') || 'STD';
    const availability = parseInt(fareEl.getAttribute('Availability') || '1');

    // Map fare type to room description
    const roomTypeMap: Record<string, string> = {
      'SGL': 'Habitación Individual',
      'DWL': 'Habitación Doble',
      'TPL': 'Habitación Triple',
      'CHD': 'Habitación para Niños',
      'INF': 'Habitación con Bebé',
      'STD': 'Habitación Estándar'
    };

    const roomType = roomTypeMap[fareType] || defaultRoomType || `Habitación ${fareType}`;

    // Extract pricing information
    const basePrice = parseFloat(getTextContent(fareEl, 'Base') || '0');
    const taxPrice = parseFloat(getTextContent(fareEl, 'Tax') || '0');
    const totalPrice = basePrice + taxPrice;

    // Get currency from parent FareList element
    const fareList = fareEl.closest('FareList');
    const currency = fareList?.getAttribute('currency') || 'USD';

    const offer = getTextContent(fareEl, 'Offer') || '';
    const description = offer ? `${roomType} - ${offer}` : roomType;

    if (totalPrice <= 0) {
      console.warn(`⚠️ Fare ${fareType} has no valid price`);
      return null;
    }

    return {
      type: roomType,
      description: description,
      price_per_night: totalPrice, // This is typically the total price, not per night
      total_price: totalPrice,
      currency: currency,
      availability: availability,
      occupancy_id: (index + 1).toString(),
      fare_id_broker: fareType
    };
  } catch (error) {
    console.error('❌ Error parsing fare element:', error);
    return null;
  }
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


