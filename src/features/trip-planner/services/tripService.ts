import { supabase } from '@/integrations/supabase/client';
import type { TripPlannerState } from '../types';

export interface TripRow {
  id: string;
  title: string | null;
  summary: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  destination_cities: string[];
  budget_level: string | null;
  travelers: { adults: number; children: number; infants: number } | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function deriveTripStatus(state: TripPlannerState): string {
  const segments = state.segments || [];
  if (segments.length === 0) return 'draft';

  const allHotelsConfirmed = segments.every(
    s => s.hotelPlan?.matchStatus === 'confirmed' || s.hotelPlan?.matchStatus === 'quoted'
  );
  const allTransportReady = segments.every(
    s => s.transportIn?.searchStatus === 'ready' || s.transportIn?.searchStatus === 'confirmed'
  );

  if (allHotelsConfirmed && allTransportReady) return 'quoted';
  if (segments.some(s => s.contentStatus === 'ready')) return 'ready';
  return 'draft';
}

function hashState(state: TripPlannerState): string {
  try {
    return btoa(JSON.stringify(state)).slice(0, 32);
  } catch {
    return String(Date.now());
  }
}

export async function upsertTrip(
  plannerState: TripPlannerState,
  conversationId: string,
  userId: string,
  agencyId: string | null,
  tenantId: string | null,
  accountType: 'agent' | 'consumer' = 'agent',
): Promise<string | null> {
  try {
    if (accountType === 'agent' && (!agencyId || !tenantId)) {
      console.warn('[TRIP SERVICE] upsertTrip: agent requires agencyId and tenantId');
      return null;
    }

    const tripData = {
      conversation_id: conversationId,
      agency_id: accountType === 'consumer' ? null : agencyId,
      tenant_id: accountType === 'consumer' ? null : tenantId,
      created_by: userId,
      owner_user_id: userId,
      account_type: accountType,
      title: plannerState.title || null,
      summary: plannerState.summary || null,
      status: deriveTripStatus(plannerState),
      start_date: plannerState.startDate || null,
      end_date: plannerState.endDate || null,
      total_nights: plannerState.days || null,
      budget_level: plannerState.budgetLevel || null,
      pace: plannerState.pace || null,
      travelers: plannerState.travelers || { adults: 2, children: 0, infants: 0 },
      destination_cities: plannerState.segments?.map(s => s.city) || [],
      destination_countries: (plannerState.segments?.map(s => s.country).filter(Boolean) as string[]) || [],
      planner_state: plannerState,
      version: plannerState.generationMeta?.version || 1,
      last_state_hash: hashState(plannerState),
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check previous status before upsert (for activity detection)
    const { data: prevTrip } = await supabase
      .from('trips')
      .select('id, status, lead_id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    const prevStatus = prevTrip?.status;
    const newStatus = tripData.status;

    const { data, error } = await supabase
      .from('trips')
      .upsert(tripData, { onConflict: 'conversation_id' })
      .select('id')
      .single();

    if (error) {
      console.warn('[TRIP SERVICE] upsertTrip error:', error.message);
      return null;
    }

    // Sync segments
    if (data?.id) {
      await syncTripSegments(data.id, plannerState);
    }

    // Create CRM activity when trip becomes 'quoted' with a lead linked
    const leadId = prevTrip?.lead_id;
    if (leadId && prevStatus !== 'quoted' && newStatus === 'quoted' && data?.id) {
      const destinations = plannerState.segments?.map(s => s.city).join(', ') || '';
      supabase.from('activities').insert({
        activity_type: 'quote_sent',
        description: `Cotización generada: ${plannerState.title || 'Itinerario'}. Destinos: ${destinations}`,
        lead_id: leadId,
        user_id: userId,
        agency_id: agencyId,
        tenant_id: tenantId,
        metadata: { trip_id: data.id },
      }).then(({ error: actErr }) => {
        if (actErr) console.warn('[TRIP SERVICE] Activity insert error:', actErr.message);
      });
    }

    return data?.id || null;
  } catch (err) {
    console.warn('[TRIP SERVICE] upsertTrip exception:', err);
    return null;
  }
}

async function syncTripSegments(tripId: string, state: TripPlannerState): Promise<void> {
  const segments = (state.segments || []).map((seg, index) => ({
    trip_id: tripId,
    segment_index: index,
    city: seg.city,
    country: seg.country || null,
    start_date: seg.startDate || null,
    end_date: seg.endDate || null,
    nights: seg.nights || null,
    hotel_status: seg.hotelPlan?.matchStatus || 'idle',
    transport_in_status: seg.transportIn?.searchStatus || 'idle',
    transport_out_status: seg.transportOut?.searchStatus || 'idle',
    hotel_name: seg.hotelPlan?.confirmedInventoryHotel?.name || null,
    hotel_price_per_night: seg.hotelPlan?.budgetPrice || null,
    flight_price_per_person: null,
  }));

  // Delete old segments and re-insert
  await supabase.from('trip_segments').delete().eq('trip_id', tripId);
  if (segments.length > 0) {
    await supabase.from('trip_segments').insert(segments);
  }
}

export async function getTripByConversation(conversationId: string): Promise<TripPlannerState | null> {
  const { data } = await supabase
    .from('trips')
    .select('planner_state')
    .eq('conversation_id', conversationId)
    .single();

  return (data?.planner_state as TripPlannerState) || null;
}

export async function listTripsByAgency(
  agencyId: string,
  filters?: { status?: string; city?: string; from?: string; to?: string },
): Promise<TripRow[]> {
  let query = supabase
    .from('trips')
    .select('id, title, summary, status, start_date, end_date, destination_cities, budget_level, travelers, created_by, created_at, updated_at')
    .eq('agency_id', agencyId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.city) query = query.contains('destination_cities', [filters.city]);
  if (filters?.from) query = query.gte('start_date', filters.from);
  if (filters?.to) query = query.lte('end_date', filters.to);

  const { data } = await query;
  return (data as TripRow[]) || [];
}

export async function getTripById(tripId: string): Promise<(TripRow & { planner_state: TripPlannerState; conversation_id: string | null }) | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error || !data) return null;
  return data as any;
}

function resetSearchStatuses(state: TripPlannerState): TripPlannerState {
  return {
    ...state,
    segments: (state.segments ?? []).map(seg => ({
      ...seg,
      hotelPlan: {
        ...seg.hotelPlan,
        city: seg.hotelPlan?.city || seg.city,
        searchStatus: 'idle' as const,
        matchStatus: 'idle' as const,
        hotelRecommendations: [],
        confirmedInventoryHotel: null,
        inventoryMatchCandidates: [],
        selectedHotelId: undefined,
        lastSearchSignature: undefined,
      },
      transportIn: seg.transportIn ? {
        type: seg.transportIn.type ?? 'flight',
        summary: '',
        searchStatus: 'idle' as const,
        options: [],
        selectedOptionId: undefined,
        lastSearchSignature: undefined,
      } : null,
      transportOut: null,
    })),
  };
}

export async function duplicateTrip(
  originalTripId: string,
  userId: string,
  agencyId: string,
  tenantId: string,
): Promise<string | null> {
  const original = await getTripById(originalTripId);
  if (!original?.planner_state) return null;

  const cleanedState = resetSearchStatuses(original.planner_state);

  const { data, error } = await supabase
    .from('trips')
    .insert({
      agency_id: agencyId,
      tenant_id: tenantId,
      created_by: userId,
      title: `Copia de ${original.title ?? 'itinerario'}`,
      status: 'draft',
      budget_level: original.budget_level,
      travelers: original.travelers,
      destination_cities: original.destination_cities,
      planner_state: cleanedState,
      conversation_id: null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[TRIP SERVICE] duplicateTrip error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function updateTripLeadId(conversationId: string, leadId: string | null, userId: string): Promise<void> {
  await supabase
    .from('trips')
    .update({
      lead_id: leadId,
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversationId);
}
