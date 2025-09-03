import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  directFlight?: boolean;
}

class StarlingAPI {
  private baseUrl = 'https://apihv2.webtravelcaster.com/api/1.6';
  private token: string | null = null;
  
  constructor(
    private username: string,
    private password: string
  ) {}

  async getAccessToken(): Promise<string> {
    console.log('Getting access token from Starling API...');
    
    const response = await fetch(`${this.baseUrl}/FlightService.json/GetAccessToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    console.log('GetAccessToken response status:', response.status);
    console.log('GetAccessToken response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GetAccessToken failed:', response.status, errorText);
      throw new Error(`Failed to get access token: ${response.statusText} - ${errorText}`);
    }

    const text = await response.text();
    console.log('GetAccessToken raw response:', text);
    
    // Clean the token - remove quotes and whitespace
    this.token = text.replace(/^["']|["']$/g, '').trim();
    console.log('Cleaned token:', this.token);
    
    return this.token;
  }

  async searchFlights(params: FlightSearchParams) {
    console.log('Starting flight search with params:', params);
    
    if (!this.token) {
      console.log('No token found, getting access token...');
      await this.getAccessToken();
    }

    const query: any = {
      Token: this.token,
      Legs: [
        {
          DepartureAirportCity: params.origin,
          ArrivalAirportCity: params.destination,
          FlightDate: params.departureDate,
        }
      ],
      Passengers: [
        { Type: 'ADT', Count: params.adults },
        { Type: 'CHD', Count: params.children || 0 },
        { Type: 'INF', Count: 0 },
      ],
      Currency: 'USD'
    };

    // Add return leg if roundtrip
    if (params.returnDate) {
      console.log('Adding return leg for roundtrip');
      query.Legs.push({
        DepartureAirportCity: params.destination,
        ArrivalAirportCity: params.origin,
        FlightDate: params.returnDate,
      });
    }

    console.log('Flight search query:', JSON.stringify(query, null, 2));

    const response = await fetch(`${this.baseUrl}/FlightService.json/GetFlightAvailability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    console.log('GetFlightAvailability response status:', response.status);
    console.log('GetFlightAvailability response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GetFlightAvailability failed:', response.status, errorText);
      throw new Error(`Flight search failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Flight search response structure:', {
      hasToken: !!data.Token,
      hasFares: !!data.Fares,
      faresCount: data.Fares?.length || 0,
      transactionCode: data.TransactionCode,
      transactionMessage: data.TransactionMessage,
      keys: Object.keys(data)
    });
    
    if (data.TransactionCode && data.TransactionCode !== '1000') {
      console.error('API returned error code:', data.TransactionCode, data.TransactionMessage);
    }
    
    return data;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STARLING_USERNAME = Deno.env.get('STARLING_USERNAME');
    const STARLING_PASSWORD = Deno.env.get('STARLING_PASSWORD');

    if (!STARLING_USERNAME || !STARLING_PASSWORD) {
      throw new Error('Starling credentials not configured');
    }

    const { searchParams } = await req.json();
    const api = new StarlingAPI(STARLING_USERNAME, STARLING_PASSWORD);
    
    const results = await api.searchFlights(searchParams);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      provider: 'starling'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in starling-flights function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});