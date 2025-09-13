import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    console.log(`📝 SOAP Request for ${soapAction}:`, soapEnvelope);
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
    console.log(`📥 SOAP Response for ${soapAction}:`, xmlResponse.substring(0, 1000));
    return xmlResponse;
  }
  async getCountryList() {
    const soapBody = `
    <xsstring7 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <dateFrom xmlns="">2025-10-01</dateFrom>
      <dateTo xmlns="">2025-12-31</dateTo>
      <activeFareType xmlns="">HOTEL</activeFareType>
      <activeFareSubtype xmlns="">TERRESTRE</activeFareSubtype>
    </xsstring7>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'getCountryList');
    console.log('🔍 Raw XML Response:', xmlResponse);
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
    const soapBody = `
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${params.cityCode}" xmlns="" />
      <dateFrom xmlns="">${params.checkinDate}</dateFrom>
      <dateTo xmlns="">${params.checkoutDate}</dateTo>
      <name xmlns="" />
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
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
  parseCountryListResponse(xmlResponse) {
    try {
      console.log('📥 Full XML Response for getCountryList:', xmlResponse);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }
      console.log('📋 All elements in XML:', Array.from(xmlDoc.getElementsByTagName('*')).map((el) => el.localName));
      const results = [];
      const countryInfoElements = Array.from(xmlDoc.getElementsByTagName('*')).filter((el) => el.localName === 'CountryInfos');
      console.log(`🔍 Found ${countryInfoElements.length} CountryInfos elements`);
      countryInfoElements.forEach((countryInfoEl) => {
        const countryCodeEl = Array.from(countryInfoEl.getElementsByTagName('*')).find((e) => e.parentElement === countryInfoEl && e.localName === 'Code');
        const countryNameEl = Array.from(countryInfoEl.getElementsByTagName('*')).find((e) => e.parentElement === countryInfoEl && e.localName === 'Name');
        const countryCode = countryCodeEl?.textContent?.trim();
        const countryName = countryNameEl?.textContent?.trim();
        if (countryCode && countryName) {
          results.push({
            code: countryCode,
            name: countryName
          });
        }
        // Process cities within this country
        const cityListEl = Array.from(countryInfoEl.getElementsByTagName('*')).find((e) => e.parentElement === countryInfoEl && e.localName === 'CityList');
        if (cityListEl) {
          const cityElements = Array.from(cityListEl.getElementsByTagName('*')).filter((e) => e.localName === 'City');
          cityElements.forEach((cityEl) => {
            const cityCodeEl = Array.from(cityEl.getElementsByTagName('*')).find((e) => e.parentElement === cityEl && e.localName === 'Code');
            const cityNameEl = Array.from(cityEl.getElementsByTagName('*')).find((e) => e.parentElement === cityEl && e.localName === 'Name');
            const cityCode = cityCodeEl?.textContent?.trim();
            const cityName = cityNameEl?.textContent?.trim();
            if (cityCode && cityName) {
              results.push({
                code: cityCode,
                name: cityName
              });
            }
          });
        }
      });
      return results;
    } catch (error) {
      console.error('❌ Error parsing country list response:', error);
      return [];
    }
  }
  parseAirlineListResponse(xmlResponse) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }
      const airlines = [];
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
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }
      const hotels = [];
      const hotelElements = xmlDoc.querySelectorAll('HotelFares, ArrayOfHotelFare1 HotelFares');
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
      return hotels;
    } catch (error) {
      console.error('❌ Error parsing hotel search response:', error);
      return [];
    }
  }
  parseFlightSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }
      const flights = [];
      const flightElements = xmlDoc.querySelectorAll('ArrayOfAirFare1 AirFares, AirFares');
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
      const hotelName = this.getTextContent(hotelEl, 'HotelName, PropertyName') || 'Unknown Hotel';
      const address = this.getTextContent(hotelEl, 'Address, HotelAddress') || '';
      const totalPrice = parseFloat(this.getTextContent(hotelEl, 'TotalFare, TotalPrice') || '0');
      const currency = this.getTextContent(hotelEl, 'Currency') || this.currency;
      if (totalPrice <= 0) {
        return null;
      }
      return {
        id: `hotel_${uniqueId}`,
        name: hotelName,
        address: address,
        checkin_date: params.checkinDate,
        checkout_date: params.checkoutDate,
        price: {
          amount: totalPrice,
          currency: currency
        },
        adults: params.adults || 1,
        children: params.children || 0,
        rooms: params.rooms || 1,
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
      const airlineCode = this.getTextContent(flightEl, 'AirlineCode') || 'XX';
      const airlineName = this.getTextContent(flightEl, 'AirlineName') || 'Unknown Airline';
      const totalPrice = parseFloat(this.getTextContent(flightEl, 'TotalFare, TotalPrice') || '0');
      const currency = this.getTextContent(flightEl, 'Currency') || this.currency;
      if (totalPrice <= 0) {
        return null;
      }
      const legs = [];
      // Outbound flight
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
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }

      const packages = [];
      const packageElements = xmlDoc.querySelectorAll('ArrayOfPackageFare1 PackageFares, PackageFares');

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
      const includedServices = [];
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
    // Log the request for debugging
    console.log('🚀 Edge Function called!');
    console.log('📥 Request method:', req.method);
    console.log('📋 Request headers:', Object.fromEntries(req.headers.entries()));
    const authHeader = req.headers.get('authorization');
    console.log('🔑 Auth header:', authHeader?.substring(0, 50) + '...');
    const body = await req.json();
    console.log('📦 Request body:', body);
    const { action, data } = body;
    const client = new EurovipsSOAPClient();
    let results;
    switch (action) {
      case 'getCountryList':
        results = await client.getCountryList();
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
