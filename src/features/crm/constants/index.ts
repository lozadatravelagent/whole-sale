// CRM Feature constants
export const CRM_FEATURE_VERSION = '1.0.0';

export const DEFAULT_SECTION_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
];

export const LEAD_STATUS_COLORS = {
  new: 'bg-blue-500',
  quoted: 'bg-yellow-500',
  negotiating: 'bg-orange-500',
  won: 'bg-green-500',
  lost: 'bg-red-500'
} as const;

export const TRIP_TYPE_ICONS = {
  flight: '✈️',
  hotel: '🏨',
  package: '📦'
} as const;

export const MAX_FLIGHT_SELECTIONS = 2;
export const MAX_HOTEL_SELECTIONS = 3;
export const MAX_CHECKLIST_ITEMS = 20;