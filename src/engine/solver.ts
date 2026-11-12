import { key, neighbors } from './hex';
import type { Puzzle } from './generator';
export const forward = (p: Puzzle, id: string): string[] => neighbors(p.cells[id])
  .map(key).filter(k => p.cells[k]?.value === p.cells[id].value + 1);
export interface Analysis {
  validPaths: string; minimumMoves: number | null; branchingDecisions: number;
  falseBranches: { from: string; entry: string; depth: number; failingRoutes: string }[];
  deadEnds: number; failingRoutes: string; reachableCells: number;
  solutions: string[][]; solutionsTruncated: boolean;
  viableCells: string[];
  reachableCellIds: string[];
}
/** Strictly increasing edges form a DAG. Counts are exact BigInts, serialized as decimal strings. */
export function analyze(p: Puzzle, solutionLimit = 100): Analysis {
  const memo = new Map<string, { wins: bigint; failures: bigint; depth: number }>();
  const visit = (id: string): { wins: bigint; failures: bigint; depth: number } => {
    const cached = memo.get(id); if (cached) return cached;
    const children = p.cells[id].value === p.target ? [] : forward(p, id);
    const results = children.map(visit);
    const result = {
      wins: p.cells[id].value === p.target ? 1n : results.reduce((n, r) => n + r.wins, 0n),
      failures: p.cells[id].value === p.target ? 0n : !children.length ? 1n : results.reduce((n, r) => n + r.failures, 0n),
      depth: results.length ? 1 + Math.max(...results.map(r => r.depth)) : 0,
    };
    memo.set(id, result); return result;
  };
  const root = visit(p.start);
  const viableCells = [...memo].filter(([, r]) => r.wins > 0n).map(([id]) => id);
  const falseBranches: Analysis['falseBranches'] = [];
  let branchingDecisions = 0, deadEnds = 0;
  for (const [id, result] of memo) {
    const children = p.cells[id].value === p.target ? [] : forward(p, id);
    if (!children.length && p.cells[id].value !== p.target) deadEnds++;
    if (result.wins && children.length > 1) branchingDecisions++;
    if (result.wins) for (const child of children) {
      const r = memo.get(child)!;
      if (!r.wins) falseBranches.push({ from: id, entry: child, depth: r.depth + 1, failingRoutes: r.failures.toString() });
    }
  }
  const solutions: string[][] = [];
  const enumerate = (id: string, path: string[]) => {
    if (solutions.length >= solutionLimit || !memo.get(id)!.wins) return;
    const nextPath = [...path, id];
    if (p.cells[id].value === p.target) solutions.push(nextPath);
    else for (const next of forward(p, id)) enumerate(next, nextPath);
  };
  enumerate(p.start, []);
  return { validPaths: root.wins.toString(), minimumMoves: root.wins ? p.target - 1 : null,
    branchingDecisions, falseBranches, deadEnds, failingRoutes: root.failures.toString(),
    reachableCells: memo.size, reachableCellIds: [...memo.keys()], solutions,
    solutionsTruncated: root.wins > BigInt(solutions.length), viableCells };
}
