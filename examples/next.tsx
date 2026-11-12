'use client'; // app/swarm-intro.tsx — render <SwarmIntro /> once in app/layout.tsx
import { useEffect } from 'react';
export default function SwarmIntro() {
  useEffect(() => { // dynamic import keeps the engine out of the server bundle
    let swarm: { destroy(): void } | undefined, cancelled = false;
    import('swarm-rebuild').then(({ SwarmRebuild }) => { if (!cancelled) swarm = new SwarmRebuild({ selector: 'body' }); });
    return () => { cancelled = true; swarm?.destroy(); };
  }, []);
  return null;
}
