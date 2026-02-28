export type PlannerScheduleSlot = 'morning' | 'afternoon' | 'evening';
export type PlannerActivityType =
  | 'museum'
  | 'landmark'
  | 'walk'
  | 'food'
  | 'market'
  | 'nightlife'
  | 'shopping'
  | 'nature'
  | 'family'
  | 'wellness'
  | 'transport'
  | 'hotel'
  | 'viewpoint'
  | 'culture'
  | 'experience'
  | 'unknown';
export type PlannerSchedulingConfidence = 'high' | 'medium' | 'low';

export interface SchedulingTravelers {
  adults?: number;
  children?: number;
  infants?: number;
}

export interface SchedulableActivity {
  time?: string;
  title?: string;
  activity?: string;
  name?: string;
  description?: string;
  detail?: string;
  tip?: string;
  category?: string;
  neighborhood?: string;
  locked?: boolean;
  source?: string;
  activityType?: PlannerActivityType;
  recommendedSlot?: PlannerScheduleSlot;
  durationMinutes?: number;
  schedulingConfidence?: PlannerSchedulingConfidence;
  [key: string]: unknown;
}

export interface SchedulableDay<TActivity extends SchedulableActivity = SchedulableActivity> {
  morning?: TActivity[];
  afternoon?: TActivity[];
  evening?: TActivity[];
  title?: string;
  summary?: string;
  city?: string;
  travelTip?: string;
  date?: string;
  day?: number;
  dayNumber?: number;
  [key: string]: unknown;
}

interface SchedulingContext {
  pace?: string;
  travelers?: SchedulingTravelers;
  isTransferDay?: boolean;
}

const SLOT_ORDER: PlannerScheduleSlot[] = ['morning', 'afternoon', 'evening'];

const SLOT_WINDOWS: Record<PlannerScheduleSlot, [number, number]> = {
  morning: [7 * 60, 12 * 60 + 59],
  afternoon: [12 * 60, 17 * 60 + 59],
  evening: [18 * 60, 23 * 60 + 59],
};

const DEFAULT_TIME_TEMPLATES: Record<string, Record<PlannerScheduleSlot, string[]>> = {
  relaxed: {
    morning: ['10:00', '11:30'],
    afternoon: ['14:00', '16:30'],
    evening: ['19:30', '21:00'],
  },
  fast: {
    morning: ['08:30', '10:00', '11:30'],
    afternoon: ['13:00', '15:00', '17:00'],
    evening: ['19:00', '20:30', '22:00'],
  },
  balanced: {
    morning: ['09:00', '10:30', '11:45'],
    afternoon: ['13:00', '15:30', '17:00'],
    evening: ['19:00', '20:30', '22:00'],
  },
};

const TRANSFER_DAY_TIME_TEMPLATES: Record<string, Record<PlannerScheduleSlot, string[]>> = {
  relaxed: {
    morning: ['10:30', '11:45'],
    afternoon: ['15:00', '16:45'],
    evening: ['19:30', '21:00'],
  },
  fast: {
    morning: ['09:30', '11:00'],
    afternoon: ['14:30', '16:00'],
    evening: ['19:00', '20:45'],
  },
  balanced: {
    morning: ['10:00', '11:15'],
    afternoon: ['14:30', '16:15'],
    evening: ['19:00', '20:30'],
  },
};

const CATEGORY_LABELS: Record<PlannerActivityType, string> = {
  museum: 'Museo',
  landmark: 'Iconico',
  walk: 'Paseo',
  food: 'Gastronomia',
  market: 'Mercado',
  nightlife: 'Vida nocturna',
  shopping: 'Compras',
  nature: 'Naturaleza',
  family: 'Familiar',
  wellness: 'Bienestar',
  transport: 'Traslado',
  hotel: 'Hotel',
  viewpoint: 'Mirador',
  culture: 'Cultura',
  experience: 'Experiencia',
  unknown: 'Actividad',
};

const DURATION_BY_TYPE: Record<PlannerActivityType, number> = {
  museum: 120,
  landmark: 90,
  walk: 90,
  food: 90,
  market: 90,
  nightlife: 150,
  shopping: 120,
  nature: 120,
  family: 120,
  wellness: 90,
  transport: 180,
  hotel: 60,
  viewpoint: 60,
  culture: 105,
  experience: 120,
  unknown: 90,
};

