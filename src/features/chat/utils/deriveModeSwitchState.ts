export type ChatMode = 'agency' | 'passenger';

export interface ModeSwitchItem {
  mode: ChatMode;
  selected: boolean;
  disabled: boolean;
  labelKey: string;
  tooltipKey?: string;
}

export function deriveModeSwitchState(mode: ChatMode, hasAgency: boolean): ModeSwitchItem[] {
  const agency: ModeSwitchItem = {
    mode: 'agency',
    selected: mode === 'agency',
    disabled: !hasAgency,
    labelKey: 'mode.agency',
  };
  if (!hasAgency) {
    agency.tooltipKey = 'mode.tooltipNoAgency';
  }

  const passenger: ModeSwitchItem = {
    mode: 'passenger',
    selected: mode === 'passenger',
    disabled: false,
    labelKey: 'mode.passenger',
  };

  return [agency, passenger];
}
