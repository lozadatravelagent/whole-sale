// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ChatInterface from '../ChatInterface';
import type { MessageRow } from '../../types/chat';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
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

const baseMessage: MessageRow = {
  id: 'assistant-1',
  conversation_id: 'conv-1',
  role: 'assistant',
  content: { text: 'Tengo una base para Cancun.' },
  meta: {
    suggestedActions: [
      {
        id: 'action-flight-cancun',
        label: 'Buscar vuelos para Cancun',
        prompt: 'Quiero buscar vuelos para Cancun, Quintana Roo, Mexico.',
        type: 'flight',
        priority: 1,
      },
    ],
  },
  created_at: '2026-05-05T12:00:00Z',
  client_id: null,
  status: null,
} as MessageRow;

describe('ChatInterface suggested actions', () => {
  it('renders executable prompt chips and inserts their prompt into the input on click', () => {
    const onSuggestedAction = vi.fn();
    const onChipInsert = vi.fn();

    render(
      <ChatInterface
        selectedConversation="conv-1"
        message=""
        isLoading={false}
        isTyping={false}
        isUploadingPdf={false}
        isAddingToCRM={false}
        messages={[baseMessage]}
        refreshMessages={vi.fn()}
        onMessageChange={vi.fn()}
        onSendMessage={vi.fn()}
        onPdfUpload={vi.fn()}
        onAddToCRM={vi.fn()}
        onPdfGenerated={vi.fn()}
        accountType="agent"
        onSuggestedAction={onSuggestedAction}
        onChipInsert={onChipInsert}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /buscar vuelos para cancun/i }));

    // NEW: chip inserts text into the editable input (no auto-send).
    expect(onChipInsert).toHaveBeenCalledWith('Quiero buscar vuelos para Cancun, Quintana Roo, Mexico.');
    // OLD auto-send path must NOT fire.
    expect(onSuggestedAction).not.toHaveBeenCalled();
  });
});
