import { useEffect, useRef } from 'react';
import { detectUserOriginCity } from '@/features/trip-planner/services/plannerGeocoding';
import { useEmiliaState, useUpdateState } from '@/features/chat/state/useEmiliaState';

interface UseGeolocationOriginHydrationArgs {
  conversationId: string | null;
  enabled: boolean;
}

/**
 * Hydrate `EmiliaProfile.default_origin_city/country` from the browser's
 * Geolocation API once per session, after the user signals intent (first
 * message sent). Idempotent: skips if already hydrated; never retries on
 * denial within a session (the underlying `detectUserOriginCity` cache also
 * guards repeats).
 *
 * Triggers no UI (no banner, no modal). Browser owns the permission prompt.
 *
 * Track B of feat-geolocation-origin-default. Track A reads
 * `profile.default_origin_city` from the prompt-side `<user_profile>` block
 * to fill `flights.origin` when the user does not state it explicitly.
 */
export default function useGeolocationOriginHydration({
  conversationId,
  enabled,
}: UseGeolocationOriginHydrationArgs): void {
  const { state } = useEmiliaState(conversationId);
  const { mutate } = useUpdateState(conversationId);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!conversationId) return;
    if (!state) return;
    if (state.profile.default_origin_city) return;
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    let cancelled = false;
    detectUserOriginCity().then((result) => {
      if (cancelled) return;
      if (!result) {
        console.log('🌍 [GEO-HYDRATION] denied or unavailable, no default set');
        return;
      }
      mutate((draft) => {
        // Re-check inside the mutator: defends against a race where another
        // path (e.g. an explicit "desde Madrid" parse) wrote the slot
        // between getCurrentPosition resolution and this mutation landing.
        if (draft.profile.default_origin_city) return;
        draft.profile.default_origin_city = result.city;
        draft.profile.default_origin_country = result.country;
      })
        .then(() => {
          console.log(`🌍 [GEO-HYDRATION] granted, set default_origin_city="${result.city}"`);
        })
        .catch((e) => {
          console.warn('🌍 [GEO-HYDRATION] mutation failed:', e);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, conversationId, state, mutate]);
}
