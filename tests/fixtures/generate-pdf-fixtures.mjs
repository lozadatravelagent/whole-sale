/**
 * Generate valid PDF test fixtures with travel itinerary content.
 * Run with: node tests/fixtures/generate-pdf-fixtures.mjs
 *
 * Creates minimal valid PDFs that contain extractable text matching
 * the patterns expected by pdfProcessor.ts and the AI analyzer.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'pdfs');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────

/** Build a minimal but valid PDF-1.4 document from plain text lines. */
function buildPdf(textLines) {
  const stream = textLines
    .map((line, i) => `BT /F1 12 Tf 50 ${750 - i * 18} Td (${escapePdf(line)}) Tj ET`)
    .join('\n');

  const objects = [];
  const offsets = [];
  let buf = '%PDF-1.4\n';

  function addObj(body) {
    const num = objects.length + 1;
    offsets.push(buf.length);
    const text = `${num} 0 obj\n${body}\nendobj\n`;
    buf += text;
    objects.push(num);
    return num;
  }

  // 1 – Catalog
  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  // 2 – Pages
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  // 3 – Page
  addObj(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  );
  // 4 – Stream
  const streamBytes = Buffer.byteLength(stream, 'latin1');
  addObj(`<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`);
  // 5 – Font
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  // xref
  const xrefOffset = buf.length;
  buf += 'xref\n';
  buf += `0 ${objects.length + 1}\n`;
  buf += '0000000000 65535 f \n';
  for (const off of offsets) {
    buf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  buf += 'trailer\n';
  buf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  buf += 'startxref\n';
  buf += `${xrefOffset}\n`;
  buf += '%%EOF\n';

  return Buffer.from(buf, 'latin1');
}

function escapePdf(str) {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ── fixtures ─────────────────────────────────────────────────────────

// 1. Combined flight + hotel itinerary (matches PdfMonkey template patterns)
const combinedItinerary = [
  'PRESUPUESTO DE VIAJE',
  '',
  'DETALLE DEL VUELO LA LATAM Airlines Ocupacion:',
  'Vuelo de ida 2026-03-15',
  'EZE Buenos Aires 08:30',
  'LIM Lima 12:45',
  'Escala en Lima Tiempo de espera: 1h 35m en LIM (Lima)',
  'LIM Lima 14:20',
  'CUN Cancun 18:30',
  '',
  'Vuelo de regreso 2026-03-22',
  'CUN Cancun 06:00',
  'LIM Lima 11:30',
  'Escala en Lima Tiempo de espera: 1h 45m en LIM (Lima)',
  'LIM Lima 13:15',
  'EZE Buenos Aires 18:00',
  '',
  'Equipaje de bodega incluido',
  '1.250 USD Precio total',
  '',
  'Pasajeros: 2 adultos 0 ninos',
  '',
  'Opcion 1 $1.200 USD Hotel Riu Bambu',
  '5 estrellas',
  'Punta Cana',
  'Double Room - All Inclusive',
  'Todo incluido',
  'Check-in: 2026-03-15 / Check-out: 2026-03-22',
  '7 noches',
  '',
  'Opcion 2 $1.550 USD Barcelo Bavaro Palace',
  '5 estrellas',
  'Punta Cana',
  'Deluxe Double Room - All Inclusive',
  'Todo incluido',
  'Check-in: 2026-03-15 / Check-out: 2026-03-22',
  '7 noches',
  '',
  'INCLUYE',
  'Traslado Aeropuerto - Hotel - Aeropuerto',
  'Asistencia medica en viaje',
  '',
  'Precios sujeto a disponibilidad y tipo de cambio',
  'wholesale-connect cotizacion',
];

// 2. Multi-hotel itinerary (2 hotels → Economic/Premium detection)
const multiHotelItinerary = [
  'PRESUPUESTO DE VIAJE',
  '',
  'DETALLE DEL VUELO AM Aeromexico Ocupacion:',
  'Vuelo de ida 2026-04-01',
  'EZE Buenos Aires 22:00',
  'MEX Ciudad de Mexico 05:00',
  'Escala en Ciudad de Mexico Tiempo de espera: 3h 00m en MEX (Ciudad de Mexico)',
  'MEX Ciudad de Mexico 08:00',
  'PUJ Punta Cana 14:30',
  '',
  'Vuelo de regreso 2026-04-08',
  'PUJ Punta Cana 16:00',
  'MEX Ciudad de Mexico 19:30',
  'Escala en Ciudad de Mexico Tiempo de espera: 2h 30m en MEX (Ciudad de Mexico)',
  'MEX Ciudad de Mexico 22:00',
  'EZE Buenos Aires 07:00',
  '',
  '980 USD Precio total',
  '',
  'Pasajeros: 2 adultos 0 ninos',
  '',
  'Opcion 1 $1.200 USD Hotel Riu Bambu',
  '5 estrellas Punta Cana',
  'Double Room - All Inclusive',
  'Todo incluido - 7 noches',
  '',
  'Opcion 2 $1.800 USD Barcelo Bavaro Palace',
  '5 estrellas Punta Cana',
  'Deluxe Double Room - All Inclusive',
  'Todo incluido - 7 noches',
  '',
  'INCLUYE',
  'Transfer Aeropuerto - Hotel',
  'Seguro de viaje',
  '',
  'Precios sujeto a disponibilidad',
  'wholesale-connect cotizacion',
];

// 3. Simple search-trigger PDF (for re-quote flow)
const searchTriggerItinerary = [
  'COTIZACION DE VIAJE',
  '',
  'Ruta: Buenos Aires - Cancun',
  'Fecha de ida: 2026-03-15',
  'Fecha de vuelta: 2026-03-22',
  'Pasajeros: 2 adultos',
  '',
  'Vuelo: LATAM Airlines LA 7510',
  'EZE - CUN con escala en LIM',
  'Precio vuelo: 1.250 USD por persona',
  '',
  'Hotel: Riu Bambu 5 estrellas',
  'Punta Cana - All Inclusive',
  'Precio hotel: 1.200 USD por persona',
  '',
  'Total por persona: 2.450 USD',
  'Total 2 pasajeros: 4.900 USD',
  '',
  'Precios sujeto a disponibilidad',
];

// Write fixtures
const fixtures = [
  { name: 'combined-itinerary.pdf', lines: combinedItinerary },
  { name: 'multi-hotel-itinerary.pdf', lines: multiHotelItinerary },
  { name: 'search-trigger-itinerary.pdf', lines: searchTriggerItinerary },
];

for (const { name, lines } of fixtures) {
  const pdfBuffer = buildPdf(lines);
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`Created ${outPath} (${pdfBuffer.length} bytes)`);
}

console.log('\nDone! All PDF fixtures generated.');