const SLOT_COMPATIBILITY: Record<PlannerActivityType, PlannerScheduleSlot[]> = {
  museum: ['morning', 'afternoon'],
  landmark: ['morning', 'afternoon'],
  walk: ['afternoon', 'evening'],
  food: ['morning', 'afternoon', 'evening'],
  market: ['morning', 'afternoon'],
  nightlife: ['evening'],
  shopping: ['morning', 'afternoon'],
  nature: ['morning', 'afternoon'],
  family: ['morning', 'afternoon'],
  wellness: ['afternoon', 'evening'],
  transport: ['morning', 'afternoon', 'evening'],
  hotel: ['morning', 'afternoon', 'evening'],
  viewpoint: ['afternoon', 'evening'],
  culture: ['afternoon', 'evening'],
  experience: ['morning', 'afternoon', 'evening'],
  unknown: ['morning', 'afternoon', 'evening'],
};

const RULES: Array<{ type: PlannerActivityType; keywords: string[] }> = [
  { type: 'transport', keywords: ['vuelo', 'flight', 'tren', 'train', 'ferry', 'traslado', 'transfer', 'llegada', 'arrival', 'salida', 'departure'] },
  { type: 'hotel', keywords: ['hotel', 'check in', 'check-in', 'check out', 'check-out', 'descanso', 'siesta'] },
  { type: 'nightlife', keywords: ['nightlife', 'vida nocturna', 'bar', 'pub', 'club', 'cocktail', 'coctel', 'rooftop', 'discoteca', 'musica en vivo', 'live music'] },
  { type: 'museum', keywords: ['museo', 'museum', 'gallery', 'galeria', 'pinacoteca', 'exhibition', 'exhibicion'] },
  { type: 'market', keywords: ['mercado', 'market', 'feria', 'food hall'] },
  { type: 'shopping', keywords: ['shopping', 'compras', 'boutique', 'outlet', 'tiendas', 'shopping district'] },
  { type: 'wellness', keywords: ['spa', 'wellness', 'masaje', 'relax', 'termas'] },
  { type: 'nature', keywords: ['parque', 'park', 'jardin', 'garden', 'beach', 'playa', 'lake', 'bosque', 'river', 'rio'] },
  { type: 'family', keywords: ['kids', 'ninos', 'niños', 'family', 'familia', 'aquarium', 'zoo', 'interactive', 'theme park', 'parque tematico'] },
  { type: 'viewpoint', keywords: ['mirador', 'viewpoint', 'sunset', 'atardecer', 'vista panoramica', 'vista', 'panorama'] },
  { type: 'culture', keywords: ['flamenco', 'opera', 'theatre', 'teatro', 'concert', 'concierto', 'show', 'espectaculo'] },
  { type: 'food', keywords: ['almuerzo', 'lunch', 'desayuno', 'breakfast', 'brunch', 'cena', 'dinner', 'tapas', 'comida', 'restaurant', 'restaurante', 'gastronomia', 'cata', 'wine bar'] },
  { type: 'walk', keywords: ['paseo', 'walk', 'stroll', 'recorrido', 'tour a pie', 'neighborhood', 'barrio', 'callejear'] },
  { type: 'landmark', keywords: ['plaza', 'cathedral', 'catedral', 'basilica', 'palacio', 'tower', 'torre', 'monumento', 'historic center', 'centro historico'] },
  { type: 'experience', keywords: ['experience', 'experiencia', 'class', 'clase', 'workshop', 'taller', 'cruise', 'excursion', 'day trip', 'tour'] },
];

