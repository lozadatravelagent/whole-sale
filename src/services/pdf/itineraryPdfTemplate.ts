import type { TripPlannerState, PlannerDay, PlannerActivity } from '@/features/trip-planner/types';
import {
  pageOpen,
  pageClose,
  wrapHtmlDocument,
  renderCustomHeader,
  renderCustomFooter,
} from './customPdfTemplates';

export interface ItineraryBrandingData {
  agency_name: string;
  agency_logo_url: string;
  agency_primary_color: string;
  agency_secondary_color: string;
  agency_contact_name: string;
  agency_contact_email: string;
  agency_contact_phone: string;
  pdf_footer_text?: string;
  pdf_header_bg_color?: string;
  pdf_footer_bg_color?: string;
}

// ─── PUBLIC API ───

export function canExportPdf(state: TripPlannerState | null): boolean {
  if (!state) return false;
  if (state.generationMeta?.isDraft) return false;
  if (!state.segments || state.segments.length === 0) return false;
  return state.segments.some(s => s.days && s.days.length > 0);
}

export function renderItineraryHtml(
  state: TripPlannerState,
  branding: ItineraryBrandingData
): string {
  // Strip syncingFields (ephemeral) — use stable fields only
  const { syncingFields: _ephemeral, ...stableState } = state as TripPlannerState & {
    syncingFields?: unknown;
  };

  let pages = '';
  pages += renderSummaryPage(stableState, branding);

  for (const segment of stableState.segments) {
    // Use segment.days only — never bufferedDays
    const days = segment.days ?? [];
    if (days.length === 0) continue;

    // Group days into chunks of 3 per A4 page
    for (let i = 0; i < days.length; i += 3) {
      pages += renderDaysPage(segment.city, segment.country, days.slice(i, i + 3), branding);
    }
  }

  return wrapHtmlDocument(pages);
}

// ─── PAGES ───

function renderSummaryPage(state: TripPlannerState, branding: ItineraryBrandingData): string {
  const color = branding.agency_primary_color;

  const dateLabel = state.isFlexibleDates
    ? [state.flexibleMonth, state.flexibleYear].filter(Boolean).join(' ') || 'Fechas flexibles'
    : [state.startDate, state.endDate].filter(Boolean).join(' — ') || 'A definir';

  const travelers = state.travelers
    ? [
        state.travelers.adults > 0 ? `${state.travelers.adults} adulto${state.travelers.adults > 1 ? 's' : ''}` : '',
        state.travelers.children > 0 ? `${state.travelers.children} menor${state.travelers.children > 1 ? 'es' : ''}` : '',
        state.travelers.infants > 0 ? `${state.travelers.infants} bebé${state.travelers.infants > 1 ? 's' : ''}` : '',
      ].filter(Boolean).join(', ')
    : '';

  const budgetLabels: Record<string, string> = {
    low: 'Económico', mid: 'Moderado', high: 'Premium', luxury: 'Lujo',
  };
  const budgetLabel = state.budgetLevel ? (budgetLabels[state.budgetLevel] ?? '') : '';

  const route = [state.origin, ...state.destinations].filter(Boolean).map(escapeHtml).join(' → ');

  const segmentRows = state.segments.map(seg => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#374151;">
        ${escapeHtml(seg.city)}${seg.country ? `, ${escapeHtml(seg.country)}` : ''}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;text-align:right;">
        ${seg.nights != null ? `${seg.nights} noche${seg.nights !== 1 ? 's' : ''}` : ''}
      </td>
    </tr>`).join('');

  const summaryRows = [
    ['Ruta', route],
    ['Fechas', escapeHtml(dateLabel)],
    travelers ? ['Viajeros', escapeHtml(travelers)] : null,
    state.days ? ['Duración', `${state.days} día${state.days !== 1 ? 's' : ''}`] : null,
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
  branding: ItineraryBrandingData
): string {
  const color = branding.agency_primary_color;

  const daysHtml = days.map(day => renderDayCard(day, color)).join('');

  return `${pageOpen()}
    ${renderCustomHeader(branding)}
    <div style="flex:1;padding-top:16px;overflow:hidden;">
      <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid ${color};">
        ${escapeHtml(city)}${country ? ` · ${escapeHtml(country)}` : ''}
      </div>
      ${daysHtml}
    </div>
    ${renderCustomFooter(branding)}
  ${pageClose()}`;
}

// ─── DAY CARD ───

function renderDayCard(day: PlannerDay, color: string): string {
  const dateLabel = day.date ? ` · ${escapeHtml(day.date)}` : '';

  const slotsHtml = [
    { label: 'Mañana', items: day.morning },
    { label: 'Tarde', items: day.afternoon },
    { label: 'Noche', items: day.evening },
  ]
    .filter(slot => slot.items && slot.items.length > 0)
    .map(slot => renderSlot(slot.label, slot.items))
    .join('');

  const restaurantsHtml = day.restaurants && day.restaurants.length > 0
    ? `<div style="margin-top:6px;font-size:10px;color:#6b7280;">
        <span style="font-weight:600;">Gastronomía:</span>
        ${day.restaurants.map(r => escapeHtml(r.name)).join(' · ')}
       </div>`
    : '';

  const tipHtml = day.travelTip
    ? `<div style="margin-top:6px;font-size:10px;color:#92400e;background:#fef3c7;padding:4px 8px;border-radius:4px;">
        💡 ${escapeHtml(day.travelTip)}
       </div>`
    : '';

  return `
    <div style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <div style="background:${color};padding:5px 10px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:700;color:white;">Día ${day.dayNumber}${dateLabel}</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.9);">— ${escapeHtml(day.title)}</span>
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
    .map(a => `<span style="display:inline-block;margin-right:8px;">• ${escapeHtml(a.title)}</span>`)
    .join('');

  return `<div style="margin-bottom:4px;font-size:10px;">
    <span style="font-weight:700;color:#374151;min-width:44px;display:inline-block;">${label}:</span>
    <span style="color:#4b5563;">${items}</span>
  </div>`;
}

// ─── HELPERS ───

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
