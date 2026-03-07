import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ChatState, ConversationWorkspaceMode } from '../types/chat';
import { useAuth, useConversations } from '@/hooks/useChat';
import { useAuth as useAuthContext } from '@/contexts/AuthContext'; // ⚡ OPTIMIZATION: Use cached user data
import { useToast } from '@/hooks/use-toast';

const useChatState = () => {
  const [chatState, setChatState] = useState<ChatState>({
    selectedConversation: null,
    message: '',
    isLoading: false,
    isUploadingPdf: false,
    lastPdfAnalysis: null,
    showInspirationText: false,
    activeTab: 'active',
    workspaceMode: 'standard',
    historyMode: 'standard',
    // ✅ Typing state per conversation (not global)
    typingByConversation: {},
    sidebarLimit: 50,
    previousParsedRequest: null,
    isAddingToCRM: false
  });

  // ✅ Ref that always has the current conversation ID (for async operations)
  const selectedConversationRef = useRef(chatState.selectedConversation);

  // Update ref when conversation changes
  useEffect(() => {
    selectedConversationRef.current = chatState.selectedConversation;
  }, [chatState.selectedConversation]);

  const { user } = useAuth();
  const authUser = useAuthContext(); // ⚡ OPTIMIZATION: Cached user data with agency_id, tenant_id, role
  const {
    conversations,
    loadConversations,
    createConversation,
    updateConversationState,
    updateConversationTitle
  } = useConversations();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Update individual state properties
  const updateChatState = useCallback((updates: Partial<ChatState>) => {
    setChatState(prev => ({ ...prev, ...updates }));
  }, []);

  // Setters for individual properties
  const setSelectedConversation = useCallback((id: string | null) => {
    updateChatState({
      selectedConversation: id,
      // 🧹 Clear previousParsedRequest when switching conversations to prevent cross-contamination
      previousParsedRequest: null
    });
  }, [updateChatState]);

  const setMessage = useCallback((message: string) => {
    updateChatState({ message });
  }, [updateChatState]);

  const setIsLoading = useCallback((isLoading: boolean) => {
    updateChatState({ isLoading });
  }, [updateChatState]);

  // ✅ Setters for typing state per conversation (using functional updates to avoid stale closures)
  // Can optionally specify conversationId to update a different conversation (not the current one)
  const setIsTyping = useCallback((isTyping: boolean, conversationId?: string | null) => {
    setChatState(prev => {
      const targetConversation = conversationId || prev.selectedConversation;
      if (!targetConversation) return prev;

      return {
        ...prev,
        typingByConversation: {
          ...prev.typingByConversation,
          [targetConversation]: {
            ...(prev.typingByConversation[targetConversation] || { isTyping: false, message: '' }),
            isTyping
          }
        }
      };
    });
  }, []);

  const setTypingMessage = useCallback((message: string, conversationId?: string | null) => {
    setChatState(prev => {
      const targetConversation = conversationId || prev.selectedConversation;
      if (!targetConversation) return prev;

      const currentState = prev.typingByConversation[targetConversation] || { isTyping: false, message: '' };

      return {
        ...prev,
        typingByConversation: {
          ...prev.typingByConversation,
          [targetConversation]: {
            isTyping: currentState.isTyping, // Preserve current isTyping state
            message
          }
        }
      };
    });
  }, []);

  const setActiveTab = useCallback((activeTab: string) => {
    updateChatState({ activeTab });
  }, [updateChatState]);

  const setWorkspaceMode = useCallback((workspaceMode: 'standard' | 'planner') => {
    updateChatState({ workspaceMode });
  }, [updateChatState]);

  const setHistoryMode = useCallback((historyMode: 'standard' | 'planner') => {
    updateChatState({ historyMode });
  }, [updateChatState]);

  const setPreviousParsedRequest = useCallback((request: ParsedTravelRequest | null) => {
    updateChatState({ previousParsedRequest: request });
  }, [updateChatState]);

  const setIsAddingToCRM = useCallback((isAddingToCRM: boolean) => {
    updateChatState({ isAddingToCRM });
  }, [updateChatState]);

  // Create new chat function
  const createNewChat = useCallback(async (
    initialTitle?: string,
    workspaceMode: ConversationWorkspaceMode = 'standard'
  ) => {
    const startTime = performance.now();
    console.log('🚀 [CHAT FLOW] Step 1: Starting createNewChat process', `[${startTime.toFixed(0)}ms]`);
    console.log('👤 User:', user?.id, user?.email);

    if (!user) {
      console.warn('❌ [CHAT FLOW] No user found, aborting chat creation');
      return null;
    }

    try {
      // Generate a dynamic title based on time or use provided title
      const currentTime = new Date();
      const defaultTitle = `Chat ${currentTime.toLocaleDateString('es-ES')} ${currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

      console.log('📝 [CHAT FLOW] Step 2: Preparing conversation data');
      console.log('🏷️ Title:', initialTitle || defaultTitle);

      // ⚡ OPTIMISTIC UI: Generate temporary ID and show UI IMMEDIATELY
      const tempId = `temp-${Date.now()}`;
      const optimisticConversation = {
        id: tempId,
        external_key: initialTitle || defaultTitle,
        channel: 'web' as const,
        state: 'active' as const,
        workspace_mode: workspaceMode,
        agency_id: authUser.user?.agency_id || null,
        tenant_id: authUser.user?.tenant_id || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      };

      // Show UI IMMEDIATELY (0ms perceived lag!)
      const uiStartTime = performance.now();
      updateChatState({
        selectedConversation: tempId,
        activeTab: 'active',
        workspaceMode,
        historyMode: workspaceMode,
        previousParsedRequest: null,
      });
      console.log(`⚡ [OPTIMISTIC UI] Chat displayed instantly in ${(performance.now() - uiStartTime).toFixed(0)}ms!`);

      // ⚡ OPTIMIZATION: Pass cached user data to avoid DB query (saves ~50-150ms)
      const conversationData = {
        title: initialTitle || defaultTitle,
        channel: 'web' as const,
        status: 'active' as const,
        workspaceMode,
        userData: authUser.user ? {
          agency_id: authUser.user.agency_id,
          tenant_id: authUser.user.tenant_id,
          role: authUser.user.role
        } : undefined
      };

      console.log('📤 [CHAT FLOW] Step 3: Creating conversation in background (Supabase INSERT)', `[${(performance.now() - startTime).toFixed(0)}ms]`);
      console.log('📋 Data to insert:', conversationData);

      const newConversation = await createConversation(conversationData);

      console.log('✅ [CHAT FLOW] Step 4: Conversation created in DB', `[${(performance.now() - startTime).toFixed(0)}ms]`);
      console.log('💾 New conversation:', newConversation);

      if (newConversation) {
        // Replace temp ID with real ID
        const replaceTime = performance.now();
        updateChatState({
          selectedConversation: newConversation.id,
          activeTab: 'active',
          workspaceMode: newConversation.workspace_mode || workspaceMode,
          historyMode: newConversation.workspace_mode || workspaceMode,
          previousParsedRequest: null,
        });
        console.log(`🔄 [OPTIMISTIC UI] Replaced temp ID with real ID in ${(performance.now() - replaceTime).toFixed(0)}ms`);

        const totalTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ [CHAT FLOW] Total time: ${totalTime}ms (but user saw chat at ~0ms!)`);
        return newConversation;
      }
    } catch (error) {
      console.error('❌ [CHAT FLOW] Error in createNewChat process:', error);
      updateChatState({
        selectedConversation: null,
        previousParsedRequest: null,
        isLoading: false,
      });
      toast({
        title: "Error",
        description: "No se pudo crear la conversación. Inténtalo de nuevo.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, authUser.user, createConversation, toast, updateChatState]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle ?new=1 URL parameter to create new chat automatically
  useEffect(() => {
    const shouldCreateNew = searchParams.get('new') === '1';
    if (shouldCreateNew && conversations.length >= 0) {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      createNewChat();
    }
  }, [searchParams, conversations.length, setSearchParams, createNewChat]);

  // Typing indicator is now controlled manually in useMessageHandler
  // No automatic timeout needed

  // Reset loading state when conversation changes (but NOT typing - it's per conversation now)
  useEffect(() => {
    if (chatState.selectedConversation) {
      setIsLoading(false);
      // ✅ Removed setIsTyping(false) - typing state is now per conversation and persists
    }
  }, [chatState.selectedConversation, setIsLoading]);

  // Show inspiration text for new conversations - DISABLED
  useEffect(() => {
    updateChatState({ showInspirationText: false });
  }, [chatState.selectedConversation, updateChatState]);

  // ✅ Get typing state for current conversation
  const currentTypingState = chatState.selectedConversation
    ? (chatState.typingByConversation[chatState.selectedConversation] || { isTyping: false, message: '' })
    : { isTyping: false, message: '' };

  return {
    // State
    ...chatState,
    // ✅ Expose current conversation's typing state (backwards compatible)
    isTyping: currentTypingState.isTyping,
    typingMessage: currentTypingState.message,

    // Related data
    conversations,
    user,

    // Setters
    setSelectedConversation,
    setMessage,
    setIsLoading,
    setIsTyping,
    setActiveTab,
    setWorkspaceMode,
    setHistoryMode,
    setPreviousParsedRequest,
    setIsAddingToCRM,
    updateChatState,
    setTypingMessage,

    // Actions
    createNewChat,
    loadConversations,
    updateConversationState,
    updateConversationTitle,

    // ✅ Ref for async operations that need current conversation ID
    selectedConversationRef,

    // Utils
    toast
  };
};

export default useChatState;
