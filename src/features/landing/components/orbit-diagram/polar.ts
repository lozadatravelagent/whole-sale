export interface PolarPoint {
  x: number;
  y: number;
}

/**
 * Convert an angle (in degrees, 0 = top) and radius (in viewBox units centered
 * at 50,50) into cartesian coordinates inside a 100x100 SVG viewBox.
 */
export function polar(angle: number, radius: number): PolarPoint {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}
