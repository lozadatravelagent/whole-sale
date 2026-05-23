import type { ParsedTravelRequest, UserLanguage } from '@/services/aiMessageParser';
import { SEARCH_START_OFFSET_DAYS, SEARCH_STAY_NIGHTS } from '@/services/searchDefaults';
import type { ContextState } from '@/features/chat/types/contextState';
import type { EmiliaState, PendingAction } from '@/features/chat/state/emiliaState';
import type { ChatSuggestedAction } from '@/features/chat/types/chat';

type MissingDecision = 'destination' | 'passengers' | 'dates' | 'product' | 'budget' | 'origin';
type IntentAction = 'execute' | 'guide_with_chips' | 'ask_minimal' | 'ignore';

interface IntentSearchSeeds {
  destination?: string | null;
  destinationKind?: 'city' | 'region' | 'country' | 'vibe' | null;
  dateWindow?: {
    kind: 'exact' | 'month' | 'default' | 'missing';
    month?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  agencyLanguageSignals?: string[];
  softPreferences?: string[];
  missingDecision?: MissingDecision[];
  travelerType?: 'solo' | 'couple' | 'family' | 'group' | null;
  budgetHint?: 'budget' | 'mid' | 'premium' | 'luxury' | null;
  occasionHint?: 'anniversary' | 'honeymoon' | 'birthday' | 'business' | 'leisure' | null;
  productsImplied?: Array<'flight' | 'hotel' | 'transfer'>;
  adults?: number | null;
  children?: number | null;
}

export interface IntentElicitationDefaults {
  now?: Date;
  defaultOrigin?: string | null;
  defaultAdults?: number;
  startOffsetDays?: number;
  stayNights?: number;
}

export interface IntentElicitationResult {
  action: IntentAction;
  explicitIntent: string;
  known: string[];
  missingDecision: MissingDecision[];
  probableNextIntents: string[];
  executableRequest?: ParsedTravelRequest;
  message?: string;
  chips: ChatSuggestedAction[];
  pendingAction?: PendingAction;
  confidence: number;
  rationale: string;
}

interface ResolveOptions {
  contextState?: ContextState | null;
  emiliaState?: EmiliaState | null;
  defaults?: IntentElicitationDefaults;
  language: UserLanguage;
}

const REGION_DESTINATION_CHIPS: Record<string, string[]> = {
  caribe: ['Cancún', 'Punta Cana', 'Aruba'],
  caribbean: ['Cancún', 'Punta Cana', 'Aruba'],
  playa: ['Cancún', 'Punta Cana', 'Aruba'],
  beach: ['Cancún', 'Punta Cana', 'Aruba'],
  brasil: ['Río de Janeiro', 'Búzios', 'Florianópolis'],
  brazil: ['Río de Janeiro', 'Búzios', 'Florianópolis'],
  europa: ['Madrid', 'Roma', 'París'],
  europe: ['Madrid', 'Roma', 'París'],
};

function addDaysIso(base: Date, days: number): string {
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function getSeeds(parsed: ParsedTravelRequest): IntentSearchSeeds | null {
  return (parsed.searchSeeds ?? null) as IntentSearchSeeds | null;
}

function hasStructuredSearch(parsed: ParsedTravelRequest): boolean {
  return Boolean(parsed.flights || parsed.hotels || parsed.services || parsed.transfers);
}

function isAgencyCommercial(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null): boolean {
  const commercial = parsed.commercialIntent;
  if (commercial?.kind === 'trip_planning') return false;
  if (commercial?.agencyContext === true && (commercial.confidence ?? 0) >= 0.55) return true;
  if ((seeds?.agencyLanguageSignals?.length ?? 0) > 0) return true;
  return false;
}

function isPlannerOrDiscovery(parsed: ParsedTravelRequest): boolean {
  if (parsed.placeDiscoveryResult?.ok) return true;
  if (parsed.requestType === 'itinerary' && parsed.commercialIntent?.kind !== 'package_search') return true;
  if (parsed.planIntent === true && parsed.quoteIntent !== true) return true;
  return false;
}

function hasPassengerSignal(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null): boolean {
  const adults = parsed.flights?.adults ?? parsed.hotels?.adults ?? seeds?.adults;
  return Boolean((typeof adults === 'number' && adults > 0) || seeds?.travelerType);
}

function hasDateSignal(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null): boolean {
  return Boolean(
    parsed.flights?.departureDate ||
    parsed.hotels?.checkinDate ||
    parsed.itinerary?.startDate ||
    (seeds?.dateWindow && seeds.dateWindow.kind !== 'missing'),
  );
}

function hasDestinationSignal(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null): boolean {
  return Boolean(
    parsed.flights?.destination ||
    parsed.hotels?.city ||
    parsed.services?.city ||
    seeds?.destination,
  );
}

function hasProductSignal(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null): boolean {
  return (
    parsed.requestType === 'flights' ||
    parsed.requestType === 'hotels' ||
    parsed.requestType === 'combined' ||
    parsed.requestType === 'services' ||
    Boolean(seeds?.productsImplied?.length)
  );
}

function collectKnown(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null): string[] {
  const known: string[] = [];
  if (isAgencyCommercial(parsed, seeds)) known.push('agency_context');
  const destination = parsed.flights?.destination ?? parsed.hotels?.city ?? seeds?.destination;
  if (destination) known.push(`${seeds?.destinationKind ?? 'destination'}:${destination}`);
  if (hasDateSignal(parsed, seeds)) known.push(`date:${seeds?.dateWindow?.kind ?? 'structured'}`);
  if (hasPassengerSignal(parsed, seeds)) known.push('passengers');
  if (hasProductSignal(parsed, seeds)) known.push(`product:${(seeds?.productsImplied ?? [parsed.requestType]).join('+')}`);
  if (seeds?.budgetHint) known.push(`budget:${seeds.budgetHint}`);
  for (const preference of seeds?.softPreferences ?? []) known.push(`preference:${preference}`);
  return known;
}

function deriveMissing(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null, defaultOrigin?: string | null): MissingDecision[] {
  const missing = new Set<MissingDecision>(seeds?.missingDecision ?? []);
  const destinationKind = seeds?.destinationKind;
  if (!hasDestinationSignal(parsed, seeds) || destinationKind === 'region' || destinationKind === 'country' || destinationKind === 'vibe') {
    missing.add('destination');
  }
  if (!hasPassengerSignal(parsed, seeds)) missing.add('passengers');
  if (!hasDateSignal(parsed, seeds)) missing.add('dates');
  if (!hasProductSignal(parsed, seeds)) missing.add('product');
  const products = new Set(seeds?.productsImplied ?? []);
  const destinationIsConcrete = destinationKind !== 'region' && destinationKind !== 'country' && destinationKind !== 'vibe';
  const needsOrigin = destinationIsConcrete && (parsed.requestType === 'flights' || parsed.requestType === 'combined' || products.has('flight'));
  if (needsOrigin && !parsed.flights?.origin && !defaultOrigin) missing.add('origin');
  return Array.from(missing);
}

function monthLabel(seeds: IntentSearchSeeds | null, language: UserLanguage): string {
  const month = seeds?.dateWindow?.month?.trim();
  if (month) return month;
  if (seeds?.dateWindow?.startDate && seeds?.dateWindow?.endDate) {
    return language === 'en'
      ? `from ${seeds.dateWindow.startDate} to ${seeds.dateWindow.endDate}`
      : language === 'pt'
        ? `de ${seeds.dateWindow.startDate} a ${seeds.dateWindow.endDate}`
        : `del ${seeds.dateWindow.startDate} al ${seeds.dateWindow.endDate}`;
  }
  if (language === 'en') return 'with tentative dates';
  if (language === 'pt') return 'com datas tentativas';
  return 'con fechas tentativas';
}

function baseRequestPhrase(destination: string, seeds: IntentSearchSeeds | null, adults: number, language: UserLanguage): string {
  const date = monthLabel(seeds, language);
  if (language === 'en') return `flight and hotel to ${destination} in ${date} for ${adults} adult${adults > 1 ? 's' : ''}`;
  if (language === 'pt') return `voo e hotel para ${destination} em ${date} para ${adults} adulto${adults > 1 ? 's' : ''}`;
  return `vuelo y hotel a ${destination} en ${date} para ${adults} adulto${adults > 1 ? 's' : ''}`;
}

function productForExpected(seeds: IntentSearchSeeds | null): ChatSuggestedAction['expectedProducts'] {
  const products = seeds?.productsImplied ?? ['flight', 'hotel'];
  return products.flatMap((product) => (product === 'hotel' ? ['hotel' as const] : product === 'flight' ? ['flight' as const] : ['transfer' as const]));
}

function makeChip(args: {
  id: string;
  label: string;
  prompt: string;
  priority: number;
  expectedRequestType?: ChatSuggestedAction['expectedRequestType'];
  expectedProducts?: ChatSuggestedAction['expectedProducts'];
  context?: ChatSuggestedAction['context'];
  reasonCodes?: string[];
}): ChatSuggestedAction {
  return {
    id: `intent-elicit-${args.id}`,
    label: args.label,
    prompt: args.prompt,
    type: 'quote',
    priority: args.priority,
    behavior: 'autocomplete',
    intent: 'intent_elicitation',
    template: args.prompt,
    context: args.context,
    editableFields: [],
    expectedRequestType: args.expectedRequestType ?? 'combined',
    expectedProducts: args.expectedProducts ?? ['flight', 'hotel'],
    reasonCodes: args.reasonCodes ?? ['intent_elicitation'],
  };
}

function destinationChoices(destination: string): string[] {
  const normalized = destination.toLowerCase();
  for (const [key, choices] of Object.entries(REGION_DESTINATION_CHIPS)) {
    if (normalized.includes(key)) return choices;
  }
  return ['Cancún', 'Punta Cana', 'Aruba'];
}

function buildGuidanceChips(parsed: ParsedTravelRequest, seeds: IntentSearchSeeds | null, missing: MissingDecision[], language: UserLanguage): ChatSuggestedAction[] {
  const chips: ChatSuggestedAction[] = [];
  const destination = (seeds?.destination ?? parsed.hotels?.city ?? parsed.flights?.destination ?? '').trim();
  const adults = seeds?.adults ?? (seeds?.travelerType === 'couple' ? 2 : 1);

  if (missing.includes('destination')) {
    const choices = destinationChoices(destination);
    choices.forEach((choice, index) => {
      chips.push(makeChip({
        id: `destination-${choice.toLowerCase().replace(/\s+/g, '-')}`,
        label: choice,
        prompt: baseRequestPhrase(choice, seeds, adults, language),
        priority: index + 1,
        expectedRequestType: 'combined',
        expectedProducts: ['flight', 'hotel'],
        context: { product: 'combined', destination: choice, passengers: { adults } },
        reasonCodes: ['choose_destination'],
      }));
    });
  }

  if (destination && missing.includes('product')) {
    chips.push(makeChip({
      id: 'only-hotel',
      label: language === 'en' ? 'Only hotel' : language === 'pt' ? 'Só hotel' : 'Solo hotel',
      prompt: language === 'en'
        ? `hotel in ${destination} ${monthLabel(seeds, language)} for ${adults} adult${adults > 1 ? 's' : ''}`
        : language === 'pt'
          ? `hotel em ${destination} ${monthLabel(seeds, language)} para ${adults} adulto${adults > 1 ? 's' : ''}`
          : `hotel en ${destination} ${monthLabel(seeds, language)} para ${adults} adulto${adults > 1 ? 's' : ''}`,
      priority: 2,
      expectedRequestType: 'hotels',
      expectedProducts: ['hotel'],
      context: { product: 'hotel', destination, passengers: { adults } },
      reasonCodes: ['choose_product'],
    }));
  }

  if (destination && (missing.includes('product') || !missing.includes('destination'))) {
    const productPrompt = baseRequestPhrase(destination, seeds, adults, language);
    chips.push(makeChip({
      id: 'flight-hotel',
      label: language === 'en' ? 'Flight + hotel' : language === 'pt' ? 'Voo + hotel' : 'Vuelo + hotel',
      prompt: productPrompt,
      priority: 3,
      expectedRequestType: 'combined',
      expectedProducts: ['flight', 'hotel'],
      context: { product: 'combined', destination, passengers: { adults } },
      reasonCodes: ['choose_product'],
    }));
  }

  if (destination && missing.includes('dates')) {
    chips.push(makeChip({
      id: 'default-dates',
      label: language === 'en' ? 'Use 7 nights' : language === 'pt' ? 'Usar 7 noites' : 'Usar 7 noches',
      prompt: baseRequestPhrase(destination, { ...seeds, dateWindow: { kind: 'default' } }, adults, language),
      priority: 4,
      expectedRequestType: parsed.requestType === 'hotels' ? 'hotels' : 'combined',
      expectedProducts: productForExpected(seeds),
      context: { destination, passengers: { adults } },
      reasonCodes: ['choose_dates'],
    }));
  }

  if (missing.includes('passengers')) {
    chips.push(makeChip({
      id: 'define-passengers',
      label: language === 'en' ? 'Define passengers' : language === 'pt' ? 'Definir passageiros' : 'Definir pasajeros',
      prompt: destination
        ? baseRequestPhrase(destination, seeds, 2, language)
        : language === 'en'
          ? 'flight and hotel to Cancún in July for 2 adults'
          : language === 'pt'
            ? 'voo e hotel para Cancún em julho para 2 adultos'
            : 'vuelo y hotel a Cancún en julio para 2 adultos',
      priority: 4,
      expectedRequestType: 'combined',
      expectedProducts: ['flight', 'hotel'],
      context: destination ? { product: 'combined', destination, passengers: { adults: 2 } } : undefined,
      reasonCodes: ['define_passengers'],
    }));
  }

  if (destination && !missing.includes('destination') && seeds?.budgetHint !== 'budget') {
    chips.push(makeChip({
      id: 'cheaper',
      label: language === 'en' ? 'More affordable' : language === 'pt' ? 'Mais econômico' : 'Ver más económico',
      prompt: `${baseRequestPhrase(destination, seeds, adults, language)} ${language === 'en' ? 'with good value' : language === 'pt' ? 'com bom custo-benefício' : 'con buena relación precio/calidad'}`,
      priority: 5,
      expectedRequestType: parsed.requestType === 'hotels' ? 'hotels' : 'combined',
      expectedProducts: productForExpected(seeds),
      context: { destination, passengers: { adults } },
      reasonCodes: ['budget_preference'],
    }));
  }

  return chips
    .filter((chip, index, list) => list.findIndex((candidate) => candidate.label === chip.label) === index)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
}

function buildMessage(seeds: IntentSearchSeeds | null, missing: MissingDecision[], language: UserLanguage): string {
  const destination = seeds?.destination?.trim();
  const date = monthLabel(seeds, language);
  if (language === 'en') {
    if (destination && missing.includes('destination')) {
      return `Perfect. I understand a beach search in ${destination} for ${date}. To turn it into a quote, we can start with a concrete destination.`;
    }
    return `Perfect. I understand the client request${destination ? ` for ${destination}` : ''}. I can turn it into a quote if we define the missing decision.`;
  }
  if (language === 'pt') {
    if (destination && missing.includes('destination')) {
      return `Perfeito. Entendo busca de praia em ${destination} para ${date}. Para levar para cotação, podemos começar por um destino concreto.`;
    }
    return `Perfeito. Entendo o pedido do cliente${destination ? ` para ${destination}` : ''}. Posso levar para cotação se definirmos a decisão faltante.`;
  }
  if (destination && missing.includes('destination')) {
    return `Perfecto. Entiendo búsqueda de playa en ${destination} para ${date}. Para llevarlo a cotización, podemos arrancar por un destino concreto.`;
  }
  return `Perfecto. Entiendo el pedido del cliente${destination ? ` para ${destination}` : ''}. Para llevarlo a cotización, definamos la decisión que falta.`;
}

export function resolveIntentElicitation(
  parsed: ParsedTravelRequest,
  options: ResolveOptions,
): IntentElicitationResult {
  const seeds = getSeeds(parsed);
  const defaultOrigin = options.defaults?.defaultOrigin ?? options.emiliaState?.profile.default_origin_city ?? null;

  if (!isAgencyCommercial(parsed, seeds) || isPlannerOrDiscovery(parsed)) {
    return {
      action: 'ignore',
      explicitIntent: parsed.commercialIntent?.kind ?? parsed.requestType,
      known: collectKnown(parsed, seeds),
      missingDecision: [],
      probableNextIntents: [],
      chips: [],
      confidence: parsed.commercialIntent?.confidence ?? parsed.confidence ?? 0,
      rationale: 'not an agency commercial elicitation turn',
    };
  }

  if (hasStructuredSearch(parsed)) {
    return {
      action: 'execute',
      explicitIntent: parsed.commercialIntent?.kind ?? parsed.requestType,
      known: collectKnown(parsed, seeds),
      missingDecision: [],
      probableNextIntents: [],
      executableRequest: parsed,
      chips: [],
      confidence: Math.max(parsed.commercialIntent?.confidence ?? 0, parsed.confidence ?? 0),
      rationale: 'structured commercial request is executable by the existing router',
    };
  }

  const missing = deriveMissing(parsed, seeds, defaultOrigin);
  const criticalMissing = missing.includes('origin') ? 'ask_minimal' : 'guide_with_chips';
  const chips = buildGuidanceChips(parsed, seeds, missing, options.language);
  if (missing.length === 0) {
    return {
      action: 'execute',
      explicitIntent: parsed.commercialIntent?.kind ?? 'commercial_search',
      known: collectKnown(parsed, seeds),
      missingDecision: [],
      probableNextIntents: ['search'],
      executableRequest: parsed,
      chips,
      confidence: Math.max(parsed.commercialIntent?.confidence ?? 0, parsed.confidence ?? 0.7),
      rationale: 'commercial intent has enough information after parser/defaults',
    };
  }

  const now = options.defaults?.now ?? new Date();
  const startOffset = options.defaults?.startOffsetDays ?? SEARCH_START_OFFSET_DAYS;
  const stayNights = options.defaults?.stayNights ?? SEARCH_STAY_NIGHTS;
  const defaultStartDate = addDaysIso(now, startOffset);
  const defaultEndDate = addDaysIso(now, startOffset + stayNights);
  const message = buildMessage(seeds, missing, options.language);
  const pendingAction: PendingAction = {
    kind: 'awaiting_user_input',
    for: 'intent_elicitation',
    fields: missing,
    prompt: message.slice(0, 240),
    issuedAt: now.toISOString(),
    payload: {
      searchSeeds: seeds,
      defaultsApplied: {
        origin: defaultOrigin,
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        adults: options.defaults?.defaultAdults ?? 1,
      },
      chipTemplates: chips.map((chip) => ({
        label: chip.label,
        prompt: chip.prompt,
        expectedRequestType: chip.expectedRequestType,
        expectedProducts: chip.expectedProducts,
      })),
    },
  };

  return {
    action: criticalMissing,
    explicitIntent: parsed.commercialIntent?.kind ?? 'commercial_search',
    known: collectKnown(parsed, seeds),
    missingDecision: missing,
    probableNextIntents: missing.includes('destination')
      ? ['choose_destination', 'define_passengers', 'package_search']
      : ['define_missing_slots', 'commercial_search'],
    message,
    chips,
    pendingAction,
    confidence: Math.max(parsed.commercialIntent?.confidence ?? 0, parsed.confidence ?? 0.7),
    rationale: 'commercial agency intent needs a business decision before routing',
  };
}
