import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface ParsedTravelRequest {
    requestType: 'flights' | 'hotels' | 'packages' | 'services' | 'combined' | 'general';
    flights?: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        adults: number;
        children: number;
    };
    hotels?: {
        city: string;
        hotelName?: string;
        checkinDate: string;
        checkoutDate: string;
        adults: number;
        children: number;
    };
    packages?: {
        destination: string;
        dateFrom: string;
        dateTo: string;
        packageClass: 'AEROTERRESTRE' | 'TERRESTRE' | 'AEREO';
        adults: number;
        children: number;
    };
    services?: {
        city: string;
        dateFrom: string;
        dateTo?: string;
        serviceType: '1' | '2' | '3'; // 1=Transfer, 2=Excursion, 3=Other
    };
    confidence: number;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { message, language = 'es', currentDate } = await req.json();

        if (!message) {
            throw new Error('Message is required');
        }

        console.log('🤖 AI Message Parser - Processing:', message);

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const systemPrompt = `You are an expert travel assistant that parses Spanish travel requests and extracts structured data.

IMPORTANT: Always respond with valid JSON only. No additional text or explanation.

Current date: ${currentDate}

Your task is to analyze travel messages and extract structured information for:
- flights: origin, destination, dates, passengers
- hotels: city, dates, hotel name (if specified), passengers  
- packages: destination, dates, package type, passengers
- services: city, dates, service type (transfer/excursion)
- combined: flights + hotels together

Rules:
1. Use IATA codes for airports when possible (MAD for Madrid, BCN for Barcelona, BUE for Buenos Aires, etc.)
2. Convert Spanish city names to standard formats (Barcelona, Madrid, Buenos Aires, etc.)
3. For dates, use YYYY-MM-DD format
4. If no specific dates mentioned, use reasonable defaults (1 week from current date)
5. Default adults to 1 if not specified
6. Package classes: AEROTERRESTRE (flight+hotel), TERRESTRE (hotel only), AEREO (flight only)
7. Service types: "1" (transfer), "2" (excursion), "3" (other)
8. Confidence: 0-1 score based on how clear the request is

Examples:

Input: "Quiero un vuelo de Buenos Aires a Madrid el 15 de octubre"
Output: {
  "requestType": "flights",
  "flights": {
    "origin": "BUE",
    "destination": "MAD", 
    "departureDate": "2025-10-15",
    "adults": 1,
    "children": 0
  },
  "confidence": 0.9
}

Input: "Necesito hotel en Barcelona del 1 al 5 de diciembre para 2 personas"
Output: {
  "requestType": "hotels",
  "hotels": {
    "city": "Barcelona",
    "checkinDate": "2025-12-01",
    "checkoutDate": "2025-12-05", 
    "adults": 2,
    "children": 0
  },
  "confidence": 0.95
}

Input: "Quiero paquetes para España en octubre 2025"
Output: {
  "requestType": "packages",
  "packages": {
    "destination": "España",
    "dateFrom": "2025-10-01",
    "dateTo": "2025-10-31",
    "packageClass": "AEROTERRESTRE",
    "adults": 1,
    "children": 0
  },
  "confidence": 0.8
}

Input: "Busco vuelo de Madrid a Barcelona y hotel en Barcelona"
Output: {
  "requestType": "combined",
  "flights": {
    "origin": "MAD",
    "destination": "BCN",
    "departureDate": "${getDefaultDate(currentDate)}",
    "returnDate": "${getDefaultReturnDate(currentDate)}",
    "adults": 1,
    "children": 0
  },
  "hotels": {
    "city": "Barcelona",
    "checkinDate": "${getDefaultDate(currentDate)}",
    "checkoutDate": "${getDefaultReturnDate(currentDate)}",
    "adults": 1,
    "children": 0
  },
  "confidence": 0.85
}

Analyze the following message and respond with JSON only:`;

        const userPrompt = message;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 1000
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.text();
            console.error('❌ OpenAI API error:', errorData);
            throw new Error(`OpenAI API error: ${openaiResponse.status}`);
        }

        const openaiData = await openaiResponse.json();
        const aiResponse = openaiData.choices[0]?.message?.content;

        if (!aiResponse) {
            throw new Error('No response from OpenAI');
        }

        console.log('🤖 Raw AI response:', aiResponse);

        // Parse the JSON response
        let parsed: ParsedTravelRequest;
        try {
            parsed = JSON.parse(aiResponse);
        } catch (parseError) {
            console.error('❌ Failed to parse AI response as JSON:', parseError);
            console.error('❌ AI response was:', aiResponse);
            throw new Error('Invalid JSON response from AI');
        }

        // Validate the response structure
        if (!parsed.requestType || typeof parsed.confidence !== 'number') {
            throw new Error('Invalid response structure from AI');
        }

        console.log('✅ AI parsing successful:', parsed);

        return new Response(JSON.stringify({
            success: true,
            parsed,
            aiResponse: aiResponse,
            timestamp: new Date().toISOString()
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('❌ AI Message Parser error:', error);

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

function getDefaultDate(currentDate: string): string {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
}

function getDefaultReturnDate(currentDate: string): string {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
}
