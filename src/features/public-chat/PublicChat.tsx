import { FormEvent, useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
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
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 85%', 'end start'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.28,
  });
  const headerY = useTransform(progress, [0, 1], [72, -20]);
  const headerOpacity = useTransform(progress, [0, 0.2, 1], [0.25, 1, 1]);
  const panelY = useTransform(progress, [0, 0.55, 1], [130, 0, -24]);
  const panelScale = useTransform(progress, [0, 0.55, 1], [0.9, 1, 1.02]);
  const panelRotateX = useTransform(progress, [0, 0.55], [11, 0]);
  const orbitLeftY = useTransform(progress, [0, 1], [90, -60]);
  const orbitRightY = useTransform(progress, [0, 1], [120, -80]);

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
    <section
      ref={sectionRef}
      id="demo"
      className="relative -mt-[12vh] scroll-mt-28 overflow-hidden bg-transparent pb-24 pt-28 md:-mt-[10vh] md:scroll-mt-32 md:pb-28 md:pt-32"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
        <div className="absolute left-[8%] top-10 h-[360px] w-[360px] rounded-full bg-sky-500/[0.12] blur-[130px]" />
        <div
          className="absolute bottom-8 right-[10%] h-[300px] w-[300px] rounded-full bg-amber-400/[0.08] blur-[130px]"
          style={{ animationDelay: '1s' }}
        />
        <motion.div
          className="absolute left-[6%] top-[30%] hidden rounded-full border border-sky-300/[0.12] bg-slate-950/55 px-4 py-2 text-xs uppercase tracking-[0.28em] text-sky-100 lg:block"
          style={{ y: orbitLeftY }}
        >
          Search to quote
        </motion.div>
        <motion.div
          className="absolute right-[7%] top-[24%] hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-200 lg:block"
          style={{ y: orbitRightY }}
        >
          CRM sync
        </motion.div>
      </div>

      <div className="container relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 md:px-6">
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="mx-auto mb-8 max-w-3xl text-center md:mb-10"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-sky-200" />
            <span className="text-sm text-sky-100">Demo en vivo</span>
          </div>
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Probá cómo responde{' '}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent">
              Emilia
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 md:text-lg">
            Hacé una consulta real de vuelos, hoteles o paquetes y mirá cómo Vibook la convierte en
            una respuesta operativa para tu equipo.
          </p>
        </motion.div>

        <motion.div
          style={{
            y: panelY,
            scale: panelScale,
            rotateX: panelRotateX,
            transformPerspective: 1400,
            maxHeight: 'calc(100vh - 280px)',
            minHeight: '480px',
          }}
          className="landing-panel mx-auto flex w-full max-w-4xl flex-col rounded-[30px] border border-white/[0.12]"
        >
          <div className="shrink-0 border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-cyan-400 to-amber-300 text-slate-950">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Emilia</p>
                <p className="text-xs text-emerald-400">En linea</p>
              </div>
              {searchesUsed > 0 && (
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {searchesUsed}/{maxSearches} busquedas
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Consultá un itinerario y revisá cómo combina búsqueda, contexto comercial y respuesta
              asistida.
            </p>
          </div>

          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3">
            {messages.map(message => {
              const hasCards = message.role === 'assistant' && message.data?.combinedData &&
                (
                  message.data.combinedData.flights.length > 0 ||
                  message.data.combinedData.hotels.length > 0 ||
                  (message.data.combinedData.hotelSegments?.length || 0) > 0
                );

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

          <div className="px-4 md:px-5 pb-4 pt-2 border-t border-white/10 shrink-0 space-y-3">
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

      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} />
    </section>
  );
}
