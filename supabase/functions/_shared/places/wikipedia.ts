import type { PlannerPlaceCategory } from './types.ts';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

const SKIP_CATEGORIES: PlannerPlaceCategory[] = [
  'restaurant',
  'cafe',
  'nightlife',
  'shopping',
  'hotel',
];

async function searchForPhoto(query: string): Promise<string | null> {
  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      origin: '*',
      srlimit: '1',
    });

    const searchResponse = await fetch(`${WIKI_API}?${searchParams}`);
    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json() as {
      query?: { search?: Array<{ title: string }> };
    };

    const title = searchData.query?.search?.[0]?.title;
    if (!title) return null;

    const imageParams = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'pageimages',
      format: 'json',
      origin: '*',
      pithumbsize: '800',
      pilicense: 'any',
    });

    const imageResponse = await fetch(`${WIKI_API}?${imageParams}`);
    if (!imageResponse.ok) return null;

    const imageData = await imageResponse.json() as {
      query?: { pages?: Record<string, { thumbnail?: { source: string } }> };
    };

    const pages = imageData.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function fetchWikipediaPhoto(
  placeName: string,
  city: string,
  category?: PlannerPlaceCategory,
): Promise<string | null> {
  if (category && SKIP_CATEGORIES.includes(category)) {
    return null;
  }

  return await searchForPhoto(`${placeName} ${city}`);
}
