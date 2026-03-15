/**
 * Custom PDF Generator — Orchestrates HTML → PDF blob → Supabase Storage URL
 * Returns PdfMonkeyResponse so all consumers work without changes.
 *
 * Strategy: each template emits one <div data-pdf-page> per logical page, each
 * containing its own header + body + footer.  The renderer captures every page
 * div as a separate A4-sized canvas and assembles them into a single jsPDF doc.
 */

import type { FlightData, HotelData, HotelDataWithSelectedRoom, PdfMonkeyResponse } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { renderFlightsSimpleHtml, renderFlightsMultipleHtml, renderCombinedHtml } from './customPdfTemplates';

interface AgencyBrandingData {
  agency_name: string;
  agency_logo_url: string;
  agency_primary_color: string;
  agency_secondary_color: string;
  agency_contact_name: string;
  agency_contact_email: string;
  agency_contact_phone: string;
  pdf_footer_text?: string;
}

// A4 at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// ─── PUBLIC API ───

export async function generateCustomFlightPdf(
  selectedFlights: FlightData[],
  brandingData: AgencyBrandingData
): Promise<PdfMonkeyResponse> {
  try {
    console.log('[CUSTOM PDF] Generating flight PDF for', selectedFlights.length, 'flights');

    const { analyzeFlightStructure, preparePdfData } = await import('../pdfMonkey');

    const flightAnalysis = analyzeFlightStructure(selectedFlights);
    const pdfData = preparePdfData(selectedFlights, null);

    let html: string;
    if (flightAnalysis.templateType === 'flights2' || selectedFlights.length >= 2) {
      html = renderFlightsMultipleHtml(pdfData, brandingData);
    } else {
      html = renderFlightsSimpleHtml(pdfData, brandingData);
    }

    const blob = await renderHtmlToPdfBlob(html);
    const publicUrl = await uploadPdfToStorage(blob, `vuelos-cotizacion-${Date.now()}.pdf`);

    console.log('[CUSTOM PDF] Flight PDF generated:', publicUrl);
    return { success: true, document_url: publicUrl };
  } catch (error) {
    console.error('[CUSTOM PDF] Error generating flight PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating custom PDF'
    };
  }
}

export async function generateCustomCombinedPdf(
  selectedFlights: FlightData[],
  selectedHotels: HotelData[] | HotelDataWithSelectedRoom[],
  brandingData: AgencyBrandingData,
  isPriceModified?: boolean
): Promise<PdfMonkeyResponse> {
  try {
    console.log('[CUSTOM PDF] Generating combined PDF:', selectedFlights.length, 'flights,', selectedHotels.length, 'hotels');
    console.log('[CUSTOM PDF] Hotel names received:', selectedHotels.map((h, i) => ({
      index: i, id: h.id, name: h.name, city: h.city
    })));

    const { prepareCombinedPdfData } = await import('../pdfMonkey');

    const pdfData = prepareCombinedPdfData(selectedFlights, selectedHotels, isPriceModified, null);
    console.log('[CUSTOM PDF] Template hotel data:', {
      option_1_hotel: pdfData.option_1_hotel ? { name: pdfData.option_1_hotel.name } : null,
      option_2_hotel: pdfData.option_2_hotel ? { name: pdfData.option_2_hotel.name } : null,
      hotel_summary_cards: pdfData.hotel_summary_cards?.map((c: any) => c.hotel_name),
      best_hotels: pdfData.best_hotels?.map((h: any) => h.name)
    });
    const html = renderCombinedHtml(pdfData, brandingData);

    const blob = await renderHtmlToPdfBlob(html);
    const publicUrl = await uploadPdfToStorage(blob, `viaje-combinado-cotizacion-${Date.now()}.pdf`);

    console.log('[CUSTOM PDF] Combined PDF generated:', publicUrl);
    return { success: true, document_url: publicUrl };
  } catch (error) {
    console.error('[CUSTOM PDF] Error generating combined PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating custom combined PDF'
    };
  }
}

// ─── INTERNALS ───

async function renderHtmlToPdfBlob(html: string): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const jsPDF = (await import('jspdf')).default;

  // Mount hidden (but renderable) container
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = `${A4_WIDTH_PX}px`;
  container.style.zIndex = '-1';
  container.style.pointerEvents = 'none';
  container.style.background = 'white';
  container.style.fontFamily = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  document.body.appendChild(container);

  try {
    // Let the browser layout+paint
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    // Locate page divs marked by the templates
    const pageDivs = Array.from(container.querySelectorAll('[data-pdf-page]')) as HTMLElement[];
    const targets = pageDivs.length > 0 ? pageDivs : [container];

    console.log('[CUSTOM PDF] Rendering', targets.length, 'page(s)');

    // Force each page div to exact A4 dimensions so header stays at top, footer at bottom
    for (const page of targets) {
      page.style.width = `${A4_WIDTH_PX}px`;
      page.style.height = `${A4_HEIGHT_PX}px`;
      page.style.minHeight = `${A4_HEIGHT_PX}px`;
      page.style.maxHeight = `${A4_HEIGHT_PX}px`;
      page.style.overflow = 'hidden';
      page.style.boxSizing = 'border-box';
    }

    // Re-layout after size changes
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        windowWidth: A4_WIDTH_PX,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
      });

      if (i > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    }

    const blob = pdf.output('blob');
    console.log('[CUSTOM PDF] Generated', targets.length, 'page PDF, size:', blob.size, 'bytes');
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

async function uploadPdfToStorage(blob: Blob, filename: string): Promise<string> {
  const filePath = `custom-pdfs/${filename}`;
  const buckets = ['documents', 'pdf-backgrounds', 'agency-logos'];

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      console.log(`[CUSTOM PDF] Uploaded to bucket "${bucket}":`, publicUrl);
      return publicUrl;
    }

    console.warn(`[CUSTOM PDF] Bucket "${bucket}" failed:`, error?.message);
  }

  console.warn('[CUSTOM PDF] All storage buckets failed, using blob URL fallback');
  return URL.createObjectURL(blob);
}
