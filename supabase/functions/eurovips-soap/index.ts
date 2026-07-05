import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit, extractIdentifiers } from "../_shared/rateLimit.ts";
import { corsHeaders } from '../_shared/cors.ts';

const EUROVIPS_ALLOWED_ACTIONS = new Set([
  'getCountryList',
  'getAirlineList',
  'searchHotels',
  'searchFlights',
  'searchPackages',
  'searchServices',
  'makeBudget',
]);

function validationErrorResponse(error: string) {
  return new Response(JSON.stringify({
    success: false,
    error: 'invalid_request_body',
    detail: error,
    timestamp: new Date().toISOString(),
  }), {
    status: 400,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requireString(data: any, field: string, action: string): string | null {
  return typeof data?.[field] === 'string' && data[field].trim() !== ''
    ? null
    : `${field} is required for ${action}`;
}

function validateEurovipsRequestBody(body: any): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'body must be a JSON object';
  }
  if (typeof body.action !== 'string' || body.action.trim() === '') {
    return 'action is required';
  }
  if (!EUROVIPS_ALLOWED_ACTIONS.has(body.action)) {
    return `unsupported action: ${body.action}`;
  }
  if (body.jobId !== undefined && typeof body.jobId !== 'string') {
    return 'jobId must be a string when provided';
  }

  const dataOptionalActions = new Set(['getAirlineList', 'getCountryList']);
  if (!dataOptionalActions.has(body.action)) {
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return `data object is required for ${body.action}`;
    }
  }

  switch (body.action) {
    case 'searchHotels':
      return requireString(body.data, 'cityCode', body.action) ??
        requireString(body.data, 'checkinDate', body.action) ??
        requireString(body.data, 'checkoutDate', body.action);
    case 'searchFlights':
      return requireString(body.data, 'originCode', body.action) ??
        requireString(body.data, 'destinationCode', body.action) ??
        requireString(body.data, 'departureDate', body.action);
    case 'searchPackages':
      return requireString(body.data, 'cityCode', body.action) ??
        requireString(body.data, 'dateFrom', body.action) ??
        requireString(body.data, 'dateTo', body.action);
    case 'searchServices':
      return requireString(body.data, 'cityCode', body.action) ??
        requireString(body.data, 'dateFrom', body.action);
    case 'makeBudget':
      return requireString(body.data, 'fareId', body.action) ??
        requireString(body.data, 'fareIdBroker', body.action) ??
        requireString(body.data, 'checkinDate', body.action) ??
        requireString(body.data, 'checkoutDate', body.action) ??
        (Array.isArray(body.data?.occupancies) && body.data.occupancies.length > 0
          ? null
          : 'occupancies array is required for makeBudget');
    default:
      return null;
  }
}
function normalizeCategory(category: string): number {
  const match = category.match(/(\d)/);
  return match ? parseInt(match[1], 10) : 0;
}

function normalizeHotelName(name: string): string {
  return name
    .replace(/\s*-\s*(ALL INCLUSIVE|TODO INCLUIDO)\s*/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Domain preconditions for SOAP requests. SOFTUR is well-known to hang for
 * 30+ seconds on malformed input (invalid city codes, open-ended ranges,
 * inverted dates) instead of returning a quick error. Fail fast here so we
 * don't burn the wall-clock budget on requests that can't succeed.
 *
 * Throws on violation; the caller surfaces the message in the standard
 * "request failed" envelope upstream.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STAY_NIGHTS = 30;
const MAX_TRIP_DAYS = 365;

function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    throw new Error(`invalid_input: ${field} must be ISO date YYYY-MM-DD, got ${JSON.stringify(value)}`);
  }
  return value;
}

function diffDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00.000Z`).getTime();
  const to = new Date(`${toIso}T00:00:00.000Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return NaN;
  return Math.round((to - from) / 86_400_000);
}

function assertCityCode(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`invalid_input: ${field} is required (got ${JSON.stringify(value)})`);
  }
  // SOFTUR codes are short alphanumeric tokens; reject obvious garbage that
  // would force a full-inventory scan.
  if (!/^[A-Za-z0-9]{2,10}$/.test(value.trim())) {
    throw new Error(`invalid_input: ${field}="${value}" is not a valid city/airport code`);
  }
  return value.trim();
}

function assertStayRange(checkin: string, checkout: string): number {
  const nights = diffDays(checkin, checkout);
  if (!Number.isFinite(nights)) {
    throw new Error(`invalid_input: cannot compute nights from ${checkin}/${checkout}`);
  }
  if (nights < 1) {
    throw new Error(`invalid_input: stay range must be >= 1 night (got ${nights}; checkin=${checkin} checkout=${checkout})`);
  }
  if (nights > MAX_STAY_NIGHTS) {
    throw new Error(`invalid_input: stay range exceeds ${MAX_STAY_NIGHTS} nights (got ${nights}; SOFTUR times out on long ranges)`);
  }
  return nights;
}

function assertDateRange(from: string, to: string, label: string): number {
  const days = diffDays(from, to);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`invalid_input: ${label} range must have from <= to (got ${from}/${to})`);
  }
  if (days > MAX_TRIP_DAYS) {
    throw new Error(`invalid_input: ${label} range exceeds ${MAX_TRIP_DAYS} days (${from}/${to})`);
  }
  return days;
}

class EurovipsSOAPClient {
  baseUrl = 'https://eurovips.itraffic.com.ar/WSBridge_Euro/BridgeService.asmx';
  username = 'WSLOZADA';
  password = 'ROS.9624+';
  agency = '96175';
  currency = 'USD';
  // SOAP timeout policy:
  //   - Sync path (no jobId): 30s — HTTP wall-clock for the invoking client.
  //   - Async path (jobId, runs under EdgeRuntime.waitUntil): 90s — we're no
  //     longer in a user-facing HTTP response, so we can give SOFTUR more
  //     headroom before failing the background job.
  soapTimeoutMs = 30_000;

