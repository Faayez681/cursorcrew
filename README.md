# CursorCrew

**A framework-independent animated cursor crew that visually reconstructs your webpage and reveals the real site.**

CursorCrew is a TypeScript library built with Canvas 2D and Web Audio. It uses multiple animated cursors to recreate the appearance of a webpage, then reveals the original interactive page.

- Framework-independent TypeScript engine
- Zero runtime dependencies
- React and Next.js integration examples
- ESM and CommonJS support
- TypeScript declarations included

## Installation

```bash
npm install @zenoverse/cursorcrew
```

## Quick Start

```ts
import { CursorCrew } from '@zenoverse/cursorcrew';

const crew = new CursorCrew({
  selector: 'body',
  agents: 12,
});

// Available controls
crew.replay();
crew.pause();
crew.resume();
crew.finish();
crew.destroy();
```

## React

```tsx
import { useEffect } from 'react';

export function CursorCrewIntro() {
  useEffect(() => {
    let crew: { destroy(): void } | undefined;
    let cancelled = false;

    import('@zenoverse/cursorcrew').then(({ CursorCrew }) => {
      if (!cancelled) {
        crew = new CursorCrew({
          selector: '#root',
          agents: 12,
        });
      }
    });

    return () => {
      cancelled = true;
      crew?.destroy();
    };
  }, []);

  return null;
}
```

See `examples/react.tsx`.

## Next.js

CursorCrew accesses browser APIs, so initialize it inside a client component.

```tsx
'use client';

import { useEffect } from 'react';

export default function CursorCrewIntro() {
  useEffect(() => {
    let crew: { destroy(): void } | undefined;
    let cancelled = false;

    import('@zenoverse/cursorcrew').then(({ CursorCrew }) => {
      if (!cancelled) {
        crew = new CursorCrew({
          selector: 'body',
        });
      }
    });

    return () => {
      cancelled = true;
      crew?.destroy();
    };
  }, []);

  return null;
}
```

Render `<CursorCrewIntro />` once in your application layout.

See `examples/next.tsx`.

## Configuration

| Option | Default | Description |
|---|---|---|
| `selector` | `body` | Subtree to scan |
| `agents` | `12` | Number of animated cursors |
| `speed` | `1` | Animation speed |
| `sound` | `false` | Enable synthesized sound effects |
| `autoStart` | `true` | Automatically start the animation |
| `once` | `false` | Play once per session or forever |
| `tour` | `false` | Enable cinematic camera movement |
| `controls` | `true` | Show the animation controls |
| `onProgress` | — | Callback receiving animation progress |
| `onComplete` | — | Callback receiving `{ skipped, ms }` |

### Available methods

- `replay()` — replay the animation
- `finish()` — finish and reveal the live page
- `pause()` — pause the animation
- `resume()` — resume the animation
- `setAgents(count)` — change the cursor count
- `setSpeed(speed)` — change animation speed
- `destroy()` — clean up the instance

Keyboard shortcuts:

- `Esc` — reveal the live page
- `M` — toggle sound

## What happens during the animation?

1. CursorCrew scans the visible webpage.
2. Multiple cursors reconstruct page elements.
3. Text, shapes, images, and repeated components are animated.
4. The cursor crew gathers before the final reveal.
5. A sweeping transition reveals the real webpage.

The original page remains the actual interactive website.

## Architecture

| Module | Responsibility |
|---|---|
| `DOMScanner` | Reads visible page elements |
| `BlueprintGenerator` | Organizes reconstruction tasks |
| `AgentCoordinator` | Coordinates animated cursors |
| `ReconstructionRenderer` | Draws the reconstructed page |
| `SwarmEngine` | Controls the animation lifecycle |
| `AnimationTimeline` | Coordinates animation timing |
| `AudioController` | Handles sound effects |
| `UIController` | Manages animation controls |

## Performance

- Only visible steps are drawn.
- Device pixel ratio is capped at 2.
- Rendering adapts to slower frame rates.
- Animation pauses when the tab is hidden.
- Cursor count is reduced on smaller screens.

## Limitations

- Scanning covers up to 14 screens of page height.
- Radial and conic gradients are approximated.
- CSS transforms, iframes, and shadow DOM are not reproduced.
- Inline SVGs relying on external CSS may lose colours.
- Browser APIs are required; this library is not intended for server-side execution.

## Development

Clone the repository and install development dependencies:

```bash
npm install
```

Start the demo:

```bash
npm run dev
```

Build the distributable library:

```bash
npm run build
```

Generated files are placed in `dist-lib/`.

## License

See the repository for license information.
