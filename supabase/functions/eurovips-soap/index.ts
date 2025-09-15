import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
class EurovipsSOAPClient {
  baseUrl = 'https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx';
  username = 'LOZADAWS';
  password = '.LOZAWS23.';
  agency = '20350';
  currency = 'USD';
  async makeSOAPRequest(soapBody, soapAction) {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;
    console.log(`📝 SOAP REQUEST [${soapAction}]:`, soapEnvelope.length, 'chars');
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
        'Accept': 'text/xml, application/xml, application/soap+xml'
      },
      body: soapEnvelope
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ SOAP Error ${response.status}:`, errorText);
      throw new Error(`SOAP request failed: ${response.status} ${response.statusText}`);
    }
    const xmlResponse = await response.text();
    console.log(`📥 SOAP RESPONSE [${soapAction}]:`, xmlResponse.length, 'chars');
    return xmlResponse;
  }
  async getCountryList(params: any = {}) {
    // Use dynamic dates: user-provided dates or intelligent fallback
    const today = new Date();
    const threeMonthsLater = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));

    const {
      dateFrom = today.toISOString().split('T')[0],
      dateTo = threeMonthsLater.toISOString().split('T')[0],
      activeFareType = 'HOTEL'
    } = params;

    // ✅ FIJO: Siempre usar TERRESTRE (AEROTERRESTRE no funciona)
    const activeFareSubtype = 'TERRESTRE';

    console.log('🔍 getCountryList called with params:', { dateFrom, dateTo, activeFareType, activeFareSubtype });

    const soapBody = `
    <xsstring7 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <dateFrom xmlns="">${dateFrom}</dateFrom>
      <dateTo xmlns="">${dateTo}</dateTo>
      <activeFareType xmlns="">${activeFareType}</activeFareType>
      <activeFareSubtype xmlns="">${activeFareSubtype}</activeFareSubtype>
    </xsstring7>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'getCountryList');
    console.log('🔍 Raw XML Response length:', xmlResponse.length);
    console.log('🔍 XML Sample (first 500 chars):', xmlResponse.substring(0, 500));
    return {
      rawResponse: xmlResponse,
      parsed: this.parseCountryListResponse(xmlResponse)
    };
  }
  async getAirlineList() {
    const soapBody = `
    <getAirlineList xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
    </getAirlineList>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'getAirlineList');
    return this.parseAirlineListResponse(xmlResponse);
  }
  async searchHotels(params) {
    // Build occupancy based on adults/children
    const adults = params.adults || 1;  // Default to 1 adult
    const children = params.children || 0;

    // Create occupants XML
    let occupantsXml = '';
    for (let i = 0; i < adults; i++) {
      occupantsXml += '      <Occupants type="ADT" />\n';
    }
    for (let i = 0; i < children; i++) {
      occupantsXml += '      <Occupants type="CHD" />\n';
    }

    const soapBody = `
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${params.cityCode}" xmlns="" />
      <dateFrom xmlns="">${params.checkinDate}</dateFrom>
      <dateTo xmlns="">${params.checkoutDate}</dateTo>
      <name xmlns="">${params.hotelName || ''}</name>
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
      <OtherBroker xmlns="">true</OtherBroker>
      <FareTypeSelectionList xmlns="http://www.softur.com.ar/wsbridge/budget.xsd">
        <FareTypeSelection OccupancyId="1">1</FareTypeSelection>
        <Ocuppancy OccupancyId="1">
${occupantsXml}        </Ocuppancy>
      </FareTypeSelectionList>
    </searchHotelFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchHotelFares');
    return this.parseHotelSearchResponse(xmlResponse, params);
  }
  async searchFlights(params) {
    const soapBody = `
    <searchAirFaresRQ1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <departureLocation code="${params.originCode}" xmlns="" />
      <arrivalLocation code="${params.destinationCode}" xmlns="" />
      <dateFrom xmlns="">${params.departureDate}</dateFrom>
      ${params.returnDate ? `<dateTo xmlns="">${params.returnDate}</dateTo>` : ''}
      <airline xmlns="" />
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchAirFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchAirFares');
    return this.parseFlightSearchResponse(xmlResponse, params);
  }
  async searchPackages(params) {
    const soapBody = `
    <searchPackageFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <Class xmlns="">${params.packageClass || 'AEROTERRESTRE'}</Class>
      <cityLocation code="${params.cityCode}" xmlns="" />
      <dateFrom xmlns="">${params.dateFrom}</dateFrom>
      <dateTo xmlns="">${params.dateTo}</dateTo>
      <name xmlns="" />
      <keyword xmlns="" />
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchPackageFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchPackageFares');
    return this.parsePackageSearchResponse(xmlResponse, params);
  }
  async searchServices(params) {
    const soapBody = `
    <searchServiceFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${params.cityCode}" xmlns="" />
      <dateFrom xmlns="">${params.dateFrom}</dateFrom>
      <dateTo xmlns="">${params.dateTo || params.dateFrom}</dateTo>
      <name xmlns="" />
      <type xmlns="">${params.serviceType || '1'}</type>
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchServiceFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchServiceFares');
    return this.parseServiceSearchResponse(xmlResponse, params);
  }
  parseCountryListResponse(xmlResponse) {
    try {
      console.log('🔍 PARSING XML - Starting parseCountryListResponse');
      console.log('🔍 XML Response length:', xmlResponse.length);

      // Find España first to test our regex
      const espanaTest = xmlResponse.includes('ESPAÑA');
      console.log('🔍 Does XML contain ESPAÑA?', espanaTest);

      if (espanaTest) {
        console.log('🔍 España context:', xmlResponse.substring(xmlResponse.indexOf('ESPAÑA') - 100, xmlResponse.indexOf('ESPAÑA') + 100));
      }

      // Simplified pattern - find any Code/Name pairs regardless of context
      // We'll filter countries vs cities in post-processing
      const codeNamePattern = /<Code[^>]*>([A-Z]{2,3})<\/Code>[\s\S]*?<Name[^>]*>([^<]+)<\/Name>/g;
      const matches = [...xmlResponse.matchAll(codeNamePattern)];

      console.log(`🔍 Found ${matches.length} CountryInfos with Code/Name pairs`);

      const results: Array<{ code: string, name: string }> = [];
      const seenCodes = new Set();

      // Create a map to track context - countries appear before cities in CountryInfos blocks
      const contextMap = new Map();

      // First pass: identify all matches and their positions
      for (const match of matches) {
        const code = match[1].trim();
        const name = match[2].trim();
        const position = match.index || 0;

        // Check if this appears within a CountryInfos block
        const beforeMatch = xmlResponse.substring(Math.max(0, position - 500), position);
        const isInCountryBlock = beforeMatch.includes('<CountryInfos');
        const isAfterCountryCode = beforeMatch.match(/<Code[^>]*>([A-Z]{2,3})<\/Code>/g);

        contextMap.set(code, {
          name,
          position,
          isInCountryBlock,
          isAfterCountryCode: !!isAfterCountryCode,
          codeLength: code.length
        });
      }

      // Second pass: filter for likely countries
      for (const [code, info] of contextMap) {
        // Countries are typically:
        // - 2-3 characters
        // - No numbers
        // - First Code in a CountryInfos block (not after another country code)
        // - Not obvious city patterns like XXX with 3 chars + numbers

        const isLikelyCountry = (
          info.codeLength <= 3 &&
          !/\d/.test(code) &&
          !seenCodes.has(code) &&
          // Additional heuristics
          (info.codeLength === 2 || // 2-letter codes are almost always countries
            (info.codeLength === 3 && info.isInCountryBlock)) // 3-letter in country block
        );

        if (isLikelyCountry) {
          console.log(`🔍 Found country: ${code} - ${info.name}`);
          results.push({ code, name: info.name });
          seenCodes.add(code);
        }
      }

      console.log(`🔍 PARSED ${results.length} countries from real XML`);
      console.log('🔍 First 10 countries:', results.slice(0, 10));
      console.log('🔍 España found:', results.find(r => r.name.includes('ESPAÑA') || r.code === 'ES'));

      return results;

    } catch (error) {
      console.error('❌ Error parsing country list response:', error);
      console.error('❌ XML sample (first 1000 chars):', xmlResponse.substring(0, 1000));
      return [];
    }
  }
  parseAirlineListResponse(xmlResponse) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const airlines: Array<{ code: string, name: string }> = [];
      const airlineElements = xmlDoc.querySelectorAll('Airline, airline, AirlineInfo, airlineinfo');
      airlineElements.forEach((airlineEl) => {
        const code = airlineEl.getAttribute('code') || airlineEl.getAttribute('Code') || '';
        const name = airlineEl.textContent?.trim() || airlineEl.getAttribute('name') || '';
        if (code && name) {
          airlines.push({
            code,
            name
          });
        }
      });
      return airlines;
    } catch (error) {
      console.error('❌ Error parsing airline list response:', error);
      return [];
    }
  }
  parseHotelSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const hotels: Array<any> = [];
      const hotelElements = xmlDoc.querySelectorAll('HotelFares');

      console.log(`🔍 Found ${hotelElements.length} hotel elements`);

      hotelElements.forEach((hotelEl, index) => {
        try {
          const hotel = this.parseHotelElement(hotelEl, params, index);
          if (hotel) {
            hotels.push(hotel);
          }
        } catch (error) {
          console.error('❌ Error parsing hotel element:', error);
        }
      });
      // Sort hotels by price (lowest first)
      hotels.sort((a, b) => {
        const priceA = Math.min(...a.rooms.map(room => room.total_price));
        const priceB = Math.min(...b.rooms.map(room => room.total_price));
        return priceA - priceB;
      });

      console.log(`✅ Returning ${hotels.length} EUROVIPS hotels`);
      return hotels;
    } catch (error) {
      console.error('❌ Error parsing hotel search response:', error);
      return [];
    }
  }
  parseFlightSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const flights: Array<any> = [];

      // Try multiple selectors to handle different XML structures
      let flightElements = xmlDoc.querySelectorAll('ArrayOfAirFare1 > AirFares');

      // Fallback to original selectors for backward compatibility
      if (flightElements.length === 0) {
        flightElements = xmlDoc.querySelectorAll('ArrayOfAirFare1 AirFares, AirFares');
      }

      console.log(`🔍 Found ${flightElements.length} flight elements`);

      flightElements.forEach((flightEl, index) => {
        try {
          const flight = this.parseFlightElement(flightEl, params, index);
          if (flight) {
            flights.push(flight);
          }
        } catch (error) {
          console.error('❌ Error parsing flight element:', error);
        }
      });
      return flights;
    } catch (error) {
      console.error('❌ Error parsing flight search response:', error);
      return [];
    }
  }
  parseHotelElement(hotelEl, params, index) {
    try {
      const uniqueId = hotelEl.getAttribute('UniqueId') || `hotel_${Date.now()}_${index}`;
      const hotelName = this.getTextContent(hotelEl, 'Name') || this.getTextContent(hotelEl, 'HotelName') || 'Unknown Hotel';
      const address = this.getTextContent(hotelEl, 'HotelAddress') || this.getTextContent(hotelEl, 'Address') || '';

      // Try to get total price from FareList instead of direct TotalFare
      let totalPrice = 0;
      const fareListEl = hotelEl.querySelector('FareList');
      if (fareListEl) {
        const fareEl = fareListEl.querySelector('Fare');
        if (fareEl) {
          const base = parseFloat(this.getTextContent(fareEl, 'Base') || '0');
          const tax = parseFloat(this.getTextContent(fareEl, 'Tax') || '0');
          totalPrice = base + tax;
        }
      }

      if (totalPrice <= 0) {
        return null;
      }

      // Get currency from FareList or use default
      const currency = fareListEl?.getAttribute('currency') || this.currency;

      // Calculate nights
      const checkIn = new Date(params.checkinDate);
      const checkOut = new Date(params.checkoutDate);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

      // Parse room information from FareList
      const rooms: Array<any> = [];
      if (fareListEl) {
        const fareElements = fareListEl.querySelectorAll('Fare');
        fareElements.forEach(fareEl => {
          const fareType = fareEl.getAttribute('type') || 'Standard';
          const availability = parseInt(fareEl.getAttribute('Availability') || '0');
          const base = parseFloat(this.getTextContent(fareEl, 'Base') || '0');
          const tax = parseFloat(this.getTextContent(fareEl, 'Tax') || '0');
          const roomTotal = base + tax;
          const description = this.getTextContent(fareEl, 'Description') || fareType;

          if (roomTotal > 0) {
            rooms.push({
              type: fareType,
              description: description,
              total_price: roomTotal,
              currency: currency,
              availability: availability // ✅ Disponibilidad real del WebService
            });
          }
        });
      }

      // Fallback if no rooms found
      if (rooms.length === 0) {
        rooms.push({
          type: 'Standard',
          description: 'Standard Room',
          total_price: totalPrice,
          currency: currency,
          availability: 0 // Unknown availability
        });
      }

      return {
        id: `hotel_${uniqueId}`,
        name: hotelName,
        category: this.getTextContent(hotelEl, 'Category, HotelCategory') || 'Standard',
        city: this.getTextContent(hotelEl, 'City, Location') || params.cityCode || '',
        address: address,
        phone: this.getTextContent(hotelEl, 'Phone, Telephone') || '',
        check_in: params.checkinDate,   // ✅ Nombre correcto
        check_out: params.checkoutDate, // ✅ Nombre correcto
        nights: nights,
        rooms: rooms,                   // ✅ Array de habitaciones
        policy_cancellation: this.getTextContent(hotelEl, 'CancellationPolicy') || '',
        policy_lodging: this.getTextContent(hotelEl, 'LodgingPolicy') || '',
        adults: params.adults || 1,
        children: params.children || 0,
        provider: 'EUROVIPS'
      };
    } catch (error) {
      console.error('❌ Error parsing hotel element:', error);
      return null;
    }
  }
  parseFlightElement(flightEl, params, index) {
    try {
      const uniqueId = flightEl.getAttribute('UniqueId') || `flight_${Date.now()}_${index}`;

      // Handle both XML structures for airline info
      let airlineCode = this.getTextContent(flightEl, 'AirlineCode') || '';
      let airlineName = this.getTextContent(flightEl, 'AirlineName') || '';

      // EUROVIPS structure: MarketingAirline with code attribute
      if (!airlineCode || !airlineName) {
        const marketingAirlineEl = flightEl.querySelector('MarketingAirline');
        if (marketingAirlineEl) {
          airlineCode = marketingAirlineEl.getAttribute('code') || airlineCode || 'XX';
          airlineName = marketingAirlineEl.textContent?.trim() || airlineName || 'Unknown Airline';
        }
      }

      // Default fallbacks
      airlineCode = airlineCode || 'XX';
      airlineName = airlineName || 'Unknown Airline';

      // Handle different price structures
      let totalPrice = parseFloat(this.getTextContent(flightEl, 'TotalFare, TotalPrice') || '0');
      let currency = this.getTextContent(flightEl, 'Currency') || this.currency;

      // EUROVIPS structure: calculate from FareList
      if (totalPrice <= 0) {
        const fareListEl = flightEl.querySelector('FareList');
        if (fareListEl) {
          currency = fareListEl.getAttribute('currency') || currency;
          // Get ADT (Adult) fare as main price
          const adultFareEl = fareListEl.querySelector('Fare[type="ADT"]');
          if (adultFareEl) {
            const base = parseFloat(this.getTextContent(adultFareEl, 'Base') || '0');
            const taxElements = adultFareEl.querySelectorAll('Tax');
            let totalTaxes = 0;
            taxElements.forEach(taxEl => {
              totalTaxes += parseFloat(taxEl.textContent?.trim() || '0');
            });
            totalPrice = base + totalTaxes;
          }
        }
      }

      if (totalPrice <= 0) {
        return null;
      }

      const legs: Array<any> = [];
      // Try to parse flight legs with new structure
      const outboundLeg = this.parseFlightLeg(flightEl, 'outbound', params.originCode, params.destinationCode, params.departureDate);
      if (outboundLeg) {
        legs.push(outboundLeg);
      }

      // Return flight if dates are provided
      if (params.returnDate) {
        const returnLeg = this.parseFlightLeg(flightEl, 'return', params.destinationCode, params.originCode, params.returnDate);
        if (returnLeg) {
          legs.push(returnLeg);
        }
      }

      // If no legs were parsed with legacy method, create basic leg from airport info
      if (legs.length === 0) {
        const departureAirport = flightEl.querySelector('DepartureAirport');
        const arrivalAirport = flightEl.querySelector('ArrivalAirport');

        if (departureAirport && arrivalAirport) {
          const depCode = departureAirport.getAttribute('code') || params.originCode || '';
          const depName = departureAirport.textContent?.trim() || depCode;
          const arrCode = arrivalAirport.getAttribute('code') || params.destinationCode || '';
          const arrName = arrivalAirport.textContent?.trim() || arrCode;

          legs.push({
            departure: {
              city_code: depCode,
              city_name: depName,
              time: '00:00' // Default time since not provided
            },
            arrival: {
              city_code: arrCode,
              city_name: arrName,
              time: '00:00' // Default time since not provided
            },
            duration: '0h 0m', // Default duration
            flight_type: 'outbound',
            layovers: []
          });
        }
      }

      if (legs.length === 0) {
        return null;
      }

      return {
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
        children: params.children || 0,
        departure_date: params.departureDate,
        return_date: params.returnDate,
        legs: legs,
        luggage: false,
        travel_assistance: 0,
        transfers: 0,
        provider: 'EUROVIPS'
      };
    } catch (error) {
      console.error('❌ Error parsing flight element:', error);
      return null;
    }
  }
  parseFlightLeg(flightEl, type, origin, destination, date) {
    try {
      const departureTime = this.getTextContent(flightEl, `${type}DepartureTime, DepartureTime`) || '00:00';
      const arrivalTime = this.getTextContent(flightEl, `${type}ArrivalTime, ArrivalTime`) || '00:00';
      const duration = this.getTextContent(flightEl, `${type}Duration, Duration`) || '0h 0m';
      return {
        departure: {
          city_code: origin,
          city_name: origin,
          time: departureTime
        },
        arrival: {
          city_code: destination,
          city_name: destination,
          time: arrivalTime
        },
        duration: duration,
        flight_type: type,
        layovers: []
      };
    } catch (error) {
      console.error(`❌ Error parsing ${type} flight leg:`, error);
      return null;
    }
  }
  parsePackageSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');

      const packages: Array<any> = [];

      // Try multiple selectors to handle different XML structures
      let packageElements = xmlDoc.querySelectorAll('ArrayOfPackageFare1 PackageFares');

      // If not found, try direct PackageFares selector
      if (packageElements.length === 0) {
        packageElements = xmlDoc.querySelectorAll('PackageFares');
      }

      // If still not found, try alternative structure
      if (packageElements.length === 0) {
        packageElements = xmlDoc.querySelectorAll('ArrayOfPackageFare1 > PackageFares');
      }

      console.log(`🔍 Found ${packageElements.length} package elements using selector`);

      packageElements.forEach((packageEl, index) => {
        try {
          const packageData = this.parsePackageElement(packageEl, params, index);
          if (packageData) {
            packages.push(packageData);
          }
        } catch (error) {
          console.error('❌ Error parsing package element:', error);
        }
      });

      return packages;
    } catch (error) {
      console.error('❌ Error parsing package search response:', error);
      return [];
    }
  }
  parseServiceSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');

      const services: Array<any> = [];

      // Try multiple selectors to handle different XML structures
      let serviceElements = xmlDoc.querySelectorAll('ArrayOfServiceFare1 ServiceFares');

      // If not found, try direct ServiceFares selector
      if (serviceElements.length === 0) {
        serviceElements = xmlDoc.querySelectorAll('ServiceFares');
      }

      console.log(`🔍 Found ${serviceElements.length} service elements`);

      serviceElements.forEach((serviceEl, index) => {
        try {
          const serviceData = this.parseServiceElement(serviceEl, params, index);
          if (serviceData) {
            services.push(serviceData);
          }
        } catch (error) {
          console.error('❌ Error parsing service element:', error);
        }
      });

      return services;
    } catch (error) {
      console.error('❌ Error parsing service search response:', error);
      return [];
    }
  }
  parseServiceElement(serviceEl, params, index) {
    try {
      const uniqueId = serviceEl.getAttribute('UniqueId') || `service_${Date.now()}_${index}`;
      const backOfficeCode = serviceEl.getAttribute('BackOfficeCode') || '';
      const backOfficeOperatorCode = serviceEl.getAttribute('BackOfficeOperatorCode') || '';

      const name = this.getTextContent(serviceEl, 'Name') || 'Servicio sin nombre';
      const category = this.getTextContent(serviceEl, 'Category') || 'REGULAR';
      const categoryDescription = this.getTextContent(serviceEl, 'CategoryDescription') || '';

      // Location
      const locationEl = serviceEl.querySelector('Location');
      const location = locationEl ? {
        code: locationEl.getAttribute('code') || '',
        name: locationEl.textContent?.trim() || ''
      } : { code: params.cityCode || '', name: '' };

      const fareType = this.getTextContent(serviceEl, 'FareType') || 'OW';
      const rateType = this.getTextContent(serviceEl, 'RateType') || '';
      const observations = this.getTextContent(serviceEl, 'Observations') || '';

      // Parse fares
      const fares = this.parseServiceFares(serviceEl);

      if (fares.length === 0) {
        console.warn(`⚠️ Service ${name} has no valid fares`);
        return null;
      }

      // Get main price (first available fare)
      const mainFare = fares.find(f => f.total > 0) || fares[0];

      const serviceData = {
        id: `service_${uniqueId}`,
        unique_id: uniqueId,
        backOfficeCode,
        backOfficeOperatorCode,
        name,
        category,
        categoryDescription,
        location,
        fareType,
        rateType,
        date: params.dateFrom,
        price: {
          amount: mainFare.total,
          currency: mainFare.currency
        },
        fares,
        observations,
        provider: 'EUROVIPS'
      };

      console.log('✅ Parsed service:', serviceData.name, `- ${fares.length} fare type(s)`);
      return serviceData;
    } catch (error) {
      console.error('❌ Error parsing service element:', error);
      return null;
    }
  }
  parseServiceFares(serviceEl) {
    const fares: Array<any> = [];
    const fareListEl = serviceEl.querySelector('FareList');

    if (!fareListEl) return fares;

    const currency = fareListEl.getAttribute('currency') || 'USD';
    const fareElements = fareListEl.querySelectorAll('Fare');

    fareElements.forEach(fareEl => {
      const type = fareEl.getAttribute('type') || '';
      const passengerType = fareEl.getAttribute('PassengerType') || 'ADT';
      const availability = parseInt(fareEl.getAttribute('Availability') || '0');

      const base = parseFloat(this.getTextContent(fareEl, 'Base') || '0');

      // Parse taxes
      const taxes: Array<any> = [];
      const taxElements = fareEl.querySelectorAll('Tax');
      let totalTaxes = 0;

      taxElements.forEach(taxEl => {
        const taxType = taxEl.getAttribute('type') || '';
        const taxAmount = parseFloat(taxEl.textContent?.trim() || '0');

        taxes.push({ type: taxType, amount: taxAmount });
        totalTaxes += taxAmount;
      });

      const total = base + totalTaxes;

      if (base >= 0) { // Include even free services (base = 0)
        fares.push({
          type,
          passengerType,
          availability,
          base,
          taxes,
          total,
          currency,
          description: type // Use fare type as description
        });
      }
    });

    return fares;
  }
  parsePackageElement(packageEl, params, index) {
    try {
      const uniqueId = packageEl.getAttribute('UniqueId') || `package_${Date.now()}_${index}`;
      const packageName = this.getTextContent(packageEl, 'Name') || 'Package sin nombre';
      const category = this.getTextContent(packageEl, 'Category') || 'REGULAR';
      const location = this.getTextContent(packageEl, 'Location') || '';
      const description = this.getTextContent(packageEl, 'Description') || '';

      // Get duration
      const lodgedNights = parseInt(this.getTextContent(packageEl, 'LodgedNights') || '0');
      const lodgedDays = parseInt(this.getTextContent(packageEl, 'LodgedDays') || '0');

      // Parse pricing information
      const fareListEl = packageEl.querySelector('FareList');
      let totalPrice = 0;
      let currency = this.currency;

      if (fareListEl) {
        currency = fareListEl.getAttribute('currency') || this.currency;

        // Get adult fare (DWL = double, SGL = single)
        const adultFareEl = fareListEl.querySelector('Fare[type="DWL"], Fare[type="SGL"]');
        if (adultFareEl) {
          const base = parseFloat(this.getTextContent(adultFareEl, 'Base') || '0');
          const tax = parseFloat(this.getTextContent(adultFareEl, 'Tax') || '0');
          totalPrice = base + tax;
        }
      }

      if (totalPrice <= 0) {
        return null;
      }

      // Parse included services
      const includedServices: Array<any> = [];
      if (description) {
        includedServices.push(description);
      }

      // Check for flight and hotel information
      const hasFlights = description.toLowerCase().includes('bue/') ||
        description.toLowerCase().includes('vuelo') ||
        category.toUpperCase().includes('AEROTERRESTRE');

      const hasHotel = description.toLowerCase().includes('hotel') ||
        lodgedNights > 0 ||
        category.toUpperCase().includes('HOTEL');

      return {
        id: `package_${uniqueId}`,
        name: packageName,
        description: description,
        destination: location || params.cityCode || '',
        duration_nights: lodgedNights,
        duration_days: lodgedDays || lodgedNights + 1,
        departure_date: params.dateFrom,
        return_date: params.dateTo,
        price: {
          amount: totalPrice,
          currency: currency
        },
        category: category,
        includes: {
          flights: hasFlights,
          hotel: hasHotel,
          meals: description.toLowerCase().includes('comida') || description.toLowerCase().includes('pension'),
          transfers: description.toLowerCase().includes('traslado'),
          excursions: description.toLowerCase().includes('excursion') || description.toLowerCase().includes('visita')
        },
        included_services: includedServices,
        provider: 'EUROVIPS'
      };
    } catch (error) {
      console.error('❌ Error parsing package element:', error);
      return null;
    }
  }
  getTextContent(element, selectors) {
    const selectorList = selectors.split(', ');
    for (const selector of selectorList) {
      const found = element.querySelector(selector);
      if (found && found.textContent?.trim()) {
        return found.textContent.trim();
      }
    }
    return '';
  }
}
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    if (req.method !== 'POST') {
      throw new Error('Only POST method is allowed');
    }
    const body = await req.json();
    console.log('📦 EUROVIPS REQUEST:', body.action, body.data ? Object.keys(body.data) : 'no-data');
    const { action, data } = body;
    const client = new EurovipsSOAPClient();
    let results;
    switch (action) {
      case 'getCountryList':
        results = await client.getCountryList(data);
        break;
      case 'getAirlineList':
        results = await client.getAirlineList();
        break;
      case 'searchHotels':
        if (!data) throw new Error('Hotel search data is required');
        results = await client.searchHotels(data);
        break;
      case 'searchFlights':
        if (!data) throw new Error('Flight search data is required');
        results = await client.searchFlights(data);
        break;
      case 'searchPackages':
        if (!data) throw new Error('Package search data is required');
        results = await client.searchPackages(data);
        break;
      case 'searchServices':
        if (!data) throw new Error('Service search data is required');
        results = await client.searchServices(data);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    return new Response(JSON.stringify({
      success: true,
      action,
      results,
      provider: 'EUROVIPS',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error in eurovips-soap function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
