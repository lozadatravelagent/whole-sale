import React, { useState, useRef, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  MessageSquare, 
  Phone, 
  Globe, 
  FileText,
  Clock,
  User,
  Bot
} from 'lucide-react';
import type { Conversation, Message } from '@/types';

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversations: Conversation[] = [
    {
      id: '1',
      tenant_id: 'tenant1',
      agency_id: 'agency1',
      channel: 'wa',
      external_key: '+54911234567',
      state: 'active',
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      tenant_id: 'tenant1', 
      agency_id: 'agency1',
      channel: 'web',
      external_key: 'web-user-123',
      state: 'active',
      last_message_at: new Date(Date.now() - 900000).toISOString(),
      created_at: new Date().toISOString(),
    }
  ];

  const mockMessages: Message[] = [
    {
      id: '1',
      conversation_id: '1',
      role: 'user',
      content: { text: 'Hola, necesito cotizar un viaje a Madrid para 2 personas' },
      meta: {},
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: '2',
      conversation_id: '1',
      role: 'assistant',
      content: { 
        text: 'Por supuesto! Te ayudo con la cotización para Madrid. ¿Para qué fechas necesitas el viaje?',
      },
      meta: {},
      created_at: new Date(Date.now() - 500000).toISOString(),
    },
    {
      id: '3',
      conversation_id: '1',
      role: 'user', 
      content: { text: 'Del 15 al 22 de marzo, somos 2 adultos' },
      meta: {},
      created_at: new Date(Date.now() - 400000).toISOString(),
    },
    {
      id: '4',
      conversation_id: '1',
      role: 'assistant',
      content: { 
        text: 'Perfecto! He encontrado estas opciones para Madrid del 15 al 22 de marzo:',
        cards: [
          { hotel: 'Hotel Ritz Madrid', price: 1850, rating: 5 },
          { hotel: 'Hotel Villa Real', price: 1450, rating: 4 }
        ],
        pdfUrl: 'https://example.com/quote-madrid-123.pdf'
      },
      meta: {},
      created_at: new Date(Date.now() - 300000).toISOString(),
    }
  ];

  useEffect(() => {
    if (selectedConversation) {
      setMessages(mockMessages.filter(m => m.conversation_id === selectedConversation));
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      conversation_id: selectedConversation,
      role: 'user',
      content: { text: message },
      meta: {},
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    // TODO: Call orchestrator API
    // POST /v1/agent/ask
    
    // Simulate response
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: selectedConversation,
        role: 'assistant',
        content: { text: 'Entendido! Estoy procesando tu consulta...' },
        meta: {},
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, response]);
    }, 1000);
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

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-screen flex">
        {/* Conversations Sidebar */}
        <div className="w-80 border-r border-border bg-gradient-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <p className="text-sm text-muted-foreground">Active customer chats</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {conversations.map((conv) => {
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
                          <span className="font-medium text-sm">
                            {conv.channel === 'wa' ? conv.external_key : 'Web User'}
                          </span>
                        </div>
                        <Badge 
                          variant={conv.state === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {conv.state}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Last message
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
                      <h3 className="font-semibold">Customer Chat</h3>
                      <p className="text-sm text-muted-foreground">
                        {conversations.find(c => c.id === selectedConversation)?.external_key}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
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
                        <div className={`rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm">{msg.content.text}</p>
                          
                          {msg.content.cards && (
                            <div className="mt-3 space-y-2">
                              {msg.content.cards.map((card: any, index: number) => (
                                <div key={index} className="bg-background/10 p-2 rounded">
                                  <p className="font-medium">{card.hotel}</p>
                                  <p className="text-sm">${card.price} • {card.rating} stars</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {msg.content.pdfUrl && (
                            <div className="mt-2">
                              <Button size="sm" variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                Download Quote PDF
                              </Button>
                            </div>
                          )}

                          <p className="text-xs opacity-70 mt-1">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {formatTime(msg.created_at)}
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
                  <Button onClick={handleSendMessage} className="px-3">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                <p className="text-muted-foreground">Choose a conversation from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;