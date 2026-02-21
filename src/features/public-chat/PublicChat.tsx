import { FormEvent, useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, MessageSquare, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { usePublicMessageHandler } from './usePublicMessageHandler';
import { usePublicSearchLimit } from '@/hooks/usePublicSearchLimit';
import { PaywallModal } from './PaywallModal';
import { PublicSearchResults } from './components/PublicSearchResults';

const quickPrompts = [
  'Vuelos Buenos Aires a Cancun, 15 al 22 de marzo, 2 adultos con valija',
  'Hotel all inclusive en Punta Cana, 10 al 17 de abril, 2 adultos',
  'Vuelo + hotel a Bariloche, julio, 1 semana, 2 personas',
];

export function PublicChat() {
  const { messages, isProcessing, sendMessage } = usePublicMessageHandler();
  const { searchesUsed, canSearch, incrementSearch, isLimitReached, maxSearches } = usePublicSearchLimit();
  const [inputValue, setInputValue] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasUserMessages = messages.some(m => m.role === 'user');

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      setInputValue('');
      sendMessage(trimmed, {
        canSearch,
        incrementSearch,
        onLimitReached: () => setShowPaywall(true),
      });
    },
    [isProcessing, canSearch, incrementSearch, sendMessage]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  return (
    <section className="relative min-h-[calc(100vh-5rem)] md:min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center overflow-hidden bg-transparent pt-8 md:pt-12 pb-16">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6 flex flex-col items-center w-full max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 md:mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <Sparkles className="w-4 h-4 text-blue-300" />
            <span className="text-sm text-blue-200">Asistente de viajes con IA</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3">
            Preguntale a{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Emilia
            </span>
          </h1>
          <p className="text-base md:text-lg text-gray-400 max-w-xl mx-auto">
            Busca vuelos, hoteles y paquetes en segundos. Proba gratis.
          </p>
        </motion.div>

        {/* Chat panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="w-full rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-sm shadow-2xl flex flex-col"
          style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '480px' }}
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Emilia</p>
              <p className="text-xs text-green-400">En linea</p>
            </div>
            {searchesUsed > 0 && (
              <div className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                {searchesUsed}/{maxSearches} busquedas
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3">
            {messages.map(message => {
              const hasCards = message.role === 'assistant' && message.data?.combinedData &&
                (message.data.combinedData.flights.length > 0 || message.data.combinedData.hotels.length > 0);

              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm md:text-base ${
                      hasCards ? 'max-w-[95%] w-full' : 'max-w-[88%]'
                    } ${
                      message.role === 'user'
                        ? 'bg-blue-500/20 border border-blue-400/30 text-gray-100 rounded-br-md'
                        : 'bg-white/[0.08] border border-white/10 text-gray-200 rounded-bl-md'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      hasCards ? (
                        <PublicSearchResults combinedData={message.data!.combinedData!} />
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                          <ReactMarkdown>{message.text}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      message.text
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-white/[0.08] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:120ms]" />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts + input */}
          <div className="px-4 md:px-5 pb-4 pt-2 border-t border-white/10 shrink-0 space-y-3">
            {/* Quick prompts - only show when no user messages yet */}
            {!hasUserMessages && (
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={isProcessing}
                    className="text-xs md:text-sm px-3 py-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 transition-colors disabled:opacity-50 text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <MessageSquare className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Ej: Vuelos a Miami para 2 personas en marzo..."
                  disabled={isProcessing}
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim() || isProcessing}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Search counter */}
            {searchesUsed > 0 && (
              <p className="text-center text-xs text-gray-500">
                {isLimitReached
                  ? 'Alcanzaste el limite de busquedas gratis'
                  : `${searchesUsed}/${maxSearches} busquedas gratis usadas`}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent" />

      {/* Paywall modal */}
      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} />
    </section>
  );
}
