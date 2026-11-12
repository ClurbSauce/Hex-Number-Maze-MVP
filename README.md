# Hex / Number Maze

A mobile-first React + TypeScript + Vite prototype with an SVG board and a framework-independent TypeScript engine. No backend. The goal is to evaluate the puzzle mechanics before building a 3D renderer or a difficulty model.

## Run

Use Node 22 LTS or Node 24+ (the test runner does not officially support odd-numbered Node 23).

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the localhost address printed by Vite. Tap adjacent orange outlined numbers to progress from 1 to the target. Tap the blue outlined previous hex, or **Step back**, to retrace one step. Each movement counts. Keyboard users can Tab between available cells and press Enter or Space. The active cell stays centered; the configured number of rings is rendered (two rings / 19 cells by default).

The timer starts on the first legal move, includes time away from the tab, and stops on completion. New game starts a fresh UUID seed. Refreshing resets the active game; completed playtest records remain in local browser storage when available. There is no account, cloud sync, or resumable session.

## Game Lab

The development controls above the board default to **2 visible rings, target 25, scouting Once per run, primary score Mistakes, and Game over Dead end or 60 seconds**.

- **Game over**: Free play (no failure condition), No mistakes (first false-branch entry ends the run), Dead end (wrong turns are allowed; reaching a non-target cell with no adjacent next number ends the run), 30 seconds timer, 60 seconds timer, or **Dead end or 60 seconds** (whichever happens first). Timed modes start on the first legal move, show time remaining, and continue while the tab is in the background. At the exact deadline the run ends, including if a late click arrives before the next timer callback. Finishing before the deadline wins and stops the clock.
- In **Dead end** mode you can retrace while a forward option still exists, but once a dead end is reached the run ends immediately, even though the previous cell is adjacent. Reaching the target wins. Mistakes are still counted, and the standalone Dead end mode has no time limit. The combined mode also enforces a 60-second deadline: reaching the target must happen before it.
- A failed run locks movement and scouting, shows the reason, and offers **Retry same seed**. Retry resets time, moves, mistakes, and scout usage. Applying game-over rules preserves the exact board.
- Visible rings: 1–4. Scouting: None, Once per run, or Unlimited peeks. Primary score: Mistakes, Moves, or Time. Target: 15, 25, or 40.
- **Apply & restart same seed** starts a clean attempt. Visibility, scouting, and scoring changes reuse the exact puzzle object. Changing the target regenerates with the same seed and branch parameters; it is a different puzzle and should not be treated as a controlled visibility comparison.
- **Replay current settings** resets the current attempt without changing its board or configuration. **New game** is the explicit way to request a new seed.
- When enabled, **Scout +1 ring** temporarily reveals one extra ring, with no movement cost. It ends on the next legal move or when toggled off. Once per run consumes the single allowance when the peek opens; closing it or moving does not restore it. A retry, replay, new game, or applied configuration starts a new run and restores the allowance. Unlimited peeks allows repeated uses. Scout usage is counted separately. Disabled scouting supplies no peek control; the existing developer solution reveal remains a separate, recorded assistance tool.
- A **mistake** is a forward move from a cell that can reach the target into a false branch that cannot. Continuing deeper or retracing does not add mistakes. Re-entering that false branch counts again. Invalid taps are ignored. This uses solver knowledge, so the immediate score provides feedback about wrong turns.
- All three measures remain visible regardless of primary score; lower is better. Finished session JSON includes applied settings, mistakes, scout uses, and outcome (`complete`, `mistake`, `dead-end`, or `timeout`), so different conditions can be compared. Older records show unknown settings rather than assuming defaults.

Settings remain active across new games and replays within the page. Reloading restores the requested defaults. The generator v1 algorithm and existing seeds remain unchanged; extra rings beyond its original terrain use stable cosmetic padding that no legal increasing route can reach.

## Developer workbench

Turn on **Developer mode** beneath the game:

- Choose the target in Game Lab, then enter a seed in the workbench and Generate. This also replays the current seed from the start.
- Review exact route counts, minimum moves, decision cells, false branches, dead ends, and failing routes.
- Reveal a solution and select among the first 100 routes. Green markers show the chosen route in the normal viewport; an overview displays all reachable cells and neighboring terrain. Coordinate lists support precise inspection.
- Export the full puzzle, parameters, and analysis as JSON.
- Complete games, add feedback, and export playtest sessions. Revealing a route marks the session assisted, even if subsequently hidden. Completed and failed games are recorded; abandoned runs are not retained.

## Engine contracts

