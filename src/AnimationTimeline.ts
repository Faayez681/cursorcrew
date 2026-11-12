import type { Phase } from './types';
/** Tracks the phase machine and scaled time. Build → flock → outro. */
export class AnimationTimeline {
  phase: Phase = 'idle'; t = 0; pt = 0; speed = 1;
  static readonly FLOCK = 2.4;
  go(p: Phase) { this.phase = p; this.pt = 0; }
  reset() { this.t = 0; this.pt = 0; this.phase = 'idle'; }
  /** Returns scaled dt for sim, and advances clocks. */
  tick(dtReal: number): number { const dt = dtReal * this.speed; this.t += dt; this.pt += this.phase === 'outro' ? dtReal : dt; return dt; }
}
