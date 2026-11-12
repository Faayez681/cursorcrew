export interface SwarmOptions {
  selector?: string; agents?: number; speed?: number; sound?: boolean; autoStart?: boolean; tour?: boolean; controls?: boolean;
  /** Play only once per 'session' (tab) or 'forever' (browser). Replay() always plays. */
  once?: false | 'session' | 'forever';
  onProgress?: (fraction: number) => void;
  onComplete?: (info: { skipped: boolean; ms: number }) => void;
}
export interface Word { t: string; x: number; w: number }
export interface Line { y: number; h: number; words: Word[]; start: number; n: number }
export type Kind = 'box' | 'text' | 'image';
export interface Typo { at: number; ch: string; st: number; t: number }
export interface Grad { a: number; s: { o: number; c: string }[] }
export interface Shadow { c: string; x: number; y: number; b: number }
export interface Step {
  kind: Kind; x: number; y: number; w: number; h: number; r: number; bg: string | null; bc: string | null; bw: number;
  color: string; font: string; ls: string; lines: Line[]; total: number; img: CanvasImageSource | null; tint: string;
  work: number; p: number; owners: number; arr: number; shown: number;
  fs: number; fam: string; hold: boolean; fixed: boolean; ghost: boolean; dupOf: Step | null; kids: Step[];
  src: Step | null; selT: number; gap: number; typo: Typo | null; typoTried: boolean;
  a: number; grad: Grad | null; bgImg: HTMLImageElement | null; bsize: string; bpos: string; shadow: Shadow | null;
  ul: { c: string; th: number } | null; fit: string; fpos: string; sides: { w: number; c: string }[] | null;
}
export interface Blueprint { steps: Step[]; bg: string; dark: boolean }
export type Phase = 'idle' | 'build' | 'flock' | 'outro' | 'done';
