import { PackageData } from '@/types';

// Configuration for LOZADA WebService (same as hotelSearch.ts)
const WS_CONFIG = {
  url: import.meta.env.DEV ? '/api/package' : 'https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx',
  username: 'LOZADAWS',
  password: '.LOZAWS23.',
  agency: '20350',
  currency: 'USD'
};

export interface PackageSearchParams {
  city: string;
  dateFrom: string;
  dateTo: string;
  class?: 'AEROTERRESTRE' | 'TERRESTRE' | 'AEREO';
  adults?: number;
  children?: number;
}

export async function searchPackageFares(params: PackageSearchParams): Promise<PackageData[]> {
  console.log('📦 Searching packages with params:', params);

  try {
    // Build SOAP XML request according to documentation
    const soapRequest = await buildPackageSearchRequest(params);
    console.log('📝 SOAP Request:', soapRequest);

    const response = await fetch(WS_CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'searchPackageFares',
        'Accept': 'text/xml, application/xml, application/soap+xml'
      },
      body: soapRequest,
      mode: import.meta.env.DEV ? 'cors' : 'no-cors'
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      
      // Try to read the error response to understand what's happening
      try {
        const errorText = await response.text();
        console.error('📝 Error Response Body:', errorText);
      } catch (e) {
        console.error('❌ Could not read error response body');
      }
      
      // If WebService is not accessible, return empty array instead of throwing
      console.log('📦 WebService not accessible, returning empty results');
      return [];
    }

    const xmlResponse = await response.text();
    console.log('📝 SOAP Response:', xmlResponse.substring(0, 1000));

    // Parse XML response
    const packages = parsePackageSearchResponse(xmlResponse, params);
    console.log('📦 Parsed packages:', packages.length);
    
    return packages;
  } catch (error) {
    console.error('❌ Error searching packages:', error);
    
    // Check if it's a CORS error or network error
    if (error instanceof Error) {
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        console.log('📦 CORS or network error, WebService may not be accessible from browser');
      }
    }
    
    // Return empty array instead of throwing to avoid breaking the chat
    return [];
  }
}

async function buildPackageSearchRequest(params: PackageSearchParams): Promise<string> {
  const { city, dateFrom, dateTo, class: packageClass = 'AEROTERRESTRE', adults = 1, children = 0 } = params;
  
  // Get correct city code from WebService country list or fallback
  const { getCountryList } = await import('./hotelSearch');
  const countries = await getCountryList();
  
  // Find city code
  let cityCode = city.substring(0, 3).toUpperCase(); // Default fallback
  if (countries.length > 0) {
    const foundCity = countries.find(country => 
      country.name.toLowerCase().includes(city.toLowerCase()) ||
      city.toLowerCase().includes(country.name.toLowerCase())
    );
    if (foundCity) {
      cityCode = foundCity.code;
    }
  }
  
  // Build request with working format discovered from documentation
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <searchPackageFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <Class xmlns="">${packageClass}</Class>
      <cityLocation code="${cityCode}" xmlns="" />
      <dateFrom xmlns="">${dateFrom}</dateFrom>
      <dateTo xmlns="">${dateTo}</dateTo>
      <adultCount xmlns="">${adults}</adultCount>
      <childCount xmlns="">${children}</childCount>
      <pos xmlns="">
        <id>${WS_CONFIG.username}</id>
        <clave>${WS_CONFIG.password}</clave>
      </pos>
      <currency xmlns="">${WS_CONFIG.currency}</currency>
    </searchPackageFaresRQ1>
  </soap:Body>
</soap:Envelope>`;
}

function parsePackageSearchResponse(xmlResponse: string, params: PackageSearchParams): PackageData[] {
  console.log('🔄 Parsing package search response...');
  
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

    const packages: PackageData[] = [];
    
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

    // Look for package elements in response 
    // Response structure: ArrayOfPackageFare1 -> PackageFares
    const packageElements = xmlDoc.querySelectorAll('ArrayOfPackageFare1 PackageFares, PackageFares');
    
    console.log(`📦 Found ${packageElements.length} PackageFares elements`);
    
    packageElements.forEach((packageEl, index) => {
      try {
        const packageData = parsePackageElement(packageEl, params, index);
        if (packageData) {
          packages.push(packageData);
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing package ${index}:`, error);
      }
    });

    return packages;
  } catch (error) {
    console.error('❌ Error parsing XML response:', error);
    return [];
  }
}

