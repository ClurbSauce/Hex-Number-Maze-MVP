import { distance } from './hex';
import type { Puzzle } from './generator';
export interface GameState { path: string[]; moves: number; backtracks: number; startedAt: number | null; finishedAt: number | null }
export const newGame = (p: Puzzle): GameState => ({ path: [p.start], moves: 0, backtracks: 0, startedAt: null, finishedAt: null });
export function moveKind(p: Puzzle, s: GameState, id: string): 'forward' | 'back' | null {
  if (s.finishedAt !== null || !p.cells[id]) return null;
  const current = p.cells[s.path[s.path.length - 1]];
  if (distance(current, p.cells[id]) !== 1) return null;
  if (s.path.length > 1 && id === s.path[s.path.length - 2]) return 'back';
  return p.cells[id].value === current.value + 1 ? 'forward' : null;
}
export function move(p: Puzzle, s: GameState, id: string, now: number): GameState {
  const kind = moveKind(p, s, id); if (!kind) return s;
  return { path: kind === 'back' ? s.path.slice(0, -1) : [...s.path, id], moves: s.moves + 1,
    backtracks: s.backtracks + Number(kind === 'back'), startedAt: s.startedAt ?? now,
    finishedAt: p.cells[id].value === p.target ? now : null };
}
export const elapsed = (s: GameState, now: number): number => s.startedAt === null ? 0 : Math.max(0, (s.finishedAt ?? now) - s.startedAt);
