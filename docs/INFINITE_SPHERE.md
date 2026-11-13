# Infinite rolling sphere prototype

Branch: `feature/infinite-sphere`. This is a renderer experiment; the game engine, generator v1, seeds, maze rules, scoring, scouting, and failure conditions are unchanged.

## Try it

Run `npm run dev`. Open **Rendering prototype** between Game Lab and the board, and select **Rolling sphere (Three.js)**. Flat SVG remains the default. Switching renderers or changing rendering sliders does not restart the attempt, change the seed, consume scouting, or stop a running timer.

The controls expose sphere radius (2–12 units), relative camera distance (6–15), perspective FOV (25–70 degrees), cell size (0.6–1.4), and roll duration (0–1,000 ms). Smaller radius increases curvature. Reset rendering controls restores only these five values. Extreme settings intentionally let the developer trade readability for distortion or zoom; default settings are tuned for two rings. More rings are framed automatically, with the distance slider applied relative to that framing.

The optional **Renderer-only six-direction navigation test** renders a separate synthetic grid. It allows all six adjacent moves, repeated travel, and a jump to `(1000000,-1000000)` without changing any puzzle data or gameplay state. Its numbers are coordinate-derived diagnostic labels, not a solvable puzzle. The actual game timer still runs if previously started. Disable this diagnostic to release its second WebGL context.

## Projection and rolling

The world is addressed by ordinary unwrapped axial coordinates `(q,r)`. Each frame first subtracts an interpolated local axial origin, then converts to the same pointy-top hex plane used by SVG. SVG's downward y-axis is flipped for Three.js.

For planar offset `(x,y)` and radius `R`, define:

```
s = R / sqrt(x*x + y*y + R*R)
P = (s*x, s*y, R*(s-1))
```

This inverse gnomonic projection places the visible patch on the front hemisphere of a sphere centered at `(0,0,-R)`. It is continuous and one-to-one for finite planar offsets; it uses no longitude, modulo coordinates, pole stitching, or finite globe texture. The local origin maps to the front point `(0,0,0)`.

On each adjacent move, interpolate the axial origin from its current displayed position to the new active cell with a smoothstep easing curve. The surface and labels move together along curved trajectories. A quick second move retargets from the in-flight origin rather than snapping or queuing an old move. Backtracking follows the same geometry in reverse. New attempts and nonadjacent diagnostic jumps snap to the new origin. Reduced-motion preferences and zero-duration rolls snap immediately.

This is a local spherical **illusion**, not rigid-body globe physics: a Euclidean infinite hex tiling cannot cover a sphere isometrically without distortion or defects. Reprojecting the local neighborhood deliberately avoids accumulating rotation/holonomy and preserves the coordinate grid. The viewport's center is fixed; during a transition the destination cell travels toward it and is exactly centered when the roll finishes. Keeping that destination pinned for every intermediate frame would prevent the requested rolling-to-center motion.

Each hex is tessellated into 96 triangles before projection. Adjacent edges use the same projection; small intentional gutters separate cells. Analytic sphere normals provide continuous lighting. Number textures are drawn locally to canvas and mapped onto the same curved mesh, so they foreshorten with the surface. No external font or texture asset is needed by this renderer.

## Architecture

- `src/rendering/types.ts`: immutable presentation cells and the shared renderer contract. The parent supplies active/visited/legal/solution flags and an `onMove(id)` callback.
- `FlatBoard.tsx`: the existing SVG board extracted into a standalone component, preserving hex sizes, labels, styling, keyboard behavior, and click handling.
- `SphereBoard.tsx`: Three.js scene, curved cell meshes, raycast picking, frame scheduling, texture creation, and lifecycle cleanup. It has no puzzle-generation, movement-validation, scoring, or failure logic.
- `projection.ts`: pure projection, local-coordinate, tessellation, and roll interpolation functions.
- `RendererControls.tsx`: rendering-only configuration, separate from Game Lab's apply-and-restart form.
- `NavigationProbe.tsx`: isolated six-direction diagnostic surface.

