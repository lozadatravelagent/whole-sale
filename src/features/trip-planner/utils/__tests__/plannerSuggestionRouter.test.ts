import { describe, it, expect } from 'vitest';
import { routePlannerSuggestion } from '../plannerSuggestionRouter';

const mk = (action: string, label = 'L') => ({ id: 'x', label, type: 'edit', priority: 1, action, payload: {} } as any);

describe('routePlannerSuggestion', () => {
  it('confirm_field → direct action only, no insert', () => {
    expect(routePlannerSuggestion(mk('confirm_field'))).toEqual({ runDirectAction: true, insertText: null });
  });
  it('confirm_location_dates → direct action only, no insert', () => {
    expect(routePlannerSuggestion(mk('confirm_location_dates'))).toEqual({ runDirectAction: true, insertText: null });
  });
  it('select_dates → direct action AND seed text', () => {
    expect(routePlannerSuggestion(mk('select_dates'))).toEqual({ runDirectAction: true, insertText: 'Quiero elegir las fechas exactas del viaje.' });
  });
  it('search_transport → insert label, no direct action', () => {
    expect(routePlannerSuggestion(mk('search_transport', 'Buscar vuelos a Roma'))).toEqual({ runDirectAction: false, insertText: 'Buscar vuelos a Roma' });
  });
  it('unknown action → default: insert label', () => {
    expect(routePlannerSuggestion(mk('something_new', 'Algo'))).toEqual({ runDirectAction: false, insertText: 'Algo' });
  });
});
