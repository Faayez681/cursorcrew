import type { Blueprint, Step } from './types';
import type { CursorAgent } from './CursorAgent';
import { TRAIL } from './CursorAgent';
type Ctx = CanvasRenderingContext2D;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const BLUE = '#0d99ff', RED = '#f24822';
function path(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** Editor-style label chip, centred on cx. */
function pill(c: Ctx, cx: number, y: number, text: string, bg: string) {
  c.font = '500 10px system-ui,sans-serif'; c.textBaseline = 'middle'; const w = c.measureText(text).width + 10, x = cx - w / 2;
  c.fillStyle = bg; path(c, x, y, w, 16, 3); c.fill(); c.fillStyle = '#fff'; c.fillText(text, x + 5, y + 8.5);
}
/** Editor-style selection frame with corner handles. */
function sel(c: Ctx, x: number, y: number, w: number, h: number, r: number, a: number, handles: boolean) {
  c.save(); c.globalAlpha *= a; c.strokeStyle = BLUE; c.lineWidth = 1; path(c, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), r); c.stroke();
  if (handles && w > 16 && h > 16) for (const [px, py] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) { c.fillStyle = '#fff'; c.fillRect(px - 3, py - 3, 6, 6); c.strokeRect(px - 2.5, py - 2.5, 5, 5); }
  c.restore();
}

let sm: HTMLCanvasElement | null = null, DPR = 1;
const ready = (i: CanvasImageSource | null): i is CanvasImageSource => !!i && (i instanceof HTMLImageElement ? i.complete && i.naturalWidth > 0 : i instanceof HTMLVideoElement ? i.readyState > 1 : true);
const nat = (i: CanvasImageSource): [number, number] => i instanceof HTMLImageElement ? [i.naturalWidth, i.naturalHeight] : i instanceof HTMLVideoElement ? [i.videoWidth, i.videoHeight] : i instanceof HTMLCanvasElement ? [i.width, i.height] : [0, 0];
/** CSS position token -> offset within the free space. */
function place(t: string | undefined, free: number): number {
  if (!t) return free / 2; if (t.endsWith('%')) return free * parseFloat(t) / 100; if (t.endsWith('px')) return parseFloat(t);
  return t === 'left' || t === 'top' ? 0 : t === 'right' || t === 'bottom' ? free : free / 2;
}
interface IR { dx: number; dy: number; dw: number; dh: number }
/** Where the whole image is drawn for an <img>-like element (object-fit / object-position); the caller clips to the box. */
function imgRect(s: Step, img: CanvasImageSource): IR {
  const [nw, nh] = nat(img), full: IR = { dx: s.x, dy: s.y, dw: s.w, dh: s.h };
  if (!nw || !nh || s.fit === 'fill') return full;
  const sc = s.fit === 'cover' ? Math.max(s.w / nw, s.h / nh) : s.fit === 'contain' ? Math.min(s.w / nw, s.h / nh) : s.fit === 'none' ? 1 : s.fit === 'scale-down' ? Math.min(1, s.w / nw, s.h / nh) : 0;
  if (!sc) return full;
  const rw = nw * sc, rh = nh * sc, [px, py] = s.fpos.split(/\s+/);
  return { dx: s.x + place(px, s.w - rw), dy: s.y + place(py, s.h - rh), dw: rw, dh: rh };
}
/** Mosaic draw: image sampled down to a coarse grid and scaled up without smoothing. */
function pix(c: Ctx, img: CanvasImageSource, r: IR, ps: number) {
  const t = sm || (sm = document.createElement('canvas')), sw = Math.max(1, Math.ceil(r.dw / ps)), sh = Math.max(1, Math.ceil(r.dh / ps));
  t.width = sw; t.height = sh; const tc = t.getContext('2d')!;
  try { tc.drawImage(img, 0, 0, sw, sh); } catch { return; }
  const o = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, sw, sh, r.dx, r.dy, sw * ps, sh * ps); c.imageSmoothingEnabled = o;
}
function linear(c: Ctx, s: Step): CanvasGradient {
  const g = s.grad!, a = g.a * Math.PI / 180, sx = Math.sin(a), sy = -Math.cos(a), L = Math.abs(s.w * sx) + Math.abs(s.h * sy), cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const gr = c.createLinearGradient(cx - sx * L / 2, cy - sy * L / 2, cx + sx * L / 2, cy + sy * L / 2);
  for (const st of g.s) { try { gr.addColorStop(clamp(st.o), st.c); } catch { /* bad colour */ } }
  return gr;
}
/** CSS background-image (single layer) placed by background-size / position. */
function drawBg(c: Ctx, s: Step, img: HTMLImageElement) {
  const [nw, nh] = nat(img); let rw = nw, rh = nh; const z = s.bsize;
  if (z === 'cover') { const k = Math.max(s.w / nw, s.h / nh); rw = nw * k; rh = nh * k; }
  else if (z === 'contain') { const k = Math.min(s.w / nw, s.h / nh); rw = nw * k; rh = nh * k; }
  else if (z && z !== 'auto' && z !== 'auto auto') {
    const [a, b = 'auto'] = z.split(/\s+/), pw = (t: string, f: number) => (t === 'auto' ? null : t.endsWith('%') ? f * parseFloat(t) / 100 : parseFloat(t));
    let ww = pw(a, s.w), hh = pw(b, s.h); if (ww == null && hh != null) ww = hh * nw / nh; else if (hh == null && ww != null) hh = ww * nh / nw;
    if (ww != null && hh != null) { rw = ww; rh = hh; }
  }
  const [bx, by] = (s.bpos || '0% 0%').split(/\s+/); c.drawImage(img, s.x + place(bx, s.w - rw), s.y + place(by, s.h - rh), rw, rh);
}

