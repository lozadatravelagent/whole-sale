import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { buildSystemPrompt, PROMPT_VERSION } from "./prompt.ts";
import { normalizeFlightRequest } from "../_shared/flightSegments.ts";
import { requestOpenAiChatCompletion } from "../_shared/llm/openaiChat.ts";
import { estimateCostUsd } from "../_shared/llm/pricing.ts";
import { resolveModelPolicy } from "../_shared/llm/modelPolicy.ts";
import { logLlmRequest } from "../_shared/llm/usageLogger.ts";
import {
  normalizeDestinationListToCapitals,
  normalizeDestinationToCapitalIfCountry,
} from "../_shared/countryCapitalResolver.ts";
import { corsHeaders } from '../_shared/cors.ts';

function cleanLocation(value: string | undefined): string {
  return (value || '')
    .replace(/^(desde|de|hacia|a)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function augmentMultiCitySegmentsFromMessage(message: string, parsed: any): any {
  if (!parsed?.flights) return parsed;

  const normalizedFlights = normalizeFlightRequest(parsed.flights);
  if (!normalizedFlights?.origin || !normalizedFlights?.destination || !normalizedFlights?.departureDate) {
    return parsed;
  }

  if (Array.isArray(normalizedFlights.segments) && normalizedFlights.segments.length > 1) {
    return {
      ...parsed,
      flights: normalizedFlights
    };
  }

  const returnDate = normalizedFlights.returnDate;
  if (!returnDate) {
    return {
      ...parsed,
      flights: normalizedFlights
    };
  }

  const explicitDifferentCityMatch = message.match(
    /\b(?:con\s+)?(?:vuelta|regreso|volver|volviendo)\b[\s\S]{0,120}?\bdesde\s+(.+?)\s+(?:hacia|a)\s+(.+?)(?=[,.;]|$)/i
  );
  const implicitReturnFromMatch = message.match(
    /\b(?:con\s+)?(?:vuelta|regreso|volver|volviendo)\b[\s\S]{0,120}?\bdesde\s+(.+?)(?=[,.;]|$)/i
  );

  let secondOrigin = '';
  let secondDestination = '';

  if (explicitDifferentCityMatch) {
    secondOrigin = cleanLocation(explicitDifferentCityMatch[1]);
    secondDestination = cleanLocation(explicitDifferentCityMatch[2]);
  } else if (implicitReturnFromMatch) {
    secondOrigin = cleanLocation(implicitReturnFromMatch[1]);
    secondDestination = cleanLocation(normalizedFlights.origin);
  }

  if (!secondOrigin || !secondDestination) {
    return {
      ...parsed,
      flights: normalizedFlights
    };
  }

  const nextFlights = normalizeFlightRequest({
    ...normalizedFlights,
    tripType: undefined,
    segments: [
      {
        origin: normalizedFlights.origin,
        destination: normalizedFlights.destination,
        departureDate: normalizedFlights.departureDate
      },
      {
        origin: secondOrigin,
        destination: secondDestination,
        departureDate: returnDate
      }
    ]
  });

  return {
    ...parsed,
    flights: nextFlights
  };
}

function extractOpenAiMessageContent(openaiData: any): string {
  const content = openaiData?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function normalizeLocationsToCountryCapitals(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const nextParsed = { ...parsed };

  // Itinerary destinations are NOT normalized to capitals.
  // The planner has its own country/regional expansion that handles
  // "España" → multi-city routes. Normalizing here would collapse
  // "España" to "Madrid" before expansion can run.

  if (nextParsed.hotels) {
    nextParsed.hotels = {
      ...nextParsed.hotels,
      ...(nextParsed.hotels.city
        ? { city: normalizeDestinationToCapitalIfCountry(nextParsed.hotels.city) }
        : {}),
      ...(Array.isArray(nextParsed.hotels.segments)
        ? {
            segments: nextParsed.hotels.segments.map((segment: any) => ({
              ...segment,
              ...(segment?.city
                ? { city: normalizeDestinationToCapitalIfCountry(segment.city) }
                : {}),
            })),
          }
        : {}),
    };
  }

  if (nextParsed.flights) {
    nextParsed.flights = {
      ...nextParsed.flights,
      ...(nextParsed.flights.origin
        ? { origin: normalizeDestinationToCapitalIfCountry(nextParsed.flights.origin) }
        : {}),
      ...(nextParsed.flights.destination
        ? { destination: normalizeDestinationToCapitalIfCountry(nextParsed.flights.destination) }
        : {}),
      ...(Array.isArray(nextParsed.flights.segments)
        ? {
            segments: nextParsed.flights.segments.map((segment: any) => ({
              ...segment,
              ...(segment?.origin
                ? { origin: normalizeDestinationToCapitalIfCountry(segment.origin) }
                : {}),
              ...(segment?.destination
                ? { destination: normalizeDestinationToCapitalIfCountry(segment.destination) }
                : {}),
            })),
          }
        : {}),
    };
  }

  if (nextParsed.packages?.destination) {
    nextParsed.packages = {
      ...nextParsed.packages,
      destination: normalizeDestinationToCapitalIfCountry(nextParsed.packages.destination),
    };
  }

  if (nextParsed.services?.city) {
    nextParsed.services = {
      ...nextParsed.services,
      city: normalizeDestinationToCapitalIfCountry(nextParsed.services.city),
    };
  }

  return nextParsed;
}
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // Initialize Supabase client for rate limiting
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Apply rate limiting
  return await withRateLimit(
    req,
    supabase,
    { action: 'message', resource: 'ai-parser' },
    async () => {
      const requestId = crypto.randomUUID();
      try {
        const requestBody = await req.json();
        const {
          message = requestBody.prompt, // Support both 'message' and 'prompt'
          language = 'es',
          currentDate = new Date().toISOString().split('T')[0], // Default to today's date (YYYY-MM-DD)
          previousContext,
          conversationHistory = [],
          conversationSummary = null,
          leadProfile = null,
          plannerContext = null,
          historyWindow = 6,
          contextMeta = null,
        } = requestBody;

        if (!message) {
          throw new Error('Message or prompt is required');
        }
        console.log('🤖 AI Message Parser - Processing:', message);
        console.log('📝 Previous context received:', previousContext);
        console.log('📚 Conversation history received:', conversationHistory?.length || 0, 'messages');
        console.log('📅 Current date:', currentDate);
        // Format conversation history - use smart truncation to maximize context
        let conversationHistoryText = '';
        if (conversationHistory && conversationHistory.length > 0) {
          try {
            const normalizedHistoryWindow = Math.max(1, Math.min(12, Number(historyWindow) || 6));
            const recentHistory = conversationHistory.slice(-normalizedHistoryWindow);

            conversationHistoryText = recentHistory.map((msg, index) => {
              // Escape problematic characters
              let safeContent = (msg.content || '').replace(/`/g, "'").replace(/\$/g, "\\$");

              // Smart truncation: keep more for recent messages, less for older ones
              const messagesFromEnd = recentHistory.length - index;
              let maxLength;
              if (messagesFromEnd <= 5) {
                maxLength = 800; // Last 5 messages: keep almost full content
              } else if (messagesFromEnd <= 10) {
                maxLength = 500; // Messages 6-10: medium length
              } else {
                maxLength = 300; // Older messages: shorter summary
              }

              safeContent = safeContent.substring(0, maxLength);
              if (safeContent.length === maxLength) {
                safeContent += '...'; // Indicate truncation
              }

              return `${msg.role}: ${safeContent}`;
            }).join('\\n');
          } catch (e) {
            console.error('Error formatting conversation history:', e);
            conversationHistoryText = '';
          }
        }

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) throw new Error('OpenAI API key not configured');
        const systemPrompt = buildSystemPrompt({
          currentDate,
          conversationHistoryText,
          previousContext,
          conversationSummary,
          leadProfile,
          plannerContext,
        });
        const userPrompt = message;
        const modelDecision = resolveModelPolicy({
          feature: 'ai-message-parser',
          operation: 'parse',
        });
        const openAiStartedAt = performance.now();
        const parserMessages = [
          {
            role: 'system' as const,
            content: systemPrompt
          },
          {
            role: 'user' as const,
            content: userPrompt
          }
        ];
        let openaiData = await requestOpenAiChatCompletion<any>({
          apiKey: openaiApiKey,
          model: modelDecision.model,
          messages: parserMessages,
          temperature: 0.1,
          maxTokens: 1800,
        });
        const openAiLatencyMs = Math.round(performance.now() - openAiStartedAt);
        let aiResponse = extractOpenAiMessageContent(openaiData);
        if (!aiResponse && modelDecision.model !== 'gpt-4.1') {
          console.warn('⚠️ Empty parser response from OpenAI, retrying with gpt-4.1', {
            model: modelDecision.model,
            finishReason: openaiData?.choices?.[0]?.finish_reason ?? null,
            usage: openaiData?.usage ?? null,
          });
          openaiData = await requestOpenAiChatCompletion<any>({
            apiKey: openaiApiKey,
            model: 'gpt-4.1',
            messages: parserMessages,
            temperature: 0.1,
            maxTokens: 1800,
          });
          aiResponse = extractOpenAiMessageContent(openaiData);
        }
        if (!aiResponse) {
          throw new Error(`No response from OpenAI (finishReason: ${openaiData?.choices?.[0]?.finish_reason ?? 'unknown'})`);
        }
        console.log('🤖 Raw AI response:', aiResponse);
        console.log('🤖 AI response type:', typeof aiResponse);
        console.log('🤖 AI response length:', aiResponse?.length);
        // Clean the AI response to handle emojis and special characters properly
        let cleanedResponse = aiResponse.trim();
        // Remove any potential BOM or invisible characters
        cleanedResponse = cleanedResponse.replace(/^\uFEFF/, '');
        // Try to fix JSON by replacing literal newlines in string values with \\n
        // This is a more targeted approach to fix the specific issue
        try {
          // First, try to parse as-is
          JSON.parse(cleanedResponse);
        } catch (error) {
          // If parsing fails, try to fix common issues
          console.log('🔧 Attempting to fix JSON formatting issues...');
          // Fix literal newlines in string values by replacing them with \\n
          cleanedResponse = cleanedResponse.replace(/"([^"]*)\n([^"]*)"/g, (match, before, after) => {
            return `"${before}\\n${after}"`;
          });
          // Fix multiple consecutive newlines
          cleanedResponse = cleanedResponse.replace(/"([^"]*)\n\n([^"]*)"/g, (match, before, after) => {
            return `"${before}\\n\\n${after}"`;
          });
        }
        // Parse the JSON response
        let parsed;
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error('❌ Failed to parse AI response as JSON:', parseError);
          console.error('❌ AI response was:', aiResponse);
          console.error('❌ Cleaned response was:', cleanedResponse);
          // Try to extract JSON from the response if it's wrapped in other text
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              console.log('✅ Successfully extracted JSON from wrapped response');
            } catch (secondParseError) {
              console.error('❌ Failed to parse extracted JSON:', secondParseError);
              throw new Error('Invalid JSON response from AI');
            }
          } else {
            throw new Error('Invalid JSON response from AI');
          }
        }
        // Fix common type issues from AI response
        if (typeof parsed.confidence === 'string') {
          parsed.confidence = parseFloat(parsed.confidence);
        }

        // Add default confidence if missing
        if (parsed.confidence === undefined || parsed.confidence === null) {
          console.log('⚠️ Missing confidence field, setting default value of 0.8');
          parsed.confidence = 0.8;
        }

        // Fix maxLayoverHours if it's a string
        if (parsed.flights?.maxLayoverHours && typeof parsed.flights.maxLayoverHours === 'string') {
          parsed.flights.maxLayoverHours = parseInt(parsed.flights.maxLayoverHours, 10);
        }

        if (parsed.itinerary?.days && typeof parsed.itinerary.days === 'string') {
          parsed.itinerary.days = parseInt(parsed.itinerary.days, 10);
        }

        if (parsed.itinerary?.budgetAmount && typeof parsed.itinerary.budgetAmount === 'string') {
          parsed.itinerary.budgetAmount = parseFloat(parsed.itinerary.budgetAmount);
        }

        if (parsed.flights) {
          parsed = augmentMultiCitySegmentsFromMessage(message, parsed);
          parsed.flights = normalizeFlightRequest(parsed.flights);
        }

        parsed = normalizeLocationsToCountryCapitals(parsed);

        // Validate the response structure
        if (!parsed.requestType || typeof parsed.confidence !== 'number') {
          console.error('❌ Invalid response structure from AI:', {
            requestType: parsed.requestType,
            confidence: parsed.confidence,
            confidenceType: typeof parsed.confidence,
            fullResponse: parsed
          });
          throw new Error(`Invalid response structure from AI - requestType: ${parsed.requestType}, confidence: ${parsed.confidence} (${typeof parsed.confidence})`);
        }
        console.log('✅ AI parsing successful:', parsed);
        const usage = {
          provider: modelDecision.provider,
          model: openaiData?.model ?? modelDecision.model,
          promptTokens: openaiData?.usage?.prompt_tokens ?? null,
          completionTokens: openaiData?.usage?.completion_tokens ?? null,
          totalTokens: openaiData?.usage?.total_tokens ?? null,
          cachedTokens: openaiData?.usage?.prompt_tokens_details?.cached_tokens ?? null,
          estimatedCostUsd: estimateCostUsd({
            model: openaiData?.model ?? modelDecision.model,
            promptTokens: openaiData?.usage?.prompt_tokens ?? null,
            completionTokens: openaiData?.usage?.completion_tokens ?? null,
            cachedTokens: openaiData?.usage?.prompt_tokens_details?.cached_tokens ?? null,
          }),
          finishReason: openaiData?.choices?.[0]?.finish_reason ?? null,
        };
        await logLlmRequest(supabase, {
          provider: usage.provider,
          model: usage.model,
          feature: 'ai-message-parser',
          operation: 'parse',
          requestId,
          success: true,
          latencyMs: openAiLatencyMs,
          finishReason: usage.finishReason,
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            cachedTokens: usage.cachedTokens,
          },
          contextMeta,
          metadata: {
            promptVersion: PROMPT_VERSION,
          },
        });
        return new Response(JSON.stringify({
          success: true,
          parsed,
          aiResponse: aiResponse,
          usage,
          requestId,
          timestamp: new Date().toISOString(),
          meta: {
            promptVersion: PROMPT_VERSION
          }
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('❌ AI Message Parser error:', error);
        console.error('❌ Error stack:', error.stack);
        const failureModelDecision = resolveModelPolicy({
          feature: 'ai-message-parser',
          operation: 'parse',
        });
        await logLlmRequest(supabase, {
          provider: failureModelDecision.provider,
          model: failureModelDecision.model,
          feature: 'ai-message-parser',
          operation: 'parse',
          requestId,
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            promptVersion: PROMPT_VERSION,
          },
        });
        const statusCode = error.message?.includes('OpenAI') ? 502 : 500;
        return new Response(JSON.stringify({
          success: false,
          error: 'AI parsing failed. Please try again.',
          timestamp: new Date().toISOString(),
          meta: {
            promptVersion: PROMPT_VERSION
          }
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

