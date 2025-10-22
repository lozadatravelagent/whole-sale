// CSV Export utility for CRM data
import type { Lead, Seller, Section } from '@/types';

/**
 * Escapes CSV special characters and wraps the value in quotes if necessary
 */
function escapeCsvValue(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    // If the value contains comma, quote, or newline, wrap it in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

/**
 * Formats a date string for CSV export
 */
function formatDate(dateString: string | undefined): string {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES');
    } catch {
        return dateString;
    }
}

/**
 * Formats currency for CSV export
 */
function formatCurrency(amount: number | undefined): string {
    if (!amount) return '0';
    return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converts lead status to human-readable Spanish
 */
function formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
        'new': 'Nuevo',
        'quoted': 'Cotizado',
        'negotiating': 'Negociación',
        'won': 'Ganado',
        'lost': 'Perdido'
    };

    return statusMap[status] || status;
}

interface ExportOptions {
    leads: Lead[];
    sellers?: Seller[];
    sections?: Section[];
    filename?: string;
}

/**
 * Exports CRM leads to CSV format
 */
export function exportLeadsToCSV(options: ExportOptions): void {
    const { leads, sellers, sections, filename = 'crm-leads-export.csv' } = options;

    // Create a map for quick lookups
    const sellerMap = new Map(sellers?.map(s => [s.id, s.name]) || []);
    const sectionMap = new Map(sections?.map(s => [s.id, s.name]) || []);

    // Define CSV headers
    const headers = [
        'ID',
        'Estado',
        'Sección',
        'Cliente',
        'Teléfono',
        'Email',
        'Tipo de Viaje',
        'Destino',
        'Fecha Check-in',
        'Fecha Check-out',
        'Adultos',
        'Niños',
        'Presupuesto',
        'Vendedor Asignado',
        'Fecha de Vencimiento',
        'Descripción',
        'PDFs Generados',
        'Items Checklist',
        'Items Completados',
        'Archivos Adjuntos',
        'Fecha de Creación',
        'Última Actualización'
    ];

    // Build CSV rows
    const rows = leads.map(lead => {
        const sellerName = lead.assigned_user_id
            ? sellerMap.get(lead.assigned_user_id) || 'Sin asignar'
            : (lead.seller_id ? sellerMap.get(lead.seller_id) || 'Sin asignar' : 'Sin asignar');

        const sectionName = lead.section_id
            ? sectionMap.get(lead.section_id) || 'Sin sección'
            : 'Sin sección';

        const checklistTotal = lead.checklist?.length || 0;
        const checklistCompleted = lead.checklist?.filter(item => item.completed).length || 0;
        const attachmentsCount = lead.attachments?.length || 0;
        const pdfCount = lead.pdf_urls?.length || 0;

        return [
            escapeCsvValue(lead.id.substring(0, 8)), // Shortened ID for readability
            escapeCsvValue(formatStatus(lead.status)),
            escapeCsvValue(sectionName),
            escapeCsvValue(lead.contact.name),
            escapeCsvValue(lead.contact.phone),
            escapeCsvValue(lead.contact.email || ''),
            escapeCsvValue(lead.trip.type === 'hotel' ? 'Hotel' : lead.trip.type === 'flight' ? 'Vuelo' : 'Paquete'),
            escapeCsvValue(lead.trip.city),
            escapeCsvValue(formatDate(lead.trip.dates.checkin)),
            escapeCsvValue(formatDate(lead.trip.dates.checkout)),
            escapeCsvValue(lead.trip.adults),
            escapeCsvValue(lead.trip.children),
            escapeCsvValue(formatCurrency(lead.budget)),
            escapeCsvValue(sellerName),
            escapeCsvValue(formatDate(lead.due_date)),
            escapeCsvValue(lead.description || ''),
            escapeCsvValue(pdfCount),
            escapeCsvValue(checklistTotal),
            escapeCsvValue(checklistCompleted),
            escapeCsvValue(attachmentsCount),
            escapeCsvValue(formatDate(lead.created_at)),
            escapeCsvValue(formatDate(lead.updated_at))
        ];
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for proper Excel UTF-8 encoding
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create blob and download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        // Create a link and trigger download
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

/**
 * Exports leads with detailed information including checklist items
 */
export function exportLeadsToDetailedCSV(options: ExportOptions): void {
    const { leads, sellers, sections, filename = 'crm-leads-detailed-export.csv' } = options;

    // Create a map for quick lookups
    const sellerMap = new Map(sellers?.map(s => [s.id, s.name]) || []);
    const sectionMap = new Map(sections?.map(s => [s.id, s.name]) || []);

    // Define CSV headers for detailed export
    const headers = [
        'ID Lead',
        'Estado',
        'Sección',
        'Cliente',
        'Teléfono',
        'Email',
        'Tipo de Viaje',
        'Destino',
        'Check-in',
        'Check-out',
        'Adultos',
        'Niños',
        'Presupuesto',
        'Vendedor',
        'Vencimiento',
        'Descripción',
        'Item Checklist',
        'Estado Item',
        'URL PDF',
        'Archivo Adjunto',
        'Fecha Creación'
    ];

    // Build detailed CSV rows (one row per checklist item, PDF, or attachment)
    const rows: string[][] = [];

    leads.forEach(lead => {
        const sellerName = lead.assigned_user_id
            ? sellerMap.get(lead.assigned_user_id) || 'Sin asignar'
            : (lead.seller_id ? sellerMap.get(lead.seller_id) || 'Sin asignar' : 'Sin asignar');

        const sectionName = lead.section_id
            ? sectionMap.get(lead.section_id) || 'Sin sección'
            : 'Sin sección';

        const baseData = [
            escapeCsvValue(lead.id.substring(0, 8)),
            escapeCsvValue(formatStatus(lead.status)),
            escapeCsvValue(sectionName),
            escapeCsvValue(lead.contact.name),
            escapeCsvValue(lead.contact.phone),
            escapeCsvValue(lead.contact.email || ''),
            escapeCsvValue(lead.trip.type === 'hotel' ? 'Hotel' : lead.trip.type === 'flight' ? 'Vuelo' : 'Paquete'),
            escapeCsvValue(lead.trip.city),
            escapeCsvValue(formatDate(lead.trip.dates.checkin)),
            escapeCsvValue(formatDate(lead.trip.dates.checkout)),
            escapeCsvValue(lead.trip.adults),
            escapeCsvValue(lead.trip.children),
            escapeCsvValue(formatCurrency(lead.budget)),
            escapeCsvValue(sellerName),
            escapeCsvValue(formatDate(lead.due_date)),
            escapeCsvValue(lead.description || '')
        ];

        // If the lead has checklist items, create a row for each
        if (lead.checklist && lead.checklist.length > 0) {
            lead.checklist.forEach(item => {
                rows.push([
                    ...baseData,
                    escapeCsvValue(item.text),
                    escapeCsvValue(item.completed ? 'Completado' : 'Pendiente'),
                    '',
                    '',
                    escapeCsvValue(formatDate(lead.created_at))
                ]);
            });
        }

        // If the lead has PDFs, create rows for them
        if (lead.pdf_urls && lead.pdf_urls.length > 0) {
            lead.pdf_urls.forEach(url => {
                rows.push([
                    ...baseData,
                    '',
                    '',
                    escapeCsvValue(url),
                    '',
                    escapeCsvValue(formatDate(lead.created_at))
                ]);
            });
        }

        // If the lead has attachments, create rows for them
        if (lead.attachments && lead.attachments.length > 0) {
            lead.attachments.forEach(attachment => {
                rows.push([
                    ...baseData,
                    '',
                    '',
                    '',
                    escapeCsvValue(`${attachment.name} (${attachment.url})`),
                    escapeCsvValue(formatDate(lead.created_at))
                ]);
            });
        }

        // If lead has no checklist, PDFs, or attachments, create a single row
        if ((!lead.checklist || lead.checklist.length === 0) &&
            (!lead.pdf_urls || lead.pdf_urls.length === 0) &&
            (!lead.attachments || lead.attachments.length === 0)) {
            rows.push([
                ...baseData,
                '',
                '',
                '',
                '',
                escapeCsvValue(formatDate(lead.created_at))
            ]);
        }
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for proper Excel UTF-8 encoding
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create blob and download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

