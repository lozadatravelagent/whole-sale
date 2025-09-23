import { supabase } from '@/integrations/supabase/client';

// Use Supabase add-message function instead of direct saveMessage
export const addMessageViaSupabase = async (messageData: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: { text?: string; cards?: unknown[]; pdfUrl?: string; metadata?: Record<string, unknown>; };
  meta?: { status?: string;[key: string]: unknown; };
}) => {
  console.log('📤 [SUPABASE FUNCTION] About to call add-message function');
  console.log('📋 Message data:', messageData);

  try {
    const response = await supabase.functions.invoke('add-message', {
      body: {
        conversationId: messageData.conversation_id,
        role: messageData.role,
        content: messageData.content,
        meta: messageData.meta
      }
    });

    if (response.error) {
      console.error('❌ [SUPABASE FUNCTION] add-message error:', response.error);
      throw response.error;
    }

    console.log('✅ [SUPABASE FUNCTION] add-message success:', response.data);
    return response.data.message;
  } catch (error) {
    console.error('❌ [SUPABASE FUNCTION] add-message failed:', error);
    throw error;
  }
};

// City code service for EUROVIPS integration
export const getCityCode = async (cityName: string): Promise<string> => {
  try {
    const response = await supabase.functions.invoke('eurovips-soap', {
      body: { action: 'getCountryList', data: {} }
    });

    const countries = response.data.results?.parsed || [];
    const city = countries.find((c: { name: string; code: string }) =>
      c.name.toLowerCase().includes(cityName.toLowerCase())
    );

    return city?.code || cityName;
  } catch (error) {
    console.error('Error getting city code:', error);
    return cityName;
  }
};