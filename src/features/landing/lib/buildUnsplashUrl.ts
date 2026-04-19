/**
 * Builds a hotlink URL to an Unsplash photo with sensible transform defaults.
 *
 * Defaults: `w=<width ?? 1200>`, `q=80`, `auto=format`, `fit=crop`. The
 * `extra` object spread-merges on top, so any key it provides overrides the
 * corresponding default (including `w` if the caller needs to override via
 * `extra` instead of the `width` positional argument).
 *
 * The function is purely presentational and does not validate `photoId`; the
 * caller is responsible for passing a well-formed Unsplash photo id (e.g.
 * `"photo-1483729558449-99ef09a8c325"`). Invalid ids produce URLs that 404 on
 * request; UnsplashImage handles the failure gracefully with a fallback
 * gradient.
 */
export function buildUnsplashUrl(
  photoId: string,
  width?: number,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    w: String(width ?? 1200),
    q: '80',
    auto: 'format',
    fit: 'crop',
    ...extra,
  });
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}
