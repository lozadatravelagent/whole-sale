/**
 * Multi-provider search types (Starling / EUROVIPS / Delfos).
 * Shared by edge executors and delfos-api mappers.
 * Keep in sync with src/types TravelSearchProvider / ProviderOfferMeta.
 */

export type TravelSearchProvider = 'STARLING' | 'EUROVIPS' | 'DELFOS' | 'HOTELBEDS';

export interface ProviderOfferMeta {
  priceableUntil?: string;
  expiresAt?: string;
  sourceProvider?: string;
}

export interface ProviderErrorEntry {
  provider: TravelSearchProvider;
  message: string;
  code?: string;
  chain?: string;
}

export interface ProviderSearchMeta {
  providers_searched: TravelSearchProvider[];
  providers_succeeded: TravelSearchProvider[];
  provider_errors?: ProviderErrorEntry[];
  provider_counts?: Record<string, number>;
}

export const DEFAULT_FLIGHT_MERGE_CAP = 40;
export const DEFAULT_HOTEL_MERGE_CAP = 40;
