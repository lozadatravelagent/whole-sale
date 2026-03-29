import mapboxgl from 'mapbox-gl';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN?.trim() || '';
export const HAS_MAP = Boolean(MAPBOX_TOKEN);

const mapboxWithTelemetryToggle = mapboxgl as typeof mapboxgl & {
  setTelemetryEnabled?: (enabled: boolean) => void;
};

mapboxWithTelemetryToggle.setTelemetryEnabled?.(false);
