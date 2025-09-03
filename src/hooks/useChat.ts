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

      setMessages(prev => [...prev, data]);
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

      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? data : msg)
      );
      return data;
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  return {
    messages,
    loading,
    loadMessages,
    saveMessage,
    updateMessageStatus
  };
}