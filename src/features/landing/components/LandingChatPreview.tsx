import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const demoMessages: Message[] = [
  {
    id: 1,
    role: 'user',
    content: 'Hola! Busco un paquete a Bariloche para 2 adultos del 15 al 22 de julio',
  },
  {
    id: 2,
    role: 'assistant',
    content: '¡Hola! Perfecto, te ayudo con eso. Estoy buscando las mejores opciones de paquetes a Bariloche para 2 adultos del 15 al 22 de julio...',
  },
  {
    id: 3,
    role: 'assistant',
    content: 'Encontré 3 opciones excelentes para vos. La mejor relación calidad-precio es el Hotel Catalonia con todo incluido por $185.000 por persona.',
  },
  {
    id: 4,
    role: 'user',
    content: '¿Me podés pasar más detalles de ese paquete?',
  },
  {
    id: 5,
    role: 'assistant',
    content: 'Claro! El paquete incluye:\n✈️ Vuelos directos ida y vuelta\n🏨 7 noches en Hotel Catalonia 4★\n🍽️ Desayuno y cena incluidos\n🚌 Traslados aeropuerto-hotel\n\n¿Te preparo la cotización en PDF?',
  },
];

export function LandingChatPreview() {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let messageIndex = 0;
    const showNextMessage = () => {
      if (messageIndex < demoMessages.length) {
        const nextMessage = demoMessages[messageIndex];

        // Show typing indicator for assistant messages
        if (nextMessage.role === 'assistant') {
          setIsTyping(true);
          setTimeout(() => {
            setIsTyping(false);
            setVisibleMessages((prev) => [...prev, nextMessage]);
            messageIndex++;
            setTimeout(showNextMessage, 1500);
          }, 1000);
        } else {
          setVisibleMessages((prev) => [...prev, nextMessage]);
          messageIndex++;
          setTimeout(showNextMessage, 1500);
        }
      } else {
        // Reset animation after all messages shown
        setTimeout(() => {
          setVisibleMessages([]);
          messageIndex = 0;
          setTimeout(showNextMessage, 2000);
        }, 5000);
      }
    };

    const timer = setTimeout(showNextMessage, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Chat Header */}
      <div className="border-b border-border p-4 flex items-center space-x-3 bg-card">
        <Avatar>
          <AvatarFallback className="bg-gradient-hero text-white">EM</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold">Emilia - IA de ViBook</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Activa</span>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">Demo</Badge>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <Card
              className={`max-w-[80%] p-3 ${message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
                }`}
            >
              <p className="text-sm whitespace-pre-line">{message.content}</p>
            </Card>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <Card className="bg-muted p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Chat Input (disabled for demo) */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Quiero un vuelo a Bariloche ..."
            disabled
            className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm text-muted-foreground cursor-not-allowed"
          />
          <button disabled className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm opacity-50 cursor-not-allowed">
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
