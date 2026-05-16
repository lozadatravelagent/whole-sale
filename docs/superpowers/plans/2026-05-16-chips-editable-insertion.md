# Chips: Editable Insertion + Refinement Chips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every text-bearing chip insert its text into the chat input (editable, no auto-send) via a single shared hook, and add client-derived post-search refinement chips.

**Architecture:** One shared `useChipInsertion` hook owns smart-append + focus + caret. The chat input's textarea ref is lifted so the hook can focus it. The three chip systems (Suggested Actions, Narrative Chips incl. legacy inferred-field block, Trip Planner Suggestion Chips) call `onChipInsert` instead of auto-send. A new pure `buildRefinementChips` function derives `'refine'` chips from the parsed last search and is merged inside `buildSuggestedActions`.

**Tech Stack:** React 18 + TypeScript, Vitest + jsdom, existing `ChatSuggestedAction` type, `src/services/searchDefaults.ts`.

**Spec:** `docs/superpowers/specs/2026-05-16-chips-editable-insertion-design.md`

**Spec corrections applied here:** constant is `SEARCH_STAY_NIGHTS` (not `DEFAULT_FALLBACK_STAY_NIGHTS`); `tripType` uses underscore values (`'one_way'`); refinement-chip source is the in-scope `parsedRequest` (functionally equal to `ContextState.lastSearch` — chosen to avoid touching the race-sensitive context-state IIFE in `useMessageHandler.ts`, per the CLAUDE.md race-guard invariant).

**Priority scheme (refinement chips, within the existing `.slice(0,3)` cap — cap unchanged):**
`quote=0`, `flight=1`, `hotel=2`, `itinerary=3`, then refinement: `refine-roundtrip=1`, `refine-passengers=4`, `refine-duration=5`, `refine-search=6`. Dedup is by `prompt` (existing `seen` set). Refinement chips surface naturally post-search because `flight`/`hotel` suggestions are suppressed once results exist, freeing slots.

---

### Task 1: `useChipInsertion` hook

**Files:**
- Create: `src/features/chat/hooks/useChipInsertion.ts`
- Test: `src/features/chat/hooks/__tests__/useChipInsertion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/chat/hooks/__tests__/useChipInsertion.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useChipInsertion } from '../useChipInsertion';

function setup(initialValue: string) {
  const onChange = vi.fn();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  const inputRef = { current: textarea };
  const { result, rerender } = renderHook(
    ({ value }: { value: string }) => useChipInsertion({ value, onChange, inputRef }),
    { initialProps: { value: initialValue } },
  );
  return { result, rerender, onChange, textarea };
}

describe('useChipInsertion', () => {
  it('replaces the value when the input is empty', () => {
    const { result, onChange } = setup('');
    act(() => result.current.insertChipText('Buscar vuelo a Madrid'));
    expect(onChange).toHaveBeenCalledWith('Buscar vuelo a Madrid');
  });

  it('replaces the value when the input is only whitespace', () => {
    const { result, onChange } = setup('   ');
    act(() => result.current.insertChipText('Hola'));
    expect(onChange).toHaveBeenCalledWith('Hola');
  });

  it('appends with a single space separator when the input has text', () => {
    const { result, onChange } = setup('Quiero ir a Madrid');
    act(() => result.current.insertChipText('en julio'));
    expect(onChange).toHaveBeenCalledWith('Quiero ir a Madrid en julio');
  });

  it('trims trailing whitespace before appending', () => {
    const { result, onChange } = setup('Hola   ');
    act(() => result.current.insertChipText('mundo'));
    expect(onChange).toHaveBeenCalledWith('Hola mundo');
  });

  it('does not throw when inputRef.current is null', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useChipInsertion({ value: '', onChange, inputRef: { current: null } }),
    );
    expect(() => act(() => result.current.insertChipText('x'))).not.toThrow();
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/chat/hooks/__tests__/useChipInsertion.test.ts`
Expected: FAIL — `Cannot find module '../useChipInsertion'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/chat/hooks/useChipInsertion.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/chat/hooks/__tests__/useChipInsertion.test.ts`
Expected: PASS (5 passing). Note: `requestAnimationFrame` callbacks are not awaited by the tests; the `onChange` assertions run synchronously and pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/hooks/useChipInsertion.ts src/features/chat/hooks/__tests__/useChipInsertion.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): add useChipInsertion hook for editable chip insertion

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Lift the chat input textarea ref through ChatInputDock

