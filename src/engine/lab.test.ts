import { describe, expect, it } from 'vitest';
import { canScout, configurePuzzle, DEFAULT_LAB, entersFalseBranch, newScout, toggleScout, viewCells } from './lab';
import { generate, type Puzzle } from './generator';
import { move, newGame } from './game';
import { analyze } from './solver';
import { key } from './hex';

describe('Game Lab comparison settings', () => {
  it('defaults to two rings, target 25, one scout, mistakes, and dead end or 60 seconds', () => {
    expect(DEFAULT_LAB).toEqual({ visibleRings: 2, target: 25, scouting: 'once', primaryScore: 'mistakes', gameOver: 'dead-end-60' });
  });
  it('preserves the exact puzzle object for viewing and scoring changes', () => {
    const p = generate('comparison', { target: 25 });
    const before = JSON.stringify(p);
    for (const visibleRings of [1, 2, 3, 4]) {
      for (const scouting of ['none', 'peek', 'once'] as const) {
        for (const primaryScore of ['mistakes', 'moves', 'time'] as const) {
          expect(configurePuzzle(p, { ...DEFAULT_LAB, target: 25, visibleRings, scouting, primaryScore })).toBe(p);
        }
      }
    }
    expect(JSON.stringify(p)).toBe(before);
  });
  it('keeps seed and generation parameters when target changes', () => {
    const p = generate('comparison', { target: 15, branchCount: 4, maxBranchDepth: 2 });
    const updated = configurePuzzle(p, DEFAULT_LAB);
    expect(updated).toEqual(generate('comparison', { target: 25, branchCount: 4, maxBranchDepth: 2 }));
    expect(configurePuzzle(updated, { ...DEFAULT_LAB, target: 15 })).toEqual(p);
  });
  it('expands and contracts the view without changing cells, even at the terrain edge', () => {
    const p = generate('comparison', { target: 2 });
    const before = JSON.stringify(p);
    for (const radius of [1, 2, 3, 4, 5]) {
      const view = viewCells(p, '1,0', radius);
      expect(view).toHaveLength(1 + 3 * radius * (radius + 1));
      expect(viewCells(p, '1,0', radius)).toEqual(view);
      const larger = new Map(viewCells(p, '1,0', radius + 1).map(c => [key(c), c]));
      for (const cell of view) expect(larger.get(key(cell))).toEqual(cell);
    }
    expect(JSON.stringify(p)).toBe(before);
  });
  it('counts entry into a false branch, not deeper steps, invalid taps, or retracing', () => {
    const p: Puzzle = { version: 1, seed: 'fixture', target: 4, branchCount: 0, maxBranchDepth: 1, start: '0,0',
      cells: Object.fromEntries([[0,0,1],[1,0,2],[2,0,3],[3,0,4],[0,-1,2],[0,-2,3]].map(([q,r,value]) => [`${q},${r}`, {q,r,value}])) };
    const viable = analyze(p).viableCells;
    let state = newGame(p), mistakes = 0;
    for (const id of ['0,-1', '0,-2', 'missing', '0,-1', '0,0', '1,0', '2,0', '3,0']) {
      const next = move(p, state, id, state.moves * 100);
      mistakes += Number(entersFalseBranch(state, next, viable));
      state = next;
    }
    expect(mistakes).toBe(1);
    expect(state.backtracks).toBe(2);
    expect(state.moves).toBe(7);
    expect(state.finishedAt).not.toBeNull();
    expect(entersFalseBranch(newGame(p), move(p, newGame(p), '0,-1', 0), viable)).toBe(true);
  });
});


describe('scouting allowance', () => {
  it('consumes one use on opening and prevents reopening after manual close', () => {
    let s = toggleScout(newScout(), 'once', false);
    expect(s).toEqual({ active: true, uses: 1 });
    expect(canScout(s, 'once', false)).toBe(true);
    s = toggleScout(s, 'once', false);
    expect(s).toEqual({ active: false, uses: 1 });
    expect(canScout(s, 'once', false)).toBe(false);
    expect(toggleScout(s, 'once', false)).toBe(s);
  });
  it('cannot reopen after moving, and a new run restores the allowance', () => {
    const opened = toggleScout(newScout(), 'once', false);
    const afterMove = { ...opened, active: false };
    expect(toggleScout(afterMove, 'once', false)).toBe(afterMove);
    expect(canScout(newScout(), 'once', false)).toBe(true);
  });
  it('keeps unlimited peeks available and blocks disabled or finished scouting', () => {
    let s = newScout();
    expect(toggleScout(s, 'none', false)).toBe(s);
    expect(toggleScout(s, 'once', true)).toBe(s);
    for (let i = 0; i < 3; i++) {
      s = toggleScout(s, 'peek', false);
      s = toggleScout(s, 'peek', false);
    }
    expect(s).toEqual({ active: false, uses: 3 });
  });
});
