import { useEffect } from 'react';
export function SwarmIntro() {
  useEffect(() => {
    let swarm: { destroy(): void } | undefined, cancelled = false;
    import('swarm-rebuild').then(({ SwarmRebuild }) => { if (!cancelled) swarm = new SwarmRebuild({ selector: '#root', agents: 80 }); });
    return () => { cancelled = true; swarm?.destroy(); };
  }, []);
  return null;
}
