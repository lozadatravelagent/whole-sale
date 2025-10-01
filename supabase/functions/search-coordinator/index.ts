import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, searches } = await req.json();

    if (!searches || !Array.isArray(searches) || searches.length === 0) {
      throw new Error('searches array is required');
    }

    console.log(`🚀 Search Coordinator - Processing ${searches.length} searches`);
    console.log(`📝 Conversation ID: ${conversationId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jobIds: Record<string, string> = {};
    const dispatchPromises = [];

    // Create jobs and dispatch searches in parallel
    for (const search of searches) {
      const { type, provider, params } = search;

      // Create job in database
      const { data: job, error: jobError } = await supabase
        .from('search_jobs')
        .insert({
          conversation_id: conversationId,
          search_type: type,
          provider: provider,
          params: params,
          status: 'pending'
        })
        .select()
        .single();

      if (jobError || !job) {
        console.error(`❌ Failed to create job for ${type}:`, jobError);
        continue;
      }

      console.log(`✅ Created job ${job.id} for ${type} (${provider})`);
      jobIds[type] = job.id;

      // Dispatch search asynchronously (fire and forget)
      const dispatchPromise = (async () => {
        try {
          const functionName = provider === 'TVC' ? 'starling-flights' : 'eurovips-soap';

          console.log(`📤 Dispatching ${type} to ${functionName} with job ${job.id}`);

          // Call the function with jobId - it will update the job when done
          const response = await supabase.functions.invoke(functionName, {
            body: {
              action: type,
              data: params,
              jobId: job.id
            }
          });

          if (response.error) {
            console.error(`❌ Error dispatching ${type}:`, response.error);
            // Mark job as failed
            await supabase
              .from('search_jobs')
              .update({
                status: 'failed',
                error: response.error.message,
                completed_at: new Date().toISOString()
              })
              .eq('id', job.id);
          } else {
            console.log(`✅ Successfully dispatched ${type}`);
          }
        } catch (error) {
          console.error(`❌ Exception dispatching ${type}:`, error);
          // Mark job as failed
          await supabase
            .from('search_jobs')
            .update({
              status: 'failed',
              error: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
      })();

      dispatchPromises.push(dispatchPromise);
    }

    // Wait for all dispatches to complete (but don't wait for searches to finish)
    await Promise.all(dispatchPromises);

    console.log(`🎯 All searches dispatched. Job IDs:`, jobIds);

    // Return job IDs immediately - frontend will listen for updates via Realtime
    return new Response(JSON.stringify({
      success: true,
      jobIds: jobIds,
      message: `${Object.keys(jobIds).length} searches dispatched`,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Search Coordinator Error:', error);
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
