import { generate } from '../src/engine/generator';
import { analyze } from '../src/engine/solver';
const count = Number(process.argv[2] ?? 1000), target = Number(process.argv[3] ?? 15), prefix = process.argv[4] ?? 'batch';
if (!Number.isInteger(count) || count < 1 || count > 100000) throw new Error('Count must be from 1 to 100000.');
console.log('version,seed,target,validPaths,minimumMoves,decisionCells,falseBranches,maxFalseDepth,deadEnds,failingRoutes,reachableCells');
for (let i = 0; i < count; i++) {
  const p = generate(`${prefix}-${i.toString().padStart(4, '0')}`, { target });
  const a = analyze(p, 0);
  console.log([p.version, JSON.stringify(p.seed), target, a.validPaths, a.minimumMoves, a.branchingDecisions, a.falseBranches.length,
    Math.max(0, ...a.falseBranches.map(b => b.depth)), a.deadEnds, a.failingRoutes, a.reachableCells].join(','));
}
