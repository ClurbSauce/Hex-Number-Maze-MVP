import { describe, expect, it } from 'vitest';
import { expireAttempt, moveAttempt, newAttempt, timeLimit } from './attempt';
import { configurePuzzle, DEFAULT_LAB } from './lab';
import type { Puzzle } from './generator';
import { analyze } from './solver';
const p: Puzzle = { version: 1, seed: 'fixture', target: 3, branchCount: 0, maxBranchDepth: 1, start: '0,0',
  cells: Object.fromEntries([[0,0,1],[1,0,2],[2,0,3],[-1,0,2]].map(([q,r,value]) => [`${q},${r}`, {q,r,value}])) };
const viable = analyze(p).viableCells;
describe('game-over rules', () => {
  it('free play allows mistakes, retracing, and unlimited time', () => {
    let a = moveAttempt(p, newAttempt(p), '-1,0', 0, 'free-play', viable);
    expect(a.mistakes).toBe(1); expect(a.failure).toBeNull();
    expect(expireAttempt(a, 'free-play', 100000)).toBe(a);
    a = moveAttempt(p, a, '0,0', 100000, 'free-play', viable);
    expect(a.game.backtracks).toBe(1); expect(a.game.moves).toBe(2);
  });
  it('no mistakes ends on the first false-branch entry and locks movement', () => {
    const a = moveAttempt(p, newAttempt(p), '-1,0', 123, 'no-mistakes', viable);
    expect(a.failure).toEqual({ reason: 'mistake', at: 123 });
    expect(a.game.moves).toBe(1); expect(a.mistakes).toBe(1);
    expect(moveAttempt(p, a, '0,0', 456, 'no-mistakes', viable)).toBe(a);
    expect(expireAttempt(a, 'no-mistakes', 999)).toBe(a);
  });
  it('invalid taps do not start a timer or cause mistakes', () => {
    const a = newAttempt(p);
    for (const mode of ['free-play','no-mistakes','dead-end','timer-30','timer-60','dead-end-60'] as const) {
      expect(moveAttempt(p, a, '2,0', 100, mode, viable)).toBe(a);
      expect(expireAttempt(a, mode, 999999)).toBe(a);
    }
  });
  for (const mode of ['timer-30','timer-60','dead-end-60'] as const) {
    it(`${mode} expires exactly at its deadline, including a delayed callback`, () => {
      const a = moveAttempt(p, newAttempt(p), '1,0', 1000, mode, viable);
      const deadline = 1000 + timeLimit(mode)!;
      expect(expireAttempt(a, mode, deadline - 1)).toBe(a);
      const expired = expireAttempt(a, mode, deadline + 10000);
      expect(expired.failure).toEqual({ reason: 'timeout', at: deadline });
      const lateMove = moveAttempt(p, a, '2,0', deadline, mode, viable);
      expect(lateMove.failure?.reason).toBe('timeout');
      expect(lateMove.game.moves).toBe(1); expect(lateMove.game.finishedAt).toBeNull();
      expect(moveAttempt(p, expired, '0,0', deadline + 20000, mode, viable)).toBe(expired);
    });
    it(`${mode} preserves a success before the deadline`, () => {
      let a = moveAttempt(p, newAttempt(p), '1,0', 0, mode, viable);
      a = moveAttempt(p, a, '2,0', timeLimit(mode)! - 1, mode, viable);
      expect(a.game.finishedAt).toBe(timeLimit(mode)! - 1);
      expect(expireAttempt(a, mode, 999999)).toBe(a); expect(a.failure).toBeNull();
    });
  }
  it('all modes preserve the board and retry clears terminal state', () => {
    for (const gameOver of ['free-play','no-mistakes','dead-end','timer-30','timer-60','dead-end-60'] as const)
      expect(configurePuzzle(p, { ...DEFAULT_LAB, target: 3, gameOver })).toBe(p);
    const fresh = newAttempt(p);
    expect(fresh.failure).toBeNull(); expect(fresh.mistakes).toBe(0);
    expect(fresh.game.path).toEqual([p.start]); expect(fresh.game.startedAt).toBeNull();
  });
});


describe('dead-end mode', () => {
  const branchPuzzle: Puzzle = { ...p, target: 4,
    cells: Object.fromEntries([[0,0,1],[1,0,2],[2,0,3],[3,0,4],[-1,0,2],[-2,0,3]].map(([q,r,value]) => [`${q},${r}`, {q,r,value}])) };
  const branchViable = analyze(branchPuzzle).viableCells;
  it('allows mistakes and retreat before a dead end, then ends and locks on arrival', () => {
    let a = moveAttempt(branchPuzzle, newAttempt(branchPuzzle), '-1,0', 100, 'dead-end', branchViable);
    expect(a.mistakes).toBe(1); expect(a.failure).toBeNull();
    a = moveAttempt(branchPuzzle, a, '0,0', 200, 'dead-end', branchViable);
    expect(a.game.backtracks).toBe(1); expect(a.failure).toBeNull();
    a = moveAttempt(branchPuzzle, a, '-1,0', 300, 'dead-end', branchViable);
    expect(a.mistakes).toBe(2); expect(a.failure).toBeNull();
    a = moveAttempt(branchPuzzle, a, '-2,0', 400, 'dead-end', branchViable);
    expect(a.failure).toEqual({ reason: 'dead-end', at: 400 });
    expect(a.mistakes).toBe(2); expect(a.game.moves).toBe(4);
    expect(moveAttempt(branchPuzzle, a, '-1,0', 500, 'dead-end', branchViable)).toBe(a);
    expect(expireAttempt(a, 'dead-end', 999999)).toBe(a);
  });
  it('ends immediately on a one-step dead end', () => {
    const a = moveAttempt(p, newAttempt(p), '-1,0', 100, 'dead-end', viable);
    expect(a.failure?.reason).toBe('dead-end'); expect(a.mistakes).toBe(1);
  });
  it('reaching the target is success even with no next-number neighbor', () => {
    let a = moveAttempt(p, newAttempt(p), '1,0', 100, 'dead-end', viable);
    a = moveAttempt(p, a, '2,0', 200, 'dead-end', viable);
    expect(a.game.finishedAt).toBe(200); expect(a.failure).toBeNull();
    expect(moveAttempt(p, a, '1,0', 300, 'dead-end', viable)).toBe(a);
    expect(timeLimit('dead-end')).toBeNull();
  });
});


describe('combined dead end or 60 seconds', () => {
  it('ends at a dead end before the timer expires', () => {
    const a = moveAttempt(p, newAttempt(p), '-1,0', 100, 'dead-end-60', viable);
    expect(a.failure).toEqual({ reason: 'dead-end', at: 100 });
    expect(expireAttempt(a, 'dead-end-60', 100000)).toBe(a);
  });
  it('gives the expired deadline priority over a late move into a dead end', () => {
    let a = moveAttempt(p, newAttempt(p), '1,0', 100, 'dead-end-60', viable);
    a = moveAttempt(p, a, '0,0', 200, 'dead-end-60', viable);
    const expired = moveAttempt(p, a, '-1,0', 60100, 'dead-end-60', viable);
    expect(expired.failure).toEqual({ reason: 'timeout', at: 60100 });
    expect(expired.game).toBe(a.game);
  });
});
