import { describe, expect, it } from 'vitest';
import { disk, distance, key, neighbors } from './hex';
import { generate, type Puzzle } from './generator';
import { analyze, forward } from './solver';
import { elapsed, move, moveKind, newGame } from './game';

function fixture(values: [number, number, number][], target: number): Puzzle {
  return { version: 1, seed: 'fixture', target, branchCount: 0, maxBranchDepth: 1, start: '0,0',
    cells: Object.fromEntries(values.map(([q, r, value]) => [`${q},${r}`, { q, r, value }])) };
}
describe('axial geometry', () => {
  it('has six unique reciprocal neighbors', () => {
    const origin = { q: -2, r: 3 };
    expect(new Set(neighbors(origin).map(key)).size).toBe(6);
    for (const n of neighbors(origin)) {
      expect(distance(origin, n)).toBe(1);
      expect(neighbors(n).map(key)).toContain(key(origin));
    }
  });
  it('shows exactly nineteen cells within two rings', () => {
    const origin = { q: 7, r: -4 };
    expect(disk(origin, 2)).toHaveLength(19);
    expect(disk(origin, 2).every(h => distance(origin, h) <= 2)).toBe(true);
  });
});
describe('solver metrics', () => {
  it('counts reconvergent routes separately with a capped preview', () => {
    const p = fixture([[0,0,1],[1,0,2],[0,1,2],[1,1,3]], 3);
    const a = analyze(p, 1);
    expect(a.validPaths).toBe('2'); expect(a.minimumMoves).toBe(2);
    expect(a.branchingDecisions).toBe(1); expect(a.deadEnds).toBe(0);
    expect(a.failingRoutes).toBe('0'); expect(a.solutions).toHaveLength(1);
    expect(a.solutionsTruncated).toBe(true);
  });
  it('measures false branch depth and failing routes', () => {
    const p = fixture([[0,0,1],[1,0,2],[2,0,3],[3,0,4],[0,-1,2],[0,-2,3],[-1,-1,3]], 4);
    const a = analyze(p);
    expect(a.validPaths).toBe('1'); expect(a.failingRoutes).toBe('2');
    expect(a.deadEnds).toBe(2); expect(a.branchingDecisions).toBe(1);
    expect(a.falseBranches).toEqual([{ from: '0,0', entry: '0,-1', depth: 2, failingRoutes: '2' }]);
  });
  it('handles an unsolvable start', () => {
    const a = analyze(fixture([[0,0,1],[1,0,3]], 3));
    expect(a.minimumMoves).toBeNull(); expect(a.validPaths).toBe('0');
    expect(a.failingRoutes).toBe('1'); expect(a.deadEnds).toBe(1);
  });
});
describe('seeded generation', () => {
  it('is deterministic for identical seeds and parameters', () => {
    expect(generate('honey-01')).toEqual(generate('honey-01'));
    expect(generate('honey-01', { target: 40 })).toEqual(generate('honey-01', { target: 40 }));
    expect(generate('honey-01')).not.toEqual(generate('honey-02'));
  });
  it('keeps a stable generator v1 fingerprint', () => {
    const p = generate('regression-seed');
    // Snapshot includes all terrain, generation parameters, and exact solver metrics.
    expect(JSON.stringify(p)).toMatchSnapshot();
    expect(analyze(p)).toMatchSnapshot();
  });
  it('generates 100 distinct solvable puzzles at both initial and future targets', () => {
    for (const target of [15, 40]) {
      const fingerprints = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const p = generate(`validation-${i}`, { target });
        fingerprints.add(JSON.stringify(p.cells));
        const a = analyze(p);
        expect(BigInt(a.validPaths)).toBeGreaterThan(0n);
        expect(a.minimumMoves).toBe(target - 1);
        const seen = new Set<string>();
        const checkVisibility = (id: string) => {
          if (seen.has(id)) return;
          seen.add(id);
          expect(disk(p.cells[id], 2).every(h => Boolean(p.cells[key(h)]))).toBe(true);
          if (p.cells[id].value < target) forward(p, id).forEach(checkVisibility);
        };
        checkVisibility(p.start);
        for (const path of a.solutions) {
          expect(path).toHaveLength(target); expect(path[0]).toBe(p.start);
          path.forEach((id, j) => {
            expect(p.cells[id].value).toBe(j + 1);
            if (j) expect(distance(p.cells[path[j - 1]], p.cells[id])).toBe(1);
          });
        }
      }
      expect(fingerprints.size).toBe(100);
    }
  });
  it('rejects invalid generation options', () => {
    for (const target of [0, 1, 41, 2.5, NaN]) expect(() => generate('x', { target })).toThrow();
    expect(() => generate(' ')).toThrow();
    expect(() => generate('x', { branchCount: -1 })).toThrow();
  });
  it('agrees with brute-force route counting on small generated puzzles', () => {
    for (let i = 0; i < 20; i++) {
      const p = generate(`small-${i}`, { target: 6 });
      const brute = (id: string): { wins: number; fails: number } => {
        if (p.cells[id].value === p.target) return { wins: 1, fails: 0 };
        const next = forward(p, id);
        if (!next.length) return { wins: 0, fails: 1 };
        return next.map(brute).reduce((a, b) => ({ wins: a.wins + b.wins, fails: a.fails + b.fails }), { wins: 0, fails: 0 });
      };
      const b = brute(p.start), a = analyze(p);
      expect(a.validPaths).toBe(String(b.wins)); expect(a.failingRoutes).toBe(String(b.fails));
    }
  });
});
describe('player movement and clock', () => {
  const p = fixture([[0,0,1],[1,0,2],[2,0,3],[0,1,2],[0,2,1]], 3);
  it('accepts adjacent next numbers and rejects jumps, same cells, and unrelated lower numbers', () => {
    let s = newGame(p);
    expect(move(p,s,'2,0',0)).toBe(s); expect(move(p,s,'0,0',0)).toBe(s);
    expect(move(p,s,'missing',0)).toBe(s);
    s = move(p,s,'0,1',100);
    expect(moveKind(p,s,'0,2')).toBeNull();
    expect(moveKind(p,s,'0,0')).toBe('back');
  });
  it('counts each backtracking step and locks after completion', () => {
    let s = move(p,newGame(p),'0,1',1000);
    s = move(p,s,'0,0',2000); expect(s.backtracks).toBe(1); expect(s.moves).toBe(2);
    s = move(p,s,'1,0',3000); s = move(p,s,'2,0',4000);
    expect(s.moves).toBe(4); expect(s.path).toEqual(['0,0','1,0','2,0']);
    expect(elapsed(s,9000)).toBe(3000); expect(move(p,s,'1,0',5000)).toBe(s);
  });
  it('starts on the first legal movement, including timestamp zero', () => {
    const s = newGame(p); expect(elapsed(s,10000)).toBe(0);
    const started = move(p,s,'1,0',0); expect(elapsed(started,500)).toBe(500);
    expect(move(p,started,'2,0',1000).startedAt).toBe(0);
  });
});