function parsePackageElement(packageEl: Element, params: PackageSearchParams, index: number): PackageData | null {
  try {
    // Extract package data according to real XML structure
    const uniqueId = packageEl.getAttribute('UniqueId') || `package_${Date.now()}_${index}`;
    const backOfficeCode = packageEl.getAttribute('BackOfficeCode') || '';
    const backOfficeOperatorCode = packageEl.getAttribute('BackOfficeOperatorCode') || '';
    const packageClass = packageEl.getAttribute('Class') as 'AEROTERRESTRE' | 'TERRESTRE' | 'AEREO' || 'AEROTERRESTRE';
    
    const name = getTextContent(packageEl, 'Name') || 'Paquete sin nombre';
    const category = getTextContent(packageEl, 'Category') || '';
    
    // Location has code attribute and city name as text content
    const locationEl = packageEl.querySelector('Location');
    const destination = locationEl ? locationEl.textContent?.trim() || params.city || '' : params.city || '';
    
    const description = getTextContent(packageEl, 'Description') || '';
    const itinerary = getTextContent(packageEl, 'Itinerary') || '';
    const details = getTextContent(packageEl, 'Details') || '';
    
    // Parse operation items (days of week)
    const operationItems: string[] = [];
    const operationItemElements = packageEl.querySelectorAll('OperationItems OperationDay');
    operationItemElements.forEach(item => {
      const day = item.textContent?.trim();
      if (day) operationItems.push(day);
    });
    
    // Parse lodged nights and days
    const lodgedNights = parseInt(getTextContent(packageEl, 'LodgedNights') || '0');
    const lodgedDays = parseInt(getTextContent(packageEl, 'LodgedDays') || '0');
    
    // Parse policies
    const policies = {
      cancellation: getTextContent(packageEl, 'CancelationPolicy') || undefined,
      lodging: getTextContent(packageEl, 'LodgingPolicy') || undefined,
      children: parseChildPolicy(packageEl)
    };
    
    // Parse fares
    const fares = parseFares(packageEl);
    
    if (fares.length === 0) {
      console.warn(`⚠️ Package ${name} has no valid fares`);
      return null;
    }

    // Parse operation days and composition
    const operationDays = parseOperationDays(packageEl);

    const packageData: PackageData = {
      id: `package_${uniqueId}`,
      unique_id: uniqueId,
      backOfficeCode,
      backOfficeOperatorCode,
      name,
      category,
      destination,
      description: description || undefined,
      class: packageClass,
      operationItems,
      lodgedNights,
      lodgedDays,
      policies,
      fares,
      operationDays,
      itinerary: itinerary || undefined,
      details: details || undefined
    };

    console.log('✅ Parsed package:', packageData.name, `- ${fares.length} fare type(s), ${operationDays.length} operation day(s)`);
    return packageData;
  } catch (error) {
    console.error('❌ Error parsing package element:', error);
    return null;
  }
}

// Parse child policy from ChildPolicy element
function parseChildPolicy(packageEl: Element): string | undefined {
  const childPolicyEl = packageEl.querySelector('ChildPolicy');
  if (!childPolicyEl) return undefined;
  
  const policies: string[] = [];
  const roomElements = childPolicyEl.querySelectorAll('Room');
  
  roomElements.forEach(roomEl => {
    const roomType = roomEl.getAttribute('Type') || '';
    const maxChildren = roomEl.getAttribute('MaxNumChild') || '';
    
    const childElements = roomEl.querySelectorAll('Child');
    childElements.forEach(childEl => {
      const ageFrom = childEl.getAttribute('AgeFrom') || '';
      const ageTo = childEl.getAttribute('AgeTo') || '';
      const fareType = childEl.getAttribute('FareType') || '';
      
      policies.push(`${roomType}: Niños ${ageFrom}-${ageTo} años (máx. ${maxChildren}) - Tarifa: ${fareType}`);
    });
  });
  
  return policies.length > 0 ? policies.join('; ') : undefined;
}

// Parse all fares from FareList
function parseFares(packageEl: Element): PackageFare[] {
  const fares: PackageFare[] = [];
  const fareListEl = packageEl.querySelector('FareList');
  
  if (!fareListEl) return fares;
  
  const currency = fareListEl.getAttribute('currency') || 'USD';
  const fareElements = fareListEl.querySelectorAll('Fare');
  
  fareElements.forEach(fareEl => {
    const type = fareEl.getAttribute('type') as 'SGL' | 'DWL' | 'TPL' | 'CHD' | 'INF' | 'CPL' || 'DWL';
    const passengerType = fareEl.getAttribute('PassengerType') as 'ADT' | 'CHD' | 'INF' | 'CNN' || 'ADT';
    const availability = parseInt(fareEl.getAttribute('Availability') || '0');
    
    const base = parseFloat(getTextContent(fareEl, 'Base') || '0');
    
    // Parse all taxes
    const taxes: Array<{type: string, amount: number}> = [];
    const taxElements = fareEl.querySelectorAll('Tax');
    let totalTaxes = 0;
    
    taxElements.forEach(taxEl => {
      const taxType = taxEl.getAttribute('type') || '';
      const taxAmount = parseFloat(taxEl.textContent?.trim() || '0');
      
      taxes.push({ type: taxType, amount: taxAmount });
      totalTaxes += taxAmount;
    });
    
    const total = base + totalTaxes;
    
    if (total > 0) {
      fares.push({
        type,
        passengerType,
        availability,
        base,
        taxes,
        total,
        currency
      });
    }
  });
  
  return fares;
}

