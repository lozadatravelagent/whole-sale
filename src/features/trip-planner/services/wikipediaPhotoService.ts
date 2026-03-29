/**
 * Wikipedia photo fallback for places without Foursquare photos.
 * Uses the free Wikipedia REST API (CORS-enabled, no API key).
 *
 * Only useful for notable places (landmarks, museums, parks).
 * Restaurants, cafes, hotels, and small businesses are skipped.
 */

import { placesCache, cacheKeys } from './placesCache';
import type { PlannerPlaceCategory } from '../types';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

/** Categories unlikely to have Wikipedia articles — skip to avoid wasted requests. */
const SKIP_CATEGORIES: PlannerPlaceCategory[] = [
  'restaurant',
  'cafe',
  'nightlife',
  'shopping',
  'hotel',
];

function wikiCacheKey(name: string, city: string): string {
  return cacheKeys.geocoding(`wiki::${name}::${city}`);
}

/**
 * Use the MediaWiki API with `prop=pageimages` to get a photo.
 * This avoids the REST summary endpoint which logs 404s in the console.
 */
async function searchForPhoto(query: string): Promise<string | null> {
  try {
    // Step 1: search for the article
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      origin: '*',
      srlimit: '1',
    });
    const searchRes = await fetch(`${WIKI_API}?${searchParams}`);
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json()) as {
      query?: { search?: Array<{ title: string }> };
    };
    const title = searchData.query?.search?.[0]?.title;
    if (!title) return null;

    // Step 2: get the page image via pageimages prop (no 404 risk)
    const imgParams = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'pageimages',
      format: 'json',
      origin: '*',
      pithumbsize: '800',
      pilicense: 'any',
    });
    const imgRes = await fetch(`${WIKI_API}?${imgParams}`);
    if (!imgRes.ok) return null;
    const imgData = (await imgRes.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source: string } }> };
    };
    const pages = imgData.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a photo URL from Wikipedia for a given place.
 * Skips restaurants, cafes, hotels, nightlife, and shopping.
 * Results are cached in IndexedDB via placesCache.
 */
export async function fetchWikipediaPhoto(
  placeName: string,
  city: string,
  category?: PlannerPlaceCategory,
): Promise<string | null> {
  if (category && SKIP_CATEGORIES.includes(category)) return null;

  const key = wikiCacheKey(placeName, city);
  const cached = await placesCache.get<string>('geocoding', key);
  if (cached !== null) return cached || null;

  const photo = await searchForPhoto(`${placeName} ${city}`);

  // Cache even empty string to avoid re-fetching misses
  await placesCache.set('geocoding', key, photo ?? '');
  return photo;
}
