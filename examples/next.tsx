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
