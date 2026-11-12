# Cursor Crew (SwarmRebuild)

A native, framework-independent effect: a small crew of named cursors rebuilds your live page the way people work in a design editor, then sweeps across and hands over to the real site. TypeScript, Canvas 2D, Web Audio, Vite. Zero runtime dependencies. `CursorCrew` and `SwarmRebuild` are the same class.

## Install & run
```bash
npm install
npm run dev          # demo at http://localhost:5173
npm run build        # demo build -> dist/
npm run build:lib    # ES + UMD library -> dist-lib/
```

## Use
```ts
import { CursorCrew } from 'swarm-rebuild';
const crew = new CursorCrew({ selector: 'body', agents: 12, once: 'session', onComplete: ({ skipped, ms }) => {} });
crew.replay(); crew.finish(); crew.pause(); crew.resume(); crew.setAgents(20); crew.destroy();
```
React: `examples/react.tsx`. Next.js (client component, dynamic import so it never runs on the server): `examples/next.tsx`.

## Options
| Option | Default | Notes |
|---|---|---|
| selector | `body` | Subtree to scan |
| agents | 12 | Number of cursors; also selectable in the panel (restarts). Capped at 8 below 700px wide |
| speed | 1 | 1–3 via panel; any 0.25–4 via `setSpeed()` |
| sound | false | Synthesized key clicks, mouse clicks, paste, chime, sweep. Needs a first user gesture |
| autoStart | true | Skipped under `prefers-reduced-motion` (Replay still works) |
| once | false | `'session'` or `'forever'`: play only the first time. `replay()` always plays |
| tour | false | Cinematic: 0.7× pace, camera glides back to the top before the reveal |
| controls | true | Replay, Go live, 1×/2×/3×, Tour, Sound, cursor count, progress line |
| onProgress | – | `(fraction) => void` |
| onComplete | – | `({ skipped, ms }) => void` |

Keys: **Esc** go live, **M** sound.

## What you see
The page is scanned once, then a slow camera follows the crew down it (the real page scrolls in sync, so the reveal is seamless).
- Shapes are drag-drawn with a selection frame and size chip, then filled. Red alignment guides appear only where an edge really lines up with another.
- Text is typed at an uneven pace with a font chip; the odd slipped key is noticed and backspaced; cursors pause and hesitate; clicks leave a small ripple.
- Images appear as a frame and load like a progressive image.
- Repeated cards are built once, then copied and pasted; the copy's old text is selected and retyped.
- At the end the crew gathers, then sweeps left to right, revealing the live site behind it.

## Fidelity
Rendered from computed styles: backgrounds, linear gradients, CSS background images, box shadows, per-side borders, radii, element opacity, underline, `object-fit`/`object-position`, inline SVG, canvas/video. On the demo page the rebuilt frame matches the live page to a mean per-pixel difference below 0.4 / 255 (remaining differences are anti-aliasing). Web fonts are awaited (up to 0.8s) before scanning.

## Architecture
`DOMScanner` reads visible boxes, media and per-word text rects. `BlueprintGenerator` orders them top-down, finds repeated components and sets effort. `AgentCoordinator` assigns cursors and runs the behaviour (hesitation, typos, copy/paste, flocking). `ReconstructionRenderer` draws through a scrolling camera. `SwarmEngine` runs build, flock, wipe-reveal via `AnimationTimeline`; `AudioController` and `UIController` are optional.

## Performance
Only steps in view are drawn; DPR capped at 2 and dropped to 1 automatically if frames run long; one rAF loop, paused when the tab is hidden; fixed-size trail buffers; fewer cursors on mobile. The live site is never modified (only `scroll-behavior` is set to `auto` while running) and is interactive as the wipe reveals it.

## Limits
Scan covers up to 14 screens of page height. Radial/conic gradients and text gradients are approximated flat; CSS transforms, `<iframe>`, and shadow DOM are not reproduced. Inline SVGs that depend on external CSS may lose their colours.
