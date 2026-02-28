import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { normalizePlannerSegmentsScheduling } from "../../../src/features/trip-planner/scheduling.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface PlannerRequest {
  destinations: string[];
  days?: number;
  startDate?: string;
  endDate?: string;
  isFlexibleDates?: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  budgetLevel?: string;
  budgetAmount?: number;
  interests?: string[];
  pace?: string;
  travelers?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  constraints?: string[];
  hotelCategory?: string;
  existingPlannerState?: unknown;
  editIntent?: {
    action?: string;
    targetSegmentId?: string;
    targetDayId?: string;
    targetCity?: string;
  };
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function calculateDays(startDate?: string, endDate?: string, explicitDays?: number): number {
  if (startDate && endDate) {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.round(diff / 86400000) + 1);
  }
  if (explicitDays && explicitDays > 0) return explicitDays;
  return 0;
}

function shouldKeepGeneratedDates(input: PlannerRequest): boolean {
  return Boolean(input.startDate && input.endDate);
}

function formatFlexibleMonth(month?: string, year?: number): string {
  if (!month && !year) return 'Mes flexible';
  const monthDate = month ? new Date(`${year || new Date().getFullYear()}-${month}-01T00:00:00`) : null;
  const monthLabel = monthDate && !Number.isNaN(monthDate.getTime())
    ? monthDate.toLocaleDateString('es-ES', { month: 'long' })
    : month;

  if (!monthLabel) return 'Mes flexible';
  return `${monthLabel}${year ? ` de ${year}` : ''}`;
}

function stripGeneratedDates(rawSegments: any[]): any[] {
  return safeArray(rawSegments).map((segment) => ({
    ...segment,
    startDate: undefined,
    endDate: undefined,
    transportIn: segment?.transportIn
      ? {
          ...segment.transportIn,
          date: undefined,
        }
      : segment?.transportIn,
    transportOut: segment?.transportOut
      ? {
          ...segment.transportOut,
          date: undefined,
        }
      : segment?.transportOut,
    hotelPlan: segment?.hotelPlan
      ? {
          ...segment.hotelPlan,
          checkinDate: undefined,
          checkoutDate: undefined,
        }
      : segment?.hotelPlan,
    days: safeArray(segment?.days).map((day) => ({
      ...day,
      date: undefined,
    })),
  }));
}

function normalizeScheduling(raw: any, input: PlannerRequest) {
  const nextSegments = normalizePlannerSegmentsScheduling(safeArray<any>(raw?.segments), {
    pace: raw?.pace || input.pace,
    travelers: raw?.travelers || input.travelers,
  });

  return {
    ...raw,
    segments: nextSegments,
    itinerary: nextSegments.flatMap((segment: any) => safeArray<any>(segment?.days)),
  };
}

