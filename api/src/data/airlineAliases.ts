/**
 * Airline IATA Codes and Aliases
 *
 * Minimal version for API search - contains essential airlines for filtering
 * Full version with aliases is in: src/features/chat/data/airlineAliases.ts
 */

export interface AirlineInfo {
  code: string;
  name: string;
  aliases?: string[];
}

/**
 * Essential airlines for search filtering
 */
export const AIRLINES: Record<string, AirlineInfo> = {
  // === LATAM Group ===
  LA: { code: 'LA', name: 'LATAM Airlines', aliases: ['latam'] },
  JJ: { code: 'JJ', name: 'LATAM Brasil' },
  LP: { code: 'LP', name: 'LATAM Peru' },
  XL: { code: 'XL', name: 'LATAM Ecuador' },
  '4M': { code: '4M', name: 'LATAM Argentina' },

  // === Avianca Group ===
  AV: { code: 'AV', name: 'Avianca', aliases: ['avianca'] },
  '2K': { code: '2K', name: 'Avianca Ecuador' },

  // === Aerolineas Argentinas Group ===
  AR: { code: 'AR', name: 'Aerolineas Argentinas', aliases: ['aerolineas', 'aerolineas argentinas'] },

  // === Copa Airlines ===
  CM: { code: 'CM', name: 'Copa Airlines', aliases: ['copa'] },

  // === Aeromexico ===
  AM: { code: 'AM', name: 'Aeromexico', aliases: ['aeromexico'] },

  // === JetSMART ===
  JA: { code: 'JA', name: 'JetSMART', aliases: ['jetsmart'] },

  // === Sky Airline ===
  H2: { code: 'H2', name: 'Sky Airline', aliases: ['sky airline', 'sky'] },

  // === Iberia Group (IAG) ===
  IB: { code: 'IB', name: 'Iberia', aliases: ['iberia'] },
  I2: { code: 'I2', name: 'Iberia Express' },

  // === American Airlines ===
  AA: { code: 'AA', name: 'American Airlines', aliases: ['american'] },

  // === Delta ===
  DL: { code: 'DL', name: 'Delta Air Lines', aliases: ['delta'] },

  // === United ===
  UA: { code: 'UA', name: 'United Airlines', aliases: ['united'] },

  // === Air France ===
  AF: { code: 'AF', name: 'Air France', aliases: ['air france'] },

  // === KLM ===
  KL: { code: 'KL', name: 'KLM Royal Dutch Airlines', aliases: ['klm'] },

  // === Lufthansa ===
  LH: { code: 'LH', name: 'Lufthansa', aliases: ['lufthansa'] },

  // === Air Europa ===
  UX: { code: 'UX', name: 'Air Europa', aliases: ['air europa'] },

  // === Turkish Airlines ===
  TK: { code: 'TK', name: 'Turkish Airlines', aliases: ['turkish'] },

  // === Emirates ===
  EK: { code: 'EK', name: 'Emirates', aliases: ['emirates'] },

  // === Qatar Airways ===
  QR: { code: 'QR', name: 'Qatar Airways', aliases: ['qatar'] },

  // === British Airways ===
  BA: { code: 'BA', name: 'British Airways', aliases: ['british airways'] },

  // === Air Canada ===
  AC: { code: 'AC', name: 'Air Canada', aliases: ['air canada'] },

  // === Gol ===
  G3: { code: 'G3', name: 'Gol Linhas Aereas', aliases: ['gol'] },

  // === Azul ===
  AD: { code: 'AD', name: 'Azul Brazilian Airlines', aliases: ['azul'] },

  // === Viva Air ===
  VH: { code: 'VH', name: 'Viva Air', aliases: ['viva', 'viva air'] },

  // === Wingo ===
  P5: { code: 'P5', name: 'Wingo', aliases: ['wingo'] },

  // === Spirit ===
  NK: { code: 'NK', name: 'Spirit Airlines', aliases: ['spirit'] },

  // === JetBlue ===
  B6: { code: 'B6', name: 'JetBlue Airways', aliases: ['jetblue'] },

  // === Southwest ===
  WN: { code: 'WN', name: 'Southwest Airlines', aliases: ['southwest'] },

  // === Frontier ===
  F9: { code: 'F9', name: 'Frontier Airlines', aliases: ['frontier'] },

  // === Volaris ===
  Y4: { code: 'Y4', name: 'Volaris', aliases: ['volaris'] },

  // === VivaAerobus ===
  VB: { code: 'VB', name: 'VivaAerobus', aliases: ['vivaaerobus'] },

  // === Interjet (historical) ===
  '4O': { code: '4O', name: 'Interjet', aliases: ['interjet'] },

  // === Plus Ultra ===
  PU: { code: 'PU', name: 'Plus Ultra', aliases: ['plus ultra'] },

  // === Air China ===
  CA: { code: 'CA', name: 'Air China', aliases: ['air china'] },

  // === Singapore Airlines ===
  SQ: { code: 'SQ', name: 'Singapore Airlines', aliases: ['singapore'] },

  // === Cathay Pacific ===
  CX: { code: 'CX', name: 'Cathay Pacific', aliases: ['cathay'] },

  // === Japan Airlines ===
  JL: { code: 'JL', name: 'Japan Airlines', aliases: ['jal', 'japan airlines'] },

  // === ANA ===
  NH: { code: 'NH', name: 'All Nippon Airways', aliases: ['ana'] },

  // === Korean Air ===
  KE: { code: 'KE', name: 'Korean Air', aliases: ['korean'] },

  // === Etihad ===
  EY: { code: 'EY', name: 'Etihad Airways', aliases: ['etihad'] },

  // === Swiss ===
  LX: { code: 'LX', name: 'Swiss International Air Lines', aliases: ['swiss'] },

  // === Austrian ===
  OS: { code: 'OS', name: 'Austrian Airlines', aliases: ['austrian'] },

  // === TAP Portugal ===
  TP: { code: 'TP', name: 'TAP Air Portugal', aliases: ['tap', 'tap portugal'] },

  // === Alitalia (historical) ===
  AZ: { code: 'AZ', name: 'Alitalia', aliases: ['alitalia'] },

  // === ITA Airways ===
  AZ2: { code: 'AZ', name: 'ITA Airways', aliases: ['ita', 'ita airways'] }
};

/**
 * Light fare airlines (typically no checked baggage)
 * Used for filtering flights with luggage requirements
 */
export const LIGHT_FARE_AIRLINES = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];

/**
 * Get airline info by IATA code
 */
export function getAirlineByCode(code: string): AirlineInfo | undefined {
  return AIRLINES[code.toUpperCase()];
}

/**
 * Get airline name by IATA code
 */
export function getAirlineName(code: string): string {
  const airline = getAirlineByCode(code);
  return airline ? airline.name : code;
}

/**
 * Check if airline is a light fare carrier
 */
export function isLightFareAirline(code: string): boolean {
  return LIGHT_FARE_AIRLINES.includes(code.toUpperCase());
}

/**
 * Find airline code by name or alias
 */
export function findAirlineCode(query: string): string | undefined {
  const normalizedQuery = query.toLowerCase().trim();

  for (const [code, info] of Object.entries(AIRLINES)) {
    // Check exact code match
    if (code.toLowerCase() === normalizedQuery) {
      return code;
    }

    // Check name match
    if (info.name.toLowerCase().includes(normalizedQuery)) {
      return code;
    }

    // Check aliases
    if (info.aliases?.some(alias => alias.toLowerCase().includes(normalizedQuery))) {
      return code;
    }
  }

  return undefined;
}
