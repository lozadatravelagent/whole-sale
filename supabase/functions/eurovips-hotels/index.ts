import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HotelSearchParams {
  destination: string;
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children?: number;
  rooms?: number;
}

class EurovipsAPI {
  private baseUrl = 'https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx';
  
  constructor(
    private username: string,
    private password: string,
    private agency: string = '20350',
    private currency: string = 'USD'
  ) {}

  private createSoapEnvelope(body: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
  }

  async searchHotels(params: HotelSearchParams) {
    const soapBody = `
    <SearchHotels xmlns="http://webservices.bridge.eurovips.com/">
      <user>${this.username}</user>
      <password>${this.password}</password>
      <agency>${this.agency}</agency>
      <destination>${params.destination}</destination>
      <checkin>${params.checkinDate}</checkin>
      <checkout>${params.checkoutDate}</checkout>
      <adults>${params.adults}</adults>
      <children>${params.children || 0}</children>
      <rooms>${params.rooms || 1}</rooms>
      <currency>${this.currency}</currency>
    </SearchHotels>`;

    const soapEnvelope = this.createSoapEnvelope(soapBody);
    
    console.log('Searching hotels with SOAP request:', soapEnvelope);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://webservices.bridge.eurovips.com/SearchHotels',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      throw new Error(`Hotel search failed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log('Hotel search SOAP response:', xmlText);

    // Parse XML response
    // For now, return raw XML - in production you'd want to parse this properly
    return {
      rawResponse: xmlText,
      // TODO: Parse XML to extract hotel data
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EUROVIPS_USERNAME = Deno.env.get('EUROVIPS_USERNAME');
    const EUROVIPS_PASSWORD = Deno.env.get('EUROVIPS_PASSWORD');

    if (!EUROVIPS_USERNAME || !EUROVIPS_PASSWORD) {
      throw new Error('Eurovips credentials not configured');
    }

    const { searchParams } = await req.json();
    const api = new EurovipsAPI(EUROVIPS_USERNAME, EUROVIPS_PASSWORD);
    
    const results = await api.searchHotels(searchParams);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      provider: 'eurovips'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in eurovips-hotels function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});