import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SOAPRequestParams {
  action: 'getCountryList' | 'searchHotels' | 'searchFlights' | 'getAirlineList';
  data?: any;
}

interface HotelSearchParams {
  cityCode: string;
  checkinDate: string;
  checkoutDate: string;
  adults?: number;
  children?: number;
  rooms?: number;
}

interface FlightSearchParams {
  originCode: string;
  destinationCode: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
}

class EurovipsSOAPClient {
  private baseUrl = 'https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx';
  private username = 'LOZADAWS';
  private password = '.LOZAWS23.';
  private agency = '20350';
  private currency = 'USD';

  private async makeSOAPRequest(soapBody: string, soapAction: string): Promise<string> {
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
      body: soapEnvelope,
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

  async getCountryList(): Promise<any> {
    const soapBody = `
    <xsstring7 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <dateFrom xmlns="">2025-12-01</dateFrom>
      <dateTo xmlns="">2025-12-31</dateTo>
      <activeFareType xmlns="">HOTEL</activeFareType>
      <activeFareSubtype xmlns=""></activeFareSubtype>
    </xsstring7>`;

    const xmlResponse = await this.makeSOAPRequest(soapBody, 'getCountryList');
    return this.parseCountryListResponse(xmlResponse);
  }

  async getAirlineList(): Promise<any> {
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

  async searchHotels(params: HotelSearchParams): Promise<any> {
    const soapBody = `
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${params.cityCode}" xmlns="" />
      <dateFrom xmlns="">${params.checkinDate}</dateFrom>
      <dateTo xmlns="">${params.checkoutDate}</dateTo>
      <name Code="" xmlns="" />
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchHotelFaresRQ1>`;

    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchHotelFares');
    return this.parseHotelSearchResponse(xmlResponse, params);
  }

  async searchFlights(params: FlightSearchParams): Promise<any> {
    const soapBody = `
    <searchAirFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <originLocationCode code="${params.originCode}" xmlns="" />
      <destinationLocationCode code="${params.destinationCode}" xmlns="" />
      <departureDateTime xmlns="">${params.departureDate}</departureDateTime>
      ${params.returnDate ? `<returnDateTime xmlns="">${params.returnDate}</returnDateTime>` : ''}
      <adultCount xmlns="">${params.adults || 1}</adultCount>
      <childCount xmlns="">${params.children || 0}</childCount>
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchAirFaresRQ1>`;

    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchAirFares');
    return this.parseFlightSearchResponse(xmlResponse, params);
  }

  private parseCountryListResponse(xmlResponse: string): any[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }

      const results: any[] = [];
      const countryInfoElements = Array.from(xmlDoc.getElementsByTagName('*'))
        .filter(el => el.localName === 'CountryInfos');

      countryInfoElements.forEach((countryInfoEl) => {
        const countryCodeEl = Array.from(countryInfoEl.getElementsByTagName('*'))
          .find(e => e.parentElement === countryInfoEl && e.localName === 'Code');
        const countryNameEl = Array.from(countryInfoEl.getElementsByTagName('*'))
          .find(e => e.parentElement === countryInfoEl && e.localName === 'Name');

        const countryCode = countryCodeEl?.textContent?.trim();
        const countryName = countryNameEl?.textContent?.trim();

        if (countryCode && countryName) {
          results.push({ code: countryCode, name: countryName });
        }

        // Process cities within this country
        const cityListEl = Array.from(countryInfoEl.getElementsByTagName('*'))
          .find(e => e.parentElement === countryInfoEl && e.localName === 'CityList');

        if (cityListEl) {
          const cityElements = Array.from(cityListEl.getElementsByTagName('*'))
            .filter(e => e.localName === 'City');

          cityElements.forEach((cityEl) => {
            const cityCodeEl = Array.from(cityEl.getElementsByTagName('*'))
              .find(e => e.parentElement === cityEl && e.localName === 'Code');
            const cityNameEl = Array.from(cityEl.getElementsByTagName('*'))
              .find(e => e.parentElement === cityEl && e.localName === 'Name');

            const cityCode = cityCodeEl?.textContent?.trim();
            const cityName = cityNameEl?.textContent?.trim();

            if (cityCode && cityName) {
              results.push({ code: cityCode, name: cityName });
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

  private parseAirlineListResponse(xmlResponse: string): any[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }

      const airlines: any[] = [];
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

  private parseHotelSearchResponse(xmlResponse: string, params: HotelSearchParams): any[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }

      const hotels: any[] = [];
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

  private parseFlightSearchResponse(xmlResponse: string, params: FlightSearchParams): any[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return [];
      }

      const flights: any[] = [];
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

  private parseHotelElement(hotelEl: Element, params: HotelSearchParams, index: number): any | null {
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

  private parseFlightElement(flightEl: Element, params: FlightSearchParams, index: number): any | null {
    try {
      const uniqueId = flightEl.getAttribute('UniqueId') || `flight_${Date.now()}_${index}`;
      const airlineCode = this.getTextContent(flightEl, 'AirlineCode') || 'XX';
      const airlineName = this.getTextContent(flightEl, 'AirlineName') || 'Unknown Airline';
      const totalPrice = parseFloat(this.getTextContent(flightEl, 'TotalFare, TotalPrice') || '0');
      const currency = this.getTextContent(flightEl, 'Currency') || this.currency;

      if (totalPrice <= 0) {
        return null;
      }

      const legs: any[] = [];

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

  private parseFlightLeg(flightEl: Element, type: 'outbound' | 'return', origin: string, destination: string, date: string): any | null {
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

  private getTextContent(element: Element, selectors: string): string {
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
    return new Response(null, { headers: corsHeaders });
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

    const { action, data }: SOAPRequestParams = body;
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in eurovips-soap function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});