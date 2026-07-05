/**
 * Portable WholeSale/Vibook itinerary PDF design.
 *
 * Copy this file next to quote-pdf-designs.ts.
 * It reuses the shared A4 page wrapper, header, footer and PDF renderer.
 */

import {
  type BrandingData,
  downloadPdfFromHtml,
  pageClose,
  pageOpen,
  renderCustomFooter,
  renderCustomHeader,
  renderHtmlToPdfBlob,
  wrapHtmlDocument,
} from './quote-pdf-designs';

export interface PlannerActivity {
  title: string;
}

export interface PlannerRestaurant {
  name: string;
}

export interface PlannerDay {
  dayNumber: number;
  date?: string;
  title: string;
  summary?: string;
  morning?: PlannerActivity[];
  afternoon?: PlannerActivity[];
  evening?: PlannerActivity[];
  restaurants?: PlannerRestaurant[];
  travelTip?: string;
}

export interface PlannerTransportOption {
  id?: string;
  route?: string;
  duration?: string;
  stops?: string;
  timeRange?: string;
  price?: {
    amount?: number | string;
    currency?: string;
  };
}

export interface PlannerTransport {
  type?: string;
  summary?: string;
  selectedOptionId?: string;
  options?: PlannerTransportOption[];
}

export interface PlannerHotelRoom {
  type?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  total_price?: number | string;
}

export interface PlannerHotel {
  name: string;
  category?: string;
  rooms?: PlannerHotelRoom[];
  selectedRoom?: PlannerHotelRoom;
  search_adults?: number;
  search_children?: number;
  search_infants?: number;
}

export interface PlannerPlaceCandidate {
  name: string;
  rating?: number | string;
  formattedAddress?: string;
}

export interface PlannerSegment {
  city: string;
  country?: string;
  nights?: number;
  days?: PlannerDay[];
  hotelPlan?: {
    confirmedInventoryHotel?: PlannerHotel | null;
    selectedPlaceCandidate?: PlannerPlaceCandidate | null;
    hotelRecommendations?: PlannerHotel[];
  };
  transportIn?: PlannerTransport | null;
  transportOut?: PlannerTransport | null;
}

export interface TripPlannerState {
  title?: string;
  summary?: string;
  origin?: string;
  destinations: string[];
  startDate?: string;
  endDate?: string;
  isFlexibleDates?: boolean;
  flexibleMonth?: string;
  flexibleYear?: string;
  days?: number;
  budgetLevel?: 'low' | 'mid' | 'high' | 'luxury' | string;
  travelers?: {
    adults: number;
    children: number;
    infants: number;
  };
  generationMeta?: {
    isDraft?: boolean;
  };
  segments: PlannerSegment[];
}

export function canExportItineraryPdf(state: TripPlannerState | null): boolean {
  if (!state) return false;
  if (state.generationMeta?.isDraft) return false;
  if (!state.segments || state.segments.length === 0) return false;
  return state.segments.some(segment =>
    (segment.days && segment.days.length > 0) || segmentHasCartContent(segment)
  );
}

export function renderItineraryHtml(state: TripPlannerState, branding: BrandingData): string {
  let pages = '';
  pages += renderSummaryPage(state, branding);

  const cartHtml = renderCartPage(state.segments);
  if (cartHtml) {
    pages += `${pageOpen()}${renderCustomHeader(branding)}<div style="flex:1;padding-top:16px;overflow:hidden;">${cartHtml}</div>${renderCustomFooter(branding)}${pageClose()}`;
  }

  for (const segment of state.segments) {
    const days = segment.days ?? [];
    if (days.length === 0) continue;

    for (let i = 0; i < days.length; i += 3) {
      pages += renderDaysPage(segment.city, segment.country, days.slice(i, i + 3), branding);
    }
  }

  return wrapHtmlDocument(pages);
}

