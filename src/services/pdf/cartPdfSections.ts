import type {
  PlannerSegment,
  PlannerTransport,
} from '@/features/trip-planner/types';
import {
  formatDestinationLabel,
  formatPlannerFlightDuration,
  formatPlannerFlightStops,
  formatPlannerFlightTimeRange,
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  formatPlannerTravelerSummary,
  getPlannerFlightRoute,
  getPrimaryPlannerHotelRoom,
} from '@/features/trip-planner/utils';

/**
 * Shared PDF section renderers for cart items (flights and hotels) added to a
 * TripPlannerState via "Agregar al itinerario". Used by both `buildPlannerPdfHtml`
 * (workspace print window) and `renderItineraryHtml` (download flow) so the
 * generated PDF surfaces what the user actually selected from the chat cards.
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderHotelSection(segment: PlannerSegment): string {
  const hotel = segment.hotelPlan.confirmedInventoryHotel
    || (!segment.hotelPlan.selectedPlaceCandidate ? segment.hotelPlan.hotelRecommendations[0] : null);

  const placeCandidate = segment.hotelPlan.selectedPlaceCandidate;

  if (!hotel && !placeCandidate) return '';

  if (hotel) {
    const room = getPrimaryPlannerHotelRoom(hotel);
    const category = formatPlannerHotelCategory(hotel.category);
    const price = formatPlannerPrice(room?.price, room?.currency);
    const roomLabel = formatPlannerRoomLabel(hotel);
    const travelers = formatPlannerTravelerSummary(hotel);
    const isConfirmedInventory = Boolean(segment.hotelPlan.confirmedInventoryHotel);
    const labelTag = isConfirmedInventory
      ? '<span style="display:inline-block;background:#166534;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Precio de inventario</span>'
      : '<span style="display:inline-block;background:#6b7280;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Sugerencia del planner</span>';

    let html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin:8px 0;">`;
    html += `<strong>🏨 ${escapeHtml(hotel.name)}</strong>${labelTag}`;
    if (category) html += ` · ${escapeHtml(category)}`;
    html += `<br/><span style="font-size:0.9em;color:#4b5563;">${escapeHtml(roomLabel)}</span>`;
    if (price) html += ` · <strong>${escapeHtml(price)}</strong>`;
    if (travelers) html += `<br/><span style="font-size:0.85em;color:#6b7280;">${escapeHtml(travelers)}</span>`;
    html += '</div>';
    return html;
  }

  if (placeCandidate) {
    let html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin:8px 0;">`;
    html += `<strong>🏨 ${escapeHtml(placeCandidate.name)}</strong>`;
    html += '<span style="display:inline-block;background:#6b7280;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Sugerencia del planner</span>';
    if (placeCandidate.rating) html += ` · ⭐ ${placeCandidate.rating}`;
    if (placeCandidate.formattedAddress) html += `<br/><span style="font-size:0.85em;color:#6b7280;">${escapeHtml(placeCandidate.formattedAddress)}</span>`;
    html += '</div>';
    return html;
  }

  return '';
}

export function renderTransportSection(transport: PlannerTransport | null | undefined, label: string): string {
  if (!transport) return '';

  if (transport.type === 'flight' && transport.options?.length) {
    const selected = transport.selectedOptionId
      ? transport.options.find((o) => o.id === transport.selectedOptionId)
      : transport.options[0];

    if (selected) {
      const route = getPlannerFlightRoute(selected);
      const duration = formatPlannerFlightDuration(selected);
      const stops = formatPlannerFlightStops(selected);
      const timeRange = formatPlannerFlightTimeRange(selected);
      const price = formatPlannerPrice(selected.price?.amount, selected.price?.currency);

      let html = `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:8px 0;">`;
      html += `<strong>✈️ ${escapeHtml(label)}</strong>`;
      if (route) html += ` · ${escapeHtml(route)}`;
      const details: string[] = [];
      if (timeRange) details.push(timeRange);
      if (duration) details.push(duration);
      if (stops) details.push(stops);
      if (price) details.push(price);
      if (details.length) html += `<br/><span style="font-size:0.9em;color:#4b5563;">${details.map(escapeHtml).join(' · ')}</span>`;
      html += '</div>';
      return html;
    }
  }

  return `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:8px 0;"><strong>🚗 ${escapeHtml(label)}</strong>: ${escapeHtml(transport.summary)}</div>`;
}

/**
 * Returns true if the segment has any cart-added content (transport or hotel)
 * worth rendering in a PDF cart section.
 */
export function segmentHasCartContent(segment: PlannerSegment): boolean {
  return Boolean(
    segment.hotelPlan?.confirmedInventoryHotel
    || segment.hotelPlan?.selectedPlaceCandidate
    || segment.transportIn?.selectedOptionId
    || segment.transportOut?.selectedOptionId
  );
}

/**
 * Renders the "Vuelos y alojamiento" cart section content (no `data-pdf-page`
 * wrapper — caller decides page envelope). Returns empty string when there's
 * no cart content. Used by `renderItineraryHtml` between summary and day pages.
 */
export function renderCartPage(segments: PlannerSegment[]): string {
  const blocks = segments
    .filter(segmentHasCartContent)
    .map((segment) => {
      const city = formatDestinationLabel(segment.city);
      let block = `<section style="margin-bottom:18px;page-break-inside:avoid;">`;
      block += `<h3 style="color:#1e40af;margin:0 0 6px;font-size:1.05em;">${escapeHtml(city)}</h3>`;
      block += renderHotelSection(segment);
      block += renderTransportSection(segment.transportIn, 'Llegada');
      block += renderTransportSection(segment.transportOut, 'Salida');
      block += '</section>';
      return block;
    })
    .join('');

  if (!blocks) return '';

  return `<h2 style="color:#1e40af;border-bottom:2px solid #93c5fd;padding-bottom:6px;margin:0 0 16px;">Vuelos y alojamiento</h2>${blocks}`;
}
