import { describe, expect, it } from 'vitest';
import { buildModeBridgeMessage } from '../services/conversationOrchestrator';

// Stand-in for react-i18next's `t` function. Returns direction-specific copy
// keyed by locale, matching the actual contents of the 3 chat.json locales.
// Exact-match assertions per the C4 spec (not `toContain`).
const MESSAGES: Record<string, Record<string, string>> = {
  es: {
    'mode.bridgeTitle.toAgency':
      'Este pedido se resuelve mejor cotizando vuelos y hoteles. ¿Cambiamos de modo?',
    'mode.bridgeTitle.toPassenger':
      'Este pedido funciona mejor armando un itinerario. ¿Cambiamos de modo?',
  },
  en: {
    'mode.bridgeTitle.toAgency':
      'This works better in agency mode for quoting flights and hotels. Switch?',
    'mode.bridgeTitle.toPassenger':
      'This works better in passenger mode for itinerary planning. Switch?',
  },
  pt: {
    'mode.bridgeTitle.toAgency':
      'Este pedido funciona melhor cotando voos e hotéis. Mudamos de modo?',
    'mode.bridgeTitle.toPassenger':
      'Este pedido funciona melhor planejando o roteiro. Mudamos de modo?',
  },
};

function makeT(locale: string) {
  return (key: string) => MESSAGES[locale][key] ?? key;
}

describe('buildModeBridgeMessage', () => {
  it('suggestedMode=agency, es → exact Spanish toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', t: makeT('es') });
    expect(text).toBe(
      'Este pedido se resuelve mejor cotizando vuelos y hoteles. ¿Cambiamos de modo?',
    );
  });

  it('suggestedMode=agency, en → exact English toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', t: makeT('en') });
    expect(text).toBe(
      'This works better in agency mode for quoting flights and hotels. Switch?',
    );
  });

  it('suggestedMode=agency, pt → exact Portuguese toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', t: makeT('pt') });
    expect(text).toBe(
      'Este pedido funciona melhor cotando voos e hotéis. Mudamos de modo?',
    );
  });

  it('suggestedMode=passenger, es → exact Spanish toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', t: makeT('es') });
    expect(text).toBe(
      'Este pedido funciona mejor armando un itinerario. ¿Cambiamos de modo?',
    );
  });

  it('suggestedMode=passenger, en → exact English toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', t: makeT('en') });
    expect(text).toBe(
      'This works better in passenger mode for itinerary planning. Switch?',
    );
  });

  it('suggestedMode=passenger, pt → exact Portuguese toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', t: makeT('pt') });
    expect(text).toBe(
      'Este pedido funciona melhor planejando o roteiro. Mudamos de modo?',
    );
  });

  it('selects the correct key per direction (agency → toAgency, passenger → toPassenger)', () => {
    const keysRequested: string[] = [];
    const probe = (key: string) => {
      keysRequested.push(key);
      return key;
    };
    buildModeBridgeMessage({ suggestedMode: 'agency', t: probe });
    buildModeBridgeMessage({ suggestedMode: 'passenger', t: probe });
    expect(keysRequested).toEqual(['mode.bridgeTitle.toAgency', 'mode.bridgeTitle.toPassenger']);
  });
});
