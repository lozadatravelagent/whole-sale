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
import type { Conversation, Message } from '@/types';

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState('active');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize with empty conversations - start fresh
  useEffect(() => {
    setConversations([]);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      // Load messages for selected conversation - start with empty
      setMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      conversation_id: selectedConversation,
      role: 'user',
      content: { text: message },
      meta: { status: 'sending' },
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setIsLoading(true);
    setIsTyping(true);

    // Update message status to sent
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, meta: { ...msg.meta, status: 'sent' } }
          : msg
      ));
    }, 500);

    // Update conversation title if it's the first message
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome')) {
      const title = generateChatTitle(currentMessage);
      setConversations(prev => 
        prev.map(conv => 
          conv.id === selectedConversation 
            ? { ...conv, external_key: title, last_message_at: new Date().toISOString() }
            : conv
        )
      );
    }

    try {
      console.log('Sending message to travel-chat:', currentMessage);
      
      // Call travel chat API
      const { data, error } = await supabase.functions.invoke('travel-chat', {
        body: {
          message: currentMessage,
          conversationId: selectedConversation,
        }
      });

      console.log('Travel-chat response:', data, error);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      // Mark message as delivered
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, meta: { ...msg.meta, status: 'delivered' } }
          : msg
      ));

      setIsTyping(false);

      const response: Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { 
          text: data?.message || 'Lo siento, no pude procesar tu mensaje.'
        },
        meta: {},
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, response]);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, meta: { ...msg.meta, status: 'failed' } }
          : msg
      ));

      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });

      const errorResponse: Message = {
        id: (Date.now() + 2).toString(),
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { text: 'Lo siento, hubo un error procesando tu mensaje. ¿Puedes intentarlo de nuevo?' },
        meta: {},
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorResponse]);
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

  const generateChatTitle = (message: string) => {
    // Generate a short title based on the first message
    const words = message.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 27) + '...' : words;
  };

  const getChatNumber = (convId: string) => {
    const index = conversations.findIndex(c => c.id === convId);
    return conversations.length - index;
  };

  const updateConversationState = (convId: string, newState: 'active' | 'archived') => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === convId 
          ? { ...conv, state: newState }
          : conv
      )
    );
  };

  const createNewChat = () => {
    const chatCount = conversations.length + 1;
    const newConversation: Conversation = {
      id: `chat-${Date.now()}`,
      tenant_id: 'tenant1',
      agency_id: 'agency1',
      channel: 'web',
      external_key: `Nuevo chat de viajes`,
      state: 'active',
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setConversations(prev => [newConversation, ...prev]);
    setSelectedConversation(newConversation.id);
    setMessages([{
      id: 'welcome',
      conversation_id: newConversation.id,
      role: 'assistant',
      content: { 
        text: '¡Hola! Soy **Emilia**, tu asistente de viajes. Puedo ayudarte con:\n\n🌍 **Recomendaciones de destinos**\n✈️ **Información sobre vuelos y hoteles**\n🎒 **Consejos de viaje**\n💰 **Presupuestos de viaje**\n\n¿En qué puedo ayudarte hoy?' 
      },
      meta: {},
      created_at: new Date().toISOString(),
    }]);
    setIsTyping(false);

    toast({
      title: "Nuevo Chat",
      description: "Chat creado. ¡Pregúntame sobre viajes!",
    });
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
              >
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Chat
              </Button>
            </div>

            {/* Tabs for Active/Archived */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active" className="text-xs">
                  Chats Activos
                </TabsTrigger>
                <TabsTrigger value="archived" className="text-xs">
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
                                      updateConversationState(conv.id, 'archived');
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
              
              <TabsContent value="archived" className="m-0 h-full">
                <div className="p-2 space-y-2">
                  {conversations
                    .filter(conv => conv.state === 'archived')
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
                  {conversations.filter(conv => conv.state === 'archived').length === 0 && (
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
                        onClick={() => updateConversationState(selectedConversation!, 'archived')}
                      >
                        Archived
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Emilia is typing indicator */}
                  {isTyping && (
                    <div className="flex justify-start">
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
                        <div className={`rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-sm max-w-none">
                            {msg.content.text || ''}
                          </ReactMarkdown>

                          <p className="text-xs opacity-70 mt-1 flex items-center justify-between">
                            <span className="flex items-center">
                              {getMessageStatusIcon(msg.meta?.status)}
                              <span className="ml-1">{formatTime(msg.created_at)}</span>
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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