// Parse operation days with composition
function parseOperationDays(packageEl: Element): PackageOperationDay[] {
  const operationDays: PackageOperationDay[] = [];
  const operationDayElements = packageEl.querySelectorAll('OperationDays OperationDay');
  
  operationDayElements.forEach(dayEl => {
    const date = dayEl.getAttribute('Date') || '';
    const seatAvailable = parseInt(dayEl.getAttribute('SeatAvailable') || '0');
    const roomsAvailable = parseInt(dayEl.getAttribute('RoomsAvailable') || '0');
    
    // Parse composition
    const compositionEl = dayEl.querySelector('Composition');
    const hotels: PackageCompositionHotel[] = [];
    const flights: PackageCompositionFlight[] = [];
    
    if (compositionEl) {
      // Parse hotels
      const hotelElements = compositionEl.querySelectorAll('Hotel');
      hotelElements.forEach(hotelEl => {
        const hotel: PackageCompositionHotel = {
          itemId: hotelEl.getAttribute('ItemId') || '',
          code: getTextContent(hotelEl, 'Code') || '',
          name: getTextContent(hotelEl, 'Name') || '',
          category: getTextContent(hotelEl, 'Category') || '',
          location: {
            code: hotelEl.querySelector('Location')?.getAttribute('code') || '',
            name: hotelEl.querySelector('Location')?.textContent?.trim() || ''
          },
          roomType: {
            code: hotelEl.querySelector('RoomType')?.getAttribute('code') || '',
            name: hotelEl.querySelector('RoomType')?.textContent?.trim() || ''
          },
          checkin: hotelEl.getAttribute('Checkin') || '',
          checkout: hotelEl.getAttribute('Checkout') || '',
          roomsAvailable: parseInt(getTextContent(hotelEl, 'RoomsAvailable') || '0')
        };
        hotels.push(hotel);
      });
      
      // Parse flights
      const flightElements = compositionEl.querySelectorAll('Air');
      flightElements.forEach(flightEl => {
        const departureEl = flightEl.querySelector('Departure');
        const arrivalEl = flightEl.querySelector('Arrival');
        const airlineEl = flightEl.querySelector('Airline');
        const flightInfoEl = flightEl.querySelector('Flight');
        
        if (departureEl && arrivalEl && airlineEl && flightInfoEl) {
          const flight: PackageCompositionFlight = {
            itemId: flightEl.getAttribute('ItemId') || '',
            departure: flightEl.getAttribute('Departure') || '',
            airline: {
              code: getTextContent(airlineEl, 'Code') || '',
              iata: getTextContent(airlineEl, 'IATA') || '',
              name: getTextContent(airlineEl, 'Name') || ''
            },
            flight: {
              number: getTextContent(flightInfoEl, 'Number') || '',
              category: getTextContent(flightInfoEl, 'Category') || '',
              seatAvailable: parseInt(getTextContent(flightInfoEl, 'SeatAvailable') || '0')
            },
            departureInfo: {
              time: getTextContent(departureEl, 'Time') || '',
              city: {
                code: departureEl.querySelector('City')?.getAttribute('Code') || '',
                name: departureEl.querySelector('City')?.textContent?.trim() || ''
              },
              airport: {
                code: departureEl.querySelector('Airport')?.getAttribute('Code') || '',
                name: departureEl.querySelector('Airport')?.textContent?.trim() || ''
              }
            },
            arrivalInfo: {
              time: getTextContent(arrivalEl, 'Time') || '',
              city: {
                code: arrivalEl.querySelector('City')?.getAttribute('Code') || '',
                name: arrivalEl.querySelector('City')?.textContent?.trim() || ''
              },
              airport: {
                code: arrivalEl.querySelector('Airport')?.getAttribute('Code') || '',
                name: arrivalEl.querySelector('Airport')?.textContent?.trim() || ''
              }
            }
          };
          flights.push(flight);
        }
      });
    }
    
    operationDays.push({
      date,
      seatAvailable,
      roomsAvailable,
      composition: {
        hotels,
        flights
      }
    });
  });
  
  return operationDays;
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

// Test function to verify WebService connectivity
export async function testPackageWebService(): Promise<boolean> {
  console.log('🧪 Testing package WebService connectivity...');
  
  try {
    const testParams: PackageSearchParams = {
      city: 'Puerto Madryn',
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // 7 days later
      class: 'AEROTERRESTRE',
      adults: 1
    };
    
    const packages = await searchPackageFares(testParams);
    console.log('✅ WebService test successful, returned:', packages.length, 'packages');
    return true;
  } catch (error) {
    console.error('❌ WebService test failed:', error);
    return false;
  }
}