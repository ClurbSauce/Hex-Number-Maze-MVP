export interface Hex { q: number; r: number }
export const directions: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
export const key = ({ q, r }: Hex): string => `${q},${r}`;
export const distance = (a: Hex, b: Hex = { q: 0, r: 0 }): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const neighbors = (h: Hex): Hex[] => directions.map(d => ({ q: h.q + d.q, r: h.r + d.r }));
export function disk(center: Hex, radius: number): Hex[] {
  const result: Hex[] = [];
  for (let q = -radius; q <= radius; q++)
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++)
      result.push({ q: center.q + q, r: center.r + r });
  return result;
}
export const pixel = ({ q, r }: Hex, size: number): { x: number; y: number } =>
  ({ x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r });
