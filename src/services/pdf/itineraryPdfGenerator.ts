import type { TripPlannerState } from '@/features/trip-planner/types';
import { fetchAgencyBranding } from '@/services/pdfMonkey';
import { renderHtmlToPdfBlob } from './customPdfGenerator';
import { renderItineraryHtml } from './itineraryPdfTemplate';

export async function generateItineraryPdf(
  plannerState: TripPlannerState,
  agencyId?: string
): Promise<void> {
  const brandingData = await fetchAgencyBranding(agencyId);

  const branding = brandingData
    ? {
        agency_name: brandingData.agency_name,
        agency_logo_url: brandingData.agency_logo_url,
        agency_primary_color: brandingData.agency_primary_color,
        agency_secondary_color: brandingData.agency_secondary_color,
        agency_contact_name: brandingData.agency_contact_name,
        agency_contact_email: brandingData.agency_contact_email,
        agency_contact_phone: brandingData.agency_contact_phone,
        pdf_footer_text: brandingData.pdf_footer_text,
        pdf_header_bg_color: brandingData.pdf_header_bg_color,
        pdf_footer_bg_color: brandingData.pdf_footer_bg_color,
      }
    : {
        agency_name: '',
        agency_logo_url: '',
        agency_primary_color: '#333333',
        agency_secondary_color: '#666666',
        agency_contact_name: '',
        agency_contact_email: '',
        agency_contact_phone: '',
      };

  const html = renderItineraryHtml(plannerState, branding);
  const blob = await renderHtmlToPdfBlob(html);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'itinerario.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