/** Draws one step honouring its own element opacity. Editing chrome (selection, guides) is drawn separately. */
function drawStep(c: Ctx, s: Step, dark: boolean) {
  const g = c.globalAlpha; if (s.a < 1) c.globalAlpha = g * s.a;
  paint(c, s, dark); c.globalAlpha = g;
}
function paint(c: Ctx, s: Step, _dark: boolean) {
  if (s.hold) return;
  let p = s.p; if (s.dupOf) { if (p < 0.85) return; p = 1; }
  const g0 = c.globalAlpha;
  if (s.kind === 'box') {
    const f = clamp((p - 0.45) / 0.2); // fill and border are applied once the shape has been drawn
    if (f > 0) {
      c.globalAlpha = g0 * f;
      const base = s.bg || (s.grad ? s.grad.s[0].c : null);
      if (base || s.bgImg) {
        c.save(); path(c, s.x, s.y, s.w, s.h, s.r);
        if (base) {
          if (s.shadow) { c.shadowColor = s.shadow.c; c.shadowBlur = s.shadow.b * DPR; c.shadowOffsetX = s.shadow.x * DPR; c.shadowOffsetY = s.shadow.y * DPR; }
          c.fillStyle = base; c.fill(); c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
        }
        c.clip();
        if (s.bgImg && ready(s.bgImg)) { try { drawBg(c, s, s.bgImg); } catch { /* unreadable */ } }
        if (s.grad) { c.fillStyle = linear(c, s); c.fillRect(s.x, s.y, s.w, s.h); }
        c.restore();
      }
      if (s.sides) { const [t, r, b, l] = s.sides; const e = (w: number, col: string, x: number, y: number, ww: number, hh: number) => { if (w > 0) { c.fillStyle = col; c.fillRect(x, y, ww, hh); } };
        e(t.w, t.c, s.x, s.y, s.w, t.w); e(b.w, b.c, s.x, s.y + s.h - b.w, s.w, b.w); e(l.w, l.c, s.x, s.y, l.w, s.h); e(r.w, r.c, s.x + s.w - r.w, s.y, r.w, s.h); }
      if (s.bc) { const hw = s.bw / 2; c.lineWidth = s.bw; c.strokeStyle = s.bc; path(c, s.x + hw, s.y + hw, s.w - s.bw, s.h - s.bw, s.r); c.stroke(); }
      c.globalAlpha = g0;
    }
  } else if (s.kind === 'text') {
    c.font = s.font; c.fillStyle = s.color; (c as any).letterSpacing = s.ls;
    const asc = c.measureText('Hg').fontBoundingBoxAscent; c.textBaseline = asc == null ? 'middle' : 'alphabetic';
    const by = (l: { y: number; h: number }) => (asc == null ? l.y + l.h / 2 : l.y + asc); // baseline from the same font metrics the browser used for the line box
    if (s.src && p <= 0) { // pasted copy: the old text, selected, until the first keystroke replaces it
      const o = s.src, dx = s.x - o.x, dy = s.y - o.y;
      if (s.selT > 0) { c.fillStyle = 'rgba(13,153,255,.3)'; const u = clamp(s.selT / 0.45); for (const l of o.lines) { const a = l.words[0].x + dx, b = l.words[l.words.length - 1]; c.fillRect(a, l.y + dy, (b.x + b.w + dx - a) * u, l.h); } c.fillStyle = s.color; }
      c.font = o.font; for (const l of o.lines) for (const w of l.words) c.fillText(w.t, w.x + dx, by(l) + dy);
      (c as any).letterSpacing = '0px'; return;
    }
    const typed = p >= 1 ? s.total : Math.floor(p * s.total), bad = s.typo && s.typo.st < 3 && p < 1 && typed > s.typo.at ? s.typo.at : -1;
    let ci = 0, cx = s.lines[0].words[0].x, cy = s.lines[0].y, ch = s.lines[0].h; const ends: number[] = [];
    s.lines.forEach((l, li) => {
      const mid = by(l); let end = l.words[0].x;
      for (const w of l.words) {
        const len = w.t.length; let t = w.t; if (bad >= ci && bad < ci + len) t = t.slice(0, bad - ci) + s.typo!.ch + t.slice(bad - ci + 1);
        if (typed >= ci + len) { c.fillText(t, w.x, mid); cx = end = w.x + w.w; cy = l.y; ch = l.h; cx += 1; }
        else if (typed > ci) { const part = t.slice(0, typed - ci), pw = c.measureText(part).width; c.fillText(part, w.x, mid); end = w.x + pw; cx = end + 1; cy = l.y; ch = l.h; }
        ci += len;
      }
      ends[li] = end;
    });
    if (s.ul) { c.fillStyle = s.ul.c; s.lines.forEach((l, li) => { const x0 = l.words[0].x; if (ends[li] > x0) c.fillRect(x0, l.y + l.h * 0.89, ends[li] - x0, s.ul!.th); }); c.fillStyle = s.color; }
    if (p < 1) c.fillRect(cx, cy + ch * 0.1, 1.5, ch * 0.8);
    (c as any).letterSpacing = '0px';
  } else {
    const f = clamp((p - 0.3) / 0.7), ok = ready(s.img);
    c.save(); path(c, s.x, s.y, s.w, s.h, s.r);
    if (f <= 0) { c.fillStyle = s.tint; c.globalAlpha = g0 * 0.18 * clamp((p - 0.18) / 0.12); c.fill(); }
    else {
      c.clip();
      if (ok && f >= 1) { try { const r = imgRect(s, s.img!); c.drawImage(s.img!, r.dx, r.dy, r.dw, r.dh); } catch { /* unreadable */ } }
      else {
        c.fillStyle = s.tint; c.globalAlpha = g0 * 0.35; c.fillRect(s.x, s.y, s.w, s.h); c.globalAlpha = g0;
        if (ok) pix(c, s.img!, imgRect(s, s.img!), [32, 18, 10, 5, 2][Math.min(4, Math.floor(f * 5))]); // loads like a progressive image
        else { c.globalAlpha = g0 * f; c.fillRect(s.x, s.y, s.w, s.h); c.globalAlpha = g0; }
      }
    }
    c.restore();
  }
}

