import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ConversationRow = Database['public']['Tables']['conversations']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];

// ✅ Global Set to track processed message IDs across ALL instances (prevents duplicates from multiple listeners)
const globalProcessedMessageIds = new Set<string>();

// ✅ Global Set to track pending optimistic client_ids (prevents Realtime from adding duplicates)
// When optimistic message is added: globalPendingOptimisticClientIds.add(clientId)
// When Realtime finds the optimistic message: globalPendingOptimisticClientIds.delete(clientId)
const globalPendingOptimisticClientIds = new Set<string>();

// ✅ Helper function to get client_id from message (checks direct column first, then meta)
function getClientId(message: MessageRow | any): string | null | undefined {
  // Try direct column first (after migration 20251028000001)
  if (message.client_id) {
    return message.client_id;
  }
  // Fallback to meta (for backwards compatibility)
  const meta = message.meta as any;
  return meta?.client_id;
}

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

// ✅ Global callback to refresh messages when conversation is updated
// This allows useConversations to notify useMessages when a conversation update should trigger message refresh
let globalRefreshMessagesCallback: ((conversationId: string) => void) | null = null;

export function setRefreshMessagesCallback(callback: ((conversationId: string) => void) | null) {
  globalRefreshMessagesCallback = callback;
}

export function useConversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      // Use RPC function that applies RLS policies correctly
      // This function filters conversations based on user role:
      // OWNER: sees all conversations
      // SUPERADMIN: sees conversations in their tenant (all agencies)
      // ADMIN: sees conversations in their agency
      // SELLER: sees only their conversations (created_by = user)
      const { data, error } = await (supabase as any)
        .rpc('get_conversations_with_agency')
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // @ts-ignore - Data type from RPC is compatible with array
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
          table: 'conversations'
          // No filter - RLS policies handle authorization
        },
        (payload) => {
          console.log('🔔 [REALTIME] Conversation event:', payload.eventType, payload.new);

          if (payload.eventType === 'INSERT') {
            // ⚡ OPTIMIZATION: Skip reload if we just created this conversation locally
            // The optimistic update already added it to the list (line 172)
            setConversations(prev => {
              const existsLocally = prev.some(c => c.id === payload.new.id);
              if (existsLocally) {
                console.log('⚡ [REALTIME] Conversation already in local state, skipping reload');
                return prev; // No reload needed - saves ~300-800ms
              }
              console.log('🔄 [REALTIME] New conversation from another user, reloading...');
              loadConversations();
              return prev; // loadConversations will update state
            });
          } else if (payload.eventType === 'UPDATE') {
            // For updates, only reload if it affects visible data
            console.log('🔄 [REALTIME] Conversation updated, reloading to get enriched data');
            loadConversations();

            // ✅ If global refresh callback exists, also refresh messages for this conversation
            // This ensures messages are reloaded when conversation metadata changes (e.g., title, last_message_at)
            if (globalRefreshMessagesCallback && payload.new?.id) {
              console.log('🔄 [REALTIME] Triggering message refresh for updated conversation:', payload.new.id);
              globalRefreshMessagesCallback(payload.new.id);
            }
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
  }, [loadConversations]);

  const createConversation = async (params?: {
    title?: string;
    user_id?: string;
    status?: 'active' | 'closed';
    channel?: 'web' | 'whatsapp';
    meta?: Record<string, unknown>;
    userData?: { agency_id: string | null; tenant_id: string | null; role: string }; // ⚡ OPTIMIZATION: Accept cached user data
  }) => {
    console.log('💾 [SUPABASE] Starting createConversation');
    console.log('📋 Parameters received:', params);

    try {
      // Get current user's agency_id and tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // ⚡ OPTIMIZATION: Use provided userData if available, otherwise fetch (saves ~50-150ms)
      let userData = params?.userData;
      if (!userData) {
        console.log('⚠️ [SUPABASE] No cached user data provided, fetching from DB...');
        const { data: fetchedUserData } = await supabase
          .from('users')
          .select('agency_id, tenant_id, role')
          .eq('id', user.id)
          .single();
        userData = fetchedUserData;
      } else {
        console.log('⚡ [SUPABASE] Using cached user data (saved ~50-150ms)');
      }

      const userRole = userData?.role;

      // OWNER and SUPERADMIN can have null agency_id (they manage multiple agencies)
      // SUPERADMIN: has tenant_id but agency_id = NULL (manages all agencies in tenant)
      // OWNER: both tenant_id and agency_id = NULL (manages everything)
      const canHaveNullAgency = userRole === 'OWNER' || userRole === 'SUPERADMIN';

      // ADMIN and SELLER MUST have agency_id
      if (!canHaveNullAgency && !userData?.agency_id) {
        throw new Error('User has no agency assigned');
      }

      // SUPERADMIN must have tenant_id even if agency_id is null
      if (userRole === 'SUPERADMIN' && !userData?.tenant_id) {
        throw new Error('SUPERADMIN must have tenant assigned');
      }

      const newConversation = {
        external_key: `chat-${Date.now()}`,
        channel: (params?.channel === 'whatsapp' ? 'wa' : params?.channel || 'web') as 'web' | 'wa',
        state: (params?.status || 'active') as 'active' | 'closed' | 'pending',
        agency_id: userData.agency_id || null, // NULL for OWNER and SUPERADMIN
        tenant_id: userData.tenant_id || null, // NULL for OWNER, required for SUPERADMIN
        created_by: user.id, // Set conversation owner
        last_message_at: new Date().toISOString()
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

  // ✅ Track current conversation to prevent stale event handlers
  const currentConversationRef = useRef<string | null>(conversationId);

  // ✅ Track active listener handler to prevent duplicates
  const listenerHandlerRef = useRef<((event: Event) => void) | null>(null);

  // ✅ Track if effect is currently active to prevent race conditions
  const isActiveRef = useRef(false);

  // ✅ Track reconnect timeout to prevent multiple simultaneous reconnects
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Track if reconnect is already in progress (global across all useMessages instances)
  const reconnectInProgressRef = useRef(false);

  // Update ref when conversation changes
  useEffect(() => {
    currentConversationRef.current = conversationId;
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    // ⚡ OPTIMISTIC UI: Skip SELECT for temporary conversations (instant display)
    if (conversationId.startsWith('temp-')) {
      console.log('⚡ [OPTIMISTIC UI] Skipping SELECT for temporary conversation:', conversationId);
      setMessages([]); // Empty messages for new chat
      setLoading(false);
      return;
    }

    setLoading(true);
    const startTime = performance.now();
    try {
      console.log('📤 [MESSAGES] SELECT messages for conversation:', conversationId, `[Start: ${startTime.toFixed(0)}ms]`);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      const elapsed = (performance.now() - startTime).toFixed(0);
      console.log(`📨 [MESSAGES] SELECT completed in ${elapsed}ms, found`, data?.length || 0, 'messages');
      if (error) throw error;

      // Merge DB messages with existing messages (preserve messages already in state from Realtime)
      setMessages(prev => {
        const optimisticMessages = prev.filter(msg => msg.id.toString().startsWith('temp-'));
        const realMessages = prev.filter(msg => !msg.id.toString().startsWith('temp-'));
        const dbMessages = data || [];

        // Start with DB messages as source of truth
        const merged = [...dbMessages];

        // ✅ STEP 1: Preserve real messages that came via Realtime but aren't in DB yet (race condition protection)
        // This handles the case where Realtime INSERT arrives before the SELECT completes
        realMessages.forEach(realMsg => {
          const existsInDb = dbMessages.some(dbMsg => dbMsg.id === realMsg.id);
          if (!existsInDb) {
            // Check if this is a duplicate by client_id
            const realClientId = getClientId(realMsg);
            if (realClientId) {
              const existsByClientId = dbMessages.some(dbMsg => getClientId(dbMsg) === realClientId);
              if (existsByClientId) {
                console.log('🔒 [LOAD] Realtime message already exists in DB (matched by client_id), skipping:', realClientId);
                return;
              }
            }
            // Check if this is a duplicate by content and time (fallback)
            const existsSimilar = dbMessages.some(dbMsg =>
              dbMsg.role === realMsg.role &&
              typeof dbMsg.content === 'object' && typeof realMsg.content === 'object' &&
              (dbMsg.content as any).text === (realMsg.content as any).text &&
              Math.abs(new Date(dbMsg.created_at).getTime() - new Date(realMsg.created_at).getTime()) < 5000
            );
            if (!existsSimilar) {
              merged.push(realMsg);
              console.log('⚡ [LOAD] Preserving Realtime message not yet in DB:', realMsg.id);
            }
          }
        });

        // ✅ STEP 2: Preserve optimistic messages that haven't been replaced
        optimisticMessages.forEach(optMsg => {
          const optClientId = getClientId(optMsg);

          // Check by client_id (strongest de-dupe)
          if (optClientId) {
            const existsByClientId = merged.some(msg =>
              !msg.id.toString().startsWith('temp-') &&
              getClientId(msg) === optClientId
            );
            if (existsByClientId) {
              console.log('🔒 [LOAD] Optimistic message already exists (matched by client_id), skipping:', optClientId);
              return; // Skip this optimistic message
            }
          }

          // Fallback heuristic matching (for legacy messages without client_id)
          const existsInMerged = merged.some(msg =>
            !msg.id.toString().startsWith('temp-') &&
            msg.role === optMsg.role &&
            typeof msg.content === 'object' && typeof optMsg.content === 'object' &&
            (msg.content as any).text === (optMsg.content as any).text &&
            Math.abs(new Date(msg.created_at).getTime() - new Date(optMsg.created_at).getTime()) < 5000
          );

          if (!existsInMerged) {
            merged.push(optMsg);
            console.log('⚡ [LOAD] Keeping optimistic message (no match):', optMsg.id);
          } else {
            console.log('🔒 [LOAD] Optimistic message matched, skipping:', optMsg.id);
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
    // ✅ ALWAYS clear messages first when conversation changes (prevents stale data)
    setMessages([]);

    if (!conversationId) {
      return;
    }

    console.log('🔄 [MESSAGES] Loading messages for conversation:', conversationId);
    loadMessages();
    // ✅ REMOVED loadMessages from dependencies to prevent duplicate executions
    // loadMessages is stable (only depends on conversationId) and we want to call it only when conversationId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Separate effect for Realtime subscription (global channel, reused across conversations)
  useEffect(() => {
    if (!conversationId) {
      isActiveRef.current = false;
      return;
    }

    // ✅ Mark effect as active
    isActiveRef.current = true;

    console.log('🔄 [REALTIME] Setting up message listener for conversation:', conversationId);

    // ✅ Clean up previous listener if exists
    if (listenerHandlerRef.current) {
      console.log('🧹 [REALTIME] Cleaning up previous listener');
      window.removeEventListener('supabase-message', listenerHandlerRef.current);
      listenerHandlerRef.current = null;
    }

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

          // ✅ AUTO-RECONNECT: Handle channel errors and disconnections
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.error('❌ [REALTIME] Channel error detected - preparing to reconnect');

            // ✅ Prevent multiple simultaneous reconnect attempts
            if (reconnectInProgressRef.current) {
              console.log('⏭️ [REALTIME] Reconnect already in progress, skipping duplicate attempt');
              return;
            }

            reconnectInProgressRef.current = true;

            // ✅ Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            // ✅ Wait 2 seconds before reconnecting (allow network to stabilize)
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('🔄 [REALTIME] Attempting to reconnect channel...');

              try {
                // Remove broken channel
                supabase.removeChannel(channel);
                console.log('🗑️ [REALTIME] Removed broken channel');

                // Reset reconnect flag
                reconnectInProgressRef.current = false;

                // Refresh messages to sync any that were missed during disconnect
                console.log('🔄 [REALTIME] Refreshing messages after reconnect...');
                loadMessages();

                console.log('✅ [REALTIME] Reconnect completed - subscription will be recreated on next effect run');
              } catch (reconnectError) {
                console.error('❌ [REALTIME] Error during reconnect:', reconnectError);
                reconnectInProgressRef.current = false;

                // Retry reconnect after another 5 seconds if it failed
                reconnectTimeoutRef.current = setTimeout(() => {
                  console.log('🔄 [REALTIME] Retrying reconnect after failure...');
                  reconnectInProgressRef.current = false;
                  supabase.removeChannel(channel);
                  loadMessages();
                }, 5000);
              }
            }, 2000);
          }

          // ✅ Reset reconnect flag when successfully subscribed
          if (status === 'SUBSCRIBED') {
            console.log('✅ [REALTIME] Successfully subscribed to messages channel');
            reconnectInProgressRef.current = false;

            // Clear any pending reconnect timeouts
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }
          }
        });
    }

    // ✅ Create handler with stable reference
    const handleMessage = (event: Event) => {
      try {
        // ✅ Double-check effect is still active (prevent stale handlers)
        if (!isActiveRef.current) {
          console.log('⏭️ [REALTIME] Effect no longer active, ignoring message event');
          return;
        }

        const customEvent = event as CustomEvent;
        const { payload } = customEvent.detail;

        // ✅ Validate payload structure before processing
        if (!payload || !payload.new || typeof payload.new !== 'object') {
          console.warn('⚠️ [REALTIME] Invalid payload structure, skipping:', payload);
          return;
        }

        const message = payload.new as MessageRow;

        // ✅ Validate required message fields
        if (!message.id || !message.conversation_id || !message.role) {
          console.warn('⚠️ [REALTIME] Message missing required fields, skipping:', message);
          return;
        }

        // ✅ Filter for CURRENT conversation only (use ref to avoid stale closures)
        const currentConv = currentConversationRef.current;
        if (!currentConv || message.conversation_id !== currentConv) {
          return;
        }

        console.log('📨 [REALTIME] Message for this conversation:', payload.eventType, message);

      if (payload.eventType === 'INSERT') {
        // ✅ STEP 0: Check if this exact message ID was already processed (race condition protection)
        // Use GLOBAL Set (not ref) to prevent multiple listeners from processing same event
        // ATOMIC operation: Check and add in one step to prevent race conditions
        // If the ID already exists, Set.add() returns false (didn't add because already present)
        // If the ID doesn't exist, Set.add() returns true (successfully added)
        const wasAlreadyProcessed = !globalProcessedMessageIds.add(message.id);

        if (wasAlreadyProcessed) {
          console.log('🔒 [REALTIME] Message ID already processed globally (by another listener), skipping:', message.id);
          return;
        }

        console.log('🔒 [REALTIME] Marked message as processed globally:', message.id);

        // Clean up old processed IDs periodically (keep only last 1000 to prevent memory leak)
        // Note: This cleanup is safe even if multiple listeners run it simultaneously
        if (globalProcessedMessageIds.size > 1000) {
          const idsArray = Array.from(globalProcessedMessageIds);
          // Keep only the most recent 500 IDs
          const recentIds = idsArray.slice(-500);
          globalProcessedMessageIds.clear();
          recentIds.forEach(id => globalProcessedMessageIds.add(id));
          console.log('🧹 [REALTIME] Cleaned up global processed message IDs, kept last 500');
        }

        // ✅ Double-check effect is still active before updating state
        if (!isActiveRef.current) {
          console.log('⏭️ [REALTIME] Effect no longer active, skipping state update');
          return;
        }

        setMessages(prev => {
          const messageClientId = getClientId(message);

          console.log('🔍 [REALTIME DEDUP] Starting deduplication checks:', {
            incoming_message_id: message.id,
            incoming_client_id: messageClientId,
            current_state_size: prev.length,
            optimistic_messages_in_state: prev.filter(m => m.id.startsWith('temp-')).length,
            pending_optimistic_client_ids: Array.from(globalPendingOptimisticClientIds)
          });

          // 🔥 CRITICAL FIX: STEP 0 - Check global pending set FIRST (eliminates race condition)
          // This check happens BEFORE looking at React state, so it works even if state update hasn't propagated yet
          if (messageClientId && globalPendingOptimisticClientIds.has(messageClientId)) {
            console.log('🔐 [REALTIME DEDUP] STEP 0 - Found pending optimistic client_id in global set!');
            console.log('🔐 [REALTIME DEDUP] This is an optimistic message echo, will search and replace in state');

            // Remove from pending set (message is now confirmed from DB)
            globalPendingOptimisticClientIds.delete(messageClientId);
            console.log('🔐 [REALTIME DEDUP] Removed client_id from pending set:', messageClientId);
          }

          // 🔥 FIX: STEP 1 - First try to REPLACE optimistic message (HIGHEST PRIORITY)
          // This prevents race conditions where we check for existing messages before the optimistic update completes
          let optimisticIndex = -1;
          if (messageClientId) {
            optimisticIndex = prev.findIndex(msg => {
              const msgClientId = getClientId(msg);
              const matches = msg.id.startsWith('temp-') && msgClientId === messageClientId;
              if (matches) {
                console.log('🎯 [REALTIME DEDUP] Found optimistic message to replace:', {
                  optimistic_id: msg.id,
                  client_id: msgClientId,
                  will_replace_with: message.id
                });
              }
              return matches;
            });

            if (optimisticIndex !== -1) {
              console.log('🔄 [REALTIME] ✅ Replacing optimistic message with real one (matched by client_id)');
              const updated = [...prev];
              updated[optimisticIndex] = message;
              return updated.sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            }
            console.log('⚠️ [REALTIME DEDUP] STEP 1 - No optimistic message found with matching client_id');
          } else {
            console.log('⚠️ [REALTIME DEDUP] No client_id found in incoming message!');
          }

          // ✅ STEP 2: Check if message with this client_id already exists (strong de-dupe)
          if (messageClientId) {
            const existingWithClientId = prev.find(msg => getClientId(msg) === messageClientId);
            if (existingWithClientId) {
              console.log('🔒 [REALTIME] Message with client_id already exists (non-optimistic), skipping:', {
                client_id: messageClientId,
                existing_msg_id: existingWithClientId.id,
                existing_is_optimistic: existingWithClientId.id.startsWith('temp-')
              });
              return prev;
            }
            console.log('✅ [REALTIME DEDUP] STEP 2 passed - no message with this client_id exists');
          }

          // ✅ STEP 3: Check by message id (prevents duplicate real messages - double check)
          const exists = prev.some(msg => msg.id === message.id);
          if (exists) {
            console.log('⚠️ [REALTIME] Message with same id already exists in state, skipping:', message.id);
            return prev;
          }
          console.log('✅ [REALTIME DEDUP] STEP 3 passed - message id is unique');

          // ✅ STEP 4: Fallback heuristic matching (for legacy messages without client_id)
          // Check if there's an optimistic message with the same role, content, and similar timestamp
          optimisticIndex = prev.findIndex(msg =>
            msg.id.startsWith('temp-') &&
            msg.role === message.role &&
            !msg.id.startsWith('temp-thinking-') && // Don't remove thinking messages
            typeof msg.content === 'object' && typeof message.content === 'object' &&
            (msg.content as any).text === (message.content as any).text &&
            Math.abs(new Date(msg.created_at).getTime() - new Date(message.created_at).getTime()) < 5000 // Within 5 seconds
          );

          if (optimisticIndex !== -1) {
            console.log('🔄 [REALTIME] Replacing optimistic message with real one (matched by heuristic)');
            const updated = [...prev];
            updated[optimisticIndex] = message;
            return updated.sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }

          console.log('⚠️ [REALTIME DEDUP] STEP 4 - No optimistic message found by heuristic match');

          // 🔥 CRITICAL: If we reached here with a client_id that's in pending set,
          // it means optimistic message was added but not yet in React state
          // Clean up the pending set to prevent memory leak
          if (messageClientId && globalPendingOptimisticClientIds.has(messageClientId)) {
            console.log('🧹 [REALTIME DEDUP] Cleaning up orphaned pending client_id (optimistic message not found in state):', messageClientId);
            globalPendingOptimisticClientIds.delete(messageClientId);
          }

          // ✅ STEP 5: Add as new message (only if no match found)
          console.log('🚨 [REALTIME] ⚠️ ADDING NEW MESSAGE TO STATE - This may cause duplication!', {
            message_id: message.id,
            client_id: messageClientId,
            role: message.role,
            content_preview: typeof message.content === 'object' ? (message.content as any).text?.substring(0, 50) : String(message.content).substring(0, 50),
            all_current_ids: prev.map(m => ({ id: m.id, client_id: getClientId(m) }))
          });

          return [...prev, message].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } else if (payload.eventType === 'UPDATE') {
        // ✅ Double-check effect is still active before updating state
        if (!isActiveRef.current) {
          return;
        }
        setMessages(prev =>
          prev.map(msg => msg.id === message.id ? message : msg)
        );
      }
      } catch (error) {
        // ✅ ERROR BOUNDARY: Prevent handler crashes from breaking Realtime subscription
        // This ensures the subscription stays alive even if message processing fails
        console.error('❌ [REALTIME] Handler error - subscription will continue:', error);
        console.error('❌ [REALTIME] Error details:', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          conversationId: currentConversationRef.current
        });

        // Don't throw - allow subscription to continue processing future messages
        // User will see existing messages and can refresh if needed
      }
    };

    // ✅ Store handler reference for cleanup
    listenerHandlerRef.current = handleMessage;
    window.addEventListener('supabase-message', handleMessage);

    return () => {
      console.log('🔴 [REALTIME] Removing message listener for conversation:', conversationId);
      isActiveRef.current = false;
      if (listenerHandlerRef.current) {
        window.removeEventListener('supabase-message', listenerHandlerRef.current);
        listenerHandlerRef.current = null;
      }

      // ✅ Cleanup reconnect timeout on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        console.log('🧹 [REALTIME] Cleaned up reconnect timeout');
      }

      // Don't remove the channel, it's shared across all conversations
      // Note: globalProcessedMessageIds is shared across all instances and is cleaned up automatically
    };
  }, [conversationId]);

  // Add a function to force refresh messages
  const refreshMessages = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  // ✅ Register refresh callback globally so useConversations can trigger message refresh
  useEffect(() => {
    if (!conversationId) {
      setRefreshMessagesCallback(null);
      return;
    }

    const refreshCallback = (updatedConversationId: string) => {
      // Only refresh if this is the currently selected conversation
      if (updatedConversationId === conversationId) {
        console.log('🔄 [MESSAGES] Conversation updated, refreshing messages');
        loadMessages();
      }
    };

    setRefreshMessagesCallback(refreshCallback);

    return () => {
      setRefreshMessagesCallback(null);
    };
  }, [conversationId, loadMessages]);

  // Add a function to add optimistic message (before saving to DB)
  const addOptimisticMessage = useCallback((message: any) => {
    console.log('🔵 [OPTIMISTIC] addOptimisticMessage called with:', {
      id: message.id,
      client_id: getClientId(message),
      content_preview: typeof message.content === 'object' ? message.content.text?.substring(0, 50) : String(message.content).substring(0, 50)
    });

    // 🔥 CRITICAL FIX: Register client_id GLOBALLY before adding to state
    // This ensures Realtime handler will ALWAYS see it, even if state update hasn't propagated yet
    const messageClientId = getClientId(message);
    if (messageClientId) {
      globalPendingOptimisticClientIds.add(messageClientId);
      console.log('🔐 [OPTIMISTIC] Registered pending optimistic client_id globally:', messageClientId);
    }

    setMessages(prev => {
      // Check if message already exists by ID
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) {
        console.log('🔒 [OPTIMISTIC] Message ID already exists in state, skipping:', message.id);
        return prev;
      }

      // 🔥 FIX: Check if message with same client_id already exists
      if (messageClientId) {
        const existsByClientId = prev.some(msg => getClientId(msg) === messageClientId);
        if (existsByClientId) {
          console.log('🔒 [OPTIMISTIC] Message with client_id already exists, skipping:', messageClientId);
          return prev;
        }
      }

      console.log('✅ [OPTIMISTIC] Adding message to state. Current state size:', prev.length);

      // Add and sort by created_at
      return [...prev, message].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  // Add a function to update optimistic message (for thinking/progress updates)
  const updateOptimisticMessage = useCallback((messageId: string, updates: Partial<any>) => {
    setMessages(prev => {
      return prev.map(msg =>
        msg.id === messageId
          ? { ...msg, ...updates }
          : msg
      );
    });
  }, []);

  // Add a function to remove optimistic message
  const removeOptimisticMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  return {
    messages,
    loading,
    loadMessages,
    saveMessage,
    updateMessageStatus,
    refreshMessages,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage
  };
}