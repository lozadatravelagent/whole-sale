import { useQuery } from '@tanstack/react-query';
import { listTripsByAgency, type TripRow } from '../services/tripService';
import { useAuth } from '@/contexts/AuthContext';

export interface TripListFilters {
  status?: string;
  city?: string;
  from?: string;
  to?: string;
}

export function useTripList(filters?: TripListFilters) {
  const { user } = useAuth();
  const agencyId = user?.agency_id;

  return useQuery<TripRow[]>({
    queryKey: ['trips', agencyId, filters],
    queryFn: () => listTripsByAgency(agencyId!, filters),
    enabled: !!agencyId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
