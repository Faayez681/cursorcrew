/** Small synthesized sound set (Web Audio): keys, clicks, paste, chime, sweep. Silent until enabled; nothing is downloaded. */
export class AudioController {
  private ctx?: AudioContext; private out?: GainNode; private noise?: AudioBuffer; private last = 0;
  constructor(public enabled: boolean) {
    const wake = () => { if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {}); };
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
  }
  set(on: boolean) { this.enabled = on; if (on) this.ensure(); }
  private ensure(): AudioContext | undefined {
    if (!this.ctx) {
      try {
        const c = this.ctx = new AudioContext(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
        this.out = c.createGain(); this.out.gain.value = 0.5; this.out.connect(lp); lp.connect(c.destination);
        this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  private env(g: GainNode, t: number, dur: number, peak: number) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  private burst(freq: number, q: number, dur: number, peak: number, type: BiquadFilterType = 'bandpass', to?: number) {
    const c = this.ensure(); if (!c || !this.out || !this.noise) return;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    s.buffer = this.noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    this.env(g, t, dur, peak); s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  private tone(f: number, dur: number, type: OscillatorType, peak: number, to?: number, when = 0) {
    const c = this.ensure(); if (!c || !this.out) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    this.env(g, t, dur, peak); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  key() { const n = performance.now(); if (!this.enabled || n - this.last < 40) return; this.last = n; this.burst(2400 + Math.random() * 1400, 1.1, 0.028, 0.05); this.tone(150 + Math.random() * 40, 0.03, 'sine', 0.012); }
  click() { if (!this.enabled) return; this.burst(900, 0.8, 0.05, 0.09, 'lowpass'); this.tone(110, 0.07, 'sine', 0.03, 70); }
  paste() { if (this.enabled) this.burst(500, 0.9, 0.28, 0.06, 'bandpass', 1800); }
  chime() { if (this.enabled) [523, 659, 784].forEach((f, i) => this.tone(f, 0.7, 'sine', 0.02, undefined, i * 0.09)); }
  sweep() { if (this.enabled) this.burst(300, 0.7, 1.3, 0.07, 'bandpass', 3200); }
}
