/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AIRLINE ALIASES - Mapeo centralizado de nombres de aerolíneas a códigos IATA
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo contiene TODAS las variaciones de nombres de aerolíneas que el
 * sistema puede detectar en el input del usuario.
 * 
 * CÓMO FUNCIONA:
 * 1. El usuario escribe: "quiero volar con latam a madrid"
 * 2. El detector busca "latam" en este mapeo
 * 3. Encuentra el código IATA: "LA"
 * 4. El filtro usa "LA" para filtrar los resultados de Starling
 * 
 * CÓMO AGREGAR NUEVAS AEROLÍNEAS:
 * 1. Agregar el código IATA en AIRLINE_IATA_CODES
 * 2. Agregar todas las variaciones de nombre en AIRLINE_ALIASES
 * 3. Agregar el nombre a AIRLINE_DETECTION_PATTERNS si necesita patrones especiales
 * 
 * ÚLTIMA ACTUALIZACIÓN: 2025-11-25
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CÓDIGOS IATA → NOMBRE OFICIAL
// ═══════════════════════════════════════════════════════════════════════════════
export const AIRLINE_IATA_CODES: Record<string, string> = {
    // ─────────────────────────────────────────────────────────────────────────────
    // LATAM GROUP
    // ─────────────────────────────────────────────────────────────────────────────
    'LA': 'LATAM Airlines',
    'JJ': 'LATAM Airlines Brasil',
    'LP': 'LATAM Airlines Peru',
    'XL': 'LATAM Airlines Ecuador',
    '4C': 'LATAM Airlines Colombia',
    '4M': 'LATAM Airlines Argentina',

    // ─────────────────────────────────────────────────────────────────────────────
    // AVIANCA GROUP
    // ─────────────────────────────────────────────────────────────────────────────
    'AV': 'Avianca',
    '2K': 'Avianca Ecuador',
    'LR': 'Avianca Costa Rica',
    'TA': 'TACA',

    // ─────────────────────────────────────────────────────────────────────────────
    // IBERIA GROUP (IAG)
    // ─────────────────────────────────────────────────────────────────────────────
    'IB': 'Iberia',
    'I2': 'Iberia Express',
    'VY': 'Vueling',

    // ─────────────────────────────────────────────────────────────────────────────
    // US CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'AA': 'American Airlines',
    'UA': 'United Airlines',
    'DL': 'Delta Air Lines',
    'WN': 'Southwest Airlines',
    'B6': 'JetBlue Airways',
    'AS': 'Alaska Airlines',
    'NK': 'Spirit Airlines',
    'F9': 'Frontier Airlines',
    'G4': 'Allegiant Air',
    'SY': 'Sun Country Airlines',

    // ─────────────────────────────────────────────────────────────────────────────
    // EUROPEAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'AF': 'Air France',
    'KL': 'KLM',
    'LH': 'Lufthansa',
    'CL': 'Lufthansa CityLine',
    'EN': 'Air Dolomiti',
    'BA': 'British Airways',
    'AZ': 'ITA Airways',
    'LX': 'Swiss International Air Lines',
    'OS': 'Austrian Airlines',
    'TP': 'TAP Air Portugal',
    'FR': 'Ryanair',
    'U2': 'easyJet',
    'W6': 'Wizz Air',
    'SN': 'Brussels Airlines',
    'UX': 'Air Europa',
    'SU': 'Aeroflot',
    'SK': 'SAS Scandinavian Airlines',
    'AY': 'Finnair',
    'LO': 'LOT Polish Airlines',
    'OK': 'Czech Airlines',
    'RO': 'TAROM',
    'JU': 'Air Serbia',
    'OU': 'Croatia Airlines',
    'A3': 'Aegean Airlines',
    'BT': 'airBaltic',
    'EI': 'Aer Lingus',
    'IG': 'Air Italy',
    '2L': 'Helvetic Airways',
    'WK': 'Edelweiss Air',
    'EB': 'Wamos Air',
    '2W': 'World2Fly',
    'NT': 'Binter Canarias',
    'YW': 'Air Nostrum',
    'V7': 'Volotea',

    // ─────────────────────────────────────────────────────────────────────────────
    // SOUTH AMERICAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'AR': 'Aerolíneas Argentinas',
    'G3': 'Gol',
    'AD': 'Azul Brazilian Airlines',
    'CM': 'Copa Airlines',
    'AM': 'Aeroméxico',
    '5D': 'Aeroméxico Connect',
    'H2': 'Sky Airline',
    'OB': 'Boliviana de Aviación',
    'PZ': 'LATAM Paraguay',
    'P5': 'Wingo',
    'VE': 'EasyFly',
    'JA': 'JetSMART',
    '2Z': 'Voepass',
    'T0': 'Avianca Argentina',
    'DM': 'Arajet',

    // ─────────────────────────────────────────────────────────────────────────────
    // CENTRAL AMERICAN & CARIBBEAN
    // ─────────────────────────────────────────────────────────────────────────────
    'BW': 'Caribbean Airlines',
    'UP': 'Bahamasair',
    '6Y': 'SmartWings',

    // ─────────────────────────────────────────────────────────────────────────────
    // MIDDLE EAST CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'EK': 'Emirates',
    'QR': 'Qatar Airways',
    'EY': 'Etihad Airways',
    'TK': 'Turkish Airlines',
    'LY': 'El Al Israel Airlines',
    'GF': 'Gulf Air',
    'WY': 'Oman Air',
    'SV': 'Saudia',
    'MS': 'EgyptAir',
    'RJ': 'Royal Jordanian',
    'ME': 'Middle East Airlines',
    'PC': 'Pegasus Airlines',

    // ─────────────────────────────────────────────────────────────────────────────
    // AFRICAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'ET': 'Ethiopian Airlines',
    'SA': 'South African Airways',
    'KQ': 'Kenya Airways',
    'AT': 'Royal Air Maroc',
    'WB': 'RwandAir',
    'HF': 'Air Côte d\'Ivoire',

    // ─────────────────────────────────────────────────────────────────────────────
    // ASIA-PACIFIC CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'CX': 'Cathay Pacific',
    'SQ': 'Singapore Airlines',
    'TG': 'Thai Airways',
    'JL': 'Japan Airlines',
    'NH': 'All Nippon Airways',
    'KE': 'Korean Air',
    'OZ': 'Asiana Airlines',
    'CI': 'China Airlines',
    'BR': 'EVA Air',
    'MH': 'Malaysia Airlines',
    'GA': 'Garuda Indonesia',
    'PR': 'Philippine Airlines',
    'VN': 'Vietnam Airlines',
    'AI': 'Air India',
    '6E': 'IndiGo',
    'UK': 'Vistara',
    'SG': 'SpiceJet',
    'AK': 'AirAsia',
    'FD': 'Thai AirAsia',
    'QZ': 'Indonesia AirAsia',
    'D7': 'AirAsia X',
    'TR': 'Scoot',
    'SL': 'Thai Lion Air',
    'QG': 'Citilink',
    'Z2': 'Philippines AirAsia',
    '5J': 'Cebu Pacific',

    // ─────────────────────────────────────────────────────────────────────────────
    // OCEANIA CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'QF': 'Qantas',
    'VA': 'Virgin Australia',
    'NZ': 'Air New Zealand',
    'JQ': 'Jetstar',
    'FJ': 'Fiji Airways',

    // ─────────────────────────────────────────────────────────────────────────────
    // CANADIAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'AC': 'Air Canada',
    'WS': 'WestJet',
    'PD': 'Porter Airlines',
    'TS': 'Air Transat',
    'WG': 'Sunwing Airlines',

    // ─────────────────────────────────────────────────────────────────────────────
    // CHINESE CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'CA': 'Air China',
    'MU': 'China Eastern',
    'CZ': 'China Southern',
    'HU': 'Hainan Airlines',
    '3U': 'Sichuan Airlines',
    'MF': 'Xiamen Airlines',
    'ZH': 'Shenzhen Airlines',
    'FM': 'Shanghai Airlines',
    'SC': 'Shandong Airlines',
    'GS': 'Tianjin Airlines',
    'PN': 'West Air',
    '9C': 'Spring Airlines',
    'HO': 'Juneyao Airlines',

    // ─────────────────────────────────────────────────────────────────────────────
    // RUSSIAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'S7': 'S7 Airlines',
    'UT': 'UTair',
    'U6': 'Ural Airlines',
    'N4': 'Nordwind Airlines',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ALIASES → CÓDIGO IATA
// Todas las variaciones de nombres que un usuario podría escribir
// ═══════════════════════════════════════════════════════════════════════════════
export const AIRLINE_ALIASES: Record<string, string> = {
    // ─────────────────────────────────────────────────────────────────────────────
    // LATAM GROUP
    // ─────────────────────────────────────────────────────────────────────────────
    'latam': 'LA',
    'latam airlines': 'LA',
    'latam airlines group': 'LA',
    'lan': 'LA',
    'lan chile': 'LA',
    'lanchile': 'LA',
    // LATAM Brasil
    'tam': 'JJ',
    'tam airlines': 'JJ',
    'latam brasil': 'JJ',
    'latam brazil': 'JJ',
    'latam airlines brasil': 'JJ',
    // LATAM Perú
    'latam peru': 'LP',
    'latam perú': 'LP',
    'latam airlines peru': 'LP',
    'latam airlines perú': 'LP',
    'lan peru': 'LP',
    'lan perú': 'LP',
    // LATAM Ecuador
    'latam ecuador': 'XL',
    'latam airlines ecuador': 'XL',
    'lan ecuador': 'XL',
    // LATAM Colombia
    'latam colombia': '4C',
    'latam airlines colombia': '4C',
    'lan colombia': '4C',
    // LATAM Argentina
    'latam argentina': '4M',
    'latam airlines argentina': '4M',
    'lan argentina': '4M',

    // ─────────────────────────────────────────────────────────────────────────────
    // AVIANCA GROUP
    // ─────────────────────────────────────────────────────────────────────────────
    'avianca': 'AV',
    'avianca holdings': 'AV',
    'avianca el salvador': 'AV',
    'avianca guatemala': 'AV',
    'avianca honduras': 'AV',
    // Avianca Ecuador
    'avianca ecuador': '2K',
    // Avianca Costa Rica
    'avianca costa rica': 'LR',
    'lacsa': 'LR',
    // TACA
    'taca': 'TA',
    'taca airlines': 'TA',
    'taca peru': 'TA',

    // ─────────────────────────────────────────────────────────────────────────────
    // IBERIA GROUP (IAG)
    // ─────────────────────────────────────────────────────────────────────────────
    'iberia': 'IB',
    'iberia lineas aereas': 'IB',
    'iberia líneas aéreas': 'IB',
    // Level opera con código IB
    'level': 'IB',
    'level iberia': 'IB',
    'level spain': 'IB',
    // Iberia Express
    'iberia express': 'I2',
    'ib express': 'I2',
    // Vueling
    'vueling': 'VY',
    'vueling airlines': 'VY',

    // ─────────────────────────────────────────────────────────────────────────────
    // US CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'american airlines': 'AA',
    'american': 'AA',
    'american eagle': 'AA',
    'aa': 'AA',
    // United
    'united airlines': 'UA',
    'united': 'UA',
    // Delta
    'delta': 'DL',
    'delta air lines': 'DL',
    'delta airlines': 'DL',
    // Southwest
    'southwest': 'WN',
    'southwest airlines': 'WN',
    // JetBlue
    'jetblue': 'B6',
    'jetblue airways': 'B6',
    'jet blue': 'B6',
    // Alaska
    'alaska': 'AS',
    'alaska airlines': 'AS',
    // Spirit
    'spirit': 'NK',
    'spirit airlines': 'NK',
    // Frontier
    'frontier': 'F9',
    'frontier airlines': 'F9',

    // ─────────────────────────────────────────────────────────────────────────────
    // EUROPEAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'air france': 'AF',
    'airfrance': 'AF',
    // KLM
    'klm': 'KL',
    'klm royal dutch': 'KL',
    'klm royal dutch airlines': 'KL',
    // Lufthansa
    'lufthansa': 'LH',
    'lufthansa german airlines': 'LH',
    'lufthansa cityline': 'CL',
    'cityline': 'CL',
    // British Airways
    'british airways': 'BA',
    'british': 'BA',
    'ba': 'BA',
    // ITA Airways (ex-Alitalia)
    'alitalia': 'AZ',
    'ita airways': 'AZ',
    'ita': 'AZ',
    // Swiss
    'swiss': 'LX',
    'swiss air': 'LX',
    'swiss international': 'LX',
    'swiss international air lines': 'LX',
    // Austrian
    'austrian': 'OS',
    'austrian airlines': 'OS',
    // TAP Portugal
    'tap air portugal': 'TP',
    'tap portugal': 'TP',
    'tap': 'TP',
    // Ryanair
    'ryanair': 'FR',
    'ryan air': 'FR',
    // easyJet
    'easyjet': 'U2',
    'easy jet': 'U2',
    // Wizz Air
    'wizz air': 'W6',
    'wizzair': 'W6',
    'wizz': 'W6',
    // Brussels
    'brussels airlines': 'SN',
    'brussels': 'SN',
    // Air Europa
    'air europa': 'UX',
    'aireuropa': 'UX',
    // Aeroflot
    'aeroflot': 'SU',
    'aeroflot russian': 'SU',
    // SAS
    'sas': 'SK',
    'scandinavian': 'SK',
    'scandinavian airlines': 'SK',
    // Finnair
    'finnair': 'AY',
    // LOT
    'lot': 'LO',
    'lot polish': 'LO',
    'lot polish airlines': 'LO',
    // Others
    'aegean': 'A3',
    'aegean airlines': 'A3',
    'aer lingus': 'EI',
    'aerlingus': 'EI',
    'air baltic': 'BT',
    'airbaltic': 'BT',
    // Charter / Regional
    'helvetic': '2L',
    'helvetic airways': '2L',
    'edelweiss': 'WK',
    'edelweiss air': 'WK',
    'wamos': 'EB',
    'wamos air': 'EB',
    'world2fly': '2W',
    'world 2 fly': '2W',
    'binter': 'NT',
    'binter canarias': 'NT',
    'air nostrum': 'YW',
    'volotea': 'V7',

    // ─────────────────────────────────────────────────────────────────────────────
    // SOUTH AMERICAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'aerolineas argentinas': 'AR',
    'aerolíneas argentinas': 'AR',
    'aerolineas': 'AR',
    'aerolíneas': 'AR',
    // Gol
    'gol': 'G3',
    'gol linhas': 'G3',
    'gol linhas aereas': 'G3',
    'gol transportes': 'G3',
    // Azul
    'azul': 'AD',
    'azul brazilian': 'AD',
    'azul airlines': 'AD',
    'azul brazilian airlines': 'AD',
    // Copa
    'copa': 'CM',
    'copa airlines': 'CM',
    // Aeroméxico
    'aeromexico': 'AM',
    'aeroméxico': 'AM',
    'aeromex': 'AM',
    'aeromexico connect': '5D',
    // Sky Airline (Chile)
    'sky': 'H2',
    'sky airline': 'H2',
    'sky airlines': 'H2',
    'sky chile': 'H2',
    // Boliviana de Aviación
    'boa': 'OB',
    'boliviana': 'OB',
    'boliviana de aviacion': 'OB',
    'boliviana de aviación': 'OB',
    // JetSMART
    'jetsmart': 'JA',
    'jet smart': 'JA',
    // Wingo
    'wingo': 'P5',
    // Arajet
    'arajet': 'DM',

    // ─────────────────────────────────────────────────────────────────────────────
    // MIDDLE EAST CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'emirates': 'EK',
    'fly emirates': 'EK',
    // Qatar
    'qatar': 'QR',
    'qatar airways': 'QR',
    // Etihad
    'etihad': 'EY',
    'etihad airways': 'EY',
    // Turkish
    'turkish': 'TK',
    'turkish airlines': 'TK',
    'thy': 'TK',
    'turk hava yollari': 'TK',
    // El Al
    'el al': 'LY',
    'elal': 'LY',
    'el al israel': 'LY',
    // Saudia
    'saudia': 'SV',
    'saudi arabian': 'SV',
    'saudi arabian airlines': 'SV',
    // EgyptAir
    'egyptair': 'MS',
    'egypt air': 'MS',
    // Royal Jordanian
    'royal jordanian': 'RJ',
    // Pegasus
    'pegasus': 'PC',
    'pegasus airlines': 'PC',

    // ─────────────────────────────────────────────────────────────────────────────
    // AFRICAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'ethiopian': 'ET',
    'ethiopian airlines': 'ET',
    // South African
    'south african': 'SA',
    'south african airways': 'SA',
    'saa': 'SA',
    // Kenya Airways
    'kenya airways': 'KQ',
    // Royal Air Maroc
    'royal air maroc': 'AT',
    'ram': 'AT',

    // ─────────────────────────────────────────────────────────────────────────────
    // ASIA-PACIFIC CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'cathay pacific': 'CX',
    'cathay': 'CX',
    // Singapore Airlines
    'singapore airlines': 'SQ',
    'singapore': 'SQ',
    'sq': 'SQ',
    // Thai Airways
    'thai airways': 'TG',
    'thai': 'TG',
    // Japan Airlines
    'japan airlines': 'JL',
    'jal': 'JL',
    // ANA
    'ana': 'NH',
    'all nippon': 'NH',
    'all nippon airways': 'NH',
    // Korean Air
    'korean air': 'KE',
    'korean': 'KE',
    // Asiana
    'asiana': 'OZ',
    'asiana airlines': 'OZ',
    // China Airlines
    'china airlines': 'CI',
    // EVA Air
    'eva air': 'BR',
    'eva': 'BR',
    // Malaysia Airlines
    'malaysia airlines': 'MH',
    'malaysia': 'MH',
    'mas': 'MH',
    // Garuda
    'garuda': 'GA',
    'garuda indonesia': 'GA',
    // Philippine Airlines
    'philippine airlines': 'PR',
    'philippine': 'PR',
    'pal': 'PR',
    // Vietnam Airlines
    'vietnam airlines': 'VN',
    'vietnam': 'VN',
    // Air India
    'air india': 'AI',
    // IndiGo
    'indigo': '6E',
    // AirAsia
    'airasia': 'AK',
    'air asia': 'AK',
    'airasia x': 'D7',
    // Scoot
    'scoot': 'TR',
    // Cebu Pacific
    'cebu pacific': '5J',
    'cebu': '5J',

    // ─────────────────────────────────────────────────────────────────────────────
    // OCEANIA CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'qantas': 'QF',
    // Virgin Australia
    'virgin australia': 'VA',
    // Air New Zealand
    'air new zealand': 'NZ',
    'air nz': 'NZ',
    // Jetstar
    'jetstar': 'JQ',
    // Fiji Airways
    'fiji airways': 'FJ',
    'fiji': 'FJ',

    // ─────────────────────────────────────────────────────────────────────────────
    // CANADIAN CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'air canada': 'AC',
    'air canada rouge': 'AC',
    'ac rouge': 'AC',
    // WestJet
    'westjet': 'WS',
    'west jet': 'WS',
    // Porter
    'porter': 'PD',
    'porter airlines': 'PD',
    // Air Transat
    'air transat': 'TS',
    'transat': 'TS',

    // ─────────────────────────────────────────────────────────────────────────────
    // CHINESE CARRIERS
    // ─────────────────────────────────────────────────────────────────────────────
    'air china': 'CA',
    // China Eastern
    'china eastern': 'MU',
    'china eastern airlines': 'MU',
    // China Southern
    'china southern': 'CZ',
    'china southern airlines': 'CZ',
    // Hainan
    'hainan': 'HU',
    'hainan airlines': 'HU',
    // Xiamen
    'xiamen': 'MF',
    'xiamen airlines': 'MF',
    // Spring Airlines
    'spring airlines': '9C',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PATRONES DE DETECCIÓN
// Lista de nombres para búsqueda con patrones contextuales
// ═══════════════════════════════════════════════════════════════════════════════
export const AIRLINE_DETECTION_PATTERNS: string[] = Object.keys(AIRLINE_ALIASES);

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * detectAirlineInText - Detecta aerolíneas en el texto del usuario
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Busca menciones de aerolíneas usando múltiples estrategias:
 * 1. Patrones contextuales: "con [airline]", "en [airline]", etc.
 * 2. Búsqueda directa de nombres en el mapeo
 * 
 * @param text - Texto del usuario a analizar
 * @returns Objeto con código IATA y nombre si encuentra, null si no
 * 
 * @example
 * detectAirlineInText("quiero volar con latam a madrid")
 * // Returns: { code: 'LA', name: 'latam', confidence: 'high' }
 * 
 * @example
 * detectAirlineInText("vuelo a madrid el viernes")
 * // Returns: null
 */
export function detectAirlineInText(text: string): {
    code: string;
    name: string;
    confidence: 'high' | 'medium' | 'low';
} | null {
    const normalizedText = text.toLowerCase().trim();

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTRATEGIA 1: Patrones contextuales (alta confianza)
    // Detecta: "con iberia", "en latam", "vuelo american", etc.
    // ═══════════════════════════════════════════════════════════════════════════

    // Ordenar aliases por longitud descendente (preferir matches más largos)
    const sortedAliases = Object.keys(AIRLINE_ALIASES).sort((a, b) => b.length - a.length);

    for (const alias of sortedAliases) {
        // Patrones de alta confianza
        const highConfidencePatterns = [
            new RegExp(`\\b(?:con|de|en|vuelo|prefiero|quiero|operado por|volando)\\s+${escapeRegex(alias)}\\b`, 'i'),
            new RegExp(`\\b${escapeRegex(alias)}\\s+(?:a|hacia|para|desde|business|economy|primera)\\b`, 'i'),
            new RegExp(`\\baerolinea\\s+${escapeRegex(alias)}\\b`, 'i'),
            new RegExp(`\\baeroli[ńn]ea\\s+${escapeRegex(alias)}\\b`, 'i'),
        ];

        for (const pattern of highConfidencePatterns) {
            if (pattern.test(normalizedText)) {
                return {
                    code: AIRLINE_ALIASES[alias],
                    name: alias,
                    confidence: 'high'
                };
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTRATEGIA 2: Búsqueda directa (confianza media)
    // Detecta nombres de aerolínea mencionados directamente
    // ═══════════════════════════════════════════════════════════════════════════

    for (const alias of sortedAliases) {
        // Solo si el alias tiene más de 3 caracteres (evitar falsos positivos)
        if (alias.length > 3) {
            const directPattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
            if (directPattern.test(normalizedText)) {
                return {
                    code: AIRLINE_ALIASES[alias],
                    name: alias,
                    confidence: 'medium'
                };
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTRATEGIA 3: Patrón flexible (confianza baja)
    // Captura aerolíneas después de "aerolinea/airline"
    // ═══════════════════════════════════════════════════════════════════════════

    const flexibleMatch = normalizedText.match(
        /\b(?:aerolinea|aerolínea|airline|con\s+la\s+aerolinea|con\s+la\s+aerolínea)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/i
    );

    if (flexibleMatch && flexibleMatch[1]) {
        let capturedAirline = flexibleMatch[1].trim().toLowerCase();

        // Limpiar palabras irrelevantes al final
        const stopWords = ['a', 'hacia', 'para', 'desde', 'saliendo', 'directo', 'business', 'economy'];
        const words = capturedAirline.split(/\s+/);
        const stopIndex = words.findIndex(w => stopWords.includes(w));
        if (stopIndex !== -1) {
            capturedAirline = words.slice(0, stopIndex).join(' ');
        }

        // Buscar en aliases
        if (capturedAirline.length > 2 && AIRLINE_ALIASES[capturedAirline]) {
            return {
                code: AIRLINE_ALIASES[capturedAirline],
                name: capturedAirline,
                confidence: 'low'
            };
        }
    }

    return null;
}

/**
 * Escapa caracteres especiales de regex
 */
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Obtiene el código IATA de un nombre de aerolínea
 * @param name - Nombre de la aerolínea (cualquier variación)
 * @returns Código IATA o null si no se encuentra
 */
export function getAirlineCode(name: string): string | null {
    const normalized = name.toLowerCase().trim();
    return AIRLINE_ALIASES[normalized] || null;
}

/**
 * Obtiene el nombre oficial de una aerolínea por su código IATA
 * @param code - Código IATA (2 caracteres)
 * @returns Nombre oficial o el código si no se encuentra
 */
export function getAirlineName(code: string): string {
    return AIRLINE_IATA_CODES[code.toUpperCase()] || code;
}

/**
 * Verifica si un código IATA es válido
 * @param code - Código a verificar
 * @returns true si es un código IATA conocido
 */
export function isValidAirlineCode(code: string): boolean {
    return code.toUpperCase() in AIRLINE_IATA_CODES;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS DEL ARCHIVO
// ═══════════════════════════════════════════════════════════════════════════════
export const AIRLINE_STATS = {
    totalCodes: Object.keys(AIRLINE_IATA_CODES).length,
    totalAliases: Object.keys(AIRLINE_ALIASES).length,
    lastUpdated: '2025-11-25'
};
































