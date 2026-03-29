import type { PlannerPlaceCategory } from '../types';

/** Foursquare category IDs mapped to internal planner categories. */
export const FSQ_CATEGORIES: Record<PlannerPlaceCategory, string[]> = {
  hotel: ['19014'],
  restaurant: ['13065', '13064'],
  cafe: ['13032', '13034'],
  museum: ['10027', '10024', '10058'],
  activity: ['16000', '10000', '10056', '10059', '16011'],
  sights: ['16026', '12104', '16020'],
  nightlife: ['13003', '10032'],
  parks: ['16032', '16019', '16046'],
  shopping: ['17000', '17114'],
  culture: ['10025', '10028'],
};

/** Infer internal category from Foursquare category objects. */
export function inferCategoryFromFSQ(
  fsqCategories: Array<{ id: number }> | undefined,
): PlannerPlaceCategory {
  const ids = fsqCategories?.map((c) => String(c.id)) ?? [];

  for (const [category, fsqIds] of Object.entries(FSQ_CATEGORIES)) {
    if (ids.some((id) => fsqIds.some((fid) => id.startsWith(fid)))) {
      return category as PlannerPlaceCategory;
    }
  }

  return 'activity';
}
