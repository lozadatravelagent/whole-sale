import type { TripPlannerState } from '@/features/trip-planner/types';
import type { MessageRow } from '../types/chat';
import type { DiscoveryContext } from '../services/discoveryService';
import { hasItineraryContent } from './hasItineraryContent';
import { hasChatMapContent } from './chatMapModel';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isDiscoveryContext(value: unknown): value is DiscoveryContext {
  if (!isRecord(value)) return false;
  const destination = value.destination;
  return isRecord(destination)
    && typeof destination.city === 'string'
    && Number.isFinite(destination.lat)
    && Number.isFinite(destination.lng)
    && Array.isArray(value.places);
}

export function getLatestDiscoveryContext(messages: MessageRow[]): DiscoveryContext | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const meta = messages[index].meta;
    if (!isRecord(meta)) continue;
    const discoveryContext = meta.discoveryContext;
    if (isDiscoveryContext(discoveryContext)) {
      return discoveryContext;
    }
  }

  return null;
}

export function hasChatContextPanelContent(
  plannerState: TripPlannerState | null,
  discoveryContext?: DiscoveryContext | null,
): boolean {
  return hasChatMapContent(plannerState, discoveryContext) || hasItineraryContent(plannerState);
}
