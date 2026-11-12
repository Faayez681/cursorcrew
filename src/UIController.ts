export interface UIState { speed: number; tour: boolean; sound: boolean; running: boolean; agents: number }
export interface UIHandlers { replay(): void; skip(): void; speed(n: number): void; tour(): void; sound(): void; agents(n: number): void }
const COUNTS = [4, 6, 8, 10, 12, 15, 20, 30, 50, 80];
const CSS = `.swr-panel{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px 4px 6px;
background:rgba(14,15,18,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);border-radius:12px;
font:500 12px/1 system-ui,sans-serif;transition:opacity .3s;overflow:hidden}.swr-panel.idle{opacity:.55}.swr-panel.idle:hover,.swr-panel:focus-within{opacity:1}
.swr-panel button,.swr-panel select{height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:#d7dae0;font:inherit;cursor:pointer}
.swr-panel select{padding:0 4px;appearance:none;-webkit-appearance:none;text-align:center}.swr-panel option{color:#111;background:#fff}
.swr-panel button:hover:not(:disabled),.swr-panel select:hover{background:rgba(255,255,255,.08)}.swr-panel button[aria-pressed=true]{background:rgba(255,255,255,.16);color:#fff}
.swr-panel button:disabled{opacity:.35;cursor:default}.swr-panel :focus-visible{outline:2px solid #8fb2ff;outline-offset:1px}
.swr-sep{width:1px;height:16px;margin:0 3px;background:rgba(255,255,255,.14)}
.swr-bar{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.08)}.swr-bar i{display:block;height:100%;background:#7fb0ff;transform-origin:left;transform:scaleX(0)}.swr-panel.idle .swr-bar{opacity:0}
@media (max-width:560px){.swr-panel{flex-wrap:wrap;justify-content:center;max-width:94vw}}@media (prefers-reduced-motion:reduce){.swr-panel{transition:none}}`;

export class UIController {
  private el = document.createElement('div'); private b: Record<string, HTMLButtonElement> = {}; private sel = document.createElement('select'); private bar = document.createElement('i');
  constructor(h: UIHandlers) {
    if (!document.getElementById('swr-style')) { const s = document.createElement('style'); s.id = 'swr-style'; s.textContent = CSS; document.head.appendChild(s); }
    this.el.className = 'swr-panel idle'; this.el.setAttribute('data-swarm', ''); this.el.setAttribute('role', 'toolbar'); this.el.setAttribute('aria-label', 'Swarm rebuild controls');
    const mk = (k: string, label: string, fn: () => void, title = '') => { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; x.title = title || label; x.onclick = fn; this.b[k] = x; this.el.appendChild(x); };
    const sep = () => { const s = document.createElement('i'); s.className = 'swr-sep'; this.el.appendChild(s); };
    mk('replay', 'Replay', h.replay); mk('skip', 'Go live', h.skip, 'Skip to the live site (Esc)'); sep();
    [1, 2, 3].forEach(n => mk('s' + n, n + '×', () => h.speed(n), `Speed ${n}×`)); sep();
    mk('tour', 'Tour', h.tour, 'Cinematic: slower pace, glides back to the top before going live'); mk('sound', 'Sound', h.sound, 'Toggle sound (M)'); sep();
    this.sel.setAttribute('aria-label', 'Number of cursors'); this.sel.title = 'Number of cursors (restarts the rebuild)';
    this.sel.onchange = () => h.agents(+this.sel.value); this.el.appendChild(this.sel);
    const bar = document.createElement('div'); bar.className = 'swr-bar'; bar.appendChild(this.bar); this.el.appendChild(bar);
    document.body.appendChild(this.el);
  }
  sync(s: UIState) {
    this.b.skip.disabled = !s.running; this.el.classList.toggle('idle', !s.running);
    [1, 2, 3].forEach(n => this.b['s' + n].setAttribute('aria-pressed', String(s.speed === n)));
    this.b.tour.setAttribute('aria-pressed', String(s.tour)); this.b.sound.setAttribute('aria-pressed', String(s.sound));
    const list = COUNTS.includes(s.agents) ? COUNTS : [...COUNTS, s.agents].sort((a, b) => a - b);
    if (this.sel.options.length !== list.length) { this.sel.innerHTML = ''; list.forEach(n => this.sel.add(new Option(`${n} cursors`, String(n)))); }
    this.sel.value = String(s.agents);
  }
  progress(f: number) { this.bar.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`; }
  destroy() { this.el.remove(); }
}