function normalizeText(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getActivityText(activity: SchedulableActivity): string {
  return normalizeText([
    activity.title,
    activity.activity,
    activity.name,
    activity.description,
    activity.detail,
    activity.category,
  ].filter(Boolean).join(' '));
}

function getPaceKey(pace?: string): 'relaxed' | 'balanced' | 'fast' {
  if (pace === 'relaxed' || pace === 'fast') return pace;
  return 'balanced';
}

function isFamilyTrip(travelers?: SchedulingTravelers): boolean {
  return Boolean((travelers?.children || 0) > 0 || (travelers?.infants || 0) > 0);
}

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isTimeCompatibleWithSlot(time: string | undefined, slot: PlannerScheduleSlot): boolean {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return false;
  const [start, end] = SLOT_WINDOWS[slot];
  return minutes >= start && minutes <= end;
}

function getSpecificKeywordPreferredSlot(text: string): PlannerScheduleSlot | null {
  if (/(desayuno|breakfast|brunch)/.test(text)) return 'morning';
  if (/(almuerzo|lunch|mercado gastronomico|food hall)/.test(text)) return 'afternoon';
  if (/(cena|dinner|cocktail|coctel|flamenco|opera|theatre|teatro|show|sunset|atardecer|nightlife|vida nocturna|bar|club|pub)/.test(text)) {
    return 'evening';
  }
  return null;
}

export function classifyPlannerActivityType(activity: SchedulableActivity): PlannerActivityType {
  const text = getActivityText(activity);
  const normalizedCategory = normalizeText(activity.category);

  if (normalizedCategory) {
    const explicitMatch = Object.entries(CATEGORY_LABELS).find(([type, label]) => {
      const normalizedLabel = normalizeText(label);
      return normalizedCategory.includes(normalizedLabel) || normalizedCategory.includes(type);
    });
    if (explicitMatch) {
      return explicitMatch[0] as PlannerActivityType;
    }
  }

  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      return rule.type;
    }
  }

  return 'unknown';
}

export function getPlannerPreferredSlot(
  activity: SchedulableActivity,
  context: SchedulingContext
): PlannerScheduleSlot {
  const text = getActivityText(activity);
  const specificSlot = getSpecificKeywordPreferredSlot(text);
  if (specificSlot) {
    return specificSlot;
  }

  const type = classifyPlannerActivityType(activity);
  const familyTrip = isFamilyTrip(context.travelers);

  if (familyTrip && type === 'nightlife') {
    return 'evening';
  }

  switch (type) {
    case 'museum':
    case 'landmark':
    case 'market':
    case 'nature':
    case 'family':
      return 'morning';
    case 'food':
    case 'walk':
    case 'shopping':
    case 'wellness':
    case 'experience':
      return 'afternoon';
    case 'nightlife':
    case 'viewpoint':
    case 'culture':
      return 'evening';
    case 'hotel':
      return 'afternoon';
    case 'transport':
      return context.isTransferDay ? 'morning' : 'afternoon';
    default:
      return 'afternoon';
  }
}

function shouldForceMove(type: PlannerActivityType, currentSlot: PlannerScheduleSlot, preferredSlot: PlannerScheduleSlot, context: SchedulingContext): boolean {
  if (currentSlot === preferredSlot) return false;
  if (type === 'nightlife') return currentSlot !== 'evening';
  if (type === 'museum' || type === 'market') return currentSlot === 'evening';
  if (type === 'viewpoint') return currentSlot === 'morning';
  if (type === 'shopping') return currentSlot === 'evening';
  if (type === 'landmark' && currentSlot === 'evening') return true;
  if (context.isTransferDay && currentSlot === 'morning' && (type === 'museum' || type === 'landmark' || type === 'culture' || type === 'nature')) {
    return true;
  }
  return !SLOT_COMPATIBILITY[type].includes(currentSlot);
}

function getSuggestedStartTime(slot: PlannerScheduleSlot, pace?: string, index = 0, isTransferDay = false): string {
  const paceKey = getPaceKey(pace);
  const templates = isTransferDay ? TRANSFER_DAY_TIME_TEMPLATES[paceKey] : DEFAULT_TIME_TEMPLATES[paceKey];
  const slotTimes = templates[slot];
  return slotTimes[Math.min(index, slotTimes.length - 1)];
}

function toCategoryLabel(type: PlannerActivityType): string {
  return CATEGORY_LABELS[type];
}

function buildSchedulingConfidence(args: {
  preferredSlot: PlannerScheduleSlot;
  finalSlot: PlannerScheduleSlot;
  moved: boolean;
  timeRepaired: boolean;
  locked: boolean;
  familyNightlife: boolean;
}): PlannerSchedulingConfidence {
  if (args.familyNightlife || args.moved || args.timeRepaired) return 'low';
  if (args.locked || args.preferredSlot === args.finalSlot) return 'high';
  return 'medium';
}

