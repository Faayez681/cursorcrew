import type { Step } from './types';
export const TRAIL = 10;
/** One collaborator. Motion is a damped spring (slight overshoot, settles), with hand tremor and per-person timing. */
export class CursorAgent {
  x: number; y: number; vx = 0; vy = 0; task: Step | null = null; slot = 0; working = false;
  dwell = 0; rest = 0; join = 0; lw = 0;
  readonly max = 650 + Math.random() * 350; readonly w = 7 + Math.random() * 2.5; readonly z = 0.66 + Math.random() * 0.14; readonly ph = Math.random() * 6.28;
  readonly trail = new Float32Array(TRAIL * 2); th = 0; tn = 0;
  constructor(public id: number, public color: string, public name: string, x: number, y: number) { this.x = x; this.y = y; }
  /** fine = near the work: stiffer so the pointer tracks a moving caret/corner closely. */
  update(dt: number, tx: number, ty: number, t: number, spd = 1, fine = false) {
    const w = this.w * (fine ? 2.2 : 1), z = this.z, mv = this.max * spd, lim = 7000 * spd;
    tx += Math.sin(t * 17 + this.ph) * 0.35 + Math.sin(t * 6.1 + this.ph * 2) * 0.3; ty += Math.cos(t * 15 + this.ph) * 0.35 + Math.cos(t * 5.3 + this.ph) * 0.3;
    const n = Math.max(1, Math.ceil(dt / 0.016)), h = dt / n;
    for (let i = 0; i < n; i++) {
      let ax = w * w * (tx - this.x) - 2 * z * w * this.vx, ay = w * w * (ty - this.y) - 2 * z * w * this.vy;
      const am = Math.hypot(ax, ay); if (am > lim) { ax *= lim / am; ay *= lim / am; }
      this.vx += ax * h; this.vy += ay * h; const v = Math.hypot(this.vx, this.vy); if (v > mv) { this.vx *= mv / v; this.vy *= mv / v; }
      this.x += this.vx * h; this.y += this.vy * h;
    }
    this.trail[this.th * 2] = this.x; this.trail[this.th * 2 + 1] = this.y; this.th = (this.th + 1) % TRAIL; this.tn = Math.min(TRAIL, this.tn + 1);
  }
}
