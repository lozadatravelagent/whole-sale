import { describe, it, expect } from 'vitest';
import { buildUnsplashUrl } from '../lib/buildUnsplashUrl';

function parse(url: string) {
  const [base, query] = url.split('?');
  return { base, params: new URLSearchParams(query ?? '') };
}

describe('buildUnsplashUrl', () => {
  it('builds a URL with the canonical default transform params', () => {
    const { base, params } = parse(buildUnsplashUrl('photo-abc'));
    expect(base).toBe('https://images.unsplash.com/photo-abc');
    expect(params.get('w')).toBe('1200');
    expect(params.get('q')).toBe('80');
    expect(params.get('auto')).toBe('format');
    expect(params.get('fit')).toBe('crop');
  });

  it('overrides the default width when a width argument is provided', () => {
    const { params } = parse(buildUnsplashUrl('photo-abc', 1920));
    expect(params.get('w')).toBe('1920');
    // Other defaults survive.
    expect(params.get('q')).toBe('80');
    expect(params.get('fit')).toBe('crop');
  });

  it('adds extra params alongside the defaults when they do not collide', () => {
    const { params } = parse(
      buildUnsplashUrl('photo-abc', undefined, { crop: 'faces' }),
    );
    expect(params.get('crop')).toBe('faces');
    // The default `fit=crop` still present — `crop` and `fit` are different keys.
    expect(params.get('fit')).toBe('crop');
  });

  it('lets extra params override a default value (extra wins)', () => {
    const { params } = parse(
      buildUnsplashUrl('photo-abc', undefined, { q: '90' }),
    );
    expect(params.get('q')).toBe('90');
  });

  it('produces a URL with a trailing slash when photoId is empty (caller is responsible for valid ids)', () => {
    const { base } = parse(buildUnsplashUrl(''));
    expect(base).toBe('https://images.unsplash.com/');
  });

  it('passes width=0 through as w=0 (no validation — caller is responsible)', () => {
    const { params } = parse(buildUnsplashUrl('photo-abc', 0));
    expect(params.get('w')).toBe('0');
  });
});