function buildPlannerPrompt(input: PlannerRequest): string {
  const destinationsText = input.destinations.join(', ');
  const days = calculateDays(input.startDate, input.endDate, input.days);
  const interests = safeArray(input.interests).join(', ') || 'general travel interests';
  const constraints = safeArray(input.constraints).join(', ') || 'none';
  const currentDate = new Date().toISOString().split('T')[0];

  return `You are an expert travel planner creating detailed travel plans in SPANISH.

TASK:
Create or update a structured travel planner for ${destinationsText}.

REQUEST DATA:
- Destinations: ${destinationsText}
- Days: ${days}
- Start date: ${input.startDate || 'not provided'}
- End date: ${input.endDate || 'not provided'}
- Flexible dates: ${input.isFlexibleDates ? 'yes' : 'no'}
- Flexible month: ${input.flexibleMonth || 'not provided'}
- Flexible year: ${input.flexibleYear || 'not provided'}
- Current date: ${currentDate}
- Budget level: ${input.budgetLevel || 'not provided'}
- Budget amount: ${input.budgetAmount || 'not provided'}
- Interests: ${interests}
- Pace: ${input.pace || 'balanced'}
- Hotel category: ${input.hotelCategory || 'not provided'}
- Travelers: ${JSON.stringify(input.travelers || { adults: 2, children: 0, infants: 0 })}
- Constraints: ${constraints}
- Edit intent: ${JSON.stringify(input.editIntent || null)}
- Existing planner state: ${JSON.stringify(input.existingPlannerState || null)}

RULES:
1. Return ONLY valid JSON.
2. The plan must be realistic and account for travel time between destinations.
3. If editIntent exists, update the plan instead of inventing a completely unrelated trip.
4. Preserve destinations, pacing, and locked structure from existingPlannerState when possible.
5. Organize the plan by segments and by days.
6. Include transport summaries between destinations when there is more than one segment.
7. Include hotel placeholders per segment, but do not invent booking IDs.
8. Give concise but useful summaries. Do not write marketing fluff.
9. Keep restaurant ideas and practical tips relevant to the destination.
10. If startDate/endDate are provided, all generated dates must stay within that range.
11. If startDate/endDate are NOT provided, leave top-level and nested date fields empty. Do NOT invent calendar dates or past years.
12. If isFlexibleDates is true, the plan must explicitly feel flexible inside the requested month and must not invent exact dates.
13. Every activity in morning, afternoon, and evening must include a plausible start time in 24-hour format HH:MM.
14. Use realistic scheduling logic: museums, major landmarks, and markets should skew to morning or afternoon; food and nightlife should skew later; nightlife should only appear at night.
15. On transfer days between cities, keep the day lighter and avoid stacking multiple high-effort activities.
16. If there are children or infants, avoid late-night plans as the main recommendation and keep evenings softer.
17. Prefer one strong anchor activity per block; if you add a second item, it must be lightweight and clearly compatible.
18. Include a concise category label for each activity, such as Museo, Gastronomia, Paseo, Cultura, Vida nocturna, Mercado, Mirador, Naturaleza, Compras, Traslado or Experiencia.

REQUIRED JSON SHAPE:
{
  "title": "Trip title",
  "summary": "A concise overview of the trip",
  "destinations": ["Destination 1", "Destination 2"],
  "days": ${days},
  "startDate": "${input.startDate || ''}",
  "endDate": "${input.endDate || ''}",
  "isFlexibleDates": ${input.isFlexibleDates ? 'true' : 'false'},
  "flexibleMonth": "${input.flexibleMonth || ''}",
  "flexibleYear": ${input.flexibleYear ?? 'null'},
  "budgetLevel": "${input.budgetLevel || ''}",
  "budgetAmount": ${input.budgetAmount ?? 'null'},
  "interests": ["museum", "food"],
  "pace": "${input.pace || 'balanced'}",
  "travelers": {
    "adults": ${input.travelers?.adults ?? 2},
    "children": ${input.travelers?.children ?? 0},
    "infants": ${input.travelers?.infants ?? 0}
  },
  "constraints": [],
  "generalTips": ["tip 1", "tip 2"],
  "segments": [
    {
      "id": "segment-1",
      "city": "Madrid",
      "country": "Spain",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "nights": 3,
      "order": 0,
      "summary": "What this segment is about",
      "transportIn": {
        "type": "flight",
        "summary": "Short summary for the transfer into the city",
        "origin": "Buenos Aires",
        "destination": "Madrid",
        "date": "YYYY-MM-DD"
      },
      "transportOut": null,
      "hotelPlan": {
        "city": "Madrid",
        "checkinDate": "YYYY-MM-DD",
        "checkoutDate": "YYYY-MM-DD",
        "requestedMealPlan": null,
        "requestedStars": null,
        "searchStatus": "idle",
        "hotelRecommendations": []
      },
      "days": [
        {
          "id": "segment-1-day-1",
          "day": 1,
          "dayNumber": 1,
          "date": "YYYY-MM-DD",
          "city": "Madrid",
          "title": "Title of the day",
          "summary": "A one-line summary",
          "morning": [
            {
              "time": "09:30",
              "title": "Museo del Prado",
              "description": "Recorrido por las salas principales del museo.",
              "category": "Museo",
              "tip": "Conviene llegar temprano para evitar filas."
            }
          ],
          "afternoon": [
            {
              "time": "14:00",
              "title": "Almuerzo en La Latina",
              "description": "Tapas y descanso en una zona animada pero caminable.",
              "category": "Gastronomia",
              "tip": "Reservar si viajan en temporada alta."
            }
          ],
          "evening": [
            {
              "time": "20:30",
              "title": "Paseo al atardecer por el centro",
              "description": "Un cierre liviano del día con vistas y cena cercana.",
              "category": "Paseo"
            }
          ],
          "restaurants": [
            { "name": "Restaurant", "type": "Cuisine", "priceRange": "$$" }
          ],
          "travelTip": "Useful practical tip"
        }
      ]
    }
  ]
}

QUALITY:
- Use Spanish labels and Spanish content.
- Make the plan feel personalized.
- Keep the pace consistent with the request.
- If there are multiple destinations, make segment boundaries obvious.
- If the request is missing dates, still produce a coherent plan using the requested number of days.
- If the trip is flexible, mention that flexibility in the summary and avoid exact date wording.`;
}