  async makeSOAPRequest(soapBody, soapAction, telemetryFields: Record<string, string | number> = {}) {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;
    console.log(`📝 SOAP REQUEST [${soapAction}]:`, soapEnvelope.length, 'chars');
    const controller = new AbortController();
    const timeoutMs = this.soapTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const telemetryStartedAt = performance.now();
    const telemetryFieldsStr = Object.entries(telemetryFields)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    const emitTelemetry = (
      outcome: 'ok' | 'timeout' | 'http_error' | 'fetch_error',
      extra?: Record<string, string | number>,
    ) => {
      const ms = Math.round(performance.now() - telemetryStartedAt);
      const extraStr = extra
        ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')
        : '';
      console.log(`[SOAP-TIMING] action=${soapAction} outcome=${outcome} ms=${ms}${telemetryFieldsStr ? ' ' + telemetryFieldsStr : ''}${extraStr}`);
    };

    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': soapAction,
          'Accept': 'text/xml, application/xml, application/soap+xml'
        },
        body: soapEnvelope,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        emitTelemetry('timeout');
        console.error(`❌ [makeSOAPRequest] Timed out after ${timeoutMs / 1000}s [${soapAction}]`);
        throw new Error(`SOAP request timed out after ${timeoutMs / 1000}s [${soapAction}]`);
      }
      emitTelemetry('fetch_error', { err: String(err?.message ?? err).slice(0, 80) });
      throw err;
    }
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      emitTelemetry('http_error', { status: response.status });
      console.error(`❌ SOAP Error ${response.status}:`, errorText);
      // Include error details in exception for debugging
      throw new Error(`SOAP request failed: ${response.status} - ${errorText.substring(0, 500)}`);
    }
    const xmlResponse = await response.text();
    emitTelemetry('ok', { bytes: xmlResponse.length });
    console.log(`📥 SOAP RESPONSE [${soapAction}]:`, xmlResponse.length, 'chars');
    return xmlResponse;
  }
  async getCountryList(params = {}) {
    // Use dynamic dates: user-provided dates or intelligent fallback
    const today = new Date();
    const threeMonthsLater = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const { dateFrom = today.toISOString().split('T')[0], dateTo = threeMonthsLater.toISOString().split('T')[0], activeFareType = 'HOTEL' } = params;
    // ✅ FIJO: Siempre usar TERRESTRE (AEROTERRESTRE no funciona)
    const activeFareSubtype = 'TERRESTRE';
    console.log('🔍 getCountryList called with params:', {
      dateFrom,
      dateTo,
      activeFareType,
      activeFareSubtype
    });
    const soapBody = `
    <xsstring7 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <dateFrom xmlns="">${dateFrom}</dateFrom>
      <dateTo xmlns="">${dateTo}</dateTo>
      <activeFareType xmlns="">${activeFareType}</activeFareType>
      <activeFareSubtype xmlns="">${activeFareSubtype}</activeFareSubtype>
    </xsstring7>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'getCountryList');
    console.log('🔍 Raw XML Response length:', xmlResponse.length);
    console.log('🔍 XML Sample (first 500 chars):', xmlResponse.substring(0, 500));
    return {
      rawResponse: xmlResponse,
      parsed: this.parseCountryListResponse(xmlResponse)
    };
  }
  async getAirlineList() {
    const soapBody = `
    <getAirlineList xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
    </getAirlineList>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'getAirlineList');
    return this.parseAirlineListResponse(xmlResponse);
  }
  async searchHotels(params) {
    // ---- Input preconditions (fail fast vs. burning the 30s SOAP timeout) ----
    const cityCode = assertCityCode(params.cityCode, 'cityCode');
    const checkinDate = assertIsoDate(params.checkinDate, 'checkinDate');
    const checkoutDate = assertIsoDate(params.checkoutDate, 'checkoutDate');
    const nights = assertStayRange(checkinDate, checkoutDate);

    // Build occupancy based on adults/children/infants
    const adults = params.adults || 1; // Default to 1 adult
    const children = params.children || 0;
    const infants = params.infants || 0;
    const childrenAges: number[] = params.childrenAges || [];
    // Create occupants XML - Age is required for child/infant pricing parity.
    let occupantsXml = '';
    for (let i = 0; i < adults; i++) {
      occupantsXml += '      <Occupants type="ADT" />\n';
    }
    for (let i = 0; i < children; i++) {
      const age = childrenAges[i] || 8;
      occupantsXml += `      <Occupants type="CNN" Age="${age}" />\n`;
    }
    for (let i = 0; i < infants; i++) {
      occupantsXml += '      <Occupants type="INFOA" Age="1" />\n';
    }
    const soapBody = `
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${cityCode}" xmlns="" />
      <dateFrom xmlns="">${checkinDate}</dateFrom>
      <dateTo xmlns="">${checkoutDate}</dateTo>
      <name xmlns="">${params.hotelName || ''}</name>
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
      <OtherBroker xmlns="">true</OtherBroker>
      <FareTypeSelectionList xmlns="http://www.softur.com.ar/wsbridge/budget.xsd">
        <FareTypeSelection OccupancyId="1">1</FareTypeSelection>
        <Ocuppancy OccupancyId="1">
${occupantsXml}        </Ocuppancy>
      </FareTypeSelectionList>
    </searchHotelFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchHotelFares', {
      city: cityCode,
      nights,
      pax: adults + children + infants,
      named: params.hotelName ? 1 : 0,
    });
    return this.parseHotelSearchResponse(xmlResponse, params);
  }
  async searchFlights(params) {
    // ---- Input preconditions ----
    const originCode = assertCityCode(params.originCode, 'originCode');
    const destinationCode = assertCityCode(params.destinationCode, 'destinationCode');
    const departureDate = assertIsoDate(params.departureDate, 'departureDate');
    let returnDate: string | undefined;
    if (params.returnDate) {
      returnDate = assertIsoDate(params.returnDate, 'returnDate');
      assertDateRange(departureDate, returnDate, 'flight');
    }

    const soapBody = `
    <searchAirFaresRQ1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <departureLocation code="${originCode}" xmlns="" />
      <arrivalLocation code="${destinationCode}" xmlns="" />
      <dateFrom xmlns="">${departureDate}</dateFrom>
      ${returnDate ? `<dateTo xmlns="">${returnDate}</dateTo>` : ''}
      <airline xmlns="" />
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchAirFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchAirFares', {
      origin: originCode,
      dest: destinationCode,
      tripType: returnDate ? 'round_trip' : 'one_way',
    });
    return this.parseFlightSearchResponse(xmlResponse, params);
  }
  async searchPackages(params) {
    // ---- Input preconditions ----
    const cityCode = assertCityCode(params.cityCode, 'cityCode');
    const dateFrom = assertIsoDate(params.dateFrom, 'dateFrom');
    const dateTo = assertIsoDate(params.dateTo, 'dateTo');
    const days = assertDateRange(dateFrom, dateTo, 'package');

    const soapBody = `
    <searchPackageFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <Class xmlns="">${params.packageClass || 'AEROTERRESTRE'}</Class>
      <cityLocation code="${cityCode}" xmlns="" />
      <dateFrom xmlns="">${dateFrom}</dateFrom>
      <dateTo xmlns="">${dateTo}</dateTo>
      <name xmlns="" />
      <keyword xmlns="" />
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchPackageFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchPackageFares', {
      city: cityCode,
      days,
      class: params.packageClass || 'AEROTERRESTRE',
    });
    return this.parsePackageSearchResponse(xmlResponse, params);
  }
  async searchServices(params) {
    // ---- Input preconditions ----
    const cityCode = assertCityCode(params.cityCode, 'cityCode');
    const dateFrom = assertIsoDate(params.dateFrom, 'dateFrom');
    const dateToRaw = params.dateTo || params.dateFrom;
    const dateTo = assertIsoDate(dateToRaw, 'dateTo');
    const days = assertDateRange(dateFrom, dateTo, 'service');

    const soapBody = `
    <searchServiceFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="${cityCode}" xmlns="" />
      <dateFrom xmlns="">${dateFrom}</dateFrom>
      <dateTo xmlns="">${dateTo}</dateTo>
      <name xmlns="" />
      <type xmlns="">${params.serviceType || '1'}</type>
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <currency xmlns="">${this.currency}</currency>
    </searchServiceFaresRQ1>`;
    const xmlResponse = await this.makeSOAPRequest(soapBody, 'searchServiceFares', {
      city: cityCode,
      days,
      type: params.serviceType || '1',
    });
    return this.parseServiceSearchResponse(xmlResponse, params);
  }

  /**
   * makeBudget - Obtiene el precio EXACTO (Neto Agencia) para una habitación seleccionada
   *
   * Este método es CRÍTICO para obtener el precio final que se cobra al cliente.
   * El precio de searchHotelFares es aproximado; makeBudget da el precio exacto.
   *
   * @param params - Parámetros de la reserva
   * @returns Budget con precio exacto y budgetId para posterior conversión a reserva
   */
  async makeBudget(params: {
    fareId: string;           // UniqueId del hotel (ej: "AP|5168-59588")
    fareIdBroker: string;     // FareIdBroker de la habitación seleccionada
    checkinDate: string;      // Fecha check-in YYYY-MM-DD
    checkoutDate: string;     // Fecha check-out YYYY-MM-DD
    roomType?: string;        // Room type for FareTypeSelection (ej: "SGL", "DBL")
    occupancies: Array<{
      occupancyId: string;
      passengers: Array<{ type: 'ADT' | 'CHD' | 'CNN' | 'INF'; age?: number }>
    }>;
    reference?: string;       // Referencia opcional para tracking
  }) {
    console.log('📋 [MAKE_BUDGET] Creating budget for hotel:', params.fareId);
    console.log('📋 [MAKE_BUDGET] FareIdBroker:', params.fareIdBroker);
    console.log('📋 [MAKE_BUDGET] Dates:', params.checkinDate, '->', params.checkoutDate);

    // Build FareTypeSelection XML
    const buildFareTypeSelectionXml = () => {
      const typeAttr = params.roomType ? ` type="${params.roomType}"` : '';
      return `<bud1:FareTypeSelection${typeAttr} FareIdBroker="${params.fareIdBroker}" OccupancyId="${params.occupancies[0]?.occupancyId || '1'}">1</bud1:FareTypeSelection>`;
    };

    // Build Occupancy XML - INSIDE FareTypeSelectionList
    const buildOccupancyXml = () => {
      let xml = '';
      params.occupancies.forEach((occ) => {
        xml += `            <bud1:Ocuppancy OccupancyId="${occ.occupancyId}">\n`;
        occ.passengers.forEach((pax) => {
          // IMPORTANT parity fix:
          // EUROVIPS hotel makeBudget expects child type CNN for correct pricing parity with portal.
          // Some clients may still send CHD (legacy), so normalize CHD -> CNN server-side.
          const normalizedType = pax.type === 'CHD' ? 'CNN' : pax.type === 'INF' ? 'INFOA' : pax.type;

          if (normalizedType === 'ADT') {
            xml += `               <bud1:Occupants type="ADT"/>\n`;
          } else {
            const age = pax.age || (normalizedType === 'INF' ? 1 : 8);
            xml += `               <bud1:Occupants type="${normalizedType}" Age="${age}"/>\n`;
          }
        });
        xml += `            </bud1:Ocuppancy>\n`;
      });
      return xml;
    };

    // SOAP Envelope COMPLETO con namespaces correctos
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:bud="http://www.softur.com.ar/wsbridge/budget.wsdl"
                  xmlns:bud1="http://www.softur.com.ar/wsbridge/budget.xsd">
   <soapenv:Header/>
   <soapenv:Body>
      <bud:BudgetType1>
         <pos>
            <id>${this.username}</id>
            <clave>${this.password}</clave>
         </pos>
         <rq UniqueId="">
            <bud1:HotelBudget ItemId="001">
               <bud1:FareId>${params.fareId}</bud1:FareId>
               <bud1:InDate>${params.checkinDate}</bud1:InDate>
               <bud1:OutDate>${params.checkoutDate}</bud1:OutDate>
               <bud1:SubTotalAmount>0</bud1:SubTotalAmount>
               <bud1:FareTypeSelectionList>
                  ${buildFareTypeSelectionXml()}
${buildOccupancyXml()}               </bud1:FareTypeSelectionList>
            </bud1:HotelBudget>
            <bud1:Summary CreationDate="${new Date().toISOString()}" StartDate="${params.checkinDate}" User="${this.username}" Reference="${params.reference || ''}" Status="0" Comments="" Agent="${this.agency}" Currency="USD"/>
            <bud1:ExtraInfoList>
               <bud1:ExtendedData type="PRESUPU">
                  <bud1:Name>cod_agcia</bud1:Name>
                  <bud1:Value>${this.agency}</bud1:Value>
               </bud1:ExtendedData>
            </bud1:ExtraInfoList>
         </rq>
      </bud:BudgetType1>
   </soapenv:Body>
</soapenv:Envelope>`;

    // Llamada directa con timeout de 30 segundos
    console.log('📋 [MAKE_BUDGET] Sending SOAP request...');
    console.log('📋 [MAKE_BUDGET] Envelope preview:', soapEnvelope.substring(0, 800));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'makeBudget'
        },
        body: soapEnvelope,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📋 [MAKE_BUDGET] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [MAKE_BUDGET] Error:', response.status, errorText.substring(0, 1000));
        throw new Error(`makeBudget failed: ${response.status} - ${errorText.substring(0, 500)}`);
      }

      const xmlResponse = await response.text();
      console.log('📋 [MAKE_BUDGET] Response length:', xmlResponse.length);
      console.log('📋 [MAKE_BUDGET] Response preview:', xmlResponse.substring(0, 2000));
      return this.parseMakeBudgetResponse(xmlResponse);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ [MAKE_BUDGET] Request timed out after 30 seconds');
        throw new Error('makeBudget request timed out - the provider is not responding');
      }
      throw error;
    }
  }

  /**
   * Parsea la respuesta de makeBudget para extraer el precio exacto
   */
  parseMakeBudgetResponse(xmlResponse: string) {
    try {
      console.log('📋 [MAKE_BUDGET] Parsing response, length:', xmlResponse.length);

      // Log sample for debugging (head + tail to capture Summary/Pricing at the end)
      console.log('📋 [MAKE_BUDGET] Response HEAD:', xmlResponse.substring(0, 500));
      console.log('📋 [MAKE_BUDGET] Response TAIL:', xmlResponse.substring(Math.max(0, xmlResponse.length - 2000)));
      console.log('📋 [MAKE_BUDGET] Contains Pricing?', xmlResponse.includes('Pricing'), 'Contains Summary?', xmlResponse.includes('Summary'), 'Contains Target?', xmlResponse.includes('Target'));

      // Extract resultado/codigo to check for errors
      const codigoMatch = xmlResponse.match(/<codigo[^>]*>(\d+)<\/codigo>/i);
      const textoMatch = xmlResponse.match(/<texto[^>]*>([^<]*)<\/texto>/i);

      const codigo = codigoMatch ? codigoMatch[1] : null;
      const texto = textoMatch ? textoMatch[1] : null;

      console.log('📋 [MAKE_BUDGET] Result code:', codigo, 'text:', texto);

      if (codigo && codigo !== '0') {
        console.error('❌ [MAKE_BUDGET] Error from EUROVIPS:', texto);
        return {
          success: false,
          error: texto || `Error code: ${codigo}`,
          errorCode: codigo
        };
      }

      // Extract budgetId from rs UniqueId attribute
      const budgetIdMatch = xmlResponse.match(/<rs[^>]*UniqueId="([^"]+)"/i);
      const budgetId = budgetIdMatch ? budgetIdMatch[1] : null;

      // Extract SubTotalAmount from HotelBudget element (CommissionablePrice / Importe Bruto)
      const subTotalMatches = xmlResponse.match(/<SubTotalAmount[^>]*>([\d.]+)<\/SubTotalAmount>/gi);
      let subTotalAmount = 0;

      if (subTotalMatches && subTotalMatches.length > 0) {
        // Get the FIRST SubTotalAmount (from HotelBudget item, the CommissionablePrice)
        const firstMatch = subTotalMatches[0];
        const valueMatch = firstMatch.match(/([\d.]+)/);
        if (valueMatch) {
          subTotalAmount = parseFloat(valueMatch[1]);
        }
      }

      // SubTotalAmount from makeBudget is the CommissionablePrice (gross/bruto)
      // Try to extract the actual agency net price from Pricing blocks in this same response
      let agencyTotal = 0;
      let commissionablePrice = 0;

      // Match Pricing blocks with or without namespace prefixes (e.g. <Pricing>, <bud1:Pricing>, <ns1:Pricing>)
      const pricingBlocks = xmlResponse.match(/<(?:\w+:)?Pricing>[\s\S]*?<\/(?:\w+:)?Pricing>/gi);
      if (pricingBlocks) {
        for (const block of pricingBlocks) {
          const targetMatch = block.match(/<(?:\w+:)?Target>([^<]+)<\/(?:\w+:)?Target>/i);
          if (targetMatch && targetMatch[1] === 'AGENCY') {
            const totalMatch = block.match(/<(?:\w+:)?Total>([\d.]+)<\/(?:\w+:)?Total>/i);
            if (totalMatch) {
              agencyTotal = parseFloat(totalMatch[1]);
            }
            const commMatch = block.match(/<(?:\w+:)?CommissionablePrice>([\d.]+)<\/(?:\w+:)?CommissionablePrice>/i);
            if (commMatch) {
              commissionablePrice = parseFloat(commMatch[1]);
            }
            break;
          }
        }
      }

      console.log('📋 [MAKE_BUDGET] Pricing from makeBudget response - agencyTotal:', agencyTotal, 'commissionablePrice:', commissionablePrice);

      // Extract internal FareId (EV code) if present
      const fareIdInternalMatch = xmlResponse.match(/<FareId[^>]*>(EV\d+)<\/FareId>/i);
      const fareIdInternal = fareIdInternalMatch ? fareIdInternalMatch[1] : null;

      const currency = this.currency;

      console.log('📋 [MAKE_BUDGET] Parsed successfully:');
      console.log('   budgetId:', budgetId);
      console.log('   subTotalAmount (CommissionablePrice/gross):', subTotalAmount);
      console.log('   fareIdInternal:', fareIdInternal);
      console.log('   currency:', currency);

      if (!budgetId || subTotalAmount <= 0) {
        console.warn('⚠️ [MAKE_BUDGET] Missing data - budgetId:', budgetId, 'subTotalAmount:', subTotalAmount);
        return {
          success: false,
          error: 'No se pudo obtener el precio exacto del proveedor',
          rawResponse: xmlResponse.substring(0, 1000)
        };
      }

      return {
        success: true,
        budgetId,
        subTotalAmount,
        agencyTotal,
        commissionablePrice,
        fareIdInternal,
        currency,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [MAKE_BUDGET] Error parsing response:', error);
      return {
        success: false,
        error: error.message || 'Error parsing makeBudget response'
      };
    }
  }

  /**
   * Calls getBudget to retrieve the detailed Pricing breakdown with Target=AGENCY
   * This returns the actual agency net price (not the gross/commissionable price from makeBudget)
   */
  async getBudget(budgetId: string) {
    console.log('📋 [GET_BUDGET] Requesting budget details for:', budgetId);

    const soapBody = `<getBudgetRQ xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
      <pos xmlns="">
        <id>${this.username}</id>
        <clave>${this.password}</clave>
      </pos>
      <rq xmlns="">${budgetId}</rq>
    </getBudgetRQ>`;

    try {
      const xmlResponse = await this.makeSOAPRequest(soapBody, 'getBudget');
      console.log('📋 [GET_BUDGET] Response length:', xmlResponse.length);
      console.log('📋 [GET_BUDGET] Response preview:', xmlResponse.substring(0, 1500));

      // Extract ALL Pricing blocks and log full breakdown
      let agencyTotal = 0;
      let commissionablePrice = 0;
      let commissionAmount = 0;

      // Match Pricing blocks with or without namespace prefixes (e.g. <Pricing>, <bud1:Pricing>, <ns1:Pricing>)
      const pricingBlocks = xmlResponse.match(/<(?:\w+:)?Pricing>[\s\S]*?<\/(?:\w+:)?Pricing>/gi);
      if (pricingBlocks) {
        console.log(`📋 [GET_BUDGET] Found ${pricingBlocks.length} Pricing blocks`);
        for (const block of pricingBlocks) {
          const targetMatch = block.match(/<(?:\w+:)?Target>([^<]+)<\/(?:\w+:)?Target>/i);
          const totalMatch = block.match(/<(?:\w+:)?Total>([\d.]+)<\/(?:\w+:)?Total>/i);
          const commPriceMatch = block.match(/<(?:\w+:)?CommissionablePrice>([\d.]+)<\/(?:\w+:)?CommissionablePrice>/i);
          const commAmountMatch = block.match(/<(?:\w+:)?CommissionAmount>([\d.]+)<\/(?:\w+:)?CommissionAmount>/i);
          const overrideCommMatch = block.match(/<(?:\w+:)?OverrideCommissionAmount>([\d.]+)<\/(?:\w+:)?OverrideCommissionAmount>/i);

          const target = targetMatch ? targetMatch[1] : 'UNKNOWN';
          console.log(`📋 [GET_BUDGET] Pricing [${target}]: Total=${totalMatch?.[1]}, CommissionablePrice=${commPriceMatch?.[1]}, CommissionAmount=${commAmountMatch?.[1]}, OverrideCommission=${overrideCommMatch?.[1]}`);

          if (target === 'AGENCY') {
            if (totalMatch) agencyTotal = parseFloat(totalMatch[1]);
            if (commPriceMatch) commissionablePrice = parseFloat(commPriceMatch[1]);
            if (commAmountMatch) commissionAmount = parseFloat(commAmountMatch[1]);
          }
        }
      } else {
        console.log('📋 [GET_BUDGET] No Pricing blocks found');
      }

      const currency = this.currency;

      console.log('📋 [GET_BUDGET] FINAL → commissionablePrice:', commissionablePrice, 'agencyTotal:', agencyTotal, 'commissionAmount:', commissionAmount, 'currency:', currency);

      if (commissionablePrice > 0) {
        return { success: true, agencyTotal, commissionablePrice, commissionAmount, currency };
      }

      console.warn('⚠️ [GET_BUDGET] No Pricing with Target=AGENCY found, response preview:', xmlResponse.substring(0, 1500));
      return { success: false, error: 'No AGENCY pricing found in getBudget response' };
    } catch (error) {
      console.error('❌ [GET_BUDGET] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  parseCountryListResponse(xmlResponse) {
    try {
      console.log('🔍 PARSING XML - Starting parseCountryListResponse');
      console.log('🔍 XML Response length:', xmlResponse.length);
      // Find España first to test our regex
      const espanaTest = xmlResponse.includes('ESPAÑA');
      console.log('🔍 Does XML contain ESPAÑA?', espanaTest);
      if (espanaTest) {
        console.log('🔍 España context:', xmlResponse.substring(xmlResponse.indexOf('ESPAÑA') - 100, xmlResponse.indexOf('ESPAÑA') + 100));
      }
      // Simplified pattern - find any Code/Name pairs regardless of context
      // We'll filter countries vs cities in post-processing
      const codeNamePattern = /<Code[^>]*>([A-Z]{2,3})<\/Code>[\s\S]*?<Name[^>]*>([^<]+)<\/Name>/g;
      const matches = [
        ...xmlResponse.matchAll(codeNamePattern)
      ];
      console.log(`🔍 Found ${matches.length} CountryInfos with Code/Name pairs`);
      const results = [];
      const seenCodes = new Set();
      // Create a map to track context - countries appear before cities in CountryInfos blocks
      const contextMap = new Map();
      // First pass: identify all matches and their positions
      for (const match of matches) {
        const code = match[1].trim();
        const name = match[2].trim();
        const position = match.index || 0;
        // Check if this appears within a CountryInfos block
        const beforeMatch = xmlResponse.substring(Math.max(0, position - 500), position);
        const isInCountryBlock = beforeMatch.includes('<CountryInfos');
        const isAfterCountryCode = beforeMatch.match(/<Code[^>]*>([A-Z]{2,3})<\/Code>/g);
        contextMap.set(code, {
          name,
          position,
          isInCountryBlock,
          isAfterCountryCode: !!isAfterCountryCode,
          codeLength: code.length
        });
      }
      // Second pass: filter for likely countries
      for (const [code, info] of contextMap) {
        // Countries are typically:
        // - 2-3 characters
        // - No numbers
        // - First Code in a CountryInfos block (not after another country code)
        // - Not obvious city patterns like XXX with 3 chars + numbers
        const isLikelyCountry = info.codeLength <= 3 && !/\d/.test(code) && !seenCodes.has(code) && // Additional heuristics
          (info.codeLength === 2 || // 2-letter codes are almost always countries
            info.codeLength === 3 && info.isInCountryBlock) // 3-letter in country block
          ;
        if (isLikelyCountry) {
          console.log(`🔍 Found country: ${code} - ${info.name}`);
          results.push({
            code,
            name: info.name
          });
          seenCodes.add(code);
        }
      }
      console.log(`🔍 PARSED ${results.length} countries from real XML`);
      console.log('🔍 First 10 countries:', results.slice(0, 10));
      console.log('🔍 España found:', results.find((r) => r.name.includes('ESPAÑA') || r.code === 'ES'));
      return results;
    } catch (error) {
      console.error('❌ Error parsing country list response:', error);
      console.error('❌ XML sample (first 1000 chars):', xmlResponse.substring(0, 1000));
      return [];
    }
  }
  parseAirlineListResponse(xmlResponse) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const airlines = [];
      const airlineElements = xmlDoc.querySelectorAll('Airline, airline, AirlineInfo, airlineinfo');
      airlineElements.forEach((airlineEl) => {
        const code = airlineEl.getAttribute('code') || airlineEl.getAttribute('Code') || '';
        const name = airlineEl.textContent?.trim() || airlineEl.getAttribute('name') || '';
        if (code && name) {
          airlines.push({
            code,
            name
          });
        }
      });
      return airlines;
    } catch (error) {
      console.error('❌ Error parsing airline list response:', error);
      return [];
    }
  }
  parseHotelSearchResponse(xmlResponse, params) {
    try {
      // 🚀 STREAMING-STYLE PROCESSING: Process hotels one-by-one WITHOUT loading full XML
      // This allows handling 15-20MB responses without memory issues
      const MAX_HOTELS_TO_PROCESS = 75;

      console.log(`📊 [MEMORY] Original XML size: ${(xmlResponse.length / 1024 / 1024).toFixed(2)}MB`);
      console.log(`🔄 [STREAMING] Processing hotels incrementally (max ${MAX_HOTELS_TO_PROCESS})`);

      const hotels = [];

      // Regex to extract individual HotelFares blocks (non-greedy match)
      // We process each hotel block independently without loading full XML
      const hotelBlockPattern = /<HotelFares[^>]*>([\s\S]*?)<\/HotelFares>/g;

      let match;
      let processedCount = 0;
      const parser = new DOMParser();

      // Process hotels one-by-one in streaming fashion
      while ((match = hotelBlockPattern.exec(xmlResponse)) !== null && processedCount < MAX_HOTELS_TO_PROCESS) {
        try {
          // Extract just this ONE hotel block (small, ~50-100KB)
          const hotelXmlBlock = match[0];

          // DEBUG: Log first hotel block to see structure
          if (processedCount === 0) {
            console.log('🔍 [DEBUG] First hotel block sample (first 500 chars):');
            console.log(hotelXmlBlock.substring(0, 500));
          }

          // Wrap in minimal XML structure for parsing
          const wrappedXml = `<?xml version="1.0"?><root>${hotelXmlBlock}</root>`;

          // Parse as HTML (text/xml not supported in Deno)
          // Tags converted to lowercase, but getTextContent() handles both cases
          const miniDoc = parser.parseFromString(wrappedXml, 'text/html');
          const hotelElement = miniDoc.querySelector('HotelFares');

          if (hotelElement) {
            // DEBUG: Check if FareList exists
            if (processedCount === 0) {
              const fareList = hotelElement.querySelector('FareList');
              console.log('🔍 [DEBUG] FareList found:', !!fareList);
              if (fareList) {
                const fare = fareList.querySelector('Fare');
                console.log('🔍 [DEBUG] First Fare found:', !!fare);
                if (fare) {
                  console.log('🔍 [DEBUG] Fare innerHTML (first 300 chars):', fare.innerHTML?.substring(0, 300));
                }
              }
            }

            const hotel = this.parseHotelElement(hotelElement, params, processedCount);
            if (hotel) {
              hotels.push(hotel);
              processedCount++;

              // Log progress every 10 hotels
              if (processedCount % 10 === 0) {
                console.log(`📦 [STREAMING] Processed ${processedCount} hotels...`);
              }
            }
          }

          // Hotel block is discarded after processing, freeing memory
        } catch (error) {
          console.warn(`⚠️ [STREAMING] Error processing hotel ${processedCount}:`, error.message);
          // Continue processing next hotel
        }
      }

      console.log(`✅ [STREAMING] Processed ${processedCount} hotels from ${(xmlResponse.length / 1024 / 1024).toFixed(2)}MB XML`);

      // Category-based deduplication: remove mislabeled broker entries
      const beforeFilterCount = hotels.length;
      const nameGroups = new Map();
      for (const hotel of hotels) {
        const normalizedName = normalizeHotelName(hotel.name);
        if (!nameGroups.has(normalizedName)) {
          nameGroups.set(normalizedName, []);
        }
        nameGroups.get(normalizedName).push(hotel);
      }

      const hotelsToRemove = new Set();
      for (const [groupName, group] of nameGroups) {
        if (group.length < 2) continue;

        // Count category occurrences
        const categoryCounts = new Map();
        for (const h of group) {
          const stars = normalizeCategory(h.category);
          categoryCounts.set(stars, (categoryCounts.get(stars) || 0) + 1);
        }

        // Find majority category (most common star rating)
        let majorityStars = 0;
        let majorityCount = 0;
        for (const [stars, count] of categoryCounts) {
          if (count > majorityCount || (count === majorityCount && stars > 0)) {
            majorityStars = stars;
            majorityCount = count;
          }
        }

        // Only filter if there's a clear majority (more than one category exists)
        if (categoryCounts.size > 1 && majorityStars > 0) {
          for (const h of group) {
            const stars = normalizeCategory(h.category);
            if (stars !== majorityStars && stars > 0) {
              hotelsToRemove.add(h);
              console.log(`⚠️ Removed broker ${h.unique_id} for "${h.name}": category ${h.category} (${stars}★) != majority ${majorityStars}★`);
            }
          }
        }
      }

      const filteredHotels = hotelsToRemove.size > 0
        ? hotels.filter(h => !hotelsToRemove.has(h))
        : hotels;

      if (hotelsToRemove.size > 0) {
        console.log(`🔍 [CATEGORY FILTER] Removed ${hotelsToRemove.size} mislabeled entries (${beforeFilterCount} → ${filteredHotels.length})`);
      }

      // Sort hotels by price (lowest first)
      filteredHotels.sort((a, b) => {
        const priceA = Math.min(...a.rooms.map((room) => room.total_price));
        const priceB = Math.min(...b.rooms.map((room) => room.total_price));
        return priceA - priceB;
      });

      console.log(`✅ Returning ${filteredHotels.length} EUROVIPS hotels (sorted by price)`);
      if (filteredHotels.length > 0) {
        console.log('💰 Cheapest hotel:', filteredHotels[0].name, '-', Math.min(...filteredHotels[0].rooms.map(r => r.total_price)));
      }

      return filteredHotels;
    } catch (error) {
      console.error('❌ Error parsing hotel search response:', error);
      return [];
    }
  }
  parseFlightSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const flights = [];
      // Try multiple selectors to handle different XML structures
      let flightElements = xmlDoc.querySelectorAll('ArrayOfAirFare1 > AirFares');
      // Fallback to original selectors for backward compatibility
      if (flightElements.length === 0) {
        flightElements = xmlDoc.querySelectorAll('ArrayOfAirFare1 AirFares, AirFares');
      }
      console.log(`🔍 Found ${flightElements.length} flight elements`);
      flightElements.forEach((flightEl, index) => {
        try {
          const flight = this.parseFlightElement(flightEl, params, index);
          if (flight) {
            flights.push(flight);
          }
        } catch (error) {
          console.error('❌ Error parsing flight element:', error);
        }
      });
      return flights;
    } catch (error) {
      console.error('❌ Error parsing flight search response:', error);
      return [];
    }
  }
  parseHotelElement(hotelEl, params, index) {
    try {
      const uniqueId = hotelEl.getAttribute('UniqueId') || `hotel_${Date.now()}_${index}`;
      const hotelName = this.getTextContent(hotelEl, 'Name') || this.getTextContent(hotelEl, 'HotelName') || 'Unknown Hotel';
      const address = this.getTextContent(hotelEl, 'HotelAddress') || this.getTextContent(hotelEl, 'Address') || '';
      // Calculate nights first
      const checkIn = new Date(params.checkinDate);
      const checkOut = new Date(params.checkoutDate);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      // Get total price from FareList - Use the first Fare's Base + Tax (total for entire stay)
      let totalPrice = 0;
      const fareListEl = hotelEl.querySelector('FareList') || hotelEl.querySelector('farelist');
      if (fareListEl) {
        const fareEl = fareListEl.querySelector('Fare') || fareListEl.querySelector('fare');
        if (fareEl) {
          // CRITICAL: <base> is HTML native void element - DOMParser mangles it completely
          // SOLUTION: Extract values directly from innerHTML with regex, bypass DOM
          const innerHTML = fareEl.innerHTML || '';

          // Extract Base value: <base>123.45</base> or <base>123.45<tax>
          const baseMatch = innerHTML.match(/<base[^>]*>([\d.]+)/i);
          // Extract Tax value: <tax...>123.45</tax>
          const taxMatch = innerHTML.match(/<tax[^>]*>([\d.]+)<\/tax>/i);

          const base = baseMatch ? parseFloat(baseMatch[1]) : 0;
          const tax = taxMatch ? parseFloat(taxMatch[1]) : 0;

          totalPrice = base + tax; // This is already the total for the entire stay
          console.log(`🔍 Hotel "${hotelName}" - Base: ${base}, Tax: ${tax}, Total for ${nights} nights: ${totalPrice}`);
        }
      }
      if (totalPrice <= 0) {
        return null;
      }
      const currency = this.currency;
      // Parse room information from FareList
      const rooms = [];
      if (fareListEl) {
        const fareElements = fareListEl.querySelectorAll('Fare, fare');
        fareElements.forEach((fareEl, index) => {
          const fareType = fareEl.getAttribute('type') || 'Standard';
          const availability = parseInt(fareEl.getAttribute('Availability') || '0');

          // Extract Base and Tax from innerHTML (bypass DOM because <base> is HTML native tag)
          const innerHTML = fareEl.innerHTML || '';
          const baseMatch = innerHTML.match(/<base[^>]*>([\d.]+)/i);
          const taxMatch = innerHTML.match(/<tax[^>]*>([\d.]+)<\/tax>/i);

          const base = baseMatch ? parseFloat(baseMatch[1]) : 0;
          const tax = taxMatch ? parseFloat(taxMatch[1]) : 0;
          const roomTotal = base + tax; // Total for entire stay
          const description = this.getTextContent(fareEl, 'Description') || fareType;

          // Parse Ocuppancy node to get REAL room type (more reliable than Fare.type)
          const ocuppancyEl = fareEl.querySelector('Ocuppancy, ocuppancy');
          let adults = 0;
          let children = 0;
          let infants = 0;

          if (ocuppancyEl) {
            const occupants = ocuppancyEl.querySelectorAll('Occupants, occupants');
            occupants.forEach(occupant => {
              const type = occupant.getAttribute('type');
              if (type === 'ADT') adults++;
              else if (type === 'CHD' || type === 'CNN') children++;
              else if (type === 'INFOA') infants++;
            });
            console.log(`🛏️ [OCCUPANCY] Fare ${fareType}: ${adults} adults, ${children} children, ${infants} infants`);
          }

          if (roomTotal > 0) {
            // Calculate price per night
            const pricePerNight = nights > 0 ? roomTotal / nights : roomTotal;

            // Extract OccupancyId from Fare element for makeBudget
            // Note: OccupancyId in XML is the requested occupancy, not a unique room identifier
            const xmlOccupancyId = fareEl.getAttribute('OccupancyId') || '1';
            const fareIdBroker = fareEl.getAttribute('FareIdBroker') || undefined;

            // Use index+1 as unique identifier for UI selection
            const uniqueRoomId = (index + 1).toString();

            console.log(`🔑 [FARE] type=${fareType}, uniqueRoomId=${uniqueRoomId}, xmlOccupancyId=${xmlOccupancyId}, FareIdBroker=${fareIdBroker}`);

            rooms.push({
              type: fareType,
              description: description,
              price_per_night: pricePerNight,
              total_price: roomTotal,
              currency: currency,
              availability: availability,
              occupancy_id: uniqueRoomId,
              xml_occupancy_id: xmlOccupancyId,
              fare_id_broker: fareIdBroker,
              // Add occupancy info from SOAP response
              adults: adults,
              children: children,
              infants: infants
            });
          }
        });
      }
      // Fallback if no rooms found
      if (rooms.length === 0) {
        const pricePerNight = nights > 0 ? totalPrice / nights : totalPrice;
        // Use search params for occupancy in fallback room
        const fallbackAdults = params.adults || 1;
        const fallbackChildren = params.children || 0;
        rooms.push({
          type: 'Standard',
          description: 'Standard Room',
          price_per_night: pricePerNight,
          total_price: totalPrice,
          currency: currency,
          availability: 0,
          occupancy_id: '1',
          fare_id_broker: undefined,
          // Include occupancy from search params for fallback room
          adults: fallbackAdults,
          children: fallbackChildren,
          infants: 0
        });
      }
      return {
        id: `hotel_${uniqueId}`,
        unique_id: uniqueId,
        name: hotelName,
        category: this.getTextContent(hotelEl, 'Category, HotelCategory') || 'Standard',
        city: this.getTextContent(hotelEl, 'City, Location') || params.cityCode || '',
        address: address,
        phone: this.getTextContent(hotelEl, 'Phone, Telephone') || '',
        website: this.getTextContent(hotelEl, 'Website') || undefined,
        description: this.getTextContent(hotelEl, 'Description') || undefined,
        images: this.extractPictures(hotelEl),
        check_in: params.checkinDate,
        check_out: params.checkoutDate,
        nights: nights,
        currency: currency,
        rooms: rooms,
        policy_cancellation: this.getTextContent(hotelEl, 'CancellationPolicy') || '',
        policy_lodging: this.getTextContent(hotelEl, 'LodgingPolicy') || '',
        // Search params - occupancy requested by user (for PDF generation)
        search_adults: params.adults || 1,
        search_children: params.children || 0,
        provider: 'EUROVIPS'
      };
    } catch (error) {
      console.error('❌ Error parsing hotel element:', error);
      return null;
    }
  }
  parseFlightElement(flightEl, params, index) {
    try {
      const uniqueId = flightEl.getAttribute('UniqueId') || `flight_${Date.now()}_${index}`;
      // Handle both XML structures for airline info
      let airlineCode = this.getTextContent(flightEl, 'AirlineCode') || '';
      let airlineName = this.getTextContent(flightEl, 'AirlineName') || '';
      // EUROVIPS structure: MarketingAirline with code attribute
      if (!airlineCode || !airlineName) {
        const marketingAirlineEl = flightEl.querySelector('MarketingAirline');
        if (marketingAirlineEl) {
          airlineCode = marketingAirlineEl.getAttribute('code') || airlineCode || 'XX';
          airlineName = marketingAirlineEl.textContent?.trim() || airlineName || 'Unknown Airline';
        }
      }
      // Default fallbacks
      airlineCode = airlineCode || 'XX';
      airlineName = airlineName || 'Unknown Airline';
      // Handle different price structures
      let totalPrice = parseFloat(this.getTextContent(flightEl, 'TotalFare, TotalPrice') || '0');
      let currency = this.getTextContent(flightEl, 'Currency') || this.currency;
      // EUROVIPS structure: calculate from FareList
      if (totalPrice <= 0) {
        const fareListEl = flightEl.querySelector('FareList');
        if (fareListEl) {
          currency = fareListEl.getAttribute('currency') || currency;
          // Get ADT (Adult) fare as main price
          const adultFareEl = fareListEl.querySelector('Fare[type="ADT"]');
          if (adultFareEl) {
            const base = parseFloat(this.getTextContent(adultFareEl, 'Base') || '0');
            const taxElements = adultFareEl.querySelectorAll('Tax');
            let totalTaxes = 0;
            taxElements.forEach((taxEl) => {
              totalTaxes += parseFloat(taxEl.textContent?.trim() || '0');
            });
            totalPrice = base + totalTaxes;
          }
        }
      }
      if (totalPrice <= 0) {
        return null;
      }
      const legs = [];
      // Try to parse flight legs with new structure
      const outboundLeg = this.parseFlightLeg(flightEl, 'outbound', params.originCode, params.destinationCode, params.departureDate);
      if (outboundLeg) {
        legs.push(outboundLeg);
      }
      // Return flight if dates are provided
      if (params.returnDate) {
        const returnLeg = this.parseFlightLeg(flightEl, 'return', params.destinationCode, params.originCode, params.returnDate);
        if (returnLeg) {
          legs.push(returnLeg);
        }
      }
      // If no legs were parsed with legacy method, create basic leg from airport info
      if (legs.length === 0) {
        const departureAirport = flightEl.querySelector('DepartureAirport');
        const arrivalAirport = flightEl.querySelector('ArrivalAirport');
        if (departureAirport && arrivalAirport) {
          const depCode = departureAirport.getAttribute('code') || params.originCode || '';
          const depName = departureAirport.textContent?.trim() || depCode;
          const arrCode = arrivalAirport.getAttribute('code') || params.destinationCode || '';
          const arrName = arrivalAirport.textContent?.trim() || arrCode;
          legs.push({
            departure: {
              city_code: depCode,
              city_name: depName,
              time: '00:00' // Default time since not provided
            },
            arrival: {
              city_code: arrCode,
              city_name: arrName,
              time: '00:00' // Default time since not provided
            },
            duration: '0h 0m',
            flight_type: 'outbound',
            layovers: []
          });
        }
      }
      if (legs.length === 0) {
        return null;
      }
      return {
        id: `flight_${uniqueId}`,
        airline: {
          code: airlineCode,
          name: airlineName
        },
        price: {
          amount: totalPrice,
          currency: currency
        },
        adults: params.adults || 1,
        children: params.children || 0,
        departure_date: params.departureDate,
        return_date: params.returnDate,
        legs: legs,
        luggage: false,
        travel_assistance: 0,
        transfers: 0,
        provider: 'EUROVIPS'
      };
    } catch (error) {
      console.error('❌ Error parsing flight element:', error);
      return null;
    }
  }
  parseFlightLeg(flightEl, type, origin, destination, date) {
    try {
      const departureTime = this.getTextContent(flightEl, `${type}DepartureTime, DepartureTime`) || '00:00';
      const arrivalTime = this.getTextContent(flightEl, `${type}ArrivalTime, ArrivalTime`) || '00:00';
      const duration = this.getTextContent(flightEl, `${type}Duration, Duration`) || '0h 0m';
      return {
        departure: {
          city_code: origin,
          city_name: origin,
          time: departureTime
        },
        arrival: {
          city_code: destination,
          city_name: destination,
          time: arrivalTime
        },
        duration: duration,
        flight_type: type,
        layovers: []
      };
    } catch (error) {
      console.error(`❌ Error parsing ${type} flight leg:`, error);
      return null;
    }
  }
  parsePackageSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const packages = [];
      // Try multiple selectors to handle different XML structures
      let packageElements = xmlDoc.querySelectorAll('ArrayOfPackageFare1 PackageFares');
      // If not found, try direct PackageFares selector
      if (packageElements.length === 0) {
        packageElements = xmlDoc.querySelectorAll('PackageFares');
      }
      // If still not found, try alternative structure
      if (packageElements.length === 0) {
        packageElements = xmlDoc.querySelectorAll('ArrayOfPackageFare1 > PackageFares');
      }
      console.log(`🔍 Found ${packageElements.length} package elements using selector`);
      packageElements.forEach((packageEl, index) => {
        try {
          const packageData = this.parsePackageElement(packageEl, params, index);
          if (packageData) {
            packages.push(packageData);
          }
        } catch (error) {
          console.error('❌ Error parsing package element:', error);
        }
      });
      return packages;
    } catch (error) {
      console.error('❌ Error parsing package search response:', error);
      return [];
    }
  }
  parseServiceSearchResponse(xmlResponse, params) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'text/html');
      const services = [];
      // Try multiple selectors to handle different XML structures
      let serviceElements = xmlDoc.querySelectorAll('ArrayOfServiceFare1 ServiceFares');
      // If not found, try direct ServiceFares selector
      if (serviceElements.length === 0) {
        serviceElements = xmlDoc.querySelectorAll('ServiceFares');
      }
      console.log(`🔍 Found ${serviceElements.length} service elements`);
      serviceElements.forEach((serviceEl, index) => {
        try {
          const serviceData = this.parseServiceElement(serviceEl, params, index);
          if (serviceData) {
            services.push(serviceData);
          }
        } catch (error) {
          console.error('❌ Error parsing service element:', error);
        }
      });
      return services;
    } catch (error) {
      console.error('❌ Error parsing service search response:', error);
      return [];
    }
  }
  parseServiceElement(serviceEl, params, index) {
    try {
      const uniqueId = serviceEl.getAttribute('UniqueId') || `service_${Date.now()}_${index}`;
      const backOfficeCode = serviceEl.getAttribute('BackOfficeCode') || '';
      const backOfficeOperatorCode = serviceEl.getAttribute('BackOfficeOperatorCode') || '';
      const name = this.getTextContent(serviceEl, 'Name') || 'Servicio sin nombre';
      const category = this.getTextContent(serviceEl, 'Category') || 'REGULAR';
      const categoryDescription = this.getTextContent(serviceEl, 'CategoryDescription') || '';
      // Location
      const locationEl = serviceEl.querySelector('Location');
      const location = locationEl ? {
        code: locationEl.getAttribute('code') || '',
        name: locationEl.textContent?.trim() || ''
      } : {
        code: params.cityCode || '',
        name: ''
      };
      const fareType = this.getTextContent(serviceEl, 'FareType') || 'OW';
      const rateType = this.getTextContent(serviceEl, 'RateType') || '';
      const observations = this.getTextContent(serviceEl, 'Observations') || '';
      // Parse fares
      const fares = this.parseServiceFares(serviceEl);
      if (fares.length === 0) {
        console.warn(`⚠️ Service ${name} has no valid fares`);
        return null;
      }
      // Get main price (first available fare)
      const mainFare = fares.find((f) => f.total > 0) || fares[0];
      const serviceData = {
        id: `service_${uniqueId}`,
        unique_id: uniqueId,
        backOfficeCode,
        backOfficeOperatorCode,
        name,
        category,
        categoryDescription,
        location,
        fareType,
        rateType,
        date: params.dateFrom,
        price: {
          amount: mainFare.total,
          currency: mainFare.currency
        },
        fares,
        observations,
        provider: 'EUROVIPS'
      };
      console.log('✅ Parsed service:', serviceData.name, `- ${fares.length} fare type(s)`);
      return serviceData;
    } catch (error) {
      console.error('❌ Error parsing service element:', error);
      return null;
    }
  }
  parseServiceFares(serviceEl) {
    const fares = [];
    const fareListEl = serviceEl.querySelector('FareList');
    if (!fareListEl) return fares;
    const currency = fareListEl.getAttribute('currency') || 'USD';
    const fareElements = fareListEl.querySelectorAll('Fare');
    fareElements.forEach((fareEl) => {
      const type = fareEl.getAttribute('type') || '';
      const passengerType = fareEl.getAttribute('PassengerType') || 'ADT';
      const availability = parseInt(fareEl.getAttribute('Availability') || '0');
      const base = parseFloat(this.getTextContent(fareEl, 'Base') || '0');
      // Parse taxes
      const taxes = [];
      const taxElements = fareEl.querySelectorAll('Tax');
      let totalTaxes = 0;
      taxElements.forEach((taxEl) => {
        const taxType = taxEl.getAttribute('type') || '';
        const taxAmount = parseFloat(taxEl.textContent?.trim() || '0');
        taxes.push({
          type: taxType,
          amount: taxAmount
        });
        totalTaxes += taxAmount;
      });
      const total = base + totalTaxes;
      if (base >= 0) {
        fares.push({
          type,
          passengerType,
          availability,
          base,
          taxes,
          total,
          currency,
          description: type // Use fare type as description
        });
      }
    });
    return fares;
  }
  parsePackageElement(packageEl, params, index) {
    try {
      const uniqueId = packageEl.getAttribute('UniqueId') || `package_${Date.now()}_${index}`;
      const packageName = this.getTextContent(packageEl, 'Name') || 'Package sin nombre';
      const category = this.getTextContent(packageEl, 'Category') || 'REGULAR';
      const location = this.getTextContent(packageEl, 'Location') || '';
      const description = this.getTextContent(packageEl, 'Description') || '';
      // Get duration
      const lodgedNights = parseInt(this.getTextContent(packageEl, 'LodgedNights') || '0');
      const lodgedDays = parseInt(this.getTextContent(packageEl, 'LodgedDays') || '0');
      // Parse pricing information
      const fareListEl = packageEl.querySelector('FareList');
      let totalPrice = 0;
      let currency = this.currency;
      if (fareListEl) {
        currency = fareListEl.getAttribute('currency') || this.currency;
        // Get adult fare (DWL = double, SGL = single)
        const adultFareEl = fareListEl.querySelector('Fare[type="DWL"], Fare[type="SGL"]');
        if (adultFareEl) {
          const base = parseFloat(this.getTextContent(adultFareEl, 'Base') || '0');
          const tax = parseFloat(this.getTextContent(adultFareEl, 'Tax') || '0');
          totalPrice = base + tax;
        }
      }
      if (totalPrice <= 0) {
        return null;
      }
      // Parse included services
      const includedServices = [];
      if (description) {
        includedServices.push(description);
      }
      // Check for flight and hotel information
      const hasFlights = description.toLowerCase().includes('bue/') || description.toLowerCase().includes('vuelo') || category.toUpperCase().includes('AEROTERRESTRE');
      const hasHotel = description.toLowerCase().includes('hotel') || lodgedNights > 0 || category.toUpperCase().includes('HOTEL');
      return {
        id: `package_${uniqueId}`,
        name: packageName,
        description: description,
        destination: location || params.cityCode || '',
        duration_nights: lodgedNights,
        duration_days: lodgedDays || lodgedNights + 1,
        departure_date: params.dateFrom,
        return_date: params.dateTo,
        price: {
          amount: totalPrice,
          currency: currency
        },
        category: category,
        includes: {
          flights: hasFlights,
          hotel: hasHotel,
          meals: description.toLowerCase().includes('comida') || description.toLowerCase().includes('pension'),
          transfers: description.toLowerCase().includes('traslado'),
          excursions: description.toLowerCase().includes('excursion') || description.toLowerCase().includes('visita')
        },
        included_services: includedServices,
        provider: 'EUROVIPS'
      };
    } catch (error) {
      console.error('❌ Error parsing package element:', error);
      return null;
    }
  }
  getTextContent(element, selectors) {
    const selectorList = selectors.split(', ');
    for (const selector of selectorList) {
      // Try original case first (for true XML parsers)
      let found = element.querySelector(selector);

      // If not found, try lowercase (DOMParser with 'text/html' converts tags to lowercase)
      if (!found) {
        found = element.querySelector(selector.toLowerCase());
      }

      if (found && found.textContent?.trim()) {
        return found.textContent.trim();
      }
    }

    // DEBUG: Log when selector not found (only for first hotel)
    if (selectors === 'Base' && element.querySelector('farelist, FareList')) {
      console.log(`⚠️ [DEBUG] getTextContent('Base') failed. Element tagName:`, element.tagName);
      console.log(`⚠️ [DEBUG] Children:`, Array.from(element.children).map(c => c.tagName).join(', '));
    }

    return '';
  }

  /**
   * Extract hotel image URLs from Pictures elements
   * XML structure: <Pictures type="img">http://images.gta-travel.com/...</Pictures>
   * type="img" → image URL (extract these)
   * type="web" → hotel website (ignore)
   */
  extractPictures(hotelEl) {
    const images: string[] = [];

    // DOMParser with 'text/html' converts tags to lowercase
    const pictureElements = hotelEl.querySelectorAll('pictures');

    pictureElements.forEach((pictureEl) => {
      const type = pictureEl.getAttribute('type')?.toLowerCase();
      const url = pictureEl.textContent?.trim();

      if (type === 'img' && url) {
        // Ensure URL has protocol
        const fullUrl = url.startsWith('https://') ? url : url.startsWith('http://') ? url.replace('http://', 'https://') : `https://${url}`;
        images.push(fullUrl);
      }
    });

    return images;
  }
}
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Apply rate limiting
  return await withRateLimit(
    req,
    supabase,
    { action: 'search', resource: 'eurovips' },
    async () => {
      let body: { action?: string; data?: any; jobId?: string } = {};
      try {
        if (req.method !== 'POST') {
          return validationErrorResponse('Only POST method is allowed');
        }
        try {
          body = await req.json();
        } catch {
          return validationErrorResponse('body must be valid JSON');
        }
        const validationError = validateEurovipsRequestBody(body);
        if (validationError) {
          return validationErrorResponse(validationError);
        }
        console.log('📦 EUROVIPS REQUEST:', body.action, body.data ? Object.keys(body.data) : 'no-data');
        const { action, data, jobId } = body;

        // If jobId exists, mark job as processing
        if (jobId) {
          console.log(`🔄 Async mode: Processing job ${jobId}`);
          await supabase
            .from('search_jobs')
            .update({ status: 'processing' })
            .eq('id', jobId);
        }

        // Executes the SOAP action against the EUROVIPS client. Pure async
        // function — used both in the sync response path (no jobId) and the
        // background path (waitUntil-scheduled, behind a jobId).
        const executeAction = async (client: EurovipsSOAPClient) => {
          switch (action) {
            case 'getCountryList':
              return await client.getCountryList(data);
            case 'getAirlineList':
              return await client.getAirlineList();
            case 'searchHotels':
              if (!data) throw new Error('Hotel search data is required');
              return await client.searchHotels(data);
            case 'searchFlights':
              if (!data) throw new Error('Flight search data is required');
              return await client.searchFlights(data);
            case 'searchPackages':
              if (!data) throw new Error('Package search data is required');
              return await client.searchPackages(data);
            case 'searchServices':
              if (!data) throw new Error('Service search data is required');
              return await client.searchServices(data);
            case 'makeBudget': {
              if (!data) throw new Error('makeBudget data is required');
              if (!data.fareId) throw new Error('fareId is required for makeBudget');
              if (!data.fareIdBroker) throw new Error('fareIdBroker is required for makeBudget');
              const r = await client.makeBudget(data);

              // Get agency net price (Neto Agencia) from getBudget Pricing breakdown
              // AGENCY Total = CommissionablePrice - Commission + Gastos + IVA = Neto Agencia
              if (r.success && r.budgetId) {
                console.log('📋 [MAKE_BUDGET] Calling getBudget for Pricing breakdown, budgetId:', r.budgetId);
                const budgetDetails = await client.getBudget(r.budgetId);
                if (budgetDetails.success && budgetDetails.commissionablePrice > 0) {
                  console.log(`📋 [MAKE_BUDGET] PRICING → Neto Agencia (Total): ${budgetDetails.agencyTotal}, Importe Bruto (CommissionablePrice): ${budgetDetails.commissionablePrice}, Comisión: ${budgetDetails.commissionAmount}, makeBudget SubTotalAmount was: ${r.subTotalAmount}`);
                  r.subTotalAmount = budgetDetails.agencyTotal;
                  r.agencyPricing = {
                    netoAgencia: budgetDetails.agencyTotal,
                    importeBruto: budgetDetails.commissionablePrice,
                    comision: budgetDetails.commissionAmount || 0
                  };
                  r.currency = client.currency;
                } else {
                  console.warn('⚠️ [MAKE_BUDGET] getBudget failed, keeping SubTotalAmount as fallback:', r.subTotalAmount);
                }
              }
              return r;
            }
            default:
              throw new Error(`Unknown action: ${action}`);
          }
        };

        // -----------------------------------------------------------------
        // ASYNC PATH (jobId provided)
        //
        // SOFTUR can take longer than the HTTP wall-clock budget (30s) for
        // catalog-heavy queries (e.g. CUN without hotelName filter). When
        // the caller passes a jobId, we:
        //   1. Upsert the job row to 'processing'.
        //   2. Schedule the actual SOAP call under EdgeRuntime.waitUntil()
        //      with a relaxed 90s SOAP timeout. The runtime keeps the
        //      function alive until the task settles, independently of the
        //      HTTP response.
        //   3. Return 202 Accepted immediately. The caller subscribes via
        //      Realtime or polls search_jobs by id until status flips to
        //      'completed' / 'failed'.
        // -----------------------------------------------------------------
        if (jobId) {
          console.log(`🔄 Async mode: scheduling background task for job ${jobId}`);

          // Upsert: create the row if a caller decides to provide its own
          // jobId without going through search-coordinator. Existing rows
          // (e.g. created by search-coordinator) are flipped to 'processing'.
          await supabase
            .from('search_jobs')
            .upsert({
              id: jobId,
              conversation_id: body.conversationId ?? null,
              search_type: action,
              provider: 'EUROVIPS',
              params: data ?? {},
              status: 'processing',
            }, { onConflict: 'id' });

          const backgroundTask = (async () => {
            const t0 = performance.now();
            try {
              const client = new EurovipsSOAPClient();
              client.soapTimeoutMs = 90_000;
              const results = await executeAction(client);
              const ms = Math.round(performance.now() - t0);
              console.log(`✅ Async job ${jobId} completed in ${ms}ms`);
              await supabase
                .from('search_jobs')
                .update({
                  status: 'completed',
                  results,
                  cache_hit: false,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', jobId);
            } catch (err) {
              const ms = Math.round(performance.now() - t0);
              const message = typeof err?.message === 'string' ? err.message : String(err);
              console.error(`❌ Async job ${jobId} failed after ${ms}ms:`, message);
              await supabase
                .from('search_jobs')
                .update({
                  status: 'failed',
                  error: message,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', jobId);
            }
          })();

          // EdgeRuntime is a Supabase Deno global. `waitUntil` keeps the
          // function instance alive until the promise settles, so the
          // background task can finish well after the 202 ships.
          // deno-lint-ignore no-explicit-any
          const runtime = (globalThis as any).EdgeRuntime;
          if (runtime && typeof runtime.waitUntil === 'function') {
            runtime.waitUntil(backgroundTask);
          } else {
            // Fallback: in local dev or non-Supabase Deno runtime we just
            // fire and forget. The function may exit before settle; that's
            // acceptable for dev.
            backgroundTask.catch(() => {});
          }

          return new Response(JSON.stringify({
            success: true,
            async: true,
            jobId,
            status: 'processing',
            action,
            timestamp: new Date().toISOString(),
          }), {
            status: 202,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }

        // -----------------------------------------------------------------
        // SYNC PATH (no jobId — legacy callers)
        // -----------------------------------------------------------------
        const client = new EurovipsSOAPClient();
        const results = await executeAction(client);

        return new Response(JSON.stringify({
          success: true,
          action,
          results,
          provider: 'EUROVIPS',
          cached: false,
          jobId: jobId,
          timestamp: new Date().toISOString()
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('❌ Error in eurovips-soap function:', error);

        // Domain precondition failures (assertCityCode / assertIsoDate /
        // assertStayRange / assertDateRange) throw `invalid_input: <detail>`.
        // Surface them as 400 with the detail so the caller can fix the
        // request, instead of a generic 500.
        const message = typeof error?.message === 'string' ? error.message : String(error);
        const isInputError = message.startsWith('invalid_input:');

        // If jobId exists, mark job as failed (async mode)
        if (body?.jobId) {
          try {
            await supabase
              .from('search_jobs')
              .update({
                status: 'failed',
                error: error.message,
                completed_at: new Date().toISOString()
              })
              .eq('id', body.jobId);
          } catch (updateError) {
            console.error('❌ Failed to update job status:', updateError);
          }
        }

        return new Response(JSON.stringify({
          success: false,
          error: isInputError ? 'invalid_input' : 'Internal server error',
          detail: isInputError ? message.slice('invalid_input:'.length).trim() : undefined,
          jobId: body?.jobId,
          timestamp: new Date().toISOString()
        }), {
          status: isInputError ? 400 : 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  );
});
