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
