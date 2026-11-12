import { move, newGame, type GameState } from './game';
import { forward } from './solver';
import type { Puzzle } from './generator';
import { entersFalseBranch, type LabSettings } from './lab';
export const GAME_OVER_LABELS = {
  'free-play': 'Free play', 'no-mistakes': 'No mistakes', 'dead-end': 'Dead end', 'dead-end-60': 'Dead end or 60 seconds',
  'timer-30': '30 seconds timer', 'timer-60': '60 seconds timer',
} as const;
export interface Attempt {
  game: GameState;
  mistakes: number;
  failure: { reason: 'mistake' | 'timeout' | 'dead-end'; at: number } | null;
}
export const newAttempt = (p: Puzzle): Attempt => ({ game: newGame(p), mistakes: 0, failure: null });
export const timeLimit = (mode: LabSettings['gameOver']): number | null =>
  mode === 'timer-30' ? 30000 : (mode === 'timer-60' || mode === 'dead-end-60') ? 60000 : null;
/** Wall-clock deadline stays exact even if a background tab delays timer callbacks. */
export function expireAttempt(a: Attempt, mode: LabSettings['gameOver'], now: number): Attempt {
  const limit = timeLimit(mode);
  if (a.failure || a.game.finishedAt !== null || a.game.startedAt === null || limit === null) return a;
  const deadline = a.game.startedAt + limit;
  return now >= deadline ? { ...a, failure: { reason: 'timeout', at: deadline } } : a;
}
export function moveAttempt(p: Puzzle, a: Attempt, id: string, now: number, mode: LabSettings['gameOver'], viableCells: readonly string[]): Attempt {
  const current = expireAttempt(a, mode, now);
  if (current.failure || current.game.finishedAt !== null) return current;
  const game = move(p, current.game, id, now);
  if (game === current.game) return current;
  const mistake = entersFalseBranch(current.game, game, viableCells);
  const deadEnd = (mode === 'dead-end' || mode === 'dead-end-60') && game.finishedAt === null
    && forward(p, game.path[game.path.length - 1]).length === 0;
  return { game, mistakes: current.mistakes + Number(mistake),
    failure: mistake && mode === 'no-mistakes' ? { reason: 'mistake', at: now }
      : deadEnd ? { reason: 'dead-end', at: now } : null };
}
