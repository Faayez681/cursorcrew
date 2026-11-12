import type { Blueprint, Step } from './types';
const rank = { box: 0, image: 1, text: 2 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const inside = (c: Step, b: Step) => c !== b && c.x >= b.x - 1 && c.y >= b.y - 1 && c.x + c.w <= b.x + b.w + 1 && c.y + c.h <= b.y + b.h + 1 && !(c.kind === 'box' && c.w * c.h >= b.w * b.h);

/** Finds repeated components (same size, style and inner layout). The first is built by hand; the rest are copy-pasted, then only their unique content is filled in. */
function dedupe(S: Step[]): Step[] {
  const kids = new Map<Step, Step[]>(), groups = new Map<string, Step[]>();
  for (const b of S) {
    if (b.kind !== 'box' || b.w * b.h < 6000) continue;
    const k = S.filter(c => inside(c, b)); if (!k.length) continue; kids.set(b, k);
    const sig = [Math.round(b.w / 4), Math.round(b.h / 4), Math.round(b.r), b.bg, b.bc, b.bw,
      ...k.map(c => c.kind + Math.round((c.x - b.x) / 6) + ',' + Math.round((c.y - b.y) / 10) + (c.kind === 'text' ? '' : ',' + Math.round(c.w / 6) + ',' + Math.round(c.h / 6))).sort()].join('|');
    const g = groups.get(sig); if (g) g.push(b); else groups.set(sig, [b]);
  }
  const claimed = new Set<Step>(), moved = new Set<Step>(), after = new Map<Step, Step[]>();
  for (const g of groups.values()) {
    if (g.length < 2 || g.some(b => claimed.has(b))) continue;
    const m = g[0], mk = kids.get(m)!; m.kids = mk;
    for (const b of g) { claimed.add(b); kids.get(b)!.forEach(k => claimed.add(k)); }
    const tail = [m, ...mk].reduce((a, s) => (S.indexOf(s) > S.indexOf(a) ? s : a)), add: Step[] = [];
    for (const d of g.slice(1)) {
      const dk = kids.get(d)!; d.dupOf = m; d.kids = dk; dk.forEach(k => (k.hold = true));
      const byPos = (a: Step, b: Step) => a.y - b.y || a.x - b.x, mt = mk.filter(k => k.kind === 'text').sort(byPos), dt = dk.filter(k => k.kind === 'text').sort(byPos);
      if (mt.length === dt.length) dt.forEach((k, i) => (k.src = mt[i]));
      moved.add(d); dk.forEach(k => moved.add(k)); add.push(d, ...S.filter(s => dk.includes(s)));
    }
    after.set(tail, [...(after.get(tail) || []), ...add]);
  }
  const out: Step[] = [];
  for (const s of S) { if (moved.has(s)) continue; out.push(s); const a = after.get(s); if (a) out.push(...a); }
  return out;
}

/** Orders raw steps top-to-bottom (containers before contents), dedupes repeats, assigns build effort. */
export function generateBlueprint(raw: Step[], bg: string): Blueprint {
  raw.sort((a, b) => (Math.round(a.y / 8) - Math.round(b.y / 8)) || (rank[a.kind] - rank[b.kind]) || (a.x - b.x));
  const steps = [...raw.filter(s => s.fixed), ...dedupe(raw.filter(s => !s.fixed))];
  for (const s of steps) {
    s.work = s.dupOf ? 1.6 : s.kind === 'box' ? clamp(2 * (s.w + s.h) / 700, 0.8, 2.2)
      : s.kind === 'image' ? clamp(1.4 + s.w * s.h / 300000, 1.6, 2.8)
      : clamp(s.total * 0.055, 0.7, 4.5);
  }
  const m = bg.match(/[\d.]+/g) || ['255', '255', '255'];
  const dark = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
  return { steps, bg, dark };
}
