import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BedDouble, Calendar, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StructuredCard } from './StructuredCard';

const PHASE_DURATIONS_MS = [
  1800, // 0: user typing dots
  1500, // 1: user message visible (after typing fades)
  1500, // 2: emilia typing dots
  2000, // 3: emilia message visible
  800, // 4: card 1
  800, // 5: card 2
  800, // 6: card 3
  2400, // 7: card 4 + hold before loop
];
const FINAL_PHASE = PHASE_DURATIONS_MS.length - 1;

interface AnimatedChatSceneProps {
  className?: string;
}

export function AnimatedChatScene({ className }: AnimatedChatSceneProps) {
  const { t } = useTranslation('landing');
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(reduceMotion ? FINAL_PHASE : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setTimeout(() => {
      setPhase((current) => (current >= FINAL_PHASE ? 0 : current + 1));
    }, PHASE_DURATIONS_MS[phase]);
    return () => clearTimeout(id);
  }, [phase, reduceMotion]);

  const userMessageVisible = phase >= 1;
  const emiliaTypingVisible = phase === 2;
  const emiliaMessageVisible = phase >= 3;
  const isCardVisible = (i: number) => phase >= 4 + i;

  const cards = [
    {
      icon: MapPin,
      label: t('hero.scene.cards.destination.label'),
      value: t('hero.scene.cards.destination.value'),
    },
    {
      icon: Calendar,
      label: t('hero.scene.cards.dates.label'),
      value: t('hero.scene.cards.dates.value'),
    },
    {
      icon: Users,
      label: t('hero.scene.cards.guests.label'),
      value: t('hero.scene.cards.guests.value'),
    },
    {
      icon: BedDouble,
      label: t('hero.scene.cards.room.label'),
      value: t('hero.scene.cards.room.value'),
    },
  ];

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-muted/10 p-5 shadow-card backdrop-blur-sm',
        className,
      )}
      aria-label="Emilia chat preview"
    >
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <div
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
        />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {t('hero.scene.assistantLabel')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"
            />
            {t('hero.scene.status')}
          </span>
        </div>
      </div>

      <div className="flex min-h-[160px] flex-col gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {!userMessageVisible ? (
            <motion.div
              key="user-typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex justify-end"
            >
              <TypingBubble variant="user" />
            </motion.div>
          ) : (
            <motion.div
              key="user-msg"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex justify-end"
            >
              <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                {t('hero.scene.userMessage')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          {emiliaTypingVisible ? (
            <motion.div
              key="emilia-typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-3"
            >
              <div
                aria-hidden="true"
                className="mt-1 h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
              />
              <TypingBubble variant="assistant" />
            </motion.div>
          ) : emiliaMessageVisible ? (
            <motion.div
              key="emilia-msg"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3"
            >
              <div
                aria-hidden="true"
                className="mt-1 h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60"
              />
              <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                {t('hero.scene.assistantMessage')}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((card, i) => {
          const visible = isCardVisible(i);
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={
                visible
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 8, scale: 0.95 }
              }
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <StructuredCard icon={card.icon} label={card.label} value={card.value} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function TypingBubble({ variant }: { variant: 'user' | 'assistant' }) {
  const isUser = variant === 'user';
  return (
    <div
      className={cn(
        'px-4 py-3',
        isUser
          ? 'rounded-2xl rounded-br-md bg-primary'
          : 'rounded-2xl rounded-bl-md border border-border bg-muted/40',
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isUser ? 'bg-primary-foreground/80' : 'bg-foreground/60',
            )}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}
