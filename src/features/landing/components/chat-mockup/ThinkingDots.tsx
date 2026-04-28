import { motion } from 'framer-motion';

export function ThinkingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
    >
      <div className="rounded-[1.1rem] rounded-tl-md bg-muted px-4 py-3 inline-flex gap-1 items-center">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </motion.div>
  );
}