**Files:**
- Modify: `src/features/chat/components/shell/ChatInputDock.tsx:8-17` (props), `:36` (ref), `:108` (Textarea ref)

- [ ] **Step 1: Add optional `inputRef` prop to the interface**

In `ChatInputDock.tsx`, replace the `ChatInputDockProps` interface (lines 8-17) with:

```typescript
interface ChatInputDockProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  isUploadingPdf: boolean;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedConversation?: string | null;
  className?: string;
  /** Optional external ref to the textarea, used by useChipInsertion for focus/caret. */
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}
```

- [ ] **Step 2: Destructure the new prop**

In the component params (lines 25-34), add `inputRef,` to the destructured props list (after `className,`).

- [ ] **Step 3: Forward the node to both the internal ref and the external ref**

Replace the `<Textarea ref={messageInputRef}` line (line 108) with a callback ref that assigns both refs:

```tsx
        <Textarea
          ref={(node) => {
            (messageInputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
            if (inputRef) {
              (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
            }
          }}
```

Leave the rest of the `<Textarea>` props (id, name, value, onChange, ...) unchanged. The internal `messageInputRef` still drives the existing auto-grow and focus-on-conversation-change effects (lines 40-62) unchanged.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `ChatInputDock.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/components/shell/ChatInputDock.tsx
git commit -m "$(cat <<'EOF'
refactor(chat): expose ChatInputDock textarea via optional inputRef

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `buildRefinementChips` pure function

**Files:**
- Create: `src/features/chat/services/refinementChipsBuilder.ts`
- Test: `src/features/chat/services/__tests__/refinementChipsBuilder.test.ts`

Source shape: `parsedRequest.flights` / `parsedRequest.hotels` carry `FlightContextParams` / `HotelContextParams`-compatible fields (`src/features/chat/types/contextState.ts:13-52`). The builder only reads a minimal subset and is fully defensive.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/chat/services/__tests__/refinementChipsBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { buildRefinementChips } from '../refinementChipsBuilder';
import { SEARCH_STAY_NIGHTS } from '@/services/searchDefaults';

const NOW = new Date('2026-05-16T00:00:00.000Z');

describe('buildRefinementChips', () => {
  it('returns [] when there is no flights nor hotels search', () => {
    expect(buildRefinementChips({}, NOW, 'es')).toEqual([]);
  });

  it('emits a round-trip chip only when the flight search is one-way', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          tripType: 'one_way', adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    const roundtrip = chips.find((c) => c.id === 'refine-roundtrip');
    expect(roundtrip).toBeTruthy();
    // Inferred return date = departure + SEARCH_STAY_NIGHTS (7) => 2026-07-08
    expect(SEARCH_STAY_NIGHTS).toBe(7);
    expect(roundtrip!.prompt).toContain('2026-07-08');
    expect(roundtrip!.type).toBe('refine');
  });

  it('does NOT emit a round-trip chip when the flight is already round-trip', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          returnDate: '2026-07-10', tripType: 'round_trip',
          adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    expect(chips.find((c) => c.id === 'refine-roundtrip')).toBeUndefined();
  });

  it('emits passengers + duration + edit chips for a round-trip flight search', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          returnDate: '2026-07-08', tripType: 'round_trip',
          adults: 2, children: 1, infants: 0,
        },
      },
      NOW,
      'es',
    );
    const ids = chips.map((c) => c.id);
    expect(ids).toContain('refine-passengers');
    expect(ids).toContain('refine-duration');
    expect(ids).toContain('refine-search');
    const pax = chips.find((c) => c.id === 'refine-passengers')!;
    expect(pax.prompt).toContain('2 adultos');
    expect(pax.prompt).toContain('1 niño');
  });

  it('uses hotel params (city + dates) when there is no flight search', () => {
    const chips = buildRefinementChips(
      {
        hotels: {
          city: 'Cancún', checkinDate: '2026-08-01', checkoutDate: '2026-08-06',
          adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    const ids = chips.map((c) => c.id);
    expect(ids).toContain('refine-passengers');
    expect(ids).toContain('refine-duration');
    expect(ids).toContain('refine-search');
    expect(ids).not.toContain('refine-roundtrip');
    expect(chips.find((c) => c.id === 'refine-search')!.prompt).toContain('Cancún');
    // 5 nights between 08-01 and 08-06
    expect(chips.find((c) => c.id === 'refine-duration')!.prompt).toContain('5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/chat/services/__tests__/refinementChipsBuilder.test.ts`
