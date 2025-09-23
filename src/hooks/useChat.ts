import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ConversationRow = Database['public']['Tables']['conversations']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const loadConversations = useCallback(async (isRetry = false) => {
    // Prevent infinite retries
    if (isRetry && retryCount >= maxRetries) {
      console.warn('⚠️ Max retries reached for loadConversations, stopping');
      return;
    }

    setLoading(true);
    try {
      // For now, create a mock agency_id and tenant_id since we don't have full user management
      // In production, these would come from the authenticated user's profile
      const mockAgencyId = '00000000-0000-0000-0000-000000000001';

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agency_id', mockAgencyId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      setConversations(data || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error('Error loading conversations:', error);

      // Only retry for network errors, not for authentication or other errors
      const isNetworkError = error.message?.includes('Failed to fetch') ||
                            error.message?.includes('ERR_CONNECTION_CLOSED') ||
                            error.message?.includes('ERR_NETWORK');

      if (isNetworkError && retryCount < maxRetries) {
        console.log(`⏳ Retrying loadConversations (${retryCount + 1}/${maxRetries}) in 2 seconds...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadConversations(true), 2000);
      } else {
        console.error('❌ loadConversations failed permanently, stopping retries');
        setRetryCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount, maxRetries]);

  const createConversation = async (params?: {
    title?: string;
    user_id?: string;
    status?: 'active' | 'closed';
    channel?: 'web' | 'whatsapp';
    meta?: Record<string, unknown>;
  }) => {
    console.log('💾 [SUPABASE] Starting createConversation');
    console.log('📋 Parameters received:', params);

    try {
      const mockAgencyId = '00000000-0000-0000-0000-000000000001';
      const mockTenantId = '00000000-0000-0000-0000-000000000001';

      const newConversation = {
        external_key: `chat-${Date.now()}`,
        channel: (params?.channel === 'whatsapp' ? 'wa' : params?.channel || 'web') as 'web' | 'wa',
        state: (params?.status || 'active') as 'active' | 'closed' | 'pending',
        agency_id: mockAgencyId,
        tenant_id: mockTenantId,
        last_message_at: new Date().toISOString()
        // Note: meta field doesn't exist in database schema, removed
      };

      console.log('📤 [SUPABASE] About to INSERT into conversations table');
      console.log('📋 Data to insert:', newConversation);

      const { data, error } = await supabase
        .from('conversations')
        .insert(newConversation)
        .select()
        .single();

      console.log('📨 [SUPABASE] INSERT response received');
      console.log('✅ Success:', !error);
      console.log('❌ Error:', error);
      console.log('💾 Data:', data);

      if (error) {
        console.error('❌ [SUPABASE] Database error in createConversation:', error);
        throw error;
      }

      console.log('🔄 [SUPABASE] Updating local conversations state');
      setConversations(prev => [data, ...prev]);

      console.log('✅ [SUPABASE] createConversation completed successfully');
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE] Error in createConversation process:', error);
      throw error;
    }
  };

  const updateConversationState = async (id: string, state: 'active' | 'closed') => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({ state })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setConversations(prev => 
        prev.map(conv => conv.id === id ? data : conv)
      );
    } catch (error) {
      console.error('Error updating conversation state:', error);
      throw error;
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({ 
          external_key: title,
          last_message_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setConversations(prev => 
        prev.map(conv => conv.id === id ? data : conv)
      );
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw error;
    }
  };

  return {
    conversations,
    loading,
    loadConversations,
    createConversation,
    updateConversationState,
    updateConversationTitle
  };
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const saveMessage = async (message: {
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: { text?: string; cards?: any[]; pdfUrl?: string; metadata?: Record<string, any>; };
    meta?: { status?: string; [key: string]: any; };
  }) => {
    console.log('💾 [SUPABASE] Starting saveMessage');
    console.log('📋 Message to save:', message);
    console.log('👤 Role:', message.role);
    console.log('💬 Content preview:', typeof message.content === 'object' ? JSON.stringify(message.content).substring(0, 100) + '...' : message.content);

    try {
      const messageData = {
        conversation_id: message.conversation_id,
        role: message.role,
        content: message.content as any, // Cast to Json compatible type
        meta: message.meta as any, // Cast to Json compatible type
        created_at: new Date().toISOString()
      };

      console.log('📤 [SUPABASE] About to INSERT into messages table');
      console.log('📋 Data to insert:', messageData);

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      console.log('📨 [SUPABASE] INSERT response received');
      console.log('✅ Success:', !error);
      console.log('❌ Error:', error);

      if (error) {
        console.error('❌ [SUPABASE] Database error in saveMessage:', error);
        throw error;
      }

      console.log('💾 [SUPABASE] Message saved with ID:', data.id);
      console.log('🔄 [SUPABASE] Letting real-time subscription handle state update');

      // Don't add to local state here - let the real-time subscription handle it
      // This prevents duplicate messages when we get both the return value and the subscription event
      console.log('✅ [SUPABASE] saveMessage completed successfully');
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE] Error in saveMessage process:', error);
      throw error;
    }
  };

  const updateMessageStatus = async (messageId: string, status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed') => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({ 
          meta: { status }
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      // Don't update local state here - let the real-time subscription handle it
      return data;
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  };

  // Load messages initially
  useEffect(() => {
    loadMessages();
  }, [conversationId, loadMessages]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) {
      console.log('No conversationId - skipping real-time setup');
      return;
    }

    console.log(`🔴 Setting up real-time subscription for conversation: ${conversationId}`);

    const channel = supabase
      .channel(`messages-${conversationId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: conversationId }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('🟢 NEW MESSAGE RECEIVED via real-time:', payload.new);
          const newMessage = payload.new as MessageRow;
          
          setMessages(prev => {
            console.log('🔵 Current messages count:', prev.length);
            // Check if message already exists to prevent duplicates
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('🟡 Duplicate message prevented:', newMessage.id);
              return prev;
            }
            
            console.log('🟢 Adding new message to state:', newMessage.id, newMessage.content);
            // Add new message in chronological order and force re-render
            const updated = [...prev, newMessage].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            
            console.log('🔵 Updated messages count:', updated.length);
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('🟡 Message updated via real-time:', payload.new);
          const updatedMessage = payload.new as MessageRow;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe((status, err) => {
        console.log(`🔴 Real-time subscription status for ${conversationId}:`, status);
        if (err) {
          console.error('🔴 Real-time subscription ERROR:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription ACTIVE for conversation:', conversationId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription ERROR for conversation:', conversationId);
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Real-time subscription TIMED OUT for conversation:', conversationId);
        }
      });

    return () => {
      console.log(`🔴 Cleaning up real-time subscription for conversation: ${conversationId}`);
      channel.unsubscribe();
    };
  }, [conversationId]);

  return {
    messages,
    loading,
    loadMessages,
    saveMessage,
    updateMessageStatus
  };
}