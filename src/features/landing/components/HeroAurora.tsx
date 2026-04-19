import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Ambient gradient-canvas behind the hero. Three warm orbs (coral/amber/
 * red-pink) drift along independent lissajous trajectories so the flow
 * never perfectly repeats. The canvas is purely presentational — no
 * interaction, pointer-events none, aria-hidden.
 *
 * Runtime safeguards:
 *   - `prefers-reduced-motion: reduce` → draw once at t=0 and return; no
 *     raf, no observer, no visibilitychange listener installed.
 *   - `document.visibilitychange` pauses the raf when the tab is hidden.
 *   - `IntersectionObserver(threshold: 0)` pauses the raf when the canvas
 *     leaves the viewport (user scrolled past the hero).
 *   Both must be "visible" for the raf loop to run.
 *
 * Rendering:
 *   - Each frame clears and redraws the three orbs using radial gradients
 *     over `globalCompositeOperation = 'lighter'` so overlapping regions
 *     add brightness (aurora-like glow).
 *   - `devicePixelRatio` scaling keeps edges crisp on HiDPI displays.
 */

interface Orb {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  radius: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  hue: number;
  saturation: number;
  lightness: number;
}

const ORBS: readonly Orb[] = [
  {
    cx: 0.25,
    cy: 0.4,
    rx: 0.18,
    ry: 0.2,
    radius: 0.55,
    freqX: 0.11,
    freqY: 0.15,
    phaseX: 0,
    phaseY: 0,
    hue: 16,
    saturation: 85,
    lightness: 58,
  },
  {
    cx: 0.75,
    cy: 0.5,
    rx: 0.15,
    ry: 0.18,
    radius: 0.5,
    freqX: 0.13,
    freqY: 0.09,
    phaseX: 1.2,
    phaseY: 2.1,
    hue: 32,
    saturation: 80,
    lightness: 55,
  },
  {
    cx: 0.5,
    cy: 0.7,
    rx: 0.2,
    ry: 0.15,
    radius: 0.45,
    freqX: 0.08,
    freqY: 0.17,
    phaseX: 3.5,
    phaseY: 0.8,
    hue: 350,
    saturation: 65,
    lightness: 58,
  },
];

interface HeroAuroraProps {
  className?: string;
}

export function HeroAurora({ className }: HeroAuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawOrb = (orb: Orb, t: number) => {
      const x =
        width * orb.cx +
        width * orb.rx * Math.sin(t * orb.freqX * 2 * Math.PI + orb.phaseX);
      const y =
        height * orb.cy +
        height * orb.ry * Math.cos(t * orb.freqY * 2 * Math.PI + orb.phaseY);
      const r = Math.min(width, height) * orb.radius;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(
        0,
        `hsla(${orb.hue}, ${orb.saturation}%, ${orb.lightness}%, 0.55)`,
      );
      gradient.addColorStop(
        1,
        `hsla(${orb.hue}, ${orb.saturation}%, ${orb.lightness}%, 0)`,
      );
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const orb of ORBS) drawOrb(orb, t);
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      draw(0);
      const onResizeReduced = () => {
        resize();
        draw(0);
      };
      window.addEventListener('resize', onResizeReduced);
      return () => {
        window.removeEventListener('resize', onResizeReduced);
      };
    }

    let rafId: number | null = null;
    let isTabVisible = document.visibilityState === 'visible';
    let isInViewport = false;

    const loop = () => {
      draw(performance.now() / 1000);
      rafId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (rafId !== null) return;
      if (isTabVisible && isInViewport) {
        rafId = requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const onVisibility = () => {
      isTabVisible = document.visibilityState === 'visible';
      if (isTabVisible && isInViewport) start();
      else stop();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInViewport = entry.isIntersecting;
        if (isTabVisible && isInViewport) start();
        else stop();
      },
      { threshold: 0 },
    );

    const onResize = () => {
      resize();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    observer.observe(canvas);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none', className)}
    />
  );
}
