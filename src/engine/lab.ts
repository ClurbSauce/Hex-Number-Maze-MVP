import { generate, random, type Cell, type Puzzle } from './generator';
import { disk, key } from './hex';
import type { GameState } from './game';
export interface LabSettings {
  visibleRings: number;
  target: number;
  scouting: 'none' | 'peek' | 'once';
  primaryScore: 'mistakes' | 'moves' | 'time';
  gameOver: 'free-play' | 'no-mistakes' | 'dead-end' | 'timer-30' | 'timer-60' | 'dead-end-60';
}
export const DEFAULT_LAB: LabSettings = { visibleRings: 2, target: 25, scouting: 'once', primaryScore: 'mistakes', gameOver: 'dead-end-60' };
/** Viewing and scoring settings never participate in puzzle generation. */
export function configurePuzzle(puzzle: Puzzle, settings: LabSettings): Puzzle {
  return settings.target === puzzle.target ? puzzle : generate(puzzle.seed, {
    target: settings.target, branchCount: puzzle.branchCount, maxBranchDepth: puzzle.maxBranchDepth,
  });
}
export function viewCells(puzzle: Puzzle, current: string, rings: number): Cell[] {
  return disk(puzzle.cells[current], rings).map(h => puzzle.cells[key(h)] ?? {
    ...h,
    // Stable cosmetic padding beyond the original v1 board. No increasing path can reach it.
    value: 2 + Math.floor(random(`rim:${puzzle.seed}:${puzzle.target}:${key(h)}`)() * (puzzle.target - 1)),
  });
}
/** Count a wrong decision once when leaving the viable graph, not for each step inside it. */
export function entersFalseBranch(before: GameState, after: GameState, viableCells: readonly string[]): boolean {
  return after.path.length === before.path.length + 1
    && viableCells.includes(before.path[before.path.length - 1])
    && !viableCells.includes(after.path[after.path.length - 1]);
}

export const SCOUT_LABELS = { none: 'None', once: 'Once per run', peek: 'Unlimited peeks' } as const;
export interface ScoutState { active: boolean; uses: number }
export const newScout = (): ScoutState => ({ active: false, uses: 0 });
export function canScout(state: ScoutState, mode: LabSettings['scouting'], ended: boolean): boolean {
  return !ended && mode !== 'none' && (state.active || mode === 'peek' || state.uses < 1);
}
/** A use is consumed on opening, whether closed manually or by moving. */
export function toggleScout(state: ScoutState, mode: LabSettings['scouting'], ended: boolean): ScoutState {
  if (!canScout(state, mode, ended)) return state;
  return state.active ? { ...state, active: false } : { active: true, uses: state.uses + 1 };
}
