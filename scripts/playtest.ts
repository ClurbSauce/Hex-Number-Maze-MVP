import { generate } from '../src/engine/generator';
import { analyze, forward } from '../src/engine/solver';
import { move, newGame } from '../src/engine/game';
// Deterministic depth-first player: remembers exhausted cells, sees only adjacent choices.
// A mechanical smoke test, not evidence of human enjoyment or natural strategy.
const reports = [];
for (let i = 1; i <= 5; i++) {
  const p = generate(`playtest-${i}`), a = analyze(p);
  let state = newGame(p), tick = 0;
  const exhausted = new Set<string>();
  while (state.finishedAt === null && state.moves < 10000) {
    const id = state.path[state.path.length - 1];
    const next = forward(p, id).find(k => !exhausted.has(k));
    if (next) state = move(p, state, next, ++tick);
    else {
      exhausted.add(id);
      if (state.path.length < 2) throw new Error(`Unsolvable: ${p.seed}`);
      state = move(p, state, state.path[state.path.length - 2], ++tick);
    }
  }
  if (state.finishedAt === null) throw new Error(`Failed to complete ${p.seed}`);
  reports.push({ seed: p.seed, completed: true, moves: state.moves, backtracks: state.backtracks,
    minimumMoves: a.minimumMoves, decisionCells: a.branchingDecisions, falseBranches: a.falseBranches.length,
    maxFalseDepth: Math.max(0, ...a.falseBranches.map(b => b.depth)), validPaths: a.validPaths });
}
console.log(JSON.stringify({ type: 'automated traversal; not human playtesting', reports }, null, 2));
