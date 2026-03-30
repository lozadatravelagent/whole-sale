function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,()]/g, ' ')
    .replace(/\s+/g, ' ');
}

const COUNTRY_TO_CAPITAL: Record<string, string> = {
  argentina: 'Buenos Aires',
  brasil: 'Brasilia',
  brazil: 'Brasilia',
  chile: 'Santiago',
  colombia: 'Bogota',
  peru: 'Lima',
  uruguay: 'Montevideo',
  paraguay: 'Asuncion',
  ecuador: 'Quito',
  bolivia: 'La Paz',
  mexico: 'Mexico City',
  'estados unidos': 'Washington',
  eeuu: 'Washington',
  'ee uu': 'Washington',
  usa: 'Washington',
  'u s a': 'Washington',
  'united states': 'Washington',
  canada: 'Ottawa',
  cuba: 'Havana',
  jamaica: 'Kingston',
  panama: 'Panama City',
  'costa rica': 'San Jose',
  'republica dominicana': 'Santo Domingo',
  'dominican republic': 'Santo Domingo',
  'puerto rico': 'San Juan',
  espana: 'Madrid',
  spain: 'Madrid',
  francia: 'Paris',
  france: 'Paris',
  italia: 'Rome',
  italy: 'Rome',
  alemania: 'Berlin',
  germany: 'Berlin',
  portugal: 'Lisbon',
  'reino unido': 'London',
  'united kingdom': 'London',
  uk: 'London',
  inglaterra: 'London',
  netherlands: 'Amsterdam',
  'paises bajos': 'Amsterdam',
  'paises bajos reino de los paises bajos': 'Amsterdam',
  holland: 'Amsterdam',
  holanda: 'Amsterdam',
  belgica: 'Brussels',
  belgium: 'Brussels',
  austria: 'Vienna',
  suiza: 'Bern',
  switzerland: 'Bern',
  grecia: 'Athens',
  greece: 'Athens',
  turquia: 'Ankara',
  turkey: 'Ankara',
  irlanda: 'Dublin',
  ireland: 'Dublin',
  dinamarca: 'Copenhagen',
  denmark: 'Copenhagen',
  noruega: 'Oslo',
  norway: 'Oslo',
  suecia: 'Stockholm',
  sweden: 'Stockholm',
  finlandia: 'Helsinki',
  finland: 'Helsinki',
  polonia: 'Warsaw',
  poland: 'Warsaw',
  hungria: 'Budapest',
  hungary: 'Budapest',
  'republica checa': 'Prague',
  chequia: 'Prague',
  'czech republic': 'Prague',
  czechia: 'Prague',
  rumania: 'Bucharest',
  romania: 'Bucharest',
  bulgaria: 'Sofia',
  croacia: 'Zagreb',
  croatia: 'Zagreb',
  eslovenia: 'Ljubljana',
  slovenia: 'Ljubljana',
  estonia: 'Tallinn',
  letonia: 'Riga',
  latvia: 'Riga',
  lituania: 'Vilnius',
  lithuania: 'Vilnius',
  islandia: 'Reykjavik',
  iceland: 'Reykjavik',
  marruecos: 'Rabat',
  morocco: 'Rabat',
  egipto: 'Cairo',
  egypt: 'Cairo',
  'emiratos arabes unidos': 'Abu Dhabi',
  'united arab emirates': 'Abu Dhabi',
  uae: 'Abu Dhabi',
  qatar: 'Doha',
  israel: 'Jerusalem',
  japon: 'Tokyo',
  japan: 'Tokyo',
  china: 'Beijing',
  'corea del sur': 'Seoul',
  'south korea': 'Seoul',
  tailandia: 'Bangkok',
  thailand: 'Bangkok',
  vietnam: 'Hanoi',
  india: 'New Delhi',
  singapur: 'Singapore',
  singapore: 'Singapore',
  indonesia: 'Jakarta',
  philippines: 'Manila',
  filipinas: 'Manila',
  australia: 'Canberra',
  'nueva zelanda': 'Wellington',
  'new zealand': 'Wellington',
};

// Reverse map: capital (normalized) → country display names that map to it
const CAPITAL_TO_COUNTRIES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [country, capital] of Object.entries(COUNTRY_TO_CAPITAL)) {
    const normCapital = normalizeText(capital);
    if (!map[normCapital]) map[normCapital] = [];
    map[normCapital].push(country);
  }
  return map;
})();

// Display names for accented countries (guardrail restoration)
const COUNTRY_DISPLAY: Record<string, string> = {
  espana: 'España', spain: 'España',
  italia: 'Italia', italy: 'Italia',
  japon: 'Japón', japan: 'Japón',
  francia: 'Francia', france: 'Francia',
  grecia: 'Grecia', greece: 'Grecia',
  alemania: 'Alemania', germany: 'Alemania',
  portugal: 'Portugal', brasil: 'Brasil', brazil: 'Brasil',
  peru: 'Perú', belgica: 'Bélgica', panama: 'Panamá',
  turquia: 'Turquía', turkey: 'Turquía',
  'republica dominicana': 'República Dominicana',
  'costa rica': 'Costa Rica',
  'nueva zelanda': 'Nueva Zelanda',
  'estados unidos': 'Estados Unidos',
  'reino unido': 'Reino Unido',
};

/**
 * Given a capital city and a normalized message, check if the user
 * mentioned a country that maps to this capital. Returns the country
 * display name if found, null otherwise.
 */
export function findCountryInMessageForCapital(
  capital: string,
  normalizedMessage: string,
): string | null {
  const normCapital = normalizeText(capital);
  const countries = CAPITAL_TO_COUNTRIES[normCapital];
  if (!countries) return null;

  for (const countryKey of countries) {
    if (normalizedMessage.includes(countryKey)) {
      return COUNTRY_DISPLAY[countryKey]
        || countryKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

export function resolveCountryToCapital(value: string | undefined | null): string | null {
  if (!value) return null;
  return COUNTRY_TO_CAPITAL[normalizeText(value)] ?? null;
}

export function normalizeDestinationToCapitalIfCountry(value: string | undefined | null): string {
  if (!value) return '';
  return resolveCountryToCapital(value) ?? value.trim();
}

export function normalizeDestinationListToCapitals(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeDestinationToCapitalIfCountry(value))
    .filter(Boolean);
}
