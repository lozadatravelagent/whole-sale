import { useCallback } from 'react';

interface UseChipInsertionOptions {
  /** Current chat draft value. */
  value: string;
  /** Setter for the chat draft (e.g. ChatFeature's setMessage). */
  onChange: (next: string) => void;
  /** Ref to the chat input textarea. May be null (focus is best-effort). */
  inputRef?: { current: HTMLTextAreaElement | null };
}

interface UseChipInsertionResult {
  /**
   * Smart-append a chip's text into the chat draft WITHOUT sending it:
   * - empty / whitespace-only draft  -> replace with `text`
   * - draft has content              -> `${draft.trimEnd()} ${text}`
   * Then focuses the textarea and moves the caret to the end so the user
   * can immediately edit before sending.
   */
  insertChipText: (text: string) => void;
}

export function useChipInsertion({
  value,
  onChange,
  inputRef,
}: UseChipInsertionOptions): UseChipInsertionResult {
  const insertChipText = useCallback(
    (text: string) => {
      const next = value.trim() === '' ? text : `${value.trimEnd()} ${text}`;
      onChange(next);

      const el = inputRef?.current;
      if (!el) return;
      requestAnimationFrame(() => {
        el.focus();
        const end = el.value.length;
        try {
          el.setSelectionRange(end, end);
        } catch {
          /* setSelectionRange not supported in some envs — non-fatal */
        }
      });
    },
    [value, onChange, inputRef],
  );

  return { insertChipText };
}