- `src/engine/hex.ts`: axial coordinates, neighbors, hex distance, disks, and 2D projection.
- `src/engine/generator.ts`: `generate(seed, { target, branchCount, maxBranchDepth })`. Defaults are 15, 8, and 4. Explicit validation allows targets 2–40. No browser, React, clock, or random global dependencies.
- `src/engine/solver.ts`: `analyze(puzzle, solutionLimit = 100)`. Exact counting is independent of preview enumeration. Pass zero to skip enumerating solutions in batch jobs.
- `src/engine/game.ts`: immutable movement, backtracking, and elapsed time, with explicit timestamps supplied by the caller.
- `src/engine/attempt.ts`: game-over rules, exact deadlines, mistake accounting, and terminal movement guards independent of React.

Reproducibility uses the exact seed string, generation parameters, and generator version. A stable string hash initializes Mulberry32. A self-avoiding increasing path is planted first; constrained retries have a guaranteed straight-path fallback. Additional increasing branches and random terrain introduce choices. Branch attempts can collide, reconnect, or accidentally reach a finish, so requested branch count/depth are generation controls, **not promises about measured difficulty**. Random terrain can extend a false branch beyond the requested planted depth. The solver measures the actual resulting graph.

The finite terrain disk extends to target + 1. Any reachable cell is at most target − 1 steps from the start, so two rings exist around every reachable cell, including dead ends and the finish. The view layer supplies deterministic cosmetic padding for larger visibility settings without mutating the puzzle. This is not an infinite world. Rendering depends on axial positions rather than SVG state, leaving a future Three.js renderer independent of gameplay.

Keep generator v1 stable once seeds are shared. Tests snapshot a complete board and its analysis; deliberate generation changes should increment the generator version and update fixtures explicitly. Seeds use a 32-bit PRNG hash, so distinct seed strings are not a mathematical guarantee of distinct boards. New-game seed IDs use UUIDs; tests separately verify board distinctness for the validation corpus.

## Metric definitions

The solver considers increasing paths from the single designated start, stopping at any target-valued cell. It does not enumerate walks containing backtracks (there are infinitely many such walks).

| Metric | Definition |
| --- | --- |
| Valid paths | Exact count of distinct increasing coordinate sequences ending at the target; reconverging routes remain distinct. |
| Minimum moves | Target − 1 if solvable; null otherwise. All forward-only successes have equal length. |
| Branching decisions | Distinct reachable cells that can reach a finish and have at least two forward neighbors, including false choices. Not summed repeatedly across routes. |
| False branches | Directed edges from a viable cell to a cell with no possible finish. A multi-level failed region has one entry per such departure edge. |
| False branch depth | Maximum forward steps from the viable departure cell to a dead end through the given entry. |
| Dead ends | Distinct reachable non-target cells with no forward neighbor. |
| Failing routes | Exact count of distinct increasing start-to-dead-end sequences. Shared endpoints can contribute multiple routes. |

Increasing values form a directed acyclic graph. Memoized dynamic programming counts routes without enumerating them, in O(V + E) graph operations plus BigInt arithmetic. Counts are decimal strings for JSON safety. Preview enumeration is capped; metrics are never truncated. Player completion adds two moves per retraced step to the forward-only minimum. Time and movement efficiency remain separate; no composite difficulty or scoring formula is imposed.

## Batch analysis

```sh
# CSV on stdout: count, target, optional seed prefix
npm run -s analyze -- 1000 15 batch > puzzles.csv
npm run -s analyze -- 1000 40 long > long-puzzles.csv
# Five deterministic traversals exercising wrong turns and backtracking
npm run playtest
```

[reports/puzzles-1000.csv](reports/puzzles-1000.csv) contains 1,000 reproducible target-15 puzzles. All have a valid solution. Sort the raw columns to compare characteristics; a ranking by perceived difficulty should wait for playtest evidence.

[reports/PLAYTEST.md](reports/PLAYTEST.md) distinguishes automated validation from the remaining human playtest questions. No claim of human enjoyment is inferred from solver success.

## Validation

36 automated tests cover single-use scouting, combined failure rules, game-over conditions, deadline boundaries, terminal locking, and Game Lab seed retention, target changes, stable visibility expansion, mistake counting, and geometry, reproducibility snapshots, 200 distinct solvable boards across targets 15 and 40, route adjacency and numbering, two-ring visibility at every reachable cell, exact counts against brute force, reconvergent paths, false-branch depth, unsolvable inputs, movement rejection, retracing, completion locking, and clock behavior. Browser checks cover mobile interaction, seed regeneration, developer tools, and completing targets 15 and 40.

Production uses React and React DOM only. Development uses Vite, TypeScript, Vitest, and tsx. Fonts optionally load from Google Fonts and fall back to local sans-serif fonts. No analytics are sent.
