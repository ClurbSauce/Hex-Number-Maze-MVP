import { distance, type Hex } from '../engine/hex';
export const SCOUT_REACH = 2;
export function roundHex(h: Hex): Hex {
  let q=Math.round(h.q), r=Math.round(h.r), s=Math.round(-h.q-h.r);
  const dq=Math.abs(q-h.q), dr=Math.abs(r-h.r), ds=Math.abs(s+h.q+h.r);
  if(dq>dr && dq>ds) q=-r-s;
  else if(dr>ds) r=-q-s;
  return {q:q || 0,r:r || 0};
}
/** Drag the surface with the pointer; the viewing origin moves the opposite way. */
export function scoutOffset(start: Hex, dx: number, dy: number, unitsPerPixel: number, cellSize: number): Hex {
  const r=start.r-dy*unitsPerPixel/(1.5*cellSize);
  const q=start.q-dx*unitsPerPixel/(Math.sqrt(3)*cellSize)+dy*unitsPerPixel/(3*cellSize);
  const length=distance({q,r});
  const scale=length>SCOUT_REACH ? SCOUT_REACH/length : 1;
  return {q:q*scale,r:r*scale};
}