function normalizePlannerResponse(raw: any, input: PlannerRequest) {
  const days = calculateDays(input.startDate, input.endDate, input.days);
  const preserveDates = shouldKeepGeneratedDates(input);
  const segments = preserveDates
    ? safeArray<any>(raw?.segments)
    : stripGeneratedDates(safeArray<any>(raw?.segments));
  const scheduledRaw = normalizeScheduling({ ...raw, segments }, input);
  const scheduledSegments = safeArray<any>(scheduledRaw?.segments);
  const itinerary = scheduledSegments.flatMap((segment) => safeArray<any>(segment?.days));

  return {
    title: raw?.title || `Viaje por ${input.destinations.join(', ')}`,
    summary: raw?.summary || raw?.introduction || (input.isFlexibleDates
      ? `Un recorrido flexible de ${days} días por ${input.destinations.join(', ')} en ${formatFlexibleMonth(input.flexibleMonth, input.flexibleYear)}.`
      : 'Plan de viaje generado.'),
    destinations: safeArray(raw?.destinations).length > 0 ? raw.destinations : input.destinations,
    days: raw?.days || days,
    startDate: preserveDates ? (input.startDate || raw?.startDate) : undefined,
    endDate: preserveDates ? (input.endDate || raw?.endDate) : undefined,
    isFlexibleDates: Boolean(input.isFlexibleDates),
    flexibleMonth: input.flexibleMonth,
    flexibleYear: input.flexibleYear,
    budgetLevel: raw?.budgetLevel || input.budgetLevel,
    budgetAmount: raw?.budgetAmount ?? input.budgetAmount ?? null,
    interests: safeArray(raw?.interests).length > 0 ? raw.interests : safeArray(input.interests),
    pace: raw?.pace || input.pace,
    travelers: raw?.travelers || input.travelers || { adults: 2, children: 0, infants: 0 },
    constraints: safeArray(raw?.constraints).length > 0 ? raw.constraints : safeArray(input.constraints),
    generalTips: safeArray(raw?.generalTips),
    segments: scheduledSegments,
    itinerary,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(
    req,
    supabase,
    { action: 'api_call', resource: 'travel-itinerary' },
    async () => {
      try {
        const body = await req.json() as PlannerRequest;
        const days = calculateDays(body.startDate, body.endDate, body.days);

        if (!body.destinations || !Array.isArray(body.destinations) || body.destinations.length === 0) {
          throw new Error('Destinations array is required');
        }

        if (!days || days < 1) {
          throw new Error('Days must be a positive number or derivable from startDate/endDate');
        }

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) throw new Error('OpenAI API key not configured');

        const systemPrompt = buildPlannerPrompt(body);
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Generate the planner now for ${body.destinations.join(', ')} with ${days} days.`
              }
            ],
            temperature: 0.6,
            max_tokens: 5000
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

        let cleanedResponse = aiResponse.trim()
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/gi, '')
          .replace(/^\uFEFF/, '');

        let parsed;
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (parseError) {
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw parseError;
          }
          parsed = JSON.parse(jsonMatch[0]);
        }

        const normalized = normalizePlannerResponse(parsed, body);

        return new Response(JSON.stringify({
          success: true,
          data: normalized,
          timestamp: new Date().toISOString()
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (error: any) {
        console.error('❌ Travel Itinerary Generator error:', error);
        const errorMessage = error?.message || 'Unknown error occurred';
        const statusCode = errorMessage.includes('OpenAI') ? 502 : 500;

        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
          errorType: error?.constructor?.name || 'Error',
          timestamp: new Date().toISOString()
        }), {
          status: statusCode,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  );
});
