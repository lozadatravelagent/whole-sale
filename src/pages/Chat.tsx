import React, { useState, useRef, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useConversations, useMessages } from '@/hooks/useChat';
import { createLeadFromChat } from '@/utils/chatToLead';
import { 
  Send, 
  MessageSquare, 
  Phone, 
  Globe, 
  FileText,
  Clock,
  User,
  Bot,
  Plane,
  Hotel,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Star,
  Loader2,
  Plus,
  ChevronDown,
  Archive,
  Check,
  CheckCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Database } from '@/integrations/supabase/types';

type ConversationRow = Database['public']['Tables']['conversations']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isTyping, setIsTyping] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Use our new hooks
  const { user } = useAuth();
  const { 
    conversations, 
    loading: conversationsLoading, 
    loadConversations, 
    createConversation, 
    updateConversationState, 
    updateConversationTitle 
  } = useConversations();
  const { 
    messages, 
    loading: messagesLoading, 
    saveMessage, 
    updateMessageStatus 
  } = useMessages(selectedConversation);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Smart auto-scroll - only scroll when user sends a message or when at bottom
  useEffect(() => {
    if (!shouldAutoScroll || messages.length === 0) return;

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Check if user is near the bottom of the chat
    const isNearBottom = () => {
      const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-content]');
      if (!scrollArea) return true;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollArea;
      return scrollHeight - scrollTop - clientHeight < 100;
    };

    // Only auto-scroll if user is already near the bottom or if it's the first message
    if (messages.length === 1 || isNearBottom()) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll]);

  // Reset auto-scroll when conversation changes
  useEffect(() => {
    setShouldAutoScroll(true);
  }, [selectedConversation]);

  // Control typing indicator based on new messages from n8n workflows
  useEffect(() => {
    if (!selectedConversation || messages.length === 0) return;

    // Get the last message
    const lastMessage = messages[messages.length - 1];
    
    // If the last message is from assistant and was just received, start typing timer
    if (lastMessage.role === 'assistant') {
      const messageAge = Date.now() - new Date(lastMessage.created_at).getTime();
      
      // If message is less than 2 seconds old, it might be followed by more messages
      if (messageAge < 2000) {
        setIsTyping(true);
        
        // Set timeout to stop typing indicator
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 5000);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [messages, selectedConversation]);

  const generateChatTitle = (text: string) => {
    // Generate a meaningful title from the first message
    const words = text.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isLoading) return;

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);
    setIsTyping(true);
    setShouldAutoScroll(true); // Ensure auto-scroll for user messages

    try {
      // Save user message to database
      const userMessage = await saveMessage({
        conversation_id: selectedConversation,
        role: 'user',
        content: { text: currentMessage },
        meta: { status: 'sending' }
      });

      // Update message status to sent
      setTimeout(async () => {
        await updateMessageStatus(userMessage.id, 'sent');
      }, 500);

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = generateChatTitle(currentMessage);
        await updateConversationTitle(selectedConversation, title);
      }

      console.log('Sending message to travel-chat:', currentMessage);
      
      // Get conversation info for n8n
      const conversation = conversations.find(c => c.id === selectedConversation);
      
      // Call travel chat API
      const { data, error } = await supabase.functions.invoke('travel-chat', {
        body: {
          message: currentMessage,
          conversationId: selectedConversation,
          userId: user?.id,
          userName: user?.email || user?.user_metadata?.full_name,
          leadId: (conversation as any)?.meta?.lead_id || null,
          agencyId: user?.user_metadata?.agency_id
        }
      });

      console.log('Travel-chat response:', data, error);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      // Mark message as delivered
      await updateMessageStatus(userMessage.id, 'delivered');
      
      // Turn off immediate typing indicator
      setIsTyping(false);
      
      // Save AI response to database - the real-time subscription will handle displaying it
      const assistantMessage = await saveMessage({
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { 
          text: data?.message || 'Perfecto, estoy procesando tu consulta. Te enviaré las opciones disponibles en un momento...'
        },
        meta: {}
      });

      // NUEVO: Crear o actualizar lead con información extraída después del primer mensaje del usuario
      if (conversation) {
        console.log('Processing lead creation/update from user message');
        
        // Obtener todos los mensajes actuales incluyendo el que acabamos de guardar
        const allMessages = [...messages, 
          { 
            id: 'temp-user', 
            role: 'user' as const,
            content: { text: currentMessage },
            conversation_id: selectedConversation,
            created_at: new Date().toISOString(),
            meta: {}
          } as MessageRow,
          assistantMessage
        ];
        
        const leadId = await createLeadFromChat(conversation, allMessages);
        if (leadId) {
          console.log('Lead created/updated from chat with ID:', leadId);
          toast({
            title: "Lead Actualizado",
            description: "Se ha creado/actualizado automáticamente tu lead en el CRM con la información del chat.",
          });
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });

      // Save error response - real-time subscription will handle displaying it
      await saveMessage({
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { text: 'Lo siento, hubo un error procesando tu mensaje. ¿Puedes intentarlo de nuevo?' },
        meta: {}
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="inline h-3 w-3 animate-spin" />;
      case 'sent':
        return <Check className="inline h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="inline h-3 w-3" />;
      case 'failed':
        return <Clock className="inline h-3 w-3 text-destructive" />;
      default:
        return <Clock className="inline h-3 w-3" />;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getChannelIcon = (channel: string) => {
    return channel === 'wa' ? Phone : Globe;
  };

  const getChatNumber = (convId: string) => {
    const index = conversations.findIndex(c => c.id === convId);
    return conversations.length - index;
  };

  const createNewChat = async () => {
    try {
      // Desactivar auto-scroll temporalmente para evitar salto
      setShouldAutoScroll(false);
      
      // Crear la conversación
      const newConversation = await createConversation();
      setSelectedConversation(newConversation.id);

      // Crear mensaje de bienvenida
      const welcomeMessage = await saveMessage({
        conversation_id: newConversation.id,
        role: 'assistant',
        content: { 
          text: '¡Hola! Soy **Emilia**, tu asistente de viajes. Puedo ayudarte con:\n\n🌍 **Recomendaciones de destinos**\n✈️ **Información sobre vuelos y hoteles**\n🎒 **Consejos de viaje**\n💰 **Presupuestos de viaje**\n\n¿En qué puedo ayudarte hoy?' 
        },
        meta: {}
      });

      toast({
        title: "Nuevo Chat",
        description: "Chat creado. ¡Cuéntame sobre tu viaje para crear tu lead automáticamente!",
      });
      
      // Reactivar auto-scroll después de un breve delay para permitir que se cargue el chat
      setTimeout(() => {
        setShouldAutoScroll(true);
      }, 500);
      
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el chat.",
        variant: "destructive",
      });
      // Asegurar que se reactive el auto-scroll en caso de error
      setShouldAutoScroll(true);
    }
  };

  const getMessageContent = (msg: MessageRow): string => {
    if (typeof msg.content === 'object' && msg.content && 'text' in msg.content) {
      return (msg.content as any).text || '';
    }
    return '';
  };

  const getMessageStatus = (msg: MessageRow): string | undefined => {
    if (typeof msg.meta === 'object' && msg.meta && 'status' in msg.meta) {
      return (msg.meta as any).status;
    }
    return undefined;
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-screen flex">
        {/* Conversations Sidebar */}
        <div className="w-80 border-r border-border bg-gradient-card">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold">Conversaciones</h2>
                <p className="text-sm text-muted-foreground">Chats de viajes</p>
              </div>
              <Button
                onClick={createNewChat}
                size="sm"
                className="bg-primary hover:bg-primary/90"
                disabled={conversationsLoading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Chat
              </Button>
            </div>

            {/* Tabs for Active/Closed */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active" className="text-xs">
                  Chats Activos
                </TabsTrigger>
                <TabsTrigger value="closed" className="text-xs">
                  <Archive className="h-3 w-3 mr-1" />
                  Archivados
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            <Tabs value={activeTab} className="h-full">
              <TabsContent value="active" className="m-0 h-full">
                <div className="p-2 space-y-2">
                  {conversations
                    .filter(conv => conv.state === 'active')
                    .map((conv) => {
                      const ChannelIcon = getChannelIcon(conv.channel);
                      const isSelected = selectedConversation === conv.id;
                      
                      return (
                        <Card 
                          key={conv.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedConversation(conv.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm truncate">
                                  {conv.external_key}
                                </span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationState(conv.id, 'closed');
                                    }}
                                  >
                                    <Archive className="h-3 w-3 mr-2" />
                                    Archivar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Último mensaje
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conv.last_message_at)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  {conversations.filter(conv => conv.state === 'active').length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      No hay chats activos.
                      <br />
                      Crea uno nuevo para comenzar.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="closed" className="m-0 h-full">
                <div className="p-2 space-y-2">
                  {conversations
                    .filter(conv => conv.state === 'closed')
                    .map((conv) => {
                      const ChannelIcon = getChannelIcon(conv.channel);
                      const isSelected = selectedConversation === conv.id;
                      
                      return (
                        <Card 
                          key={conv.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedConversation(conv.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm truncate">
                                  {conv.external_key}
                                </span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationState(conv.id, 'active');
                                    }}
                                  >
                                    <MessageSquare className="h-3 w-3 mr-2" />
                                    Activar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Último mensaje
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conv.last_message_at)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  {conversations.filter(conv => conv.state === 'closed').length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      No hay chats archivados.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Emilia</h3>
                      <p className="text-sm text-muted-foreground">
                        chat-{getChatNumber(selectedConversation)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {conversations.find(c => c.id === selectedConversation)?.state === 'active' ? 'Active' : 'Archived'}
                        <ChevronDown className="h-3 w-3 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => updateConversationState(selectedConversation!, 'active')}
                      >
                        Active
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => updateConversationState(selectedConversation!, 'closed')}
                      >
                        Archived
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-lg flex items-start space-x-2 ${
                        msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
                          {msg.role === 'user' ? (
                            <User className="h-4 w-4 text-primary" />
                          ) : (
                            <Bot className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        <div className={`rounded-lg p-4 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            className={`${
                              msg.role === 'user' 
                                ? 'prose prose-invert prose-sm max-w-none text-primary-foreground' 
                                : 'emilia-message prose prose-neutral prose-sm max-w-none'
                            }`}
                          >
                            {getMessageContent(msg)}
                          </ReactMarkdown>

                          <p className="text-xs opacity-70 mt-1 flex items-center justify-between">
                            <span className="flex items-center">
                              {getMessageStatusIcon(getMessageStatus(msg))}
                              <span className="ml-1">{formatTime(msg.created_at)}</span>
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Emilia is typing indicator - appears after messages */}
                  {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="max-w-lg flex items-start space-x-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-card flex items-center justify-center">
                          <Bot className="h-4 w-4 text-accent" />
                        </div>
                        <div className="rounded-lg p-3 bg-muted">
                          <div className="flex items-center space-x-1">
                            <div className="typing-dots">
                              <span>Emilia está escribiendo</span>
                              <div className="dots">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator />

              {/* Message Input */}
              <div className="p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    className="px-3"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ninguna conversación seleccionada</h3>
                <p className="text-muted-foreground mb-4">Elige una conversación del sidebar o crea una nueva para comenzar.</p>
                <Button onClick={createNewChat} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Nuevo Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;