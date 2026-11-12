import type { Grad, Shadow, Step } from './types';
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TEMPLATE', 'HEAD']);
const MEDIA = new Set(['IMG', 'VIDEO', 'CANVAS', 'SVG', 'PICTURE']);
const clear = (c: string) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
const imgCache = new Map<string, HTMLImageElement>();

const mk = (o: Partial<Step> & Pick<Step, 'kind' | 'x' | 'y' | 'w' | 'h'>): Step => ({
  r: 0, bg: null, bc: null, bw: 0, color: '', font: '', ls: '', lines: [], total: 0, img: null, tint: '', work: 0, p: 0, owners: 0, arr: 0, shown: 0,
  fs: 0, fam: '', hold: false, fixed: false, ghost: false, dupOf: null, kids: [], src: null, selT: 0, gap: 0, typo: null, typoTried: false,
  a: 1, grad: null, bgImg: null, bsize: '', bpos: '', shadow: null, ul: null, fit: 'fill', fpos: '50% 50%', sides: null, ...o,
});
function splitTop(s: string): string[] {
  const out: string[] = []; let d = 0, cur = '';
  for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim()); return out;
}
const DIRS: Record<string, number> = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to right top': 45, 'to bottom right': 135, 'to right bottom': 135, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 };
function parseGradient(layer: string): Grad | null {
  if (!layer.startsWith('linear-gradient(') || !layer.endsWith(')')) return null;
  const parts = splitTop(layer.slice(16, -1)); let a = 180;
  const m = /^(-?[\d.]+)(deg|turn|rad|grad)$/.exec(parts[0] || '');
  if (m) { const v = parseFloat(m[1]); a = m[2] === 'deg' ? v : m[2] === 'turn' ? v * 360 : m[2] === 'rad' ? v * 180 / Math.PI : v * 0.9; parts.shift(); }
  else if (parts[0] && parts[0].startsWith('to ')) { a = DIRS[parts[0]] ?? 180; parts.shift(); }
  const raw: { o: number | null; c: string }[] = [];
  for (const p of parts) {
    const t = /^(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]+|[a-z]+)\s*(.*)$/i.exec(p); if (!t) return null;
    const pc = /(-?[\d.]+)%/.exec(t[2]); raw.push({ c: t[1], o: pc ? parseFloat(pc[1]) / 100 : null });
  }
  if (raw.length < 2) return null;
  if (raw[0].o == null) raw[0].o = 0; if (raw[raw.length - 1].o == null) raw[raw.length - 1].o = 1;
  for (let i = 1; i < raw.length - 1; i++) if (raw[i].o == null) {
    let j = i; while (raw[j].o == null) j++; const a0 = raw[i - 1].o!, a1 = raw[j].o!;
    for (let k = i; k < j; k++) raw[k].o = a0 + (a1 - a0) * (k - i + 1) / (j - i + 1);
  }
  let prev = 0; return { a, s: raw.map(r => { prev = Math.max(prev, r.o!); return { o: prev, c: r.c }; }) };
}
function parseShadow(bs: string): Shadow | null {
  if (!bs || bs === 'none') return null; const first = splitTop(bs)[0]; if (/inset/.test(first)) return null;
  const m = /(rgba?\([^)]*\)|hsla?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/.exec(first);
  return m ? { c: m[1], x: +m[2], y: +m[3], b: +(m[4] || 0) } : null;
}
function loadImg(layer: string): HTMLImageElement | null {
  const m = /^url\((['"]?)(.*)\1\)$/.exec(layer); if (!m) return null;
  let im = imgCache.get(m[2]); if (!im) { im = new Image(); im.src = m[2]; imgCache.set(m[2], im); } return im;
}
function svgImage(el: Element, r: DOMRect, cs: CSSStyleDeclaration): HTMLImageElement | null {
  try {
    const cl = el.cloneNode(true) as SVGElement; cl.setAttribute('width', String(r.width)); cl.setAttribute('height', String(r.height));
    if (!cl.getAttribute('xmlns')) cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    cl.setAttribute('style', `color:${cs.color};` + (cl.getAttribute('style') || ''));
    const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl)); return im;
  } catch { return null; }
}
function average(img: HTMLImageElement, fb: string): string {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch { return fb; }
}
function radius(cs: CSSStyleDeclaration, r: DOMRect) {
  const rs = cs.borderTopLeftRadius; let rad = parseFloat(rs) || 0;
  if (rs.includes('%')) rad = Math.min(r.width, r.height) * rad / 100;
  return Math.min(rad, r.width / 2, r.height / 2);
}

/** Reads the live DOM into raw construction steps in document coordinates. Call with the page scrolled to the top. */
export class DOMScanner {
  private out: Step[] = []; private imgs = 0;
  constructor(private root: Element, private maxY: number, private max = 1200) {}
  scan(): Step[] { this.out = []; this.imgs = 0; this.walk(this.root, false, 1, null); return this.out; }
  pageBg(): string {
    let e: Element | null = this.root;
    while (e) { const c = getComputedStyle(e).backgroundColor; if (!clear(c)) return c; e = e.parentElement; }
    return 'rgb(255,255,255)';
  }
  private walk(el: Element, fx: boolean, op: number, ulc: string | null) {
    const tag = el.tagName.toUpperCase();
    if (this.out.length >= this.max || SKIP.has(tag) || el.hasAttribute('data-swarm')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const eo = op * (+cs.opacity); if (eo < 0.05) return;
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    if (r.bottom < 0 || r.top > this.maxY || r.right < 0 || r.left > vw) return;
    const isFx = fx || cs.position === 'fixed' || (cs.position === 'sticky' && r.top <= (parseFloat(cs.top) || 0) + 2);
    if (MEDIA.has(tag)) { if (r.width >= 4 && r.height >= 4) this.media(tag, r, cs, el, isFx, eo); return; }
    const big = r.width >= vw * 0.98 && r.height >= innerHeight * 0.9;
    if (r.width >= 2 && r.height >= 2 && !big && tag !== 'BODY' && tag !== 'HTML') {
      const sd = ['Top', 'Right', 'Bottom', 'Left'].map(k => { const c = cs as unknown as Record<string, string>; return { w: c[`border${k}Style`] === 'none' ? 0 : parseFloat(c[`border${k}Width`]) || 0, c: c[`border${k}Color`] }; });
      const uniform = sd.every(x => x.w === sd[0].w && x.c === sd[0].c), bw = uniform ? sd[0].w : 0, sides = !uniform && sd.some(x => x.w > 0) ? sd : null;
      let bg = clear(cs.backgroundColor) ? null : cs.backgroundColor, grad: Grad | null = null, bgImg: HTMLImageElement | null = null, bsize = '', bpos = '';
      const bi = cs.backgroundImage;
      if (bi !== 'none') {
        const layers = splitTop(bi), gi = layers.findIndex(l => l.startsWith('linear-gradient(')), ui = layers.findIndex(l => l.startsWith('url('));
        if (gi >= 0) grad = parseGradient(layers[gi]);
        if (ui >= 0) { bgImg = loadImg(layers[ui]); bsize = splitTop(cs.backgroundSize)[ui] || splitTop(cs.backgroundSize)[0] || ''; bpos = splitTop(cs.backgroundPosition)[ui] || splitTop(cs.backgroundPosition)[0] || '0% 0%'; }
        if (!grad && !bgImg && !bg) bg = 'rgba(127,127,127,.12)'; // radial/conic etc: flat approximation
      }
      if (bg || grad || bgImg || bw > 0 || sides) this.out.push(mk({ kind: 'box', x: r.left, y: r.top, w: r.width, h: r.height, r: radius(cs, r), bg, grad, bgImg, bsize, bpos,
        bc: bw > 0 ? cs.borderTopColor : null, bw, sides, shadow: bg || grad || bgImg ? parseShadow(cs.boxShadow) : null, fixed: isFx, a: eo }));
    }
    const myUl = /underline/.test(cs.textDecorationLine) ? (cs.textDecorationColor || cs.color) : ulc;
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 1) this.walk(n as Element, isFx, eo, myUl);
      else if (n.nodeType === 3) this.text(n as Text, cs, isFx, eo, myUl);
    }
  }
  private media(tag: string, r: DOMRect, cs: CSSStyleDeclaration, el: Element, fixed: boolean, a: number) {
    let img: CanvasImageSource | null = null, tint = 'rgba(127,127,127,.25)';
    if (el instanceof HTMLImageElement) { if (el.complete && el.naturalWidth) { img = el; if (this.imgs++ < 30) tint = average(el, tint); } }
    else if (el instanceof HTMLVideoElement) { if (el.readyState > 1) img = el; }
    else if (el instanceof HTMLCanvasElement) img = el;
    else if (tag === 'SVG') img = svgImage(el, r, cs);
    this.out.push(mk({ kind: 'image', x: r.left, y: r.top, w: r.width, h: r.height, r: radius(cs, r), img, tint, fixed, a,
      fit: tag === 'SVG' ? 'fill' : cs.objectFit || 'fill', fpos: cs.objectPosition || '50% 50%' }));
  }
  private text(n: Text, cs: CSSStyleDeclaration, fixed: boolean, a: number, ulc: string | null) {
    const s = n.textContent || ''; if (!s.trim() || this.out.length >= this.max) return;
    const rg = document.createRange(), re = /\S+/g, lines: import('./types').Line[] = [];
    const up = cs.textTransform === 'uppercase', lo = cs.textTransform === 'lowercase';
    let m: RegExpExecArray | null, cur: import('./types').Line | null = null, total = 0;
    while ((m = re.exec(s))) {
      rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      const b = rg.getBoundingClientRect(); if (b.width < 1 || b.bottom < 0 || b.top > this.maxY) continue;
      if (!cur || Math.abs(b.top - cur.y) > b.height * 0.5) { cur = { y: b.top, h: b.height, words: [], start: total, n: 0 }; lines.push(cur); }
      const t = up ? m[0].toUpperCase() : lo ? m[0].toLowerCase() : m[0];
      cur.words.push({ t, x: b.left, w: b.width }); cur.n += t.length; total += t.length;
    }
    if (!total) return;
    const x = Math.min(...lines.map(l => l.words[0].x)), last = lines[lines.length - 1], fs = parseFloat(cs.fontSize) || 16;
    const right = Math.max(...lines.map(l => { const w = l.words[l.words.length - 1]; return w.x + w.w; }));
    this.out.push(mk({ kind: 'text', x, y: lines[0].y, w: right - x, h: last.y + last.h - lines[0].y, color: cs.color,
      font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, ls: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing, lines, total, fs,
      fam: `${cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()} ${cs.fontWeight}`, fixed, a, ul: ulc ? { c: ulc, th: Math.max(1, fs / 15) } : null }));
  }
}
