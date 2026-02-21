import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { buildSystemPrompt, PROMPT_VERSION } from "./prompt.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
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
      try {
        const requestBody = await req.json();
        const {
          message = requestBody.prompt, // Support both 'message' and 'prompt'
          language = 'es',
          currentDate = new Date().toISOString().split('T')[0], // Default to today's date (YYYY-MM-DD)
          previousContext,
          conversationHistory = []
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
            // Take last 20 messages for comprehensive context (up from 8)
            const recentHistory = conversationHistory.slice(-20);

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
          previousContext
        });
        const userPrompt = message;
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
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
        return new Response(JSON.stringify({
          success: true,
          parsed,
          aiResponse: aiResponse,
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
        // More specific error handling
        let errorMessage = 'Unknown error occurred';
        let statusCode = 500;
        if (error.message) {
          errorMessage = error.message;
        }
        if (error.message?.includes('OpenAI')) {
          statusCode = 502; // Bad Gateway for external service errors
        }
        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
          errorType: error.constructor.name,
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