Expected: FAIL — `Cannot find module '../refinementChipsBuilder'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/chat/services/refinementChipsBuilder.ts
import type { ChatSuggestedAction } from '@/features/chat/types/chat';
import type { FlightContextParams, HotelContextParams } from '@/features/chat/types/contextState';
import { SEARCH_STAY_NIGHTS } from '@/services/searchDefaults';

/**
 * Minimal slice of the parsed last search this builder reads. Matches the
 * relevant fields of ParsedTravelRequest / ContextState.lastSearch.
 */
export interface RefinementSource {
  flights?: Partial<FlightContextParams> | null;
  hotels?: Partial<HotelContextParams> | null;
}

/** Add `days` to an ISO yyyy-mm-dd string, returning yyyy-mm-dd (UTC-safe). */
function addDaysToIso(iso: string, days: number): string | null {
  const ms = Date.parse(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole nights between two ISO yyyy-mm-dd dates; null if unparseable. */
function nightsBetween(startIso: string, endIso: string): number | null {
  const a = Date.parse(`${startIso}T00:00:00.000Z`);
  const b = Date.parse(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : null;
}

function paxPhrase(adults?: number, children?: number, infants?: number): string {
  const a = Math.max(0, adults ?? 0);
  const c = Math.max(0, children ?? 0);
  const i = Math.max(0, infants ?? 0);
  const parts = [`${a} ${a === 1 ? 'adulto' : 'adultos'}`];
  if (c > 0) parts.push(`${c} ${c === 1 ? 'niño' : 'niños'}`);
  if (i > 0) parts.push(`${i} ${i === 1 ? 'bebé' : 'bebés'}`);
  return parts.join(', ');
}

/**
 * Derive post-search "refinement" chips from the parsed last search.
 * Pure and defensive: missing data => that chip is omitted; no search => [].
 * Never throws. The inserted text uses SEARCH_STAY_NIGHTS for the inferred
 * return date so it matches the rest of the search-defaults architecture.
 */
export function buildRefinementChips(
  source: RefinementSource,
  _now: Date,
  _language: string,
): ChatSuggestedAction[] {
  const chips: ChatSuggestedAction[] = [];
  const f = source.flights ?? null;
  const h = source.hotels ?? null;

  const hasFlightSearch =
    !!f && !!f.origin && !!f.destination && !!f.departureDate;
  const hasHotelSearch =
    !!h && !!h.city && !!h.checkinDate && !!h.checkoutDate;

  if (!hasFlightSearch && !hasHotelSearch) return [];

  // 1. Ida y Vuelta — only when the flight search is explicitly one-way.
  if (hasFlightSearch && f!.tripType === 'one_way') {
    const ret = addDaysToIso(f!.departureDate as string, SEARCH_STAY_NIGHTS);
    if (ret) {
      chips.push({
        id: 'refine-roundtrip',
        label: 'Ida y vuelta',
        prompt: `Cambiá la búsqueda a ida y vuelta, volviendo el ${ret}`,
        type: 'refine',
        priority: 1,
      });
    }
  }

  const destination = hasFlightSearch ? f!.destination! : h!.city!;

  // 2. Modificar pasajeros.
  const adults = hasFlightSearch ? f!.adults : h!.adults;
  const children = hasFlightSearch ? f!.children : h!.children;
  const infants = hasFlightSearch ? f!.infants : h!.infants;
  chips.push({
    id: 'refine-passengers',
    label: 'Modificar pasajeros',
    prompt: `Modificá los pasajeros (actualmente ${paxPhrase(adults, children, infants)})`,
    type: 'refine',
    priority: 4,
  });

  // 3. Agregar / quitar días.
  const startIso = hasFlightSearch ? f!.departureDate : h!.checkinDate;
  const endIso = hasFlightSearch ? f!.returnDate : h!.checkoutDate;
  const nights = startIso && endIso ? nightsBetween(startIso, endIso) : null;
  chips.push({
    id: 'refine-duration',
    label: 'Agregar o quitar días',
    prompt:
      nights != null
        ? `Modificá la duración del viaje (actualmente ${nights} noches)`
        : 'Modificá la duración del viaje',
    type: 'refine',
    priority: 5,
  });

  // 4. Modificar la búsqueda (genérico).
  chips.push({
    id: 'refine-search',
    label: 'Modificar la búsqueda',
    prompt: `Quiero modificar la búsqueda de ${destination}`,
    type: 'refine',
    priority: 6,
  });

  return chips;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/chat/services/__tests__/refinementChipsBuilder.test.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/services/refinementChipsBuilder.ts src/features/chat/services/__tests__/refinementChipsBuilder.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): add buildRefinementChips post-search refinement builder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Merge refinement chips into `buildSuggestedActions`

**Files:**
- Modify: `src/features/chat/hooks/useMessageHandler.ts:416-481`
- Test: `src/features/chat/services/__tests__/refinementChipsBuilder.integration.test.ts` (new, isolated — `buildSuggestedActions` is module-private, so we assert the merge contract via the builder + a small re-export shim is NOT added; instead we verify behavior through the existing useMessageHandler tests in Task 8 and a direct contract test here)

- [ ] **Step 1: Add the import**

At the top of `useMessageHandler.ts`, with the other `@/features/chat/services` imports, add:

```typescript
import { buildRefinementChips } from '@/features/chat/services/refinementChipsBuilder';
```

- [ ] **Step 2: Merge refinement chips before the sort/slice**

In `buildSuggestedActions` (ends at lines 478-481), replace:

```typescript
  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
