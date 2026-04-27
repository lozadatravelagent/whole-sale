import { supabase } from "@/integrations/supabase/client";
import type { LeadAiProfile } from "../types/knowledge";
import type { ParsedTravelRequest } from "@/services/aiMessageParser";

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)));
}

function extractDestinations(parsedRequest: ParsedTravelRequest): string[] {
  if (parsedRequest.itinerary?.destinations?.length) {
    return uniqueStrings(parsedRequest.itinerary.destinations);
  }

  if (parsedRequest.flights?.destination) {
    return uniqueStrings([parsedRequest.flights.destination]);
  }

  if (parsedRequest.hotels?.city) {
    return uniqueStrings([parsedRequest.hotels.city]);
  }

  return [];
}

function extractTravelers(parsedRequest: ParsedTravelRequest): { adults?: number; children?: number; infants?: number } | undefined {
  if (parsedRequest.itinerary?.travelers) {
    return {
      adults: parsedRequest.itinerary.travelers.adults,
      children: parsedRequest.itinerary.travelers.children,
      infants: parsedRequest.itinerary.travelers.infants,
    };
  }

  if (parsedRequest.flights) {
    return {
      adults: parsedRequest.flights.adults,
      children: parsedRequest.flights.children,
      infants: parsedRequest.flights.infants,
    };
  }

  if (parsedRequest.hotels) {
    return {
      adults: parsedRequest.hotels.adults,
      children: parsedRequest.hotels.children,
      infants: parsedRequest.hotels.infants,
    };
  }

  return undefined;
}

export function mergeLeadAiProfile(existing: LeadAiProfile | null, parsedRequest: ParsedTravelRequest, options?: {
  sourceConversationId?: string | null;
  tenantId?: string | null;
  agencyId?: string | null;
  leadId: string;
}): LeadAiProfile {
  const currentProfile = existing?.profile ?? {};
  const destinations = extractDestinations(parsedRequest);
  const travelers = extractTravelers(parsedRequest);
  const itinerary = parsedRequest.itinerary;

  const nextRecentDestinations = uniqueStrings([
    ...(destinations ?? []),
    ...(currentProfile.recentDestinations ?? []),
  ]).slice(0, 5);

  const nextInterests = uniqueStrings([
    ...(itinerary?.interests ?? []),
    ...(itinerary?.travelStyle ?? []),
    ...(currentProfile.interests ?? []),
  ]);

  const nextConstraints = uniqueStrings([
    ...(itinerary?.constraints ?? []),
    ...(currentProfile.constraints ?? []),
  ]);

  return {
    id: existing?.id,
    leadId: options?.leadId ?? existing?.leadId ?? "",
    tenantId: options?.tenantId ?? existing?.tenantId ?? null,
    agencyId: options?.agencyId ?? existing?.agencyId ?? null,
    sourceConversationId: options?.sourceConversationId ?? existing?.sourceConversationId ?? null,
    schemaVersion: 1,
    summaryText: existing?.summaryText ?? null,
    createdAt: existing?.createdAt,
    updatedAt: existing?.updatedAt,
    profile: {
      homeAirport: parsedRequest.flights?.origin || currentProfile.homeAirport,
      travelerDefaults: {
        adults: travelers?.adults ?? currentProfile.travelerDefaults?.adults,
        children: travelers?.children ?? currentProfile.travelerDefaults?.children,
        infants: travelers?.infants ?? currentProfile.travelerDefaults?.infants,
      },
      budgetBand: itinerary?.budgetLevel || currentProfile.budgetBand,
      hotelTier: itinerary?.hotelCategory || currentProfile.hotelTier,
      pace: itinerary?.pace || currentProfile.pace,
      interests: nextInterests,
      constraints: nextConstraints,
      recentDestinations: nextRecentDestinations,
      lastConfirmedDates: {
        startDate: itinerary?.startDate || currentProfile.lastConfirmedDates?.startDate,
        endDate: itinerary?.endDate || currentProfile.lastConfirmedDates?.endDate,
        flexibleMonth: itinerary?.flexibleMonth || currentProfile.lastConfirmedDates?.flexibleMonth,
        flexibleYear: itinerary?.flexibleYear || currentProfile.lastConfirmedDates?.flexibleYear,
      },
      preferredTripStyle: uniqueStrings([
        ...(itinerary?.travelStyle ?? []),
        ...(currentProfile.preferredTripStyle ?? []),
      ]),
    },
  };
}

function mapProfileRow(row: any): LeadAiProfile {
  return {
    id: row.id,
    leadId: row.lead_id,
    tenantId: row.tenant_id,
    agencyId: row.agency_id,
    sourceConversationId: row.source_conversation_id,
    schemaVersion: row.schema_version ?? 1,
    profile: (row.profile_json ?? {}) as LeadAiProfile["profile"],
    summaryText: row.summary_text ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadLeadAiProfile(leadId: string): Promise<LeadAiProfile | null> {
  const { data, error } = await supabase
    .from("lead_ai_profiles")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) {
    console.error("[LEAD_AI_PROFILE] load failed:", error);
    return null;
  }

  return data ? mapProfileRow(data) : null;
}

export async function saveLeadAiProfile(profile: LeadAiProfile): Promise<void> {
  let tenantId = profile.tenantId ?? null;
  let agencyId = profile.agencyId ?? null;

  if (!tenantId || !agencyId) {
    const { data: leadRow, error: leadError } = await supabase
      .from("leads")
      .select("tenant_id, agency_id")
      .eq("id", profile.leadId)
      .maybeSingle();

    if (leadError) {
      console.error("[LEAD_AI_PROFILE] lead lookup failed:", leadError);
      return;
    }

    tenantId = leadRow?.tenant_id ?? null;
    agencyId = leadRow?.agency_id ?? null;
  }

  if (!tenantId || !agencyId) {
    console.warn("[LEAD_AI_PROFILE] Missing tenant/agencia, skipping save");
    return;
  }

  const { error } = await supabase
    .from("lead_ai_profiles")
    .upsert({
      lead_id: profile.leadId,
      tenant_id: tenantId,
      agency_id: agencyId,
      source_conversation_id: profile.sourceConversationId ?? null,
      profile_json: profile.profile,
      summary_text: profile.summaryText ?? null,
      schema_version: profile.schemaVersion ?? 1,
    }, { onConflict: "lead_id" });

  if (error) {
    console.error("[LEAD_AI_PROFILE] save failed:", error);
  }
}
