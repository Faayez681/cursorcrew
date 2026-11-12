import { CursorAgent } from './CursorAgent';
import type { Step } from './types';
const NAMES = 'Maya Arjun Leo Sofia Noah Priya Ethan Chloe Kenji Amara Lucas Zoe Omar Hana Mateo Ines Daniel Mei Theo Nora Ravi Elena Jonas Aiko Sam Lena Diego Fatima Owen Yuki'.split(' ');
const PALETTE = ['#F24822', '#9747FF', '#0D99FF', '#14AE5C', '#EC6A00', '#D6409F', '#0B8A8A', '#5B6CFF', '#B7791F', '#C2410C', '#4C8F4C', '#8B5CF6'];
const ease = (t: number) => t * t * (3 - 2 * t);
const cl = (v: number) => Math.max(0, Math.min(1, v));
const cap = (s: Step) => s.dupOf ? 2 : s.kind === 'text' ? (s.total > 120 ? 2 : 1) : 2;
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
/** A neighbouring key, as a slipped finger would hit. */
function nearKey(c: string): string {
  const lc = c.toLowerCase();
  for (const r of KEYS) { const i = r.indexOf(lc); if (i >= 0) { let j = i + (Math.random() < 0.5 ? -1 : 1); if (j < 0 || j >= r.length) j = i + (j < 0 ? 1 : -1); return c === lc ? r[j] : r[j].toUpperCase(); } }
  return '';
}
function charAt(s: Step, idx: number): string { let ci = 0; for (const l of s.lines) for (const w of l.words) { if (idx < ci + w.t.length) return w.t[idx - ci]; ci += w.t.length; } return ''; }
type R = { x: number; y: number; w: number; h: number };
export interface Hooks { type(): void; done(kind: string): void; click(x: number, y: number, color: string): void }

