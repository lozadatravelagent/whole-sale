import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCachedSearch, setCachedSearch, triggerBackgroundRefresh } from "../_shared/cache.ts";
import { withRateLimit } from "../_shared/rateLimit.ts";
// ============================================================================
// STARLING TVC API CLASS
// ============================================================================
class StarlingTvcApi {
  config;
  currentToken = null;
  constructor(config) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }
  // Authentication
  async getAccessToken() {
    console.log('🔑 Getting TVC access token...');
    console.log('📤 Auth URL:', `${this.config.baseUrl}/api/1.6/FlightService.json/GetAccessToken`);
    console.log('📋 Auth Params:', { username: this.config.username, password: '***' });

    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/GetAccessToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          username: this.config.username,
          password: this.config.password
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`TVC Auth failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('🔍 TVC Auth Response:', JSON.stringify(data, null, 2));

      // TVC API returns token as a string directly, not in an object
      let token;
      if (typeof data === 'string') {
        token = data;
        console.log('✅ Token received as string:', token);
      } else if (data.Token) {
        token = data.Token;
        console.log('✅ Token received as object property:', token);
      } else {
        console.error('❌ No token found in response');
        console.error('📋 Response type:', typeof data);
        console.error('📋 Available fields:', typeof data === 'object' ? Object.keys(data) : 'N/A');
        throw new Error('No token received from TVC API');
      }

      // Store token with expiration (assume 1 hour)
      this.currentToken = {
        token: token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      };
      console.log('✅ TVC token obtained successfully:', token);
      return token;
    } catch (error) {
      console.error('❌ TVC Authentication failed:', error);
      throw error;
    }
  }
  async getValidToken() {
    if (!this.currentToken || this.currentToken.expiresAt <= new Date()) {
      return await this.getAccessToken();
    }
    return this.currentToken.token;
  }
  // Flight search
  async getFlightAvailability(request) {
    console.log('✈️ Searching flight availability...');
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/GetFlightAvailability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`Flight search failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`✅ Found ${data.Recommendations?.length || 0} flight recommendations`);
      return data;
    } catch (error) {
      console.error('❌ Flight search failed:', error);
      throw error;
    }
  }
  // Confirm availability
  async confirmFlightAvailability(request) {
    console.log('🔄 Confirming flight availability...');
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      WithAncillaries: false,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/ConfirmFlightAvailability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`Flight confirmation failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('✅ Flight availability confirmed');
      return data;
    } catch (error) {
      console.error('❌ Flight confirmation failed:', error);
      throw error;
    }
  }
  // Book flight
  async bookFlight(request) {
    console.log('🎫 Booking flight...');
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/BookFlight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`Flight booking failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.TransactionCode && data.TransactionMessage) {
        throw new Error(`Booking error: ${data.TransactionMessage} (Code: ${data.TransactionCode})`);
      }
      console.log(`✅ Flight booked successfully: ${data.BookingNumber}`);
      return data;
    } catch (error) {
      console.error('❌ Flight booking failed:', error);
      throw error;
    }
  }
  // Issue booking
  async issueBooking(request) {
    console.log(`🎟️ Issuing booking: ${request.BookingNumber}`);
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/IssueBooking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`Issue booking failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.TransactionCode && data.TransactionMessage) {
        throw new Error(`Issue booking error: ${data.TransactionMessage} (Code: ${data.TransactionCode})`);
      }
      console.log(`✅ Booking issued successfully. Tickets: ${data.TicketNumbers?.join(', ')}`);
      return data;
    } catch (error) {
      console.error('❌ Issue booking failed:', error);
      throw error;
    }
  }
  // Retrieve booking
  async retrieveBooking(request) {
    console.log(`🔍 Retrieving booking: ${request.BookingNumber}`);
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/RetrieveBooking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`Retrieve booking failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('✅ Booking retrieved successfully');
      return data;
    } catch (error) {
      console.error('❌ Retrieve booking failed:', error);
      throw error;
    }
  }
  // Get fare options
  async getFareOptions(request) {
    console.log('💰 Getting fare options...');
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/GetFareOptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`Fare options failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('✅ Fare options retrieved');
      return data;
    } catch (error) {
      console.error('❌ Fare options failed:', error);
      throw error;
    }
  }
  // List bookings
  async listBookings(request) {
    console.log(`📋 Listing bookings from ${request.FromDate} to ${request.ToDate}`);
    const token = await this.getValidToken();
    const payload = {
      Token: token,
      ...request
    };
    try {
      const response = await fetch(`${this.config.baseUrl}/api/1.6/FlightService.json/ListBookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout)
      });
      if (!response.ok) {
        throw new Error(`List bookings failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('✅ Bookings listed successfully');
      return data;
    } catch (error) {
      console.error('❌ List bookings failed:', error);
      throw error;
    }
  }
  // Utility methods
  static createSearchRequest(from, to, date, adults = 1, children = 0, infants = 0) {
    const passengers = [];
    if (adults > 0) passengers.push({
      Count: adults,
      Type: 'ADT'
    });
    if (children > 0) passengers.push({
      Count: children,
      Type: 'CHD'
    });
    if (infants > 0) passengers.push({
      Count: infants,
      Type: 'INF'
    });
    return {
      Passengers: passengers,
      Legs: [
        {
          DepartureAirportCity: from,
          ArrivalAirportCity: to,
          FlightDate: date
        }
      ],
      Airlines: null
    };
  }
  static formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}
// ============================================================================
// CORS HEADERS
// ============================================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Apply rate limiting
  return await withRateLimit(
    req,
    supabase,
    { action: 'search', resource: 'starling-tvc' },
    async () => {
      try {
        console.log(`🚀 Starling TVC API Edge Function - ${req.method} ${req.url}`);

        // Get TVC credentials from Supabase secrets
        const TVC_USERNAME = Deno.env.get('TVC_USERNAME');
        const TVC_PASSWORD = Deno.env.get('TVC_PASSWORD');
        const TVC_BASE_URL = Deno.env.get('TVC_BASE_URL');
        if (!TVC_USERNAME || !TVC_PASSWORD) {
          throw new Error('TVC credentials not configured in Supabase secrets');
        }
        console.log(`🔧 TVC Config: ${TVC_BASE_URL}, User: ${TVC_USERNAME}`);
        console.log(`🔐 Password configured: ${TVC_PASSWORD ? 'YES' : 'NO'}`);

        // Parse request body
        const requestBody = await req.json();
        const { action, data, jobId } = requestBody;
        console.log(`📋 Action: ${action}`);
        console.log(`📥 Data:`, JSON.stringify(data, null, 2));

        // If jobId exists, mark job as processing
        if (jobId) {
          console.log(`🔄 Async mode: Processing job ${jobId}`);
          await supabase
            .from('search_jobs')
            .update({ status: 'processing' })
            .eq('id', jobId);
        }

    // Actions that should be cached (heavy API calls)
    const cacheableActions = ['searchFlights', 'getFareOptions'];
    const shouldCache = cacheableActions.includes(action);

    let result;
    let cacheHit = false;

    // Try to get from cache first (with smart TTL)
    if (shouldCache && data) {
      const cached = await getCachedSearch(supabase, action, data);
      if (cached) {
        console.log(`✅ Cache HIT for ${action} - Status: ${cached.status}`);
        result = cached.results;
        cacheHit = true;

        // If cache is STALE, trigger background refresh (fire-and-forget)
        if (cached.needsRefresh && !req.url.includes('_background_refresh')) {
          console.log(`🔄 Cache is STALE - triggering background refresh for ${action}`);
          const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/starling-flights`;
          triggerBackgroundRefresh(supabase, action, data, functionUrl);
        }
      } else {
        console.log(`❌ Cache MISS for ${action}`);
      }
    }

    // If not cached, call the API
    if (!cacheHit) {
      // Create TVC API instance
      const tvcApi = new StarlingTvcApi({
        baseUrl: TVC_BASE_URL,
        username: TVC_USERNAME,
        password: TVC_PASSWORD,
        timeout: 30000
      });
      // Route to appropriate TVC API method
      switch (action) {
        case 'searchFlights':
          result = await tvcApi.getFlightAvailability(data);
          break;
        case 'confirmAvailability':
          result = await tvcApi.confirmFlightAvailability(data);
          break;
        case 'bookFlight':
          result = await tvcApi.bookFlight(data);
          break;
        case 'issueBooking':
          result = await tvcApi.issueBooking(data);
          break;
        case 'retrieveBooking':
          result = await tvcApi.retrieveBooking(data);
          break;
        case 'getFareOptions':
          result = await tvcApi.getFareOptions(data);
          break;
        case 'listBookings':
          result = await tvcApi.listBookings(data);
          break;
        case 'testConnection':
          // Test endpoint to verify credentials
          await tvcApi.getAccessToken();
          result = {
            status: 'connected',
            message: 'TVC API connection successful'
          };
          break;
        case 'createSearchRequest':
          // Utility endpoint to create search requests
          const { from, to, date, adults = 1, children = 0, infants = 0 } = data;
          result = StarlingTvcApi.createSearchRequest(from, to, date, adults, children, infants);
          break;
        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      // Store in cache for future requests
      if (shouldCache && data && result) {
        await setCachedSearch(supabase, action, data, result);
        console.log(`💾 Cached results for ${action}`);
      }
    }

    // If jobId exists, update job with results (async mode)
    if (jobId) {
      console.log(`✅ Async mode: Completing job ${jobId}`);
      await supabase
        .from('search_jobs')
        .update({
          status: 'completed',
          results: result,
          cache_hit: cacheHit,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      console.log(`🔔 Job ${jobId} updated - Realtime will notify frontend`);
    }

        // Return successful response
        const response = {
          success: true,
          data: result,
          provider: 'TVC',
          cached: cacheHit,
          jobId: jobId,
          timestamp: new Date().toISOString()
        };
        console.log(`✅ Action completed successfully: ${action}`);
        return new Response(JSON.stringify(response), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('❌ Starling TVC API Error:', error);

        // If jobId exists, mark job as failed (async mode)
        if (requestBody?.jobId) {
          try {
            await supabase
              .from('search_jobs')
              .update({
                status: 'failed',
                error: error.message,
                completed_at: new Date().toISOString()
              })
              .eq('id', requestBody.jobId);
          } catch (updateError) {
            console.error('❌ Failed to update job status:', updateError);
          }
        }

        const errorResponse = {
          success: false,
          error: error.message,
          provider: 'TVC',
          jobId: requestBody?.jobId,
          timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  );
});
