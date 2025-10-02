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
  const mockAgencyId = '00000000-0000-0000-0000-000000000001';

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agency_id', mockAgencyId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [mockAgencyId]);

  // Subscribe to real-time conversation updates
  useEffect(() => {
    loadConversations();

    console.log('🔄 [REALTIME] Setting up Realtime subscription for conversations');

    const channel = supabase
      .channel('conversations-channel', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `agency_id=eq.${mockAgencyId}`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Conversation event:', payload.eventType, payload.new);

          if (payload.eventType === 'INSERT') {
            const newConversation = payload.new as ConversationRow;
            setConversations(prev => {
              const exists = prev.some(conv => conv.id === newConversation.id);
              if (exists) return prev;
              return [newConversation, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedConversation = payload.new as ConversationRow;
            setConversations(prev =>
              prev
                .map(conv => conv.id === updatedConversation.id ? updatedConversation : conv)
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Conversations subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Conversations subscribed successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Conversations channel error');
        }
      });

    return () => {
      console.log('🔴 [REALTIME] Unsubscribing from conversations channel');
      supabase.removeChannel(channel);
    };
  }, [loadConversations, mockAgencyId]);

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

      // Preserve optimistic messages (temp IDs) when loading from DB
      setMessages(prev => {
        const optimisticMessages = prev.filter(msg => msg.id.toString().startsWith('temp-'));
        const dbMessages = data || [];

        // Merge: DB messages + optimistic messages that haven't been replaced
        const merged = [...dbMessages];

        optimisticMessages.forEach(optMsg => {
          // Only keep optimistic message if DB doesn't have a similar one
          const existsInDb = dbMessages.some(dbMsg =>
            Math.abs(new Date(dbMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()) < 5000
          );
          if (!existsInDb) {
            merged.push(optMsg);
          }
        });

        return merged.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
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
    meta?: { status?: string;[key: string]: any; };
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

      // Add to local state immediately for instant display
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === data.id);
        if (exists) return prev;

        return [...prev, data].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      console.log('✅ [SUPABASE] saveMessage completed successfully');
      console.log('🔄 Message will sync to other tabs within 2 seconds');
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

  // Load messages initially and subscribe to real-time updates
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    loadMessages();
  }, [conversationId, loadMessages]);

  // Separate effect for Realtime subscription (global channel, reused across conversations)
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    console.log('🔄 [REALTIME] Setting up message listener for conversation:', conversationId);

    // Use a single global channel for all messages
    const channelName = 'global-messages';

    // Check if channel already exists
    let channel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);

    if (!channel) {
      console.log('📢 [REALTIME] Creating new global messages channel');
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages'
          },
          (payload) => {
            const message = payload.new as MessageRow;
            console.log('🔔 [REALTIME] Global message event received:', payload.eventType, 'for conversation:', message.conversation_id);

            // This callback will receive ALL messages, we filter in the specific conversation effect
            // Dispatch custom event for other components to handle
            const event = new CustomEvent('supabase-message', { detail: { payload } });
            window.dispatchEvent(event);
          }
        )
        .subscribe((status) => {
          console.log('📡 [REALTIME] Global messages channel status:', status);
        });
    }

    // Listen for messages via custom events (filtered by conversation)
    const handleMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { payload } = customEvent.detail;
      const message = payload.new as MessageRow;

      // Filter for this conversation only
      if (message.conversation_id !== conversationId) {
        return;
      }

      console.log('📨 [REALTIME] Message for this conversation:', payload.eventType, message);

      if (payload.eventType === 'INSERT') {
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === message.id);
          if (exists) {
            console.log('⚠️ [REALTIME] Message already exists, skipping');
            return prev;
          }

          console.log('✅ [REALTIME] Adding new message to state');
          return [...prev, message].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } else if (payload.eventType === 'UPDATE') {
        setMessages(prev =>
          prev.map(msg => msg.id === message.id ? message : msg)
        );
      }
    };

    window.addEventListener('supabase-message', handleMessage);

    return () => {
      console.log('🔴 [REALTIME] Removing message listener for conversation:', conversationId);
      window.removeEventListener('supabase-message', handleMessage);
      // Don't remove the channel, it's shared across all conversations
    };
  }, [conversationId]);

  // Add a function to force refresh messages
  const refreshMessages = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  // Add a function to add optimistic message (before saving to DB)
  const addOptimisticMessage = useCallback((message: any) => {
    setMessages(prev => {
      // Check if message already exists
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) return prev;

      // Add and sort by created_at
      return [...prev, message].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  return {
    messages,
    loading,
    loadMessages,
    saveMessage,
    updateMessageStatus,
    refreshMessages,
    addOptimisticMessage
  };
}