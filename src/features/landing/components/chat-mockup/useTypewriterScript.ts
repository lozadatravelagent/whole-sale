import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_SCRIPT, type ChatScriptStep } from '../../lib/chatScript';

export type RenderedItem =
  | { id: string; kind: 'user'; text: string; typed: string; done: boolean }
  | {
      id: string;
      kind: 'emilia';
      text: string;
      typed: string;
      done: boolean;
      proposal?: boolean;
      showProposal: boolean;
    };

export function useTypewriterScript() {
  const { t, i18n } = useTranslation('landing');
  const [items, setItems] = useState<RenderedItem[]>([]);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timersRef.current.push(id);
      });

    const buildBase = (id: string, step: ChatScriptStep, text: string): RenderedItem =>
      step.kind === 'user'
        ? { id, kind: 'user', text, typed: '', done: false }
        : { id, kind: 'emilia', text, typed: '', done: false, proposal: step.proposal, showProposal: false };

    const run = async () => {
      while (!cancelled) {
        setItems([]);
        setThinking(false);
        await wait(600);

        for (let idx = 0; idx < CHAT_SCRIPT.length; idx++) {
          if (cancelled) return;
          const step = CHAT_SCRIPT[idx];
          const text = t(step.textKey);

          if (step.kind === 'emilia') {
            setThinking(true);
            await wait(900);
            if (cancelled) return;
            setThinking(false);
          } else {
            await wait(500);
          }

          const id = `${idx}-${Date.now()}`;
          setItems((prev) => [...prev, buildBase(id, step, text)]);

          const speed = step.kind === 'user' ? 22 : 18;
          for (let i = 1; i <= text.length; i++) {
            if (cancelled) return;
            await wait(speed);
            setItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, typed: text.slice(0, i) } : it)),
            );
          }
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: true } : it)));

          if (step.kind === 'emilia' && step.proposal) {
            await wait(450);
            setItems((prev) =>
              prev.map((it) =>
                it.id === id && it.kind === 'emilia' ? { ...it, showProposal: true } : it,
              ),
            );
          }

          await wait(step.kind === 'user' ? 600 : step.kind === 'emilia' && step.proposal ? 4200 : 1100);
        }

        await wait(2800);
      }
    };

    run();

    return () => {
      cancelled = true;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
    // Re-run the loop when the active language changes so messages re-type in the new locale.
  }, [t, i18n.language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, thinking]);

  return { items, thinking, scrollRef };
}