/** Assigns agents to steps in view, and runs the human-ish behaviour: reaction pauses, rests, typos, select-and-retype. */
export class AgentCoordinator {
  agents: CursorAgent[] = []; steps: Step[] = []; first = 0; win = 10; vw = 0; vh = 0; cam = 0; focusY = 0; progress = 0;
  constructor(private hooks: Hooks) {}
  init(n: number, vw: number, vh: number) {
    this.vw = vw; this.vh = vh; this.cam = 0; this.agents = [];
    const names = shuffle([...NAMES]), cols = shuffle([...PALETTE]);
    for (let i = 0; i < n; i++) {
      const side = i % 3, u = Math.random();
      const x = side === 0 ? u * vw * 0.6 : side === 1 ? -40 : vw * 0.3 + u * vw * 0.4, y = side === 0 ? -40 : side === 1 ? u * vh * 0.6 : -40;
      const name = i < names.length ? names[i] : `${names[i % names.length]} ${String.fromCharCode(65 + Math.floor(i / names.length) % 26)}.`;
      const a = new CursorAgent(i, i < cols.length ? cols[i] : `hsl(${(i * 137.5) % 360} 55% 42%)`, name, x, y);
      a.join = i === 0 ? 0 : (i / n) * 2.2 + Math.random() * 0.4; this.agents.push(a);
    }
  }
  load(steps: Step[]) { this.steps = steps; this.first = 0; this.agents.forEach(a => (a.task = null)); this.win = Math.max(6, this.agents.length); }
  /** A duplicate can be pasted only once its original (and everything inside it) is finished. */
  private ready(s: Step) { const m = s.dupOf; return !m || (m.p >= 1 && m.kids.every(k => k.p >= 1)); }
  private point(s: Step, a: CursorAgent): { x: number; y: number } {
    const p = s.p;
    if (s.dupOf) {
      const m = s.dupOf;
      if (p < 0.35) return { x: m.x + m.w * (a.slot ? 0.9 : 0.1), y: m.y + m.h * (a.slot ? 0.9 : 0.15) };
      const t = p < 0.85 ? ease((p - 0.35) / 0.5) : 1;
      return { x: m.x + (s.x - m.x) * t + (a.slot ? m.w : 0), y: m.y + (s.y - m.y) * t + (a.slot ? m.h : 0) };
    }
    if (s.kind === 'box' || s.kind === 'image') {
      const ge = s.kind === 'box' ? 0.45 : 0.3, e = ease(cl(p / ge));
      if (p < ge) return a.slot ? { x: s.x, y: s.y } : { x: s.x + s.w * e, y: s.y + s.h * e };           // drag-draw: pointer rides the growing corner
      if (s.kind === 'image') return { x: s.x + s.w * (0.55 + 0.1 * a.slot), y: s.y + s.h * 0.5 };
      if (p < 0.9) return { x: s.x + s.w * (0.5 + 0.15 * a.slot), y: s.y + s.h * (0.55 + 0.1 * Math.sin(p * 6)) };
      return { x: s.x + s.w + 14, y: s.y - 8 };                                                            // click away to deselect
    }
    if (s.src && s.p === 0 && s.selT < 0.45) { // drag across the old text to select it
      const l = s.src.lines[0], dx = s.x - s.src.x, dy = s.y - s.src.y, last = l.words[l.words.length - 1], r = last.x + last.w + dx, lf = l.words[0].x + dx;
      return { x: r - (r - lf) * (s.selT / 0.45), y: l.y + dy + l.h * 0.6 };
    }
    const c = Math.min(s.total - 1, Math.floor(p * s.total));
    let l = s.lines[s.lines.length - 1];
    for (const L of s.lines) if (c < L.start + L.n) { l = L; break; }
    if (a.slot > 0) return { x: l.words[0].x - 10, y: l.y + l.h + 8 + a.slot * 10 };
    let k = c - l.start;
    for (const w of l.words) { if (k <= w.t.length) return { x: w.x + w.w * k / w.t.length, y: l.y + l.h * 0.6 }; k -= w.t.length; }
    const w = l.words[l.words.length - 1]; return { x: w.x + w.w, y: l.y + l.h * 0.6 };
  }
  private drop(s: Step) {
    for (const k of s.kids) { k.hold = false; if (k.kind === 'box') k.p = 1; else if (k.kind === 'image') k.p = Math.max(k.p, 0.3); else k.ghost = !!k.src; }
    this.hooks.done('dup');
  }
  /** Advance the build. Returns true when every step is complete. */
  step(dt: number, t: number): boolean {
    const S = this.steps; while (this.first < S.length && S[this.first].p >= 1) this.first++;
    let sum = 0; for (const s of S) sum += Math.min(1, s.p); this.progress = S.length ? sum / S.length : 1;
    if (this.first >= S.length) { this.progress = 1; this.agents.forEach(a => { a.task = null; a.working = false; }); return true; }
    const cand: Step[] = []; const busy = S.some(o => o.dupOf && o.p > 0 && o.p < 1); let dupSeen = false;
    for (let i = this.first; i < S.length && cand.length < this.win; i++) {
      const s = S[i]; if (s.p >= 1 || s.hold || !this.ready(s) || (cand.length && s.y > this.cam + this.vh * 0.92)) continue;
      if (s.dupOf && s.p === 0) { if (busy || dupSeen) continue; dupSeen = true; } // one paste at a time
      cand.push(s);
    }
    this.focusY = (cand[0] || S[this.first]).y;
    if (!cand.length && !this.agents.some(a => a.task)) { S.forEach(s => { s.hold = false; s.dupOf = null; }); return false; } // watchdog
    const live = this.agents.filter(a => t >= a.join);
    for (const a of live) { const k = a.task; if (k && (k.p >= 1 || k.hold || !this.ready(k))) a.task = null; }
    const act = new Set<Step>(cand); for (const a of live) if (a.task) act.add(a.task);
    for (const s of act) { s.owners = 0; s.arr = 0; }
    for (const a of live) if (a.task) a.slot = a.task.owners++;
    for (const a of live) {
      if (a.task) continue;
      let best: Step | null = null, bs = 1e9;
      cand.forEach((s, i) => { const sc = Math.hypot(a.x - s.x, a.y - s.y) + s.owners * (s.owners >= cap(s) ? 1e4 : 300) + i * 12; if (sc < bs) { bs = sc; best = s; } });
      if (best) { const b = best as Step; a.task = b; a.slot = b.owners++; a.dwell = 0.15 + Math.random() * 0.35; }
    }
    for (const a of live) {
      const s = a.task; a.working = false;
      if (s) {
        const p = this.point(s, a), near = Math.hypot(p.x - a.x, p.y - a.y) < 56;
        a.update(dt, p.x, p.y, t, 1, near);
        if (near) { // beat of hesitation on arrival, and the odd pause mid-task
          if (a.dwell > 0) a.dwell -= dt; else if (a.rest > 0) a.rest -= dt;
          else { a.working = true; s.arr++; if (Math.random() < dt * 0.18) a.rest = 0.3 + Math.random() * 0.7; }
        }
      } else { // nothing to do: stay in view, drift a little
        const ax = this.vw * (0.12 + 0.76 * ((a.id * 0.618) % 1)), ay = this.cam + this.vh * (0.2 + 0.5 * ((a.id * 0.382 + 0.2) % 1)); // each rests in its own spot
        a.update(dt, ax + Math.sin(t * 0.5 + a.ph) * 22, ay + Math.cos(t * 0.4 + a.ph) * 14, t);
      }
    }
    for (const s of act) {
      if (!s.arr) continue;
      if (s.kind === 'text') {
        if (s.src && s.p === 0 && s.selT < 0.45) { s.selT += dt; continue; }                                  // selecting the pasted copy's old text
        if (!s.typoTried) {
          s.typoTried = true;
          if (s.total >= 24 && Math.random() < 0.35) {
            let at = 5 + Math.floor(Math.random() * (s.total - 18)), ch = '';
            for (let k = 0; k < 6 && !ch; k++) { const w = nearKey(charAt(s, at + k)); if (w) { at += k; ch = w; } }
            if (ch) s.typo = { at, ch, st: 0, t: 0 };
          }
        }
        if (s.gap > 0) { s.gap -= dt; continue; }
        const ty = s.typo;
        if (ty && ty.st === 1) { ty.t -= dt; if (ty.t <= 0) ty.st = 2; continue; }
        if (ty && ty.st === 2) { // backspace over the mistake
          s.p = Math.max(0, s.p - dt * 16 / s.total); const c = Math.floor(s.p * s.total + 1e-6); s.shown = c;
          if (c <= ty.at) { s.p = ty.at / s.total; s.shown = ty.at; ty.st = 3; s.gap = 0.2; }
          continue;
        }
        if (Math.random() < dt * 2.6) s.gap = 0.05 + Math.random() * 0.2;                                      // uneven typing rhythm
      }
      const before = s.p; s.p = Math.min(1, s.p + dt / s.work * Math.pow(s.arr, 0.8));
      if (s.kind === 'text') {
        const c = Math.floor(s.p * s.total); if (c > s.shown) { s.shown = c; this.hooks.type(); }
        if (s.typo && s.typo.st === 0 && c >= s.typo.at + 3) { s.typo.st = 1; s.typo.t = 0.4; }               // notices the slip
      }
      const ag = (before === 0 && s.p > 0 && s.kind !== 'text' && !s.dupOf) || (s.kind === 'box' && !s.dupOf && before < 1 && s.p >= 1) || (s.dupOf && before < 0.85 && s.p >= 0.85) ? live.find(a => a.task === s) : undefined;
      if (ag) this.hooks.click(ag.x, ag.y, ag.color);
      if (s.dupOf && before < 0.85 && s.p >= 0.85) this.drop(s);
      if (s.p >= 1 && before < 1) this.hooks.done(s.kind);
    }
    return false;
  }
  finishAll() { this.steps.forEach(s => { s.p = 1; s.hold = false; s.typo = null; }); }
  /** Gather around a leader that arcs to the left edge; then (u >= 1) sweep right along edgeX while the live site is revealed. */
  flock(dt: number, t: number, u: number, edgeX?: number) {
    const cx = this.vw / 2, cy = this.cam + this.vh / 2; let lx: number, ly: number, spread: number, spd = 1;
    if (u < 1) {
      spread = 1 - 0.72 * ease(Math.min(1, u * 1.6)); const m = Math.max(0, (u - 0.3) / 0.7), e = ease(m);
      lx = cx + (this.vw * 0.05 - cx) * e + Math.sin(m * Math.PI * 2) * this.vw * 0.04 * (1 - m); ly = cy + Math.sin(m * Math.PI * 2) * this.vh * 0.09 * (1 - m);
    } else { spread = 0.3; spd = 1.7; lx = edgeX ?? cx; ly = cy + Math.sin(t * 1.1) * this.vh * 0.06; }
    for (const a of this.agents) {
      const ang = a.id * 2.39996 + t * 0.35, rad = (16 + Math.sqrt(a.id + 1) * 13) * (0.4 + spread * 1.6);
      a.update(dt, lx + Math.cos(ang) * rad * 0.7, ly + Math.sin(ang) * rad * 0.8, t, spd);
    }
    const A = this.agents;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 16) { const k = (16 - d) * 0.5 / d; A[i].x -= dx * k; A[i].y -= dy * k; A[j].x += dx * k; A[j].y += dy * k; }
    }
  }
}
