import { describe, expect, it } from 'vitest';
import { deriveModeSwitchState } from '../utils/deriveModeSwitchState';

describe('deriveModeSwitchState', () => {
  it('agency mode with hasAgency=true: agency selected, both enabled, no tooltip', () => {
    const items = deriveModeSwitchState('agency', true);
    expect(items).toEqual([
      { mode: 'agency', selected: true, disabled: false, labelKey: 'mode.agency' },
      { mode: 'passenger', selected: false, disabled: false, labelKey: 'mode.passenger' },
    ]);
  });

  it('passenger mode with hasAgency=true: passenger selected, both enabled, no tooltip', () => {
    const items = deriveModeSwitchState('passenger', true);
    expect(items).toEqual([
      { mode: 'agency', selected: false, disabled: false, labelKey: 'mode.agency' },
      { mode: 'passenger', selected: true, disabled: false, labelKey: 'mode.passenger' },
    ]);
  });

  it('passenger mode with hasAgency=false: agency disabled with tooltip, passenger enabled and selected', () => {
    const items = deriveModeSwitchState('passenger', false);
    expect(items).toEqual([
      {
        mode: 'agency',
        selected: false,
        disabled: true,
        labelKey: 'mode.agency',
        tooltipKey: 'mode.tooltipNoAgency',
      },
      { mode: 'passenger', selected: true, disabled: false, labelKey: 'mode.passenger' },
    ]);
  });

  it('agency mode with hasAgency=false (defensive: inconsistent state): agency still selected but disabled with tooltip', () => {
    const items = deriveModeSwitchState('agency', false);
    expect(items[0]).toEqual({
      mode: 'agency',
      selected: true,
      disabled: true,
      labelKey: 'mode.agency',
      tooltipKey: 'mode.tooltipNoAgency',
    });
    expect(items[1]).toEqual({
      mode: 'passenger',
      selected: false,
      disabled: false,
      labelKey: 'mode.passenger',
    });
  });
});
