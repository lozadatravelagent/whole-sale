import { motion } from 'framer-motion';
import type { RenderedItem } from './useTypewriterScript';
import { ProposalCard } from './proposal/ProposalCard';

interface ChatBubbleProps {
  item: RenderedItem;
}

export function ChatBubble({ item }: ChatBubbleProps) {
  if (item.kind === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-[1.1rem] rounded-tr-md bg-foreground text-background px-4 py-2.5 text-[13.5px] leading-snug shadow-sm">
          {item.typed}
          {!item.done && (
            <span className="inline-block w-1 h-3.5 bg-background/70 ml-0.5 align-middle animate-blink-cursor" />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-2"
    >
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-[1.1rem] rounded-tl-md bg-muted px-4 py-2.5 text-[13.5px] leading-snug text-foreground">
          {item.typed}
          {!item.done && (
            <span className="inline-block w-1 h-3.5 bg-foreground/70 ml-0.5 align-middle animate-blink-cursor" />
          )}
        </div>
      </div>
      {item.proposal && item.showProposal && <ProposalCard />}
    </motion.div>
  );
}
