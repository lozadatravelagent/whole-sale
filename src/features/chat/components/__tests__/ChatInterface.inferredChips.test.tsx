// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChatInterface from '../ChatInterface';
import type { MessageRow } from '../../types/chat';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      if (key === 'chips.changeRoundtrip') return 'Buscar ida y vuelta';
      if (key === 'chips.changePassengers') return 'Cambiar pasajeros';
      if (key === 'chips.changeOrigin') return 'Cambiar origen';
      if (key === 'chips.changeDate') return 'Cambiar fecha';
      if (key === 'mode.agency') return 'Cotizacion';
      if (key === 'mode.passenger') return 'Planificador';
      if (key === 'mode.bridgeSwitchTo') return `Cambiar a ${vars?.otherMode}`;
      if (key === 'mode.bridgeStay') return 'Seguir en este modo';
      return key;
    },
    i18n: { language: 'es' },
  }),
}));

vi.mock('@/components/meridian', () => ({
  OrbitMark: () => <div data-testid="orbit-mark" />,
}));

function makeMessage(inferredFields: string[], extraMeta: Record<string, unknown> = {}): MessageRow {
  return {
    id: 'assistant-1',
    conversation_id: 'conv-1',
    role: 'assistant',
    content: { text: 'Busqué vuelo EZE→MIA, 1 adulto.' },
    meta: {
      emiliaRoute: {
        route: 'QUOTE',
        score: 0.8,
        reason: 'has destination',
        inferredFields,
      },
      ...extraMeta,
    },
    created_at: '2026-05-05T12:00:00Z',
    client_id: null,
    status: null,
  } as MessageRow;
}

function renderInterface(message: MessageRow, overrides: Record<string, unknown> = {}) {
  return render(
    <ChatInterface
      selectedConversation="conv-1"
      message=""
      isLoading={false}
      isTyping={false}
      isUploadingPdf={false}
      isAddingToCRM={false}
      messages={[message]}
      refreshMessages={vi.fn()}
      onMessageChange={vi.fn()}
      onSendMessage={vi.fn()}
      onPdfUpload={vi.fn()}
      onAddToCRM={vi.fn()}
      onPdfGenerated={vi.fn()}
      accountType="agent"
      {...overrides}
    />,
  );
}

describe('ChatInterface inferred-default chips', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a chip per inferred field when emiliaRoute lists adults and tripType', () => {
    renderInterface(makeMessage(['adults', 'tripType']));

    const cluster = screen.getByTestId('inferred-defaults-chips');
    expect(cluster).toBeTruthy();
    expect(screen.getByRole('button', { name: /buscar ida y vuelta/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cambiar pasajeros/i })).toBeTruthy();
    // origin and date were not inferred → no chip
    expect(screen.queryByRole('button', { name: /cambiar origen/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cambiar fecha/i })).toBeNull();
  });

  it('renders no chips when inferredFields is empty', () => {
    renderInterface(makeMessage([]));

    expect(screen.queryByTestId('inferred-defaults-chips')).toBeNull();
    expect(screen.queryByRole('button', { name: /buscar ida y vuelta/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cambiar pasajeros/i })).toBeNull();
  });

  it('auto-submits the round-trip prompt via onSuggestedAction when the tripType chip is clicked', () => {
    const onSuggestedAction = vi.fn();
    renderInterface(makeMessage(['tripType']), { onSuggestedAction });

    fireEvent.click(screen.getByRole('button', { name: /buscar ida y vuelta/i }));

    expect(onSuggestedAction).toHaveBeenCalledWith('Convertir a ida y vuelta');
  });

  it('pre-fills the chat input via onMessageChange when the passengers chip is clicked', () => {
    const onMessageChange = vi.fn();
    const onSuggestedAction = vi.fn();
    renderInterface(makeMessage(['adults']), { onMessageChange, onSuggestedAction });

    fireEvent.click(screen.getByRole('button', { name: /cambiar pasajeros/i }));

    expect(onMessageChange).toHaveBeenCalledWith('Somos ');
    // Should NOT auto-submit — passengers chip is a pre-fill flow.
    expect(onSuggestedAction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Phase 3 / sub-task C — narrative-emitted chips (`meta.emiliaNarrative.chips`).
  // The chip cluster prefers narrative chips over the legacy `inferredFields`
  // derivation when both are present. This covers the new path.
  // -------------------------------------------------------------------------
  it('renders chips from meta.emiliaNarrative.chips and routes submit-kind clicks to onSuggestedAction', () => {
    const onSuggestedAction = vi.fn();
    const message = makeMessage(['adults'], {
      emiliaNarrative: {
        chips: [
          {
            id: 'narrative-flip-trip-type',
            label: 'Pasarlo a ida y vuelta',
            action: { kind: 'submit', text: 'Hacelo ida y vuelta' },
          },
        ],
      },
    });
    renderInterface(message, { onSuggestedAction });

    const cluster = screen.getByTestId('inferred-defaults-chips');
    expect(cluster).toBeTruthy();
    // The narrative chip MUST take precedence over the inferred-fields fallback.
    expect(screen.getByRole('button', { name: /pasarlo a ida y vuelta/i })).toBeTruthy();
    // The legacy `adults` chip should NOT render — narrative chips win.
    expect(screen.queryByRole('button', { name: /cambiar pasajeros/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /pasarlo a ida y vuelta/i }));
    expect(onSuggestedAction).toHaveBeenCalledWith('Hacelo ida y vuelta');
  });

  it('falls back to inferredFields-derived chips when emiliaNarrative.chips is absent (back-compat)', () => {
    // No `emiliaNarrative` key on meta — older messages stay rendering identically.
    renderInterface(makeMessage(['tripType', 'adults']));

    const cluster = screen.getByTestId('inferred-defaults-chips');
    expect(cluster).toBeTruthy();
    expect(screen.getByRole('button', { name: /buscar ida y vuelta/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cambiar pasajeros/i })).toBeTruthy();
  });
});
