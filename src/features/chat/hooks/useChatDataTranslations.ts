import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const ROOM_TYPE_KEYS: Record<string, string> = {
  'SGL': 'SGL',
  'DUS': 'DUS',
  'DBL': 'DBL',
  'TPL': 'TPL',
  'QUA': 'QUA',
  'FAMILY': 'FAMILY',
  'OTHER': 'OTHER',
  'single': 'single',
  'double': 'double',
  'triple': 'triple',
  'quad': 'quad',
  'family': 'family',
};

const ROOM_SERVICE_SOURCE_TO_KEY: Record<string, string> = {
  'breakfast': 'breakfast',
  'bed and breakfast': 'bedAndBreakfast',
  'room only': 'roomOnly',
  'all inclusive': 'allInclusive',
  'half board': 'halfBoard',
  'full board': 'fullBoard',
};

const ROOM_CATEGORY_SOURCE_TO_KEY: Record<string, string> = {
  'standard': 'standard',
  'superior': 'superior',
  'executive': 'executive',
  'comfort': 'comfort',
  'deluxe': 'deluxe',
  'basic': 'basic',
};

const FLIGHT_TYPE_SOURCE_TO_KEY: Record<string, string> = {
  'one-way': 'oneWay',
  'round trip': 'roundTrip',
  'direct': 'direct',
  'one_stop': 'oneStop',
  'two_stops': 'twoStops',
  'any': 'any',
};

const LAYOVER_SOURCE_TO_KEY: Record<string, string> = {
  'layover': 'layover',
  'connection': 'connection',
  'stopover': 'stopover',
};

const CABIN_CLASS_SOURCE_TO_KEY: Record<string, string> = {
  'Economy': 'Economy',
  'Premium': 'Premium',
  'Business': 'Business',
  'First': 'First',
  'cabin': 'cabin',
};

const FARE_SOURCE_TO_KEY: Record<string, string> = {
  'fare': 'fare',
  'base fare': 'baseFare',
  'total fare': 'totalFare',
  'net fare': 'netFare',
};

const BAGGAGE_SOURCE_TO_KEY: Record<string, string> = {
  'carry on': 'carryOn',
  'checked': 'checked',
  'both': 'both',
  'none': 'none',
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFromMap(
  text: string,
  sourceToKey: Record<string, string>,
  resolve: (key: string) => string,
): string {
  let result = text;
  // Iterate sorted by source length DESC so longer phrases replace first
  const entries = Object.entries(sourceToKey).sort(([a], [b]) => b.length - a.length);
  for (const [source, key] of entries) {
    const regex = new RegExp(`\\b${escapeRegex(source)}\\b`, 'gi');
    result = result.replace(regex, resolve(key));
  }
  return result;
}

export function useChatDataTranslations() {
  const { t } = useTranslation('chat');

  const translateRoomDescription = useCallback(
    (description: string): string => {
      let translated = description;

      // Long phrases first (room types whose source key is > 3 chars)
      const longRoomTypes = Object.entries(ROOM_TYPE_KEYS).filter(([src]) => src.length > 3);
      for (const [source, key] of longRoomTypes) {
        const regex = new RegExp(`\\b${escapeRegex(source)}\\b`, 'gi');
        translated = translated.replace(regex, t(`data.roomTypes.${key}`));
      }

      // Services
      translated = replaceFromMap(translated, ROOM_SERVICE_SOURCE_TO_KEY, (k) =>
        t(`data.roomServices.${k}`),
      );

      // Categories
      translated = replaceFromMap(translated, ROOM_CATEGORY_SOURCE_TO_KEY, (k) =>
        t(`data.roomCategories.${k}`),
      );

      // Short room codes last (≤ 3 chars: SGL, DUS, DBL, TPL, QUA)
      const shortRoomTypes = Object.entries(ROOM_TYPE_KEYS).filter(([src]) => src.length <= 3);
      for (const [source, key] of shortRoomTypes) {
        const regex = new RegExp(`\\b${source}\\b`, 'gi');
        translated = translated.replace(regex, t(`data.roomTypes.${key}`));
      }

      return translated;
    },
    [t],
  );

  const translateRoomTypeTitle = useCallback(
    (type: string): string => {
      if (type in ROOM_TYPE_KEYS) {
        return t(`data.roomTypes.${ROOM_TYPE_KEYS[type]}`);
      }
      return type;
    },
    [t],
  );

  const translateFlightInfo = useCallback(
    (text: string): string => {
      let translated = text;
      translated = replaceFromMap(translated, FLIGHT_TYPE_SOURCE_TO_KEY, (k) =>
        t(`data.flightTypes.${k}`),
      );
      translated = replaceFromMap(translated, LAYOVER_SOURCE_TO_KEY, (k) =>
        t(`data.layovers.${k}`),
      );
      translated = replaceFromMap(translated, CABIN_CLASS_SOURCE_TO_KEY, (k) =>
        t(`data.cabinClasses.${k}`),
      );
      translated = replaceFromMap(translated, FARE_SOURCE_TO_KEY, (k) => t(`data.fares.${k}`));
      return translated;
    },
    [t],
  );

  const translateBaggage = useCallback(
    (baggageType: string): string => {
      // Handle API response formats first (e.g. "1PC", "20KG")
      if (baggageType.includes('PC') || baggageType.includes('KG')) {
        const match = baggageType.match(/(\d+)PC|(\d+)KG/);
        if (match) {
          const quantity = parseInt(match[1] || match[2], 10);
          if (quantity > 0) {
            const isPieces = baggageType.includes('PC');
            return isPieces
              ? t('data.baggage.piecesIncluded', { count: quantity })
              : t('data.baggage.kgIncluded', { count: quantity });
          }
          return t('data.baggage.notIncluded');
        }
      }

      // Standard baggage types
      if (baggageType in BAGGAGE_SOURCE_TO_KEY) {
        return t(`data.baggage.${BAGGAGE_SOURCE_TO_KEY[baggageType]}`);
      }
      return baggageType;
    },
    [t],
  );

  return useMemo(
    () => ({
      translateRoomDescription,
      translateRoomTypeTitle,
      translateFlightInfo,
      translateBaggage,
    }),
    [translateRoomDescription, translateRoomTypeTitle, translateFlightInfo, translateBaggage],
  );
}
