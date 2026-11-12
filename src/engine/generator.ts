import { disk, key, neighbors, type Hex } from './hex';
export interface Cell extends Hex { value: number }
export interface Puzzle {
  version: 1; seed: string; target: number; branchCount: number; maxBranchDepth: number;
  start: string; cells: Record<string, Cell>;
}
export interface GenerationOptions { target?: number; branchCount?: number; maxBranchDepth?: number }
/** Stable string hash + Mulberry32. Never uses Math.random or the clock. */
export function random(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function generate(seed: string, options: GenerationOptions = {}): Puzzle {
  const { target = 15, branchCount = 8, maxBranchDepth = 4 } = options;
  if (!seed.trim()) throw new Error('Enter a non-empty seed.');
  if (!Number.isInteger(target) || target < 2 || target > 40) throw new Error('Target must be an integer from 2 to 40.');
  if (!Number.isInteger(branchCount) || branchCount < 0 || branchCount > 100) throw new Error('Branch count must be from 0 to 100.');
  if (!Number.isInteger(maxBranchDepth) || maxBranchDepth < 1 || maxBranchDepth > 10) throw new Error('Branch depth must be from 1 to 10.');
  const rng = random(`hex-v1:${seed}:${target}:${branchCount}:${maxBranchDepth}`);
  const pick = <T,>(items: T[]): T => items[Math.floor(rng() * items.length)];
  // Grow a self-avoiding sequence. Restart a trapped walk; straight fallback guarantees termination.
  let route: Cell[] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    route = [{ q: 0, r: 0, value: 1 }];
    const occupied = new Set(['0,0']);
    while (route.length < target) {
      const next = neighbors(route[route.length - 1]).filter(h => !occupied.has(key(h)));
      if (!next.length) break;
      const h = pick(next);
      route.push({ ...h, value: route.length + 1 }); occupied.add(key(h));
    }
    if (route.length === target) break;
  }
  if (route.length !== target) route = Array.from({ length: target }, (_, i) => ({ q: i, r: 0, value: i + 1 }));
  const cells: Record<string, Cell> = Object.fromEntries(route.map(c => [key(c), c]));
  // Plant competing increasing chains. Intersections can reconnect, so the solver classifies actual failures.
  for (let i = 0; i < branchCount; i++) {
    let current = pick(route.slice(0, -2));
    if (!current) break;
    const depth = 1 + Math.floor(rng() * maxBranchDepth);
    for (let step = 0; step < depth && current.value < target - 1; step++) {
      const free = neighbors(current).filter(h => !cells[key(h)]);
      if (!free.length) break;
      current = { ...pick(free), value: current.value + 1 };
      cells[key(current)] = current;
    }
  }
  // Two rings of numbered terrain around every playable cell keep the viewport populated.
  // No increasing route can travel farther than target - 1 from the start.
  // Padding that bound by two guarantees all 19 visible cells exist, even on detours.
  const terrainRadius = target + 1;
  for (const h of disk({ q: 0, r: 0 }, terrainRadius))
    if (!cells[key(h)]) cells[key(h)] = { ...h, value: 2 + Math.floor(rng() * (target - 1)) };
  return { version: 1, seed, target, branchCount, maxBranchDepth, start: '0,0', cells };
}
