/**
 * Emilia 5.0 — Proposed Search Builder (Phase 5 / sub-task B)
 *
 * Pure function that turns a parsed exploratory-but-actionable agency-mode
 * request (e.g. "Quiero algo premium en Riviera Maya para aniversario, dos
 * personas") into a complete `ProposedSearch` payload: principal chip,
 * 2-3 dynamic alternative chips, and narrative segments.
 *
 * The principal chip's submit text MUST be exhaustive enough that re-parsing
 * it produces a request `routeRequest` scores >= 0.75 (QUOTE branch). That
 * means: products, destination, exact today+3 / today+10 dates, adults +
 * children, derived room type, optional origin from `profile.default_origin_city`.
 *
 * Pure module — no I/O, no React, no Supabase imports.
 *
 * NOTE: The `searchSeeds` field this module reads is added by a parallel agent
 * working on `responseSchema.ts` + `prompt.ts`. We code against the contract
 * (typed inline below) so the two streams can land independently.
 *
 * NOTE: TODO — premium/luxury chain categorization is deferred deuda. When
 * `budgetHint === 'premium'` or `'luxury'` we just inject the adjective into
 * the visible label and submit text. Mapping to specific hotel chain lists is
 * a follow-up task that applies to BOTH agency and passenger flows.
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { EmiliaProfile } from '@/features/chat/state/emiliaState';

// ---------------------------------------------------------------------------
// SearchSeeds contract (mirror of the schema-agent's shape)
// ---------------------------------------------------------------------------

export type SeedProduct = 'flight' | 'hotel' | 'transfer' | 'package';
export type SeedTravelerType = 'solo' | 'couple' | 'family' | 'group';
export type SeedBudgetHint = 'budget' | 'mid' | 'premium' | 'luxury';
export type SeedOccasionHint =
  | 'anniversary'
  | 'honeymoon'
  | 'birthday'
  | 'business'
  | 'leisure';

export interface SearchSeeds {
  destination?: string | null;
  travelerType?: SeedTravelerType | null;
  budgetHint?: SeedBudgetHint | null;
  occasionHint?: SeedOccasionHint | null;
  productsImplied: SeedProduct[];
  adults?: number | null;
  children?: number | null;
}

// Local type augmentation — `searchSeeds` is added by the schema-agent. Read
// it via a defensive cast so this module compiles regardless of whether the
// schema landed first.
type ParsedWithSeeds = ParsedTravelRequest & { searchSeeds?: SearchSeeds | null };

// ---------------------------------------------------------------------------
// Defaults (mirror of `searchIntentNormalizer.ts` constants — kept in sync
// rather than imported to avoid leaking that module's internals).
// ---------------------------------------------------------------------------

const DEFAULT_SEARCH_START_OFFSET_DAYS = 3;
const DEFAULT_FALLBACK_STAY_NIGHTS = 7;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProposedSearchLanguage = 'es' | 'en' | 'pt';

export interface ProposedAlternativeChip {
  id: string;
  label: string;
  submitText: string;
}

export interface ProposedSearch {
  principalChipLabel: string;
  principalSubmitText: string;
  alternativeChips: ProposedAlternativeChip[];
  segments: {
    lead: string;
    proposal: string;
    dates: string;
    callToAction: string;
  };
}

export interface BuildProposedSearchOptions {
  profile?: EmiliaProfile | null;
  now?: Date;
  language: ProposedSearchLanguage;
}

// ---------------------------------------------------------------------------
// Internal copy registry (es/en/pt)
// ---------------------------------------------------------------------------

interface CopyBundle {
  // Product summary phrases (used in label + submit text + proposal segment)
  productFlight: string;
  productHotel: string;
  productPackage: string;
  productFlightAndHotel: string;
  productPackageWithAll: string;
  // Connectors
  searchVerb: string;
  to: string;
  in: string;
  from: string;
  fromTo: (start: string, end: string) => string;
  forPax: string;
  inRoom: string;
  leavingFrom: string;
  // Pax phrases
  adult: (n: number) => string;
  child: (n: number) => string;
  plus: string;
  // Room types
  roomSingle: string;
  roomDouble: string;
  roomTriple: string;
  roomQuadruple: string;
  // Budget adjectives (used after the product noun in the visible label)
  budgetBudget: string;
  budgetMid: string;
  budgetPremium: string;
  budgetLuxury: string;
  // Occasion-flavored leads
  leadAnniversary: (destination: string) => string;
  leadHoneymoon: (destination: string) => string;
  leadBirthday: (destination: string) => string;
  leadBusiness: (destination: string) => string;
  leadLeisure: (destination: string) => string;
  leadFamily: (destination: string) => string;
  leadGeneric: (destination: string) => string;
  // Proposal segment templates
  proposalTemplate: (productPhrase: string, budgetPhrase: string, paxPhrase: string) => string;
  // Dates segment template
  datesTemplate: (start: string, end: string) => string;
  // CTA
  callToAction: string;
  // Alternative chip labels
  altOnlyHotel: string;
  altFiveNights: string;
  altEconomic: string;
  altAdultsOnly: string;
  // Helpers used by the alt-chip submit-text builders
  adultsOnlyHint: string;
  fiveNightsHint: string;
  budgetForAltDowngrade: string;
}

const COPY: Record<ProposedSearchLanguage, CopyBundle> = {
  es: {
    productFlight: 'vuelo',
    productHotel: 'hotel',
    productPackage: 'paquete',
    productFlightAndHotel: 'vuelo y hotel',
    productPackageWithAll: 'paquete con vuelo, hotel y traslado',
    searchVerb: 'Buscar',
    to: 'a',
    in: 'en',
    from: 'desde',
    fromTo: (s, e) => `del ${s} al ${e}`,
    forPax: 'para',
    inRoom: 'en habitación',
    leavingFrom: 'saliendo desde',
    adult: (n) => `${n} adulto${n > 1 ? 's' : ''}`,
    child: (n) => `${n} niño${n > 1 ? 's' : ''}`,
    plus: '+',
    roomSingle: 'single',
    roomDouble: 'doble',
    roomTriple: 'triple',
    roomQuadruple: 'cuádruple',
    budgetBudget: 'económico',
    budgetMid: 'moderado',
    budgetPremium: 'premium',
    budgetLuxury: 'de lujo',
    leadAnniversary: (d) => `Para tu aniversario en ${d}`,
    leadHoneymoon: (d) => `Para tu luna de miel en ${d}`,
    leadBirthday: (d) => `Para tu cumpleaños en ${d}`,
    leadBusiness: (d) => `Para tu viaje de negocios a ${d}`,
    leadLeisure: (d) => `Para tu escapada a ${d}`,
    leadFamily: (d) => `Para tu viaje en familia a ${d}`,
    leadGeneric: (d) => `Para tu viaje a ${d}`,
    proposalTemplate: (product, budget, pax) =>
      `propongo buscar ${product}${budget ? ` ${budget}` : ''} para ${pax}`,
    datesTemplate: (s, e) => `del ${s} al ${e}`,
    callToAction: '¿Buscamos esto?',
    altOnlyHotel: 'Solo hotel',
    altFiveNights: 'Cambiar a 5 noches',
    altEconomic: 'Económico en lugar de premium',
    altAdultsOnly: 'Adults-only',
    adultsOnlyHint: 'adults-only',
    fiveNightsHint: '5 noches',
    budgetForAltDowngrade: 'económico',
  },
  en: {
    productFlight: 'flight',
    productHotel: 'hotel',
    productPackage: 'package',
    productFlightAndHotel: 'flight and hotel',
    productPackageWithAll: 'package with flight, hotel and transfer',
    searchVerb: 'Search',
    to: 'to',
    in: 'in',
    from: 'from',
    fromTo: (s, e) => `from ${s} to ${e}`,
    forPax: 'for',
    inRoom: 'in a',
    leavingFrom: 'departing from',
    adult: (n) => `${n} adult${n > 1 ? 's' : ''}`,
    child: (n) => `${n} child${n > 1 ? 'ren' : ''}`,
    plus: '+',
    roomSingle: 'single',
    roomDouble: 'double',
    roomTriple: 'triple',
    roomQuadruple: 'quadruple',
    budgetBudget: 'budget',
    budgetMid: 'mid-range',
    budgetPremium: 'premium',
    budgetLuxury: 'luxury',
    leadAnniversary: (d) => `For your anniversary in ${d}`,
    leadHoneymoon: (d) => `For your honeymoon in ${d}`,
    leadBirthday: (d) => `For your birthday in ${d}`,
    leadBusiness: (d) => `For your business trip to ${d}`,
    leadLeisure: (d) => `For your getaway to ${d}`,
    leadFamily: (d) => `For your family trip to ${d}`,
    leadGeneric: (d) => `For your trip to ${d}`,
    proposalTemplate: (product, budget, pax) =>
      `I propose searching for ${product}${budget ? ` ${budget}` : ''} for ${pax}`,
    datesTemplate: (s, e) => `from ${s} to ${e}`,
    callToAction: 'Shall we search?',
    altOnlyHotel: 'Only hotel',
    altFiveNights: 'Switch to 5 nights',
    altEconomic: 'Budget instead of premium',
    altAdultsOnly: 'Adults-only',
    adultsOnlyHint: 'adults-only',
    fiveNightsHint: '5 nights',
    budgetForAltDowngrade: 'budget',
  },
  pt: {
    productFlight: 'voo',
    productHotel: 'hotel',
    productPackage: 'pacote',
    productFlightAndHotel: 'voo e hotel',
    productPackageWithAll: 'pacote com voo, hotel e traslado',
    searchVerb: 'Buscar',
    to: 'para',
    in: 'em',
    from: 'de',
    fromTo: (s, e) => `de ${s} a ${e}`,
    forPax: 'para',
    inRoom: 'em quarto',
    leavingFrom: 'saindo de',
    adult: (n) => `${n} adulto${n > 1 ? 's' : ''}`,
    child: (n) => `${n} criança${n > 1 ? 's' : ''}`,
    plus: '+',
    roomSingle: 'single',
    roomDouble: 'duplo',
    roomTriple: 'triplo',
    roomQuadruple: 'quádruplo',
    budgetBudget: 'econômico',
    budgetMid: 'moderado',
    budgetPremium: 'premium',
    budgetLuxury: 'de luxo',
    leadAnniversary: (d) => `Para seu aniversário em ${d}`,
    leadHoneymoon: (d) => `Para sua lua de mel em ${d}`,
    leadBirthday: (d) => `Para seu aniversário em ${d}`,
    leadBusiness: (d) => `Para sua viagem de negócios a ${d}`,
    leadLeisure: (d) => `Para sua escapada a ${d}`,
    leadFamily: (d) => `Para sua viagem em família a ${d}`,
    leadGeneric: (d) => `Para sua viagem a ${d}`,
    proposalTemplate: (product, budget, pax) =>
      `proponho buscar ${product}${budget ? ` ${budget}` : ''} para ${pax}`,
    datesTemplate: (s, e) => `de ${s} a ${e}`,
    callToAction: 'Buscamos isso?',
    altOnlyHotel: 'Só hotel',
    altFiveNights: 'Mudar para 5 noites',
    altEconomic: 'Econômico em vez de premium',
    altAdultsOnly: 'Adults-only',
    adultsOnlyHint: 'adults-only',
    fiveNightsHint: '5 noites',
    budgetForAltDowngrade: 'econômico',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIsoDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysIso(base: Date, days: number): string {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDate(next);
}

function deriveRoomType(adults: number, children: number, copy: CopyBundle):
  | { kind: 'single' | 'double' | 'triple' | 'quadruple'; label: string } {
  const total = (adults || 0) + (children || 0);
  if (total <= 1) return { kind: 'single', label: copy.roomSingle };
  if (total === 2) return { kind: 'double', label: copy.roomDouble };
  if (total === 3) return { kind: 'triple', label: copy.roomTriple };
  return { kind: 'quadruple', label: copy.roomQuadruple };
}

function pickProductPhrase(products: SeedProduct[], copy: CopyBundle): {
  phrase: string;
  hasFlight: boolean;
  hasHotel: boolean;
  hasPackage: boolean;
} {
  const set = new Set(products);
  const hasFlight = set.has('flight');
  const hasHotel = set.has('hotel');
  const hasTransfer = set.has('transfer');
  const hasPackage = set.has('package');

  if (hasPackage || (hasFlight && hasHotel && hasTransfer)) {
    return { phrase: copy.productPackageWithAll, hasFlight: true, hasHotel: true, hasPackage: true };
  }
  if (hasFlight && hasHotel) {
    return { phrase: copy.productFlightAndHotel, hasFlight: true, hasHotel: true, hasPackage: false };
  }
  if (hasFlight) {
    return { phrase: copy.productFlight, hasFlight: true, hasHotel: false, hasPackage: false };
  }
  if (hasHotel) {
    return { phrase: copy.productHotel, hasFlight: false, hasHotel: true, hasPackage: false };
  }
  // No products implied → default to flight + hotel (safe combined search).
  return { phrase: copy.productFlightAndHotel, hasFlight: true, hasHotel: true, hasPackage: false };
}

function budgetAdjective(hint: SeedBudgetHint | null | undefined, copy: CopyBundle): string {
  if (!hint) return '';
  switch (hint) {
    case 'budget': return copy.budgetBudget;
    case 'mid': return copy.budgetMid;
    case 'premium': return copy.budgetPremium;
    case 'luxury': return copy.budgetLuxury;
    default: return '';
  }
}

function buildOccasionLead(
  occasion: SeedOccasionHint | null | undefined,
  travelerType: SeedTravelerType | null | undefined,
  destination: string,
  copy: CopyBundle,
): string {
  if (occasion === 'anniversary') return copy.leadAnniversary(destination);
  if (occasion === 'honeymoon') return copy.leadHoneymoon(destination);
  if (occasion === 'birthday') return copy.leadBirthday(destination);
  if (occasion === 'business') return copy.leadBusiness(destination);
  if (occasion === 'leisure') return copy.leadLeisure(destination);
  if (travelerType === 'family') return copy.leadFamily(destination);
  return copy.leadGeneric(destination);
}

function describePax(adults: number, children: number, copy: CopyBundle): string {
  const parts: string[] = [copy.adult(adults)];
  if (children > 0) parts.push(copy.child(children));
  return parts.join(', ');
}

function buildSubmitText(args: {
  productPhrase: string;
  budgetAdj: string;
  destination: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  roomLabel: string;
  origin?: string | null;
  copy: CopyBundle;
  extraSuffix?: string;
}): string {
  const { productPhrase, budgetAdj, destination, startDate, endDate, adults, children, roomLabel, origin, copy, extraSuffix } = args;
  const paxParts: string[] = [copy.adult(adults)];
  if (children > 0) paxParts.push(copy.child(children));
  const paxText = paxParts.join(' ' + copy.plus + ' ');

  const productSegment = budgetAdj ? `${productPhrase} ${budgetAdj}` : productPhrase;
  const head = `${copy.searchVerb} ${productSegment} ${copy.to} ${destination}`;
  const dates = ` ${copy.fromTo(startDate, endDate)}`;
  const pax = ` ${copy.forPax} ${paxText}`;
  const room = ` ${copy.inRoom} ${roomLabel}`;
  const originText = origin ? `, ${copy.leavingFrom} ${origin}` : '';
  const suffix = extraSuffix ? `, ${extraSuffix}` : '';

  return `${head}${dates}${pax}${room}${originText}${suffix}`;
}

function buildPrincipalLabel(args: {
  productPhrase: string;
  budgetAdj: string;
  destination: string;
  travelerType: SeedTravelerType | null | undefined;
  copy: CopyBundle;
}): string {
  const { productPhrase, budgetAdj, destination, travelerType, copy } = args;
  // Family-flavored shorthand for package-style requests.
  if (travelerType === 'family' && (productPhrase === copy.productPackageWithAll || productPhrase === copy.productPackage)) {
    const familyTag = copy === COPY.es ? 'familiar' : copy === COPY.pt ? 'familiar' : 'family';
    const adj = budgetAdj ? ` ${budgetAdj}` : '';
    return `${copy.searchVerb} ${copy.productPackage} ${familyTag}${adj} ${copy.to} ${destination}`;
  }
  const adj = budgetAdj ? ` ${budgetAdj}` : '';
  // Use "+" between flight/hotel for visible label readability.
  const labelProduct = productPhrase === copy.productFlightAndHotel
    ? (copy === COPY.en ? 'flight + hotel' : copy === COPY.pt ? 'voo + hotel' : 'vuelo + hotel')
    : productPhrase;
  // Use "in" preposition for hotel-only labels (more natural than "to").
  const prep = labelProduct === copy.productHotel ? copy.in : copy.to;
  return `${copy.searchVerb} ${labelProduct}${adj} ${prep} ${destination}`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildProposedSearch(
  parsed: ParsedTravelRequest,
  options: BuildProposedSearchOptions,
): ProposedSearch | null {
  const seeds = (parsed as ParsedWithSeeds).searchSeeds ?? null;
  if (!seeds) return null;

  const copy = COPY[options.language] ?? COPY.es;

  // ---- 1. Resolve seeds → search params --------------------------------
  const destination = (seeds.destination ?? '').trim();
  if (!destination) return null;

  // adults from explicit seed → travelerType inference → null (insufficient).
  let adults: number | null = seeds.adults ?? null;
  if (adults == null) {
    if (seeds.travelerType === 'couple') adults = 2;
    else if (seeds.travelerType === 'solo') adults = 1;
  }
  if (adults == null) return null; // too vague to propose

  const children = Math.max(0, seeds.children ?? 0);

  const now = options.now ?? new Date();
  // Normalize to UTC midnight to keep date math deterministic regardless of
  // the runner's local timezone.
  const baseUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const startDate = addDaysIso(baseUtc, DEFAULT_SEARCH_START_OFFSET_DAYS);
  const endDate = addDaysIso(baseUtc, DEFAULT_SEARCH_START_OFFSET_DAYS + DEFAULT_FALLBACK_STAY_NIGHTS);

  const origin = options.profile?.default_origin_city ?? null;

  const room = deriveRoomType(adults, children, copy);

  const products = (seeds.productsImplied ?? []).slice();
  const productInfo = pickProductPhrase(products, copy);
  const budgetAdj = budgetAdjective(seeds.budgetHint, copy);

  // ---- 2. Principal submit text + label --------------------------------
  // Origin only injected when the products include flight (otherwise it's
  // noise for a hotels-only search). Hotels-only chips skip it; flight-bearing
  // chips include it when geo is available.
  const principalSubmitText = buildSubmitText({
    productPhrase: productInfo.phrase,
    budgetAdj,
    destination,
    startDate,
    endDate,
    adults,
    children,
    roomLabel: room.label,
    origin: productInfo.hasFlight ? origin : null,
    copy,
  });

  const principalChipLabel = buildPrincipalLabel({
    productPhrase: productInfo.phrase,
    budgetAdj,
    destination,
    travelerType: seeds.travelerType,
    copy,
  });

  // ---- 3. Alternative chips --------------------------------------------
  // Push order = relevance order. The UI caps at 3 so the strongest
  // contextual signals must be pushed first. Heuristic:
  //   1. Adults-only when the occasion is romantic + hotel + no kids — the
  //      strongest contextual match for couple/anniversary/honeymoon.
  //   2. Only-hotel when the bundle includes flight (offers a cheaper variant).
  //   3. Five-nights — always available, useful general override.
  //   4. Economic downgrade — only when principal is premium/luxury.
  const alternativeChips: ProposedAlternativeChip[] = [];

  // (a) Adults-only — only when occasion is romantic AND a hotel is in scope.
  const isRomanticOccasion = seeds.occasionHint === 'anniversary' || seeds.occasionHint === 'honeymoon';
  if (isRomanticOccasion && productInfo.hasHotel && children === 0) {
    const altSubmit = buildSubmitText({
      productPhrase: productInfo.phrase,
      budgetAdj,
      destination,
      startDate,
      endDate,
      adults,
      children,
      roomLabel: room.label,
      origin: productInfo.hasFlight ? origin : null,
      copy,
      extraSuffix: copy.adultsOnlyHint,
    });
    alternativeChips.push({
      id: 'alt-adults-only',
      label: copy.altAdultsOnly,
      submitText: altSubmit,
    });
  }

  // (b) Only-hotel — when the request originally bundles flight+hotel.
  if (productInfo.hasFlight && productInfo.hasHotel) {
    const altSubmit = buildSubmitText({
      productPhrase: copy.productHotel,
      budgetAdj,
      destination,
      startDate,
      endDate,
      adults,
      children,
      roomLabel: room.label,
      origin: null,
      copy,
    });
    alternativeChips.push({
      id: 'alt-only-hotel',
      label: copy.altOnlyHotel,
      submitText: altSubmit,
    });
  }

  // (c) 5 nights instead of 7 (default duration override).
  const fiveNightEndDate = addDaysIso(baseUtc, DEFAULT_SEARCH_START_OFFSET_DAYS + 5);
  const fiveNightSubmit = buildSubmitText({
    productPhrase: productInfo.phrase,
    budgetAdj,
    destination,
    startDate,
    endDate: fiveNightEndDate,
    adults,
    children,
    roomLabel: room.label,
    origin: productInfo.hasFlight ? origin : null,
    copy,
    extraSuffix: copy.fiveNightsHint,
  });
  alternativeChips.push({
    id: 'alt-five-nights',
    label: copy.altFiveNights,
    submitText: fiveNightSubmit,
  });

  // (d) Economic downgrade — only when the principal is premium/luxury.
  if (seeds.budgetHint === 'premium' || seeds.budgetHint === 'luxury') {
    const altSubmit = buildSubmitText({
      productPhrase: productInfo.phrase,
      budgetAdj: copy.budgetForAltDowngrade,
      destination,
      startDate,
      endDate,
      adults,
      children,
      roomLabel: room.label,
      origin: productInfo.hasFlight ? origin : null,
      copy,
    });
    alternativeChips.push({
      id: 'alt-economic',
      label: copy.altEconomic,
      submitText: altSubmit,
    });
  }

  // Cap at 3 alternatives — keep UI compact.
  const cappedAlternatives = alternativeChips.slice(0, 3);

  // ---- 4. Narrative segments -------------------------------------------
  const lead = buildOccasionLead(seeds.occasionHint, seeds.travelerType, destination, copy);
  const proposal = copy.proposalTemplate(
    productInfo.phrase,
    budgetAdj,
    describePax(adults, children, copy),
  );
  const datesSegment = copy.datesTemplate(startDate, endDate);
  const callToAction = copy.callToAction;

  return {
    principalChipLabel,
    principalSubmitText,
    alternativeChips: cappedAlternatives,
    segments: {
      lead,
      proposal,
      dates: datesSegment,
      callToAction,
    },
  };
}
