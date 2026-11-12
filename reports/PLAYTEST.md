# Initial playtest and validation notes

## Automated five-puzzle traversal

The deterministic player tries forward neighbors in engine order and remembers exhausted cells. When all remaining choices fail, it retraces one cell. It only chooses adjacent next numbers, but has perfect memory; it does not model human behavior. Synthetic timestamps are intentionally excluded from timing conclusions.

| Seed | Moves | Backtracks | Viable decision cells | False branch entries | Deepest false branch | Successful routes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| playtest-1 | 34 | 10 | 11 | 10 | 5 | 12 |
| playtest-2 | 36 | 11 | 8 | 8 | 4 | 8 |
| playtest-3 | 26 | 6 | 11 | 7 | 5 | 16 |
| playtest-4 | 20 | 3 | 12 | 6 | 6 | 18 |
| playtest-5 | 36 | 11 | 7 | 7 | 5 | 2 |

All five finished. The minimum for each is 14 moves. The data confirms choices and detours are present, not that they are enjoyable. Source results are in `automated-playtest.json`; regenerate with `npm run -s playtest`.

## 1,000-puzzle corpus

Generator v1, target 15, default branch parameters, seeds `batch-0000` through `batch-0999`. All 1,000 seed IDs are distinct and all boards are solvable.

| Metric | Minimum | Mean | Maximum |
| --- | ---: | ---: | ---: |
| Successful routes | 1 | 6.88 | 124 |
| Viable decision cells | 3 | 8.41 | 17 |
| False branch entries | 1 | 7.74 | 15 |
| Maximum false branch depth | 1 | 4.50 | 10 |
| Distinct dead ends | 1 | 7.23 | 14 |

These distributions are a baseline, not a difficulty scale. Counts vary with seed, path geometry, reconnection, and incidental terrain edges.

## Browser verification

- Inspected desktop layout and the 390 × 844 mobile viewport.
- Moved forward, verified the active number remains centered, then retraced; both movements counted.
- Regenerated `playtest-1` and matched engine metrics (12 successful routes, 14 minimum moves).
- Completed a revealed target-15 route in 14 moves and verified an assisted session was recorded.
- Completed `browser-target-40` in 39 moves, with exactly 19 visible cells at the finish.
- No warnings or errors appeared in the inspected browser console.
- Browser automation runs are assisted verification, not human playtest evidence.

## Human playtest protocol — still needed

Play seeds `playtest-1` through `playtest-5` at target 15, without revealing routes. Add a note after each completion and export the sessions. Keep time and move totals independent.

For each puzzle, ask:

1. How many choices felt meaningful rather than obvious?
2. Did you remember and recognize the route when retracing?
3. Could you anticipate dead ends inside the two visible rings? Which surprises felt fair or arbitrary?
4. Did limited visibility create curiosity, frustration, or a memory burden?
5. What strategy developed? Did you scan the outer ring, remember failed branches, or guess?
6. After puzzle five, would you choose a sixth?

The generated false branches can extend well beyond the visible two rings, which is a candidate source of surprise or frustration. That is a hypothesis to test, not a conclusion about fairness. The notebook records completed runs only; an observer should also record abandoned puzzles and their reasons. Visibility radius is fixed at two in this MVP; controlled radius comparisons and adaptive generation are future experiments.
