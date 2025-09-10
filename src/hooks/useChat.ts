import { useState, useEffect } from 'react';
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
      (event, session) => {
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

  const loadConversations = async () => {
    setLoading(true);
    try {
      // For now, create a mock agency_id and tenant_id since we don't have full user management
      // In production, these would come from the authenticated user's profile
      const mockAgencyId = '00000000-0000-0000-0000-000000000001';
      const mockTenantId = '00000000-0000-0000-0000-000000000001';

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
  };

  const createConversation = async () => {
    try {
      const mockAgencyId = '00000000-0000-0000-0000-000000000001';
      const mockTenantId = '00000000-0000-0000-0000-000000000001';
      
      const newConversation = {
        external_key: `chat-${Date.now()}`,
        channel: 'web' as const,
        state: 'active' as const,
        agency_id: mockAgencyId,
        tenant_id: mockTenantId,
        last_message_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('conversations')
        .insert(newConversation)
        .select()
        .single();

      if (error) throw error;

      setConversations(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
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

  const loadMessages = async () => {
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
  };

  const saveMessage = async (message: {
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: { text?: string; cards?: any[]; pdfUrl?: string; metadata?: any; };
    meta?: { status?: string; [key: string]: any; };
  }) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          ...message,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Don't add to local state here - let the real-time subscription handle it
      // This prevents duplicate messages when we get both the return value and the subscription event
      return data;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  };

  const updateMessageStatus = async (messageId: string, status: string) => {
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
  }, [conversationId]);

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