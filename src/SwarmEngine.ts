import { AgentCoordinator } from './AgentCoordinator';
import { AnimationTimeline } from './AnimationTimeline';
import { AudioController } from './AudioController';
import { generateBlueprint } from './BlueprintGenerator';
import { DOMScanner } from './DOMScanner';
import { ReconstructionRenderer } from './ReconstructionRenderer';
import { UIController } from './UIController';
import type { SwarmOptions } from './types';

type Cfg = Required<Omit<SwarmOptions, 'onComplete' | 'onProgress'>> & Pick<SwarmOptions, 'onComplete' | 'onProgress'>;
const DEFAULTS: Cfg = { selector: 'body', agents: 12, speed: 1, sound: false, autoStart: true, tour: false, controls: true, once: false };
const MAX_SCREENS = 14;
const SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);
const cw = () => document.documentElement.clientWidth;
const easeIO = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export class SwarmEngine {
  private o: Cfg; private tl = new AnimationTimeline(); private audio: AudioController; private ui: UIController | null = null;
  private coord: AgentCoordinator; private canvas?: HTMLCanvasElement; private renderer?: ReconstructionRenderer; private root?: Element;
  private raf = 0; private last = 0; private running = false; private starting = false; private paused = false; private token = 0;
  private cam = 0; private camV = 0; private camMax = 0; private sy = 0; private prevSB = ''; private rz = 0; private lastScroll = -1;
  private quick = false; private skipped = false; private t0 = 0; private ema = 1 / 60; private slowT = 0; private low = false; private lastProg = -1;

  constructor(opts: SwarmOptions = {}) {
    this.o = { ...DEFAULTS, ...opts } as Cfg; this.pace();
    this.audio = new AudioController(this.o.sound);
    this.coord = new AgentCoordinator({
      type: () => this.audio.key(), done: k => { if (k === 'dup') this.audio.paste(); },
      click: (x, y, c) => { this.renderer?.ripple(x, y, c); this.audio.click(); },
    });
    if (typeof window === 'undefined') return;
    if (this.o.controls) this.ui = new UIController({
      replay: () => this.replay(), skip: () => this.finish(), speed: n => this.setSpeed(n),
      tour: () => { this.o.tour = !this.o.tour; this.pace(); this.sync(); }, sound: () => this.toggleSound(), agents: n => this.setAgents(n),
    });
    addEventListener('keydown', this.onKey); addEventListener('resize', this.onResize); document.addEventListener('visibilitychange', this.onVis);
    this.sync();
    if (this.o.autoStart && !matchMedia('(prefers-reduced-motion: reduce)').matches && !this.seen()) this.start();
  }

  /** Begin the rebuild (waits briefly for web fonts so text metrics match). */
  start() {
    if (this.running || this.starting || typeof document === 'undefined') return;
    const root = document.querySelector(this.o.selector); if (!root) return;
    this.starting = true; const tok = ++this.token;
    const go = () => { if (tok !== this.token || !this.starting) return; this.starting = false; this.begin(root); };
    const f = (document as unknown as { fonts?: { status: string; ready: Promise<unknown> } }).fonts;
    if (f && f.status === 'loading') Promise.race([f.ready, new Promise(r => setTimeout(r, 800))]).then(go); else go();
  }
  replay() { this.teardown(); this.start(); }
  /** Skip to the live site: completes everything instantly and fades the overlay out. */
  finish() { if (!this.running || this.tl.phase === 'outro') return; this.skipped = true; this.quick = true; this.coord.finishAll(); this.enter('outro'); }
  pause() { if (this.running && !this.paused) { this.paused = true; cancelAnimationFrame(this.raf); } }
  resume() { if (this.running && this.paused) { this.paused = false; this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } }
  destroy() {
    this.teardown(); this.ui?.destroy(); this.ui = null;
    removeEventListener('keydown', this.onKey); removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis);
  }
  setSpeed(n: number) { this.o.speed = Math.max(0.25, Math.min(4, n)); this.pace(); this.sync(); }
  /** Change the number of cursors and restart the rebuild. */
  setAgents(n: number) { this.o.agents = Math.max(1, Math.min(120, Math.round(n))); this.replay(); }
  toggleSound() { this.o.sound = !this.o.sound; this.audio.set(this.o.sound); this.sync(); }

  private begin(root: Element) {
    const de = document.documentElement;
    this.root = root; this.running = true; this.paused = false; this.quick = false; this.skipped = false; this.low = false; this.slowT = 0; this.lastProg = -1;
    this.sy = scrollY; this.prevSB = de.style.scrollBehavior; de.style.scrollBehavior = 'auto'; this.t0 = performance.now();
    const cv = this.canvas = document.createElement('canvas'); cv.setAttribute('data-swarm', ''); cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483646;opacity:1;transition:opacity .7s cubic-bezier(.4,0,.2,1);cursor:progress';
    const stop = (e: Event) => e.preventDefault(); cv.addEventListener('wheel', stop, { passive: false }); cv.addEventListener('touchmove', stop, { passive: false });
    document.body.appendChild(cv);
    this.renderer = new ReconstructionRenderer(cv); this.renderer.resize(cw(), innerHeight);
    this.coord.init(innerWidth < 700 ? Math.min(this.o.agents, 8) : this.o.agents, cw(), innerHeight);
    this.tl.reset(); this.cam = this.camV = 0; this.lastScroll = -1; this.pace(); this.scan(); this.tl.go('build'); this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame); this.sync();
  }
  private pace() { this.tl.speed = this.o.speed * (this.o.tour ? 0.7 : 1); }
  /** Scan the whole page (scrolled to the top so rects are document coordinates). */
  private scan() {
    const vh = innerHeight, de = document.documentElement; scrollTo(0, 0);
    const sc = new DOMScanner(this.root!, Math.min(de.scrollHeight, vh * MAX_SCREENS)), bp = generateBlueprint(sc.scan(), sc.pageBg());
    this.renderer!.setBlueprint(bp); this.coord.load(bp.steps);
    const bottom = bp.steps.reduce((m, s) => Math.max(m, s.fixed ? 0 : s.y + s.h), vh);
    this.camMax = Math.max(0, Math.min(de.scrollHeight, bottom + 40) - vh); this.cam = Math.min(this.cam, this.camMax);
  }
  /** Slow, eased follow-camera. Speeds are in px per simulated second. */
  private moveCam(dt: number, target: number, maxV: number) {
    const tgt = Math.max(0, Math.min(this.camMax, target)), d = tgt - this.cam;
    const want = Math.sign(d) * Math.min(maxV, Math.max(0, Math.abs(d) - 6) * 1.3);
    this.camV += (want - this.camV) * Math.min(1, dt * 4); this.cam = Math.max(0, Math.min(this.camMax, this.cam + this.camV * dt));
  }
  private enter(p: 'flock' | 'outro') {
    this.tl.go(p);
    if (p === 'flock') this.audio.chime();
    else if (this.canvas) {
      this.canvas.style.pointerEvents = 'none';
      if (this.quick) { this.canvas.style.transitionDuration = `${0.7 / Math.max(1, this.o.speed)}s`; this.canvas.style.opacity = '0'; }
      else { this.canvas.style.transition = 'none'; this.audio.sweep(); }
    }
  }
  /** Soft-edged wipe: the live site is revealed behind the crew as it sweeps across. Returns the edge's x in px. */
  private wipe(u: number): number {
    const E = easeIO(u) * 115, m = `linear-gradient(90deg, transparent ${E - 12}%, #000 ${E}%)`, st = this.canvas!.style as unknown as Record<string, string>;
    st.maskImage = m; st.webkitMaskImage = m; return (E - 8) / 100 * cw();
  }
  private frame = (now: number) => {
    if (!this.running || this.paused) return;
    this.raf = requestAnimationFrame(this.frame);
    const raw = (now - this.last) / 1000, dtr = Math.min(0.05, raw), dt = this.tl.tick(dtr); this.last = now;
    this.ema += (Math.min(raw, 0.2) - this.ema) * 0.05; // adaptive quality: drop to 1x pixel ratio if frames run long
    if (!this.low && this.ema > 0.028) this.slowT += raw; else this.slowT = Math.max(0, this.slowT - raw);
    if (!this.low && this.slowT > 1.5) { this.low = true; this.renderer!.setQuality(true); }
    const ph = this.tl.phase, c = this.coord, vh = innerHeight;
    if (ph === 'build') {
      c.cam = this.cam; const done = c.step(dt, this.tl.t); this.moveCam(dt, c.focusY - vh * 0.3, 230); if (done) this.enter('flock');
    } else if (ph === 'flock') {
      if (this.o.tour) this.moveCam(dt, 0, 900);
      c.cam = this.cam; c.flock(dt, this.tl.t, this.tl.pt / AnimationTimeline.FLOCK); if (this.tl.pt >= AnimationTimeline.FLOCK) this.enter('outro');
    } else if (ph === 'outro') {
      const u = Math.min(1, this.tl.pt / ((this.quick ? 0.7 : 1.5) / Math.max(1, this.o.speed)));
      c.flock(dt, this.tl.t, 2, this.quick ? undefined : this.wipe(u));
      if (u >= 1) { this.teardown(true); return; }
    }
    const cam = Math.round(this.cam);
    if (ph !== 'outro' && cam !== this.lastScroll) { this.lastScroll = cam; scrollTo(0, cam); } // real page follows the camera, so the reveal is seamless
    this.renderer!.render(cam, c.agents, dtr);
    this.ui?.progress(c.progress);
    if (this.o.onProgress && Math.abs(c.progress - this.lastProg) >= 0.01) { this.lastProg = c.progress; this.o.onProgress(c.progress); }
  };
  private teardown(natural = false) {
    this.token++; this.starting = false; cancelAnimationFrame(this.raf); const was = this.running; this.running = false; this.paused = false;
    this.canvas?.remove(); this.canvas = undefined; this.renderer = undefined; this.tl.reset();
    if (was) {
      document.documentElement.style.scrollBehavior = this.prevSB;
      if (Math.abs(scrollY - this.sy) > 1) scrollTo({ top: this.sy, behavior: natural ? 'smooth' : 'auto' });
      if (natural) { this.mark(); this.o.onProgress?.(1); this.o.onComplete?.({ skipped: this.skipped, ms: Math.round(performance.now() - this.t0) }); }
    }
    this.sync();
  }
  private key() { return `swarm-rebuild:${this.o.selector}`; }
  private store(): Storage | null { try { return this.o.once === 'forever' ? localStorage : this.o.once === 'session' ? sessionStorage : null; } catch { return null; } }
  private seen() { try { return !!this.store()?.getItem(this.key()); } catch { return false; } }
  private mark() { try { this.store()?.setItem(this.key(), '1'); } catch { /* storage unavailable */ } }
  private sync() { this.ui?.sync({ speed: this.o.speed, tour: this.o.tour, sound: this.o.sound, running: this.running, agents: this.o.agents }); }
  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === 'Escape') this.finish(); else if (e.key === 'm' || e.key === 'M') this.toggleSound();
    else if (this.running && this.tl.phase !== 'outro' && SCROLL_KEYS.has(e.key) && !(t && t.tagName === 'BUTTON')) e.preventDefault();
  };
  private onVis = () => {
    if (!this.running || this.paused) return;
    if (document.hidden) cancelAnimationFrame(this.raf); else { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  };
  private onResize = () => {
    clearTimeout(this.rz);
    this.rz = window.setTimeout(() => {
      if (!this.running || !this.renderer) return;
      const done = this.coord.steps.filter(s => s.p >= 1).length; this.renderer.resize(cw(), innerHeight); this.coord.vw = cw(); this.coord.vh = innerHeight;
      this.scan(); this.coord.steps.forEach((s, i) => { if (i < done) s.p = 1; }); this.lastScroll = -1;
    }, 150);
  };
}