/** Draws the reconstruction in document space through a scrolling camera. Only steps in view are drawn. */
export class ReconstructionRenderer {
  private ctx: Ctx; private vw = 0; private vh = 0; private bp: Blueprint = { steps: [], bg: '#fff', dark: false };
  private low = false; private ripples: { x: number; y: number; c: string; t: number }[] = [];
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  resize(vw: number, vh: number) {
    const d = this.low ? 1 : Math.min(devicePixelRatio || 1, 2); DPR = d; this.vw = vw; this.vh = vh;
    this.canvas.width = Math.round(vw * d); this.canvas.height = Math.round(vh * d); this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  setBlueprint(bp: Blueprint) { this.bp = bp; }
  /** Adaptive quality: 1x pixel ratio and no trails on slow devices. */
  setQuality(low: boolean) { this.low = low; this.resize(this.vw, this.vh); }
  ripple(x: number, y: number, c: string) { this.ripples.push({ x, y, c, t: 0 }); if (this.ripples.length > 24) this.ripples.shift(); }
  render(cam: number, agents: CursorAgent[], dt = 0) {
    const c = this.ctx, { steps, bg, dark } = this.bp, top = cam - 24, bot = cam + this.vh + 24;
    c.fillStyle = bg; c.fillRect(0, 0, this.vw, this.vh);
    c.save(); c.translate(0, -cam);
    for (const t of steps) {
      if (t.hold || t.fixed) continue;
      if (t.dupOf && t.p > 0 && t.p < 1) this.dup(c, t, dark);
      if (t.y > bot || t.y + t.h < top) continue;
      if (t.p > 0 || t.ghost) drawStep(c, t, dark);
    }
    c.restore();
    for (const t of steps) if (t.fixed && !t.hold && (t.p > 0 || t.ghost)) drawStep(c, t, dark);
    c.save(); c.translate(0, -cam); this.chrome(c, cam); this.clicks(c, dt); this.agents(c, agents, cam); c.restore();
  }
  /** Click feedback: a small ring that expands and fades. */
  private clicks(c: Ctx, dt: number) {
    c.lineWidth = 1.5;
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]; r.t += dt; const u = r.t / 0.45; if (u >= 1) { this.ripples.splice(i, 1); continue; }
      c.globalAlpha = 0.55 * (1 - u); c.strokeStyle = r.c; c.beginPath(); c.arc(r.x, r.y, 3 + 16 * ease(u), 0, 6.2832); c.stroke();
    }
    c.globalAlpha = 1;
  }
  /** Copy/paste of a finished component: select it, lift a copy, drop it in place. */
  private dup(c: Ctx, s: Step, dark: boolean) {
    const m = s.dupOf!, p = s.p;
    if (p < 0.35) { sel(c, m.x, m.y, m.w, m.h, m.r, clamp(p / 0.08), true); return; }
    const t = p < 0.85 ? ease((p - 0.35) / 0.5) : 1, dx = (s.x - m.x) * t, dy = (s.y - m.y) * t;
    c.save(); c.globalAlpha = p < 0.85 ? 0.5 : 0.5 * (1 - (p - 0.85) / 0.15); c.translate(dx, dy);
    for (const st of [m, ...m.kids]) drawStep(c, st, dark);
    c.restore();
    if (p < 0.85) sel(c, m.x + dx, m.y + dy, m.w, m.h, m.r, 1, true);
  }
  /** Editing chrome: frames while shapes are drawn, size chips, alignment guides, font chip while typing. */
  private chrome(c: Ctx, cam: number) {
    const S = this.bp.steps, lo = cam - 60, hi = cam + this.vh + 60; let tn = 0, bn = 0;
    for (const s of S) {
      if (s.hold || s.fixed || s.dupOf || s.p <= 0 || s.p >= 1 || s.y > hi || s.y + s.h < lo) continue;
      if (s.kind === 'text') {
        if (tn++ >= 2) continue;
        c.strokeStyle = 'rgba(13,153,255,.7)'; c.lineWidth = 1; c.strokeRect(s.x - 2.5, s.y - 1.5, s.w + 5, s.h + 3);
        pill(c, s.x + 40, s.y - 21, `${s.fam} · ${Math.round(s.fs)}px`, '#1e1e1e');
      } else {
        if (bn++ >= 5) continue;
        const e = ease(clamp(s.p / (s.kind === 'box' ? 0.45 : 0.3))), dw = s.w * e, dh = s.h * e;
        sel(c, s.x, s.y, dw, dh, s.r * e, 1, true);
        if (s.p < 0.95 && dw > 24 && dh > 12) pill(c, s.x + dw / 2, s.y + dh + 8, `${Math.round(dw)} × ${Math.round(dh)}`, BLUE);
        if (s.p < 0.6) this.guides(c, s, e, lo, hi);
      }
    }
  }
  /** Smart guides: a line appears only where an edge of the new shape really lines up with an existing one. */
  private guides(c: Ctx, s: Step, e: number, lo: number, hi: number) {
    const a = clamp((0.6 - s.p) / 0.15), S = this.bp.steps, tol = 1.5;
    const near = (o: Step) => o !== s && o.p >= 1 && !o.hold && !o.fixed && o.kind !== 'text' && o.y < hi && o.y + o.h > lo;
    c.save(); c.strokeStyle = RED; c.globalAlpha *= a; c.lineWidth = 1; c.beginPath();
    const xs = [s.x, ...(e >= 0.97 ? [s.x + s.w] : [])], ys = [s.y, ...(e >= 0.97 ? [s.y + s.h] : [])];
    for (const X of xs) {
      let best: Step | null = null, bg = 500;
      for (const o of S) if (near(o) && (Math.abs(o.x - X) < tol || Math.abs(o.x + o.w - X) < tol)) { const g = Math.max(0, Math.max(o.y, s.y) - Math.min(o.y + o.h, s.y + s.h)); if (g < bg) { bg = g; best = o; } }
      if (best) { c.moveTo(X + 0.5, Math.min(s.y, best.y)); c.lineTo(X + 0.5, Math.max(s.y + s.h, best.y + best.h)); }
    }
    for (const Y of ys) {
      let best: Step | null = null, bg = 500;
      for (const o of S) if (near(o) && (Math.abs(o.y - Y) < tol || Math.abs(o.y + o.h - Y) < tol)) { const g = Math.max(0, Math.max(o.x, s.x) - Math.min(o.x + o.w, s.x + s.w)); if (g < bg) { bg = g; best = o; } }
      if (best) { c.moveTo(Math.min(s.x, best.x), Y + 0.5); c.lineTo(Math.max(s.x + s.w, best.x + best.w), Y + 0.5); }
    }
    c.stroke(); c.restore();
  }
  private agents(c: Ctx, agents: CursorAgent[], cam: number) {
    c.lineJoin = 'round';
    for (const a of agents) {
      if (a.y < cam - 40 || a.y > cam + this.vh + 40 || a.x < -40 || a.x > this.vw + 40) continue;
      if (a.tn > 3 && !this.low) { // short, faint trail
        c.strokeStyle = a.color; c.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) {
          const i0 = Math.floor(k * a.tn / 3), i1 = Math.min(a.tn - 1, Math.floor((k + 1) * a.tn / 3));
          c.globalAlpha = 0.05 + 0.05 * k; c.beginPath();
          for (let i = i0; i <= i1; i++) { const j = (a.th - a.tn + i + TRAIL * 2) % TRAIL; i === i0 ? c.moveTo(a.trail[j * 2], a.trail[j * 2 + 1]) : c.lineTo(a.trail[j * 2], a.trail[j * 2 + 1]); }
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      c.save(); c.translate(a.x, a.y);
      const k = a.working && a.task ? a.task.kind : null;
      if (k === 'text') { c.strokeStyle = a.color; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 8); c.moveTo(-3, -8); c.lineTo(3, -8); c.moveTo(-3, 8); c.lineTo(3, 8); c.stroke(); }
      else {
        c.fillStyle = a.color; c.strokeStyle = '#fff'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 14.5); c.lineTo(3.6, 11.3); c.lineTo(6.2, 17); c.lineTo(8.4, 16); c.lineTo(5.9, 10.4); c.lineTo(10.6, 10.4); c.closePath(); c.fill(); c.stroke();
      }
      if (!a.lw) { c.font = '500 10px system-ui,sans-serif'; a.lw = c.measureText(a.name).width + 10; }
      c.fillStyle = a.color; path(c, 11, 15, a.lw, 15, 3); c.fill();
      c.fillStyle = '#fff'; c.font = '500 10px system-ui,sans-serif'; c.textBaseline = 'middle'; c.fillText(a.name, 16, 22.8); c.restore();
    }
  }
}
