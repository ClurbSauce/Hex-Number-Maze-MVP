import { pixel, type Hex } from '../engine/hex';
export interface SphereSettings {
  sphereRadius: number; cameraDistance: number; perspective: number; cellSize: number; duration: number;
}
export const DEFAULT_SPHERE: SphereSettings = { sphereRadius: 4.5, cameraDistance: 9, perspective: 45, cellSize: 1, duration: 380 };
/** Inverse gnomonic projection onto a sphere centered at (0,0,-R).
 * Every finite planar point maps injectively onto the front hemisphere: no longitude wrap or pole seam.
 * Rebase axial coordinates before projection; never rotate a growing global globe matrix.
 */
export function project(x: number, y: number, radius: number): [number, number, number] {
  const scale = radius / Math.hypot(x, y, radius);
  return [x * scale, y * scale, radius * (scale - 1)];
}
export function localPosition(cell: Hex, origin: Hex, size: number): { x: number; y: number } {
  const p = pixel({ q: cell.q - origin.q, r: cell.r - origin.r }, size);
  return { x: p.x, y: -p.y }; // SVG y points down; Three.js y points up.
}
export const ease = (t: number): number => {
  const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x);
};
export interface Roll { from: Hex; to: Hex; start: number; duration: number }
export function sampleRoll(roll: Roll, now: number): Hex {
  const t = roll.duration <= 0 ? 1 : ease((now - roll.start) / roll.duration);
  // Difference-first interpolation avoids loss of precision from blending large absolute positions.
  return { q: roll.from.q + (roll.to.q - roll.from.q) * t, r: roll.from.r + (roll.to.r - roll.from.r) * t };
}
/** A hex fan tessellated before projection, so edges bend with the surface rather than floating as flat tiles. */
export function hexTriangles(subdivisions = 4): number[] {
  const vertices: number[] = [];
  for (let side = 0; side < 6; side++) {
    const a = (side * 60 - 30) * Math.PI / 180, b = a + Math.PI / 3;
    const u = [Math.cos(a), Math.sin(a)], v = [Math.cos(b), Math.sin(b)];
    const point = (i: number, j: number) => [(i * u[0] + j * v[0]) / subdivisions, (i * u[1] + j * v[1]) / subdivisions];
    for (let i = 0; i < subdivisions; i++) for (let j = 0; j < subdivisions - i; j++) {
      vertices.push(...point(i,j), ...point(i+1,j), ...point(i,j+1));
      if (i+j < subdivisions-1) vertices.push(...point(i+1,j), ...point(i+1,j+1), ...point(i,j+1));
    }
  }
  return vertices;
}