function normalizeActivityTime(
  activity: SchedulableActivity,
  slot: PlannerScheduleSlot,
  context: SchedulingContext,
  index: number
): { time?: string; repaired: boolean } {
  if (activity.time && isTimeCompatibleWithSlot(activity.time, slot)) {
    return { time: activity.time, repaired: false };
  }

  return {
    time: getSuggestedStartTime(slot, context.pace, index, context.isTransferDay),
    repaired: true,
  };
}

function sortByTime<T extends SchedulableActivity>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = parseTimeToMinutes(a.time);
    const bTime = parseTimeToMinutes(b.time);
    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return aTime - bTime;
  });
}

function normalizeActivitiesForSlot<T extends SchedulableActivity>(
  items: T[],
  slot: PlannerScheduleSlot,
  context: SchedulingContext
): T[] {
  return sortByTime(
    items.map((activity, index) => {
      const type = classifyPlannerActivityType(activity);
      const preferredSlot = getPlannerPreferredSlot(activity, context);
      const normalizedTime = normalizeActivityTime(activity, slot, context, index);
      const familyNightlife = isFamilyTrip(context.travelers) && type === 'nightlife';

      return {
        ...activity,
        time: normalizedTime.time,
        category: activity.category || toCategoryLabel(type),
        activityType: type,
        recommendedSlot: preferredSlot,
        durationMinutes: typeof activity.durationMinutes === 'number'
          ? activity.durationMinutes
          : DURATION_BY_TYPE[type],
        schedulingConfidence: buildSchedulingConfidence({
          preferredSlot,
          finalSlot: slot,
          moved: false,
          timeRepaired: normalizedTime.repaired,
          locked: Boolean(activity.locked),
          familyNightlife,
        }),
      };
    })
  );
}

export function normalizePlannerDayScheduling<TActivity extends SchedulableActivity, TDay extends SchedulableDay<TActivity>>(
  day: TDay,
  context: SchedulingContext
): TDay {
  const buckets: Record<PlannerScheduleSlot, Array<TActivity & SchedulableActivity>> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  SLOT_ORDER.forEach((slot) => {
    (day[slot] || []).forEach((activity) => {
      const type = classifyPlannerActivityType(activity);
      const preferredSlot = getPlannerPreferredSlot(activity, context);
      const finalSlot = activity.locked || !shouldForceMove(type, slot, preferredSlot, context)
        ? slot
        : preferredSlot;

      buckets[finalSlot].push({
        ...activity,
        category: activity.category || toCategoryLabel(type),
        activityType: type,
        recommendedSlot: preferredSlot,
        durationMinutes: typeof activity.durationMinutes === 'number'
          ? activity.durationMinutes
          : DURATION_BY_TYPE[type],
        schedulingConfidence: buildSchedulingConfidence({
          preferredSlot,
          finalSlot,
          moved: finalSlot !== slot,
          timeRepaired: false,
          locked: Boolean(activity.locked),
          familyNightlife: isFamilyTrip(context.travelers) && type === 'nightlife',
        }),
      });
    });
  });

  const normalizedBuckets = {
    morning: normalizeActivitiesForSlot(buckets.morning, 'morning', context),
    afternoon: normalizeActivitiesForSlot(buckets.afternoon, 'afternoon', context),
    evening: normalizeActivitiesForSlot(buckets.evening, 'evening', context),
  };

  return {
    ...day,
    morning: normalizedBuckets.morning as TActivity[],
    afternoon: normalizedBuckets.afternoon as TActivity[],
    evening: normalizedBuckets.evening as TActivity[],
  };
}

export function normalizePlannerSegmentsScheduling<
  TActivity extends SchedulableActivity,
  TDay extends SchedulableDay<TActivity>,
  TSegment extends { days?: TDay[]; transportIn?: unknown }
>(
  segments: TSegment[],
  options: {
    pace?: string;
    travelers?: SchedulingTravelers;
  }
): TSegment[] {
  return segments.map((segment, segmentIndex) => ({
    ...segment,
    days: (segment.days || []).map((day, dayIndex) =>
      normalizePlannerDayScheduling(day, {
        pace: options.pace,
        travelers: options.travelers,
        isTransferDay: segmentIndex > 0 && dayIndex === 0 && Boolean(segment.transportIn),
      })
    ),
  }));
}
