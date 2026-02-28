export const PLANNER_GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
export const PLANNER_GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || '';

export const HAS_PLANNER_GOOGLE_MAPS = Boolean(PLANNER_GOOGLE_MAPS_API_KEY);
