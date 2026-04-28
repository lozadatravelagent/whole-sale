import { motion, AnimatePresence } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { ChatBubble } from './ChatBubble';
import { ThinkingDots } from './ThinkingDots';
import { ChatInputPreview } from './ChatInputPreview';
import { useTypewriterScript } from './useTypewriterScript';

export function ChatMockup() {
  const { items, thinking, scrollRef } = useTypewriterScript();

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 sm:-inset-12 rounded-[3rem] bg-gradient-to-br from-aurora-violet/40 via-aurora-blue/30 to-aurora-coral/30 blur-3xl opacity-70"
      />

      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="relative glass-strong rounded-[2rem] p-2"
      >
        <div className="rounded-[1.6rem] bg-white/85 backdrop-blur-xl overflow-hidden">
          <ChatHeader />

          <div ref={scrollRef} className="px-4 sm:px-5 py-4 sm:py-5 space-y-3 h-[340px] sm:h-[380px] md:h-[420px] overflow-hidden">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ChatBubble key={item.id} item={item} />
              ))}
              {thinking && <ThinkingDots key="thinking" />}
            </AnimatePresence>
          </div>

          <ChatInputPreview />
        </div>
      </motion.div>
    </div>
  );
}
