import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { UseCaseDef } from '../../data/useCases';

interface UseCaseCardProps {
  useCase: UseCaseDef;
  index: number;
  isOpen: boolean;
  anyOpen: boolean;
  onToggle: () => void;
  onCta: () => void;
}

export function UseCaseCard({ useCase, index, isOpen, anyOpen, onToggle, onCta }: UseCaseCardProps) {
  const { t } = useTranslation('landing');
  const Icon = useCase.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onClick={onToggle}
      className={cn(
        'group relative cursor-pointer rounded-[1.75rem] border bg-white overflow-hidden',
        'transition-[border-color,box-shadow,transform] duration-300 ease-out',
        isOpen
          ? 'md:col-span-3 border-primary/25 shadow-xl'
          : anyOpen
            ? 'border-border/50 shadow-sm opacity-70 hover:opacity-100'
            : 'border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5',
      )}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
            className={cn(
              'pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full blur-3xl bg-gradient-to-br',
              useCase.accentClass,
            )}
          />
        )}
      </AnimatePresence>

      <motion.div
        layout="position"
        className={cn('relative', isOpen ? 'p-5 sm:p-7 md:p-9' : 'p-6 sm:p-7 md:p-8 aspect-[4/3] sm:aspect-square flex flex-col')}
      >
        <div className="flex items-start justify-between">
          <motion.div
            layout
            className={cn(
              'shrink-0 rounded-2xl flex items-center justify-center transition-all',
              useCase.iconBgClass,
              isOpen ? 'h-14 w-14' : 'h-12 w-12',
            )}
          >
            <Icon className={isOpen ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={2} />
          </motion.div>
          <motion.div
            layout
            aria-hidden
            className={cn(
              'shrink-0 h-9 w-9 rounded-full border flex items-center justify-center transition-all duration-500',
              isOpen
                ? 'bg-primary text-primary-foreground border-primary rotate-45'
                : 'border-border/60 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </motion.div>
        </div>

        <motion.div layout="position" className={cn('mt-auto', isOpen && 'mt-6')}>
          <motion.h3
            layout="position"
            className={cn(
              'font-semibold text-foreground tracking-tight',
              isOpen ? 'text-[26px]' : 'text-[22px] mt-6',
            )}
          >
            {t(useCase.titleKey)}
          </motion.h3>
          <motion.p layout="position" className="mt-1.5 text-[13.5px] text-muted-foreground/90">
            {t(useCase.taglineKey)}
          </motion.p>
        </motion.div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="relative mt-7"
            >
              <p className="text-[15px] text-foreground/80 leading-relaxed max-w-xl">
                {t(useCase.descKey)}
              </p>

              <div className="mt-7 grid md:grid-cols-[1fr_auto] gap-8 items-start">
                <div>
                  <p className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-primary/80 mb-2">
                    {t('useCases.labels.forWho')}
                  </p>
                  <p className="text-[14.5px] text-foreground/80 leading-relaxed mb-6 max-w-xl">
                    {t(useCase.forWhoKey)}
                  </p>

                  <p className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-primary/80 mb-3">
                    {t('useCases.labels.includes')}
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-2xl">
                    {useCase.featureKeys.map((featureKey) => (
                      <li
                        key={featureKey}
                        className="flex items-start gap-2.5 text-[14px] text-foreground/85 leading-relaxed"
                      >
                        <span className="mt-[3px] shrink-0 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                        </span>
                        <span>{t(featureKey)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="md:pl-6 md:border-l md:border-border/50 md:min-w-[180px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCta();
                    }}
                    className="group/btn inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:gap-2.5 transition-all"
                  >
                    {t(useCase.ctaKey)}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