export async function renderItineraryPdfBlob(state: TripPlannerState, branding: BrandingData): Promise<Blob> {
  return renderHtmlToPdfBlob(renderItineraryHtml(state, branding));
}

export async function downloadItineraryPdf(
  state: TripPlannerState,
  branding: BrandingData,
  filename = 'itinerario.pdf'
): Promise<void> {
  return downloadPdfFromHtml(renderItineraryHtml(state, branding), filename);
}

function renderSummaryPage(state: TripPlannerState, branding: BrandingData): string {
  const color = branding.agency_primary_color;

  const dateLabel = state.isFlexibleDates
    ? [state.flexibleMonth, state.flexibleYear].filter(Boolean).join(' ') || 'Fechas flexibles'
    : [state.startDate, state.endDate].filter(Boolean).join(' - ') || 'A definir';

  const travelers = state.travelers
    ? [
        state.travelers.adults > 0 ? `${state.travelers.adults} adulto${state.travelers.adults > 1 ? 's' : ''}` : '',
        state.travelers.children > 0 ? `${state.travelers.children} menor${state.travelers.children > 1 ? 'es' : ''}` : '',
        state.travelers.infants > 0 ? `${state.travelers.infants} bebe${state.travelers.infants > 1 ? 's' : ''}` : '',
      ].filter(Boolean).join(', ')
    : '';

  const budgetLabels: Record<string, string> = {
    low: 'Economico',
    mid: 'Moderado',
    high: 'Premium',
    luxury: 'Lujo',
  };
  const budgetLabel = state.budgetLevel ? (budgetLabels[state.budgetLevel] ?? String(state.budgetLevel)) : '';
  const route = [state.origin, ...state.destinations].filter(Boolean).map(escapeHtml).join(' -> ');

  const segmentRows = state.segments.map(segment => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#374151;">
        ${escapeHtml(segment.city)}${segment.country ? `, ${escapeHtml(segment.country)}` : ''}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;text-align:right;">
        ${segment.nights != null ? `${segment.nights} noche${segment.nights !== 1 ? 's' : ''}` : ''}
      </td>
    </tr>`).join('');

  const summaryRows = [
    ['Ruta', route],
    ['Fechas', escapeHtml(dateLabel)],
    travelers ? ['Viajeros', escapeHtml(travelers)] : null,
    state.days ? ['Duracion', `${state.days} dia${state.days !== 1 ? 's' : ''}`] : null,
    budgetLabel ? ['Presupuesto', escapeHtml(budgetLabel)] : null,
  ].filter(Boolean) as [string, string][];

  return `${pageOpen()}
    ${renderCustomHeader(branding)}
    <div style="flex:1;padding-top:20px;overflow:hidden;">
      <h1 style="font-size:22px;font-weight:700;color:#333;margin-bottom:18px;text-align:center;text-transform:uppercase;letter-spacing:1px;">
        ${state.title ? escapeHtml(state.title) : 'Itinerario de viaje'}
      </h1>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f8f9fa;border-radius:8px;overflow:hidden;">
        ${summaryRows.map(([label, value]) => `
          <tr>
            <td style="padding:7px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;width:30%;border-bottom:1px solid #eee;">
              ${label}
            </td>
            <td style="padding:7px 14px;font-size:13px;color:#1f2937;border-bottom:1px solid #eee;">
              ${value}
            </td>
          </tr>`).join('')}
      </table>
      ${state.summary ? `
        <p style="font-size:12px;color:#4b5563;line-height:1.6;margin-bottom:18px;padding:12px 14px;background:#f0f9ff;border-left:3px solid ${color};border-radius:0 6px 6px 0;">
          ${escapeHtml(state.summary)}
        </p>` : ''}
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;margin-bottom:8px;">Destinos</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:${color};">
              <th style="padding:7px 10px;font-size:11px;color:white;font-weight:600;text-align:left;">Ciudad</th>
              <th style="padding:7px 10px;font-size:11px;color:white;font-weight:600;text-align:right;">Noches</th>
            </tr>
          </thead>
          <tbody>${segmentRows}</tbody>
        </table>
      </div>
    </div>
    ${renderCustomFooter(branding)}
  ${pageClose()}`;
}

function renderDaysPage(
  city: string,
  country: string | undefined,
  days: PlannerDay[],
  branding: BrandingData
): string {
  const color = branding.agency_primary_color;
  const daysHtml = days.map(day => renderDayCard(day, color)).join('');

  return `${pageOpen()}
    ${renderCustomHeader(branding)}
    <div style="flex:1;padding-top:16px;overflow:hidden;">
      <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid ${color};">
        ${escapeHtml(city)}${country ? ` - ${escapeHtml(country)}` : ''}
      </div>
      ${daysHtml}
    </div>
    ${renderCustomFooter(branding)}
  ${pageClose()}`;
}

function renderDayCard(day: PlannerDay, color: string): string {
  const dateLabel = day.date ? ` - ${escapeHtml(day.date)}` : '';

  const slotsHtml = [
    { label: 'Manana', items: day.morning },
    { label: 'Tarde', items: day.afternoon },
    { label: 'Noche', items: day.evening },
  ]
    .filter(slot => slot.items && slot.items.length > 0)
    .map(slot => renderSlot(slot.label, slot.items || []))
    .join('');

  const restaurantsHtml = day.restaurants && day.restaurants.length > 0
    ? `<div style="margin-top:6px;font-size:10px;color:#6b7280;">
        <span style="font-weight:600;">Gastronomia:</span>
        ${day.restaurants.map(restaurant => escapeHtml(restaurant.name)).join(' - ')}
       </div>`
    : '';

  const tipHtml = day.travelTip
    ? `<div style="margin-top:6px;font-size:10px;color:#92400e;background:#fef3c7;padding:4px 8px;border-radius:4px;">
        ${escapeHtml(day.travelTip)}
       </div>`
    : '';

  return `
    <div style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <div style="background:${color};padding:5px 10px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:700;color:white;">Dia ${day.dayNumber}${dateLabel}</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.9);">- ${escapeHtml(day.title)}</span>
      </div>
      <div style="padding:8px 10px;">
        ${day.summary ? `<p style="font-size:10px;color:#4b5563;margin-bottom:6px;line-height:1.4;">${escapeHtml(day.summary)}</p>` : ''}
        ${slotsHtml}
        ${restaurantsHtml}
        ${tipHtml}
      </div>
    </div>`;
}

function renderSlot(label: string, activities: PlannerActivity[]): string {
  const items = activities
    .map(activity => `<span style="display:inline-block;margin-right:8px;">- ${escapeHtml(activity.title)}</span>`)
    .join('');

  return `<div style="margin-bottom:4px;font-size:10px;">
    <span style="font-weight:700;color:#374151;min-width:44px;display:inline-block;">${label}:</span>
    <span style="color:#4b5563;">${items}</span>
  </div>`;
}

function segmentHasCartContent(segment: PlannerSegment): boolean {
  return Boolean(
    segment.hotelPlan?.confirmedInventoryHotel ||
    segment.hotelPlan?.selectedPlaceCandidate ||
    segment.transportIn?.selectedOptionId ||
    segment.transportOut?.selectedOptionId
  );
}

function renderCartPage(segments: PlannerSegment[]): string {
  const blocks = segments
    .filter(segmentHasCartContent)
    .map(segment => {
      let block = `<section style="margin-bottom:18px;page-break-inside:avoid;">`;
      block += `<h3 style="color:#1e40af;margin:0 0 6px;font-size:1.05em;">${escapeHtml(formatDestinationLabel(segment.city))}</h3>`;
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

function renderHotelSection(segment: PlannerSegment): string {
  const hotel = segment.hotelPlan?.confirmedInventoryHotel ||
    (!segment.hotelPlan?.selectedPlaceCandidate ? segment.hotelPlan?.hotelRecommendations?.[0] : null);
  const placeCandidate = segment.hotelPlan?.selectedPlaceCandidate;

  if (!hotel && !placeCandidate) return '';

  if (hotel) {
    const room = getPrimaryHotelRoom(hotel);
    const price = formatPrice(room?.total_price ?? room?.price, room?.currency);
    const roomLabel = room?.description || room?.type || 'Habitacion estandar';
    const category = formatHotelCategory(hotel.category);
    const labelTag = segment.hotelPlan?.confirmedInventoryHotel
      ? '<span style="display:inline-block;background:#166534;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Precio de inventario</span>'
      : '<span style="display:inline-block;background:#6b7280;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Sugerencia del planner</span>';

    let html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin:8px 0;">`;
    html += `<strong>Hotel ${escapeHtml(hotel.name)}</strong>${labelTag}`;
    if (category) html += ` - ${escapeHtml(category)}`;
    html += `<br/><span style="font-size:0.9em;color:#4b5563;">${escapeHtml(roomLabel)}</span>`;
    if (price) html += ` - <strong>${escapeHtml(price)}</strong>`;
    html += '</div>';
    return html;
  }

  if (placeCandidate) {
    let html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin:8px 0;">`;
    html += `<strong>Hotel ${escapeHtml(placeCandidate.name)}</strong>`;
    html += '<span style="display:inline-block;background:#6b7280;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Sugerencia del planner</span>';
    if (placeCandidate.rating) html += ` - ${placeCandidate.rating}`;
    if (placeCandidate.formattedAddress) html += `<br/><span style="font-size:0.85em;color:#6b7280;">${escapeHtml(placeCandidate.formattedAddress)}</span>`;
    html += '</div>';
    return html;
  }

  return '';
}

