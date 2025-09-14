import { ServiceData } from '@/types';

// Configuration for EUROVIPS WebService
const WS_CONFIG = {
  url: import.meta.env.DEV ? '/api/service' : 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap',
  username: 'LOZADAWS',
  password: '.LOZAWS23.',
  agency: '20350',
  currency: 'USD'
};

export interface ServiceSearchParams {
  city: string;
  dateFrom: string;
  dateTo?: string;
  serviceType?: '1' | '2' | '3'; // 1=Transfer, 2=Excursion, 3=Other
}

export async function searchServiceFares(params: ServiceSearchParams): Promise<ServiceData[]> {
  console.log('🚌 Searching services with params:', params);

  try {
    // Use Edge Function in production
    const isProduction = !import.meta.env.DEV;

    if (isProduction) {
      try {
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

        // Get correct city code from WebService country list or fallback
        const cityCode = await getCityCode(params.city || '');
        console.log(`🌍 Converting city "${params.city}" to code: ${cityCode}`);

        const response = await fetch(WS_CONFIG.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'searchServices',
            data: {
              cityCode: cityCode,
              dateFrom: params.dateFrom,
              dateTo: params.dateTo || params.dateFrom,
              serviceType: params.serviceType || '1'
            }
          })
        });

        if (!response.ok) {
          console.error(`Edge Function HTTP Error: ${response.status} ${response.statusText}`);
          return [];
        }

        const responseText = await response.text();
        console.log('Service Edge Function raw response:', responseText.substring(0, 200));

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Edge Function returned non-JSON response:', responseText.substring(0, 500));
          throw new Error('Invalid JSON response from Edge Function');
        }

        if (result.success) {
          return result.results;
        } else {
          console.error('Edge Function business error:', result.error);
          return [];
        }
      } catch (error) {
        console.error('Edge Function failed:', error);
        return [];
      }
    } else {
      // Development mode: Use proxy or return empty array for now
      console.log('🚌 Development mode: Service search not implemented via proxy yet');
      return [];
    }

  } catch (error) {
    console.error('❌ Error searching services:', error);
    return [];
  }
}

// Cache for country/city codes to avoid repeated API calls
let countryListCache: Array<{ code: string, name: string }> = [];

async function getCountryList(): Promise<Array<{ code: string, name: string }>> {
  // Return cached results if available
  if (countryListCache.length > 0) {
    console.log('🎯 Using cached country list:', countryListCache.length, 'items');
    return countryListCache;
  }

  try {
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

    const response = await fetch(WS_CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'getCountryList',
        data: null
      })
    });

    if (!response.ok) {
      console.error(`Edge Function HTTP Error: ${response.status} ${response.statusText}`);
      return [];
    }

    const result = await response.json();
    if (result.success) {
      countryListCache = result.results;
      return result.results;
    } else {
      console.error('Edge Function business error:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Edge Function failed:', error);
    return [];
  }
}

async function getCityCode(cityName: string): Promise<string> {
  try {
    // Get the country list first
    const countries = await getCountryList();

    if (countries.length === 0) {
      // Fallback to static mapping if WebService fails
      const FALLBACK_CITY_CODES: Record<string, string> = {
        'buzios': 'BZS',
        'búzios': 'BZS',
        'rio de janeiro': 'RIO',
        'rio': 'RIO',
        'madrid': 'MAD',
        'barcelona': 'BCN',
        'sao paulo': 'SAO',
        'são paulo': 'SAO'
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

    // Final fallback
    console.log(`⚠️ No city code found for: ${cityName}, using fallback`);
    return cityName.substring(0, 3).toUpperCase();

  } catch (error) {
    console.error('❌ Error getting city code:', error);
    return cityName.substring(0, 3).toUpperCase();
  }
}

// Test function to verify WebService connectivity
export async function testServiceWebService(): Promise<boolean> {
  console.log('🧪 Testing service WebService connectivity...');

  try {
    const testParams: ServiceSearchParams = {
      city: 'Buzios',
      dateFrom: new Date().toISOString().split('T')[0],
      serviceType: '1'
    };

    const services = await searchServiceFares(testParams);
    console.log('✅ WebService test successful, returned:', services.length, 'services');
    return true;
  } catch (error) {
    console.error('❌ WebService test failed:', error);
    return false;
  }
}