Three.js is used directly inside a React lifecycle boundary rather than adding React Three Fiber for one small imperative surface. It is lazy-loaded; flat gameplay does not load the Three.js chunk. This is roughly 132 kB gzipped of additional on-demand code, not included in the initial flat renderer bundle.

Only the caller's visible cells are rendered: normally 19. During spherical scouting the same 19-cell window shifts across the board; flat scouting still reveals an extra ring. There is no hidden full-board number layer. The visibility set switches with the logical move, just as in SVG; boundary cells can enter/leave at that instant while retained cells roll. This is an intentional strict-visibility boundary, not a globe wrap seam. Future work could mask that boundary transition without revealing additional numbers.

The generator remains a finite playable puzzle. “Infinite” describes the rendering coordinate space and travel model, not an infinite replacement puzzle generator. Cosmetic padding already supplied by the existing view adapter is reused without modifying the board.

## Interaction and lifecycle

Pointer taps raycast the actual deformed meshes. A drag beyond eight pixels starts spherical scouting when an allowance is available; it never counts as a move. Pointer capture supports continuing a drag outside the canvas and pointer cancellation clears the gesture. Touch dragging is enabled on the sphere when scouting is available. Keyboard users can Tab to legal move buttons, which become visible on focus. Both routes invoke the same parent callback as SVG; the engine validates every move, including expired deadlines. Scouting and solution highlights apply to both views.

Frames are requested only for animation, data/settings changes, or resizes. Device pixel ratio is capped at 2. Meshes, textures, and materials leaving the visible set are disposed. Unmount cancels animation frames, disconnects resize observers and pointer listeners, disposes renderer resources, and releases the WebGL context. Unsupported/lost WebGL provides a flat-view fallback without resetting game state.

## Validation

46 automated tests pass, including all 36 pre-existing engine/settings tests with no engine edits. New tests cover sphere membership, unique projected cells, direction signs, shared edges, tessellation area, exact arrival and reversal, retargeting, zero duration, and 10,000 translated movements near million-scale coordinates.

Browser checks exercise raycast moves, centering after movement, flat/sphere state preservation, the six-direction probe, distant coordinates, control changes, scouting, and mobile layout. This remains a technical prototype: perceived physical realism and comfortable curvature need hands-on evaluation on the intended mobile devices. No mobile GPU performance benchmark is claimed.

Implementation references: [Three.js resource cleanup](https://threejs.org/manual/pages/cleanup.html), [responsive rendering](https://threejs.org/manual/pages/responsive.html), and [raycasting](https://threejs.org/docs/pages/Raycaster).


## Drag scouting

The sphere now has a separate scouting view offset. Pointer movement translates to fractional axial displacement opposite the drag, making the surface follow the pointer. The offset is clamped to a two-hex radius around the player's actual position. A rounded offset selects which cells enter the visible window; the fractional offset drives the continuous curved projection. Only the configured ring count is drawn (19 cells for two rings), supplied from a bounded surrounding data pool. No puzzle cells or game state are rewritten.

A direct drag starts scouting and consumes the existing allowance once; subsequent drags within that session do not consume additional uses. Releasing keeps the view in place. **Return to player** animates the offset back to zero and ends the session. The sphere also returns when a legal game move or game-over condition closes scouting. Replay clears the offset and restores the allowance. Changing to flat view preserves the allowance and uses the existing flat-ring scouting interaction; returning to sphere starts the inspection view centered on the player.

The game timer continues if it has already started. Scouting itself does not start it, matching the existing first-legal-move rule. Movements and keyboard cell buttons are disabled in the sphere during inspection, so tapping a revealed cell cannot move the player accidentally. Tests cover drag direction, displacement bounds, visibility cardinality across directions, and revealing hidden cells without changing the player coordinate.