function renderTransportSection(transport: PlannerTransport | null | undefined, label: string): string {
  if (!transport) return '';

  if (transport.type === 'flight' && transport.options?.length) {
    const selected = transport.selectedOptionId
      ? transport.options.find(option => option.id === transport.selectedOptionId)
      : transport.options[0];

    if (selected) {
      const details = [
        selected.timeRange,
        selected.duration,
        selected.stops,
        formatPrice(selected.price?.amount, selected.price?.currency),
      ].filter(Boolean) as string[];

      let html = `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:8px 0;">`;
      html += `<strong>Vuelo ${escapeHtml(label)}</strong>`;
      if (selected.route) html += ` - ${escapeHtml(selected.route)}`;
      if (details.length) html += `<br/><span style="font-size:0.9em;color:#4b5563;">${details.map(escapeHtml).join(' - ')}</span>`;
      html += '</div>';
      return html;
    }
  }

  return `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:8px 0;"><strong>Transporte ${escapeHtml(label)}</strong>: ${escapeHtml(transport.summary || '')}</div>`;
}

function getPrimaryHotelRoom(hotel: PlannerHotel): PlannerHotelRoom | undefined {
  if (hotel.selectedRoom) return hotel.selectedRoom;
  if (!hotel.rooms || hotel.rooms.length === 0) return undefined;
  return [...hotel.rooms].sort((a, b) =>
    Number(a.total_price ?? a.price ?? Number.POSITIVE_INFINITY) -
    Number(b.total_price ?? b.price ?? Number.POSITIVE_INFINITY)
  )[0];
}

function formatPrice(amount?: number | string, currency = 'USD'): string {
  if (amount == null || amount === '') return '';
  const value = typeof amount === 'string' ? Number(amount.replace(',', '.')) : amount;
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatHotelCategory(category?: string): string {
  if (!category) return '';
  const match = category.match(/(\d+)/);
  return match ? `${match[1]} estrellas` : category;
}

function formatDestinationLabel(city?: string): string {
  if (!city) return 'Destino';
  return city
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