```

with:

```typescript
  for (const chip of buildRefinementChips(
    {
      flights: (parsedRequest as { flights?: unknown } | null | undefined)?.flights as
        | Parameters<typeof buildRefinementChips>[0]['flights']
        | undefined,
      hotels: (parsedRequest as { hotels?: unknown } | null | undefined)?.hotels as
        | Parameters<typeof buildRefinementChips>[0]['hotels']
        | undefined,
    },
    new Date(),
    language,
  )) {
    add({
      label: chip.label,
      prompt: chip.prompt,
      type: chip.type,
      priority: chip.priority,
    });
  }

  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
```

(`add` already dedupes by `prompt` and generates the `id`; the explicit `chip.id` is intentionally not reused to keep id generation centralized in `add`.)

- [ ] **Step 3: Write a contract test for the merge**

```typescript
// src/features/chat/services/__tests__/refinementChipsBuilder.integration.test.ts
import { describe, it, expect } from 'vitest';
import { buildRefinementChips } from '../refinementChipsBuilder';

// Mirrors the dedupe/slice contract buildSuggestedActions applies after merging.
describe('refinement chips merge contract', () => {
  it('produces refine-typed chips that sort after quote/flight by priority', () => {
    const refine = buildRefinementChips(
      { flights: { origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01', tripType: 'one_way', adults: 1, children: 0, infants: 0 } },
      new Date('2026-05-16T00:00:00Z'),
      'es',
    );
    const merged = [
      { id: 'q', label: 'Cotizar', prompt: 'Cotizar', type: 'quote' as const, priority: 0 },
      ...refine,
    ].sort((a, b) => a.priority - b.priority).slice(0, 3);
    expect(merged[0].type).toBe('quote');
    expect(merged.some((c) => c.id === 'refine-roundtrip')).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/chat/services/__tests__/refinementChipsBuilder.integration.test.ts`
Expected: PASS (1 passing).

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `useMessageHandler.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/hooks/useMessageHandler.ts src/features/chat/services/__tests__/refinementChipsBuilder.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): merge refinement chips into buildSuggestedActions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rewire ChatInterface chip blocks to `onChipInsert` + thread `inputRef`

**Files:**
- Modify: `src/features/chat/components/ChatInterface.tsx` (props/interface; lines 530, 559-565, 582, 592, 602, 612, 674)

Find the `ChatInterface` props interface (the props already include `onMessageChange`, `onSuggestedAction?`, `message`). Add two optional props.

- [ ] **Step 1: Add `onChipInsert` and `inputRef` to the props interface**

In the props interface for `ChatInterface`, add:

```typescript
  onChipInsert?: (text: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
```

and add `onChipInsert` and `inputRef` to the destructured component params.

- [ ] **Step 2: Block A — Suggested Actions (line 530)**

Replace:

```tsx
                        onClick={() => onSuggestedAction?.(action.prompt)}
```

with:

```tsx
                        onClick={() => onChipInsert?.(action.prompt)}
```

- [ ] **Step 3: Block B — Narrative Chips (lines 559-565)**

Replace the entire `onClick` handler:

```tsx
                      onClick={() => {
                        if (chip.action.kind === 'submit') {
                          onSuggestedAction?.(chip.action.text);
                        } else {
                          onMessageChange(chip.action.text);
                        }
                      }}
```

with:

```tsx
                      onClick={() => onChipInsert?.(chip.action.text)}
```

(`action.kind` remains in the `NarrativeChipShape` type for back-compat but no longer affects behavior — both kinds now insert editable text.)

- [ ] **Step 4: Block C — Legacy inferred-field chips (lines 582, 592, 602, 612)**

Replace each of these four handlers so they all use `onChipInsert`:

- Line 582: `onClick={() => onSuggestedAction?.('Convertir a ida y vuelta')}` → `onClick={() => onChipInsert?.('Convertir a ida y vuelta')}`
- Line 592: `onClick={() => onMessageChange('Somos ')}` → `onClick={() => onChipInsert?.('Somos ')}`
- Line 602: `onClick={() => onMessageChange('Salimos desde ')}` → `onClick={() => onChipInsert?.('Salimos desde ')}`
- Line 612: `onClick={() => onMessageChange('Cambiar fecha a ')}` → `onClick={() => onChipInsert?.('Cambiar fecha a ')}`

(The `mode_bridge` block at lines 621-643 is intentionally left unchanged — those are mode-switch actions, not text chips, and are out of scope per the spec.)

- [ ] **Step 5: Thread `inputRef` into ChatInputDock (line 674)**

Replace the `<ChatInputDock` usage block (lines 674-682) by adding the `inputRef` prop:

```tsx
        <ChatInputDock
          value={message}
          onChange={onMessageChange}
          onSend={onSendMessage}
          disabled={isLoading}
          isUploadingPdf={isUploadingPdf}
          onPdfUpload={onPdfUpload}
          selectedConversation={selectedConversation}
          inputRef={inputRef}
        />
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `ChatInterface.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/components/ChatInterface.tsx
git commit -m "$(cat <<'EOF'
feat(chat): route all text chips through onChipInsert (no auto-send)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire `useChipInsertion` in ChatFeature and pass props to both ChatInterface usages

**Files:**
- Modify: `src/features/chat/ChatFeature.tsx` (add ref + hook near line 432; props at the consumer ChatInterface ~937-959 and the agent ChatInterface ~1057-1076)

- [ ] **Step 1: Add the import**

With the other `@/features/chat/hooks` imports in `ChatFeature.tsx`, add:

```typescript
import { useChipInsertion } from '@/features/chat/hooks/useChipInsertion';
```

Ensure `useRef` is imported from `react` (it is used elsewhere; if not present in the React import, add it).

- [ ] **Step 2: Create the ref and the insertion handler**

Immediately after the `handleSuggestedAction` definition (ends line 435), add:

```typescript
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const { insertChipText } = useChipInsertion({
    value: message,
    onChange: setMessage,
    inputRef: chatInputRef,
  });
```

- [ ] **Step 3: Pass props to the consumer ChatInterface (~937-959)**

In the consumer-surface `<ChatInterface ...>` (the one with `accountType="consumer"`), add these two props (next to `onSuggestedAction={handleSuggestedAction}`):

```tsx
                  onChipInsert={insertChipText}
                  inputRef={chatInputRef}
```

- [ ] **Step 4: Pass props to the agent ChatInterface (~1057-1076)**

In the agent-surface `<ChatInterface ...>` (the one near line 1076 with `onSuggestedAction={handleSuggestedAction}`), add the same two props:

```tsx
                onChipInsert={insertChipText}
                inputRef={chatInputRef}
```

(`onSuggestedAction={handleSuggestedAction}` may remain wired — it is now unused by the chip blocks but harmless; do not remove it in this task to keep the diff minimal and avoid touching unrelated callers.)

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/ChatFeature.tsx
git commit -m "$(cat <<'EOF'
feat(chat): wire useChipInsertion into ChatFeature surfaces

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Rewire Trip Planner Suggestion Chips (System 1) — HYBRID by action type

**REVISED** after Task 7 code review: `PlannerSuggestion.action` is heterogeneous.
Inserting `.label` for ALL planner chips is a regression for confirm/modal actions
(they have no text-prompt meaning). Final behavior is hybrid (see spec
"Decisiones y supuestos confirmados" §3). An initial commit `a125aa4b` made all
chips insert `.label`; this task supersedes it with a NEW commit.

**Files:**
- Modify: `src/features/trip-planner/components/TripPlannerWorkspace.tsx`

`TripPlannerWorkspace` receives the chat-draft value + setter as props `message` /
`onMessageChange`. `useSuggestionActions(...)` returns `{ handleSuggestionClick, loadingActionId }`.
`<SuggestionChips ... onSuggestionClick=... loadingAction={loadingActionId} />` is
rendered around line ~2003.

Action types (from `src/features/trip-planner/hooks/useSuggestionActions.ts`
switch; read `PlannerSuggestion` for the exact `action` union):
`search_transport`, `search_hotels`, `confirm_field`, `confirm_location_dates`,
`select_dates`, `fill_slot`, `add_transfers`.

- [ ] **Step 1: Add the import**

With the other `@/features/chat` imports, add:

```typescript
import { useChipInsertion } from '@/features/chat/hooks/useChipInsertion';
```

- [ ] **Step 2: Keep `useSuggestionActions` AND add the insertion hook**

KEEP the existing `const { handleSuggestionClick, loadingActionId } = useSuggestionActions({...})`
destructure (handleSuggestionClick is needed again for the direct/modal groups; do
NOT remove it). Immediately after it, add:

```typescript
  const { insertChipText: insertPlannerChipText } = useChipInsertion({
    value: message,
    onChange: onMessageChange,
  });
```

(Use the actual chat-draft value/setter prop names from `TripPlannerWorkspaceProps`
— confirmed to be `message` / `onMessageChange`.)

- [ ] **Step 3: Hybrid dispatcher for SuggestionChips click**

Add a handler (place it near the hook, after `insertPlannerChipText`):

```typescript
  const handlePlannerSuggestion = useCallback((suggestion: PlannerSuggestion) => {
    switch (suggestion.action) {
      // Direct state-write confirmations: keep the original 1-click action, no text.
      case 'confirm_field':
      case 'confirm_location_dates':
        handleSuggestionClick(suggestion);
        break;
      // Opens the date-selector modal AND seeds the editor with an LLM-readable
      // intent so the choice is explicit in the draft.
      case 'select_dates':
        handleSuggestionClick(suggestion);
        insertPlannerChipText('Quiero elegir las fechas exactas del viaje.');
        break;
      // Prompt-type chips: insert the label as an editable draft (no auto-send).
      default:
        insertPlannerChipText(suggestion.label);
        break;
    }
  }, [handleSuggestionClick, insertPlannerChipText]);
```

Ensure `useCallback` is imported from `react` (it almost certainly already is —
verify) and `PlannerSuggestion` is imported (the file already imports planner
types; add `PlannerSuggestion` to the existing type import from
`@/features/trip-planner/types` if not already present).

- [ ] **Step 4: Wire it to SuggestionChips**

Replace the `<SuggestionChips>` prop:

```tsx
              onSuggestionClick={handlePlannerSuggestion}
```

(`loadingActionId` stays passed to `loadingAction={loadingActionId}` as before — it
is still meaningful because `handleSuggestionClick` fires for confirm/select.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1` → no errors mentioning
`TripPlannerWorkspace`.

Run: `npm run lint` → no errors mentioning `TripPlannerWorkspace` (no unused-var:
`handleSuggestionClick` IS now used inside `handlePlannerSuggestion`).

Run: `npm test -- src/features/trip-planner 2>&1` → 0 failed.
Run: `npm test -- src/features/chat 2>&1` → still exactly the 4 deferred chip-test
failures (Task 8), no new failing files.

- [ ] **Step 6: Commit**

```bash
git add src/features/trip-planner/components/TripPlannerWorkspace.tsx
git commit -m "$(cat <<'EOF'
feat(trip-planner): hybrid chip behavior — prompts insert text, confirm/modal keep action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update existing chip render tests + full verification

**Files:**
- Modify: any existing test under `src/features/chat/__tests__/` that asserts a chip click calls `onSuggestedAction` / sends a message (find them in Step 1)
- Test: full suite + build

- [ ] **Step 1: Find affected tests**

Run: `git grep -ln "onSuggestedAction\|suggestedActions\|inferred-defaults-chips\|narrativeChips" -- src/features/chat/__tests__ src/features/chat/components/__tests__`
Expected: a list of test files. For each that simulates a chip click and asserts `onSuggestedAction` was called (auto-send), update the assertion to expect `onChipInsert` to have been called with the chip text instead, and pass an `onChipInsert` mock prop.

- [ ] **Step 2: Update each affected test**

For every such test, apply this transformation:
- Add `const onChipInsert = vi.fn();` and pass `onChipInsert={onChipInsert}` to the rendered `ChatInterface`.
- Replace `expect(onSuggestedAction).toHaveBeenCalledWith(<text>)` with `expect(onChipInsert).toHaveBeenCalledWith(<text>)`.
- For the former narrative `kind:'submit'` cases, the expectation is now `onChipInsert` (not `onSuggestedAction`).

(If no test currently asserts chip-click behavior, add one in `src/features/chat/components/__tests__/ChatInterface.chips.test.tsx`:)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInterface from '../ChatInterface';

// Minimal smoke test: a suggested-action chip click inserts, never sends.
it('suggested-action chip calls onChipInsert and not onSuggestedAction', () => {
  const onChipInsert = vi.fn();
  const onSuggestedAction = vi.fn();
  // NOTE: build the minimal props ChatInterface requires for an assistant
  // message carrying meta.suggestedActions = [{id,label,prompt,type,priority}].
  // Reuse the existing test harness/helpers in this folder for required props.
  // (Implementer: mirror the prop setup of the nearest existing ChatInterface test.)
  // Render, click the chip by its label, then:
  expect(onSuggestedAction).not.toHaveBeenCalled();
  expect(onChipInsert).toHaveBeenCalled();
});
```

If the harness needed for a full `ChatInterface` render is heavy and no existing pattern exists, skip the new render test and rely on the `useChipInsertion` + `refinementChipsBuilder` unit tests (Tasks 1 & 3) plus the existing suite — but you MUST still update any existing tests that break.

- [ ] **Step 3: Run the full chat test suite**

Run: `npm test -- src/features/chat`
Expected: PASS. Fix any failures caused by the rewire (they will be assertion mismatches converted per Step 2).

- [ ] **Step 4: Full verification (CLAUDE.md requires tests after chat/orchestration changes)**

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: all PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test(chat): update chip tests for editable insertion behavior

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- A — no auto-send global: Tasks 1, 2, 5, 6, 7 (all three chip systems + shared hook). ✅
- A — smart append (empty→replace, text→append+space, focus, caret): Task 1. ✅
- B — refinement chips Ida y Vuelta / días / pasajeros / modificar búsqueda, client-derived, `searchDefaults`: Tasks 3, 4. ✅
- Filter Chips out of scope: untouched. ✅ `mode_bridge` also untouched (documented). ✅
- Trip Planner inserts `suggestion.label`: Task 7. ✅
- Cap of 3 unchanged: Task 4 keeps `.slice(0,3)`; priority scheme documented in header. ✅
- `NarrativeChipShape.action.kind` kept for back-compat, no longer affects send: Task 5 Step 3. ✅

**Placeholder scan:** Task 8's optional new render test is explicitly conditional (mirror existing harness or skip) with a hard requirement to fix breaking tests — not a vague placeholder. All code steps contain full code. No TBD/TODO.

**Type consistency:** `insertChipText` (Tasks 1/6/7), `onChipInsert` prop (Tasks 5/6), `inputRef: React.RefObject<HTMLTextAreaElement>` (Tasks 1/2/5/6), `buildRefinementChips(source, now, language)` returning `ChatSuggestedAction[]` (Tasks 3/4), `tripType === 'one_way'` matching `contextState.ts`, `SEARCH_STAY_NIGHTS` matching `searchDefaults.ts` — all consistent across tasks.

**Scope:** Single subsystem (chat chips). One plan is correct.
