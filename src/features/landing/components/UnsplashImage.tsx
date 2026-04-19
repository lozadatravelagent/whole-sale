import { useState } from 'react';
import { cn } from '@/lib/utils';
import { buildUnsplashUrl } from '../lib/buildUnsplashUrl';

interface UnsplashImageProps {
  photoId: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  width?: number;
  fallbackGradient?: string;
}

/**
 * Presentational wrapper around an `<img>` that hotlinks an Unsplash photo
 * with our canonical transform params. On load failure (404, network error,
 * privacy blocker) swaps to a gradient fallback so layout never collapses.
 *
 * The fallback preserves the semantic role of the visual: the replacement
 * `<div>` carries `role="img"` + `aria-label={alt}` so screen readers still
 * announce the intended content.
 */
export function UnsplashImage({
  photoId,
  alt,
  className,
  loading = 'lazy',
  width = 1200,
  fallbackGradient = 'from-muted/40 to-muted',
}: UnsplashImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        data-testid="unsplash-image"
        className={cn('bg-gradient-to-br', fallbackGradient, className)}
      />
    );
  }

  return (
    <img
      src={buildUnsplashUrl(photoId, width)}
      alt={alt}
      loading={loading}
      onError={() => setHasError(true)}
      data-testid="unsplash-image"
      className={className}
    />
  );
}
