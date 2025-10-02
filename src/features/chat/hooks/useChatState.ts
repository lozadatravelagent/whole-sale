import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ChatState } from '../types/chat';
import { useAuth, useConversations } from '@/hooks/useChat';
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
    isTyping: false,
    sidebarLimit: 50,
    previousParsedRequest: null,
    isAddingToCRM: false
  });

  const [typingMessage, setTypingMessage] = useState<string>('');

  const { user } = useAuth();
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

  const setIsTyping = useCallback((isTyping: boolean) => {
    updateChatState({ isTyping });
  }, [updateChatState]);

  const setActiveTab = useCallback((activeTab: string) => {
    updateChatState({ activeTab });
  }, [updateChatState]);

  const setPreviousParsedRequest = useCallback((request: ParsedTravelRequest | null) => {
    updateChatState({ previousParsedRequest: request });
  }, [updateChatState]);

  const setIsAddingToCRM = useCallback((isAddingToCRM: boolean) => {
    updateChatState({ isAddingToCRM });
  }, [updateChatState]);

  // Create new chat function
  const createNewChat = useCallback(async (initialTitle?: string) => {
    console.log('🚀 [CHAT FLOW] Step 1: Starting createNewChat process');
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

      const conversationData = {
        channel: 'web' as const,
        status: 'active' as const
      };

      console.log('📤 [CHAT FLOW] Step 3: About to call createConversation (Supabase INSERT)');
      console.log('📋 Data to insert:', conversationData);

      const newConversation = await createConversation(conversationData);

      console.log('✅ [CHAT FLOW] Step 4: Conversation created successfully');
      console.log('💾 New conversation:', newConversation);

      if (newConversation) {
        console.log('🎯 [CHAT FLOW] Step 5: Setting selected conversation');
        setSelectedConversation(newConversation.id);

        console.log('📤 [CHAT FLOW] Step 6: About to update conversation state (Supabase UPDATE)');
        await updateConversationState(newConversation.id, 'active');
        console.log('✅ [CHAT FLOW] Step 7: Conversation state updated successfully');

        // Success notification removed as per user request
        console.log('✅ [CHAT FLOW] Chat creation process completed successfully');
        return newConversation;
      }
    } catch (error) {
      console.error('❌ [CHAT FLOW] Error in createNewChat process:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la conversación. Inténtalo de nuevo.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, createConversation, updateConversationState, toast, setSelectedConversation]);

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

  // Reset loading state when conversation changes
  useEffect(() => {
    if (chatState.selectedConversation) {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [chatState.selectedConversation, setIsLoading, setIsTyping]);

  // Show inspiration text for new conversations - DISABLED
  useEffect(() => {
    updateChatState({ showInspirationText: false });
  }, [chatState.selectedConversation, updateChatState]);

  return {
    // State
    ...chatState,
    typingMessage,

    // Related data
    conversations,
    user,

    // Setters
    setSelectedConversation,
    setMessage,
    setIsLoading,
    setIsTyping,
    setActiveTab,
    setPreviousParsedRequest,
    setIsAddingToCRM,
    updateChatState,
    setTypingMessage,

    // Actions
    createNewChat,
    loadConversations,
    updateConversationState,
    updateConversationTitle,

    // Utils
    toast
  };
};

export default useChatState;