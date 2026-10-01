// The narrator: plays a family's recorded clips (locally generated, content-hashed .m4a) on the tour's clock.
//
// Web Audio, not <audio>: a clip is fetched, decoded once and started at an exact offset, so "play this clip from 1.3 s in" (a jump into the
// middle of a beat) is one call, a pause freezes the clock with the context (ctx.suspend), and no server needs byte-range support.
// The clock the tour reads is `position()`: seconds into the clip that is sounding, from the AudioContext's own time.
//
// Rules this file keeps, each with a test (scripts/story/portal-tests/player.mts, T8):
//   - Nothing is created before a gesture. `enable()` is called from a click or a key press (the start card's button, or M): it makes the
//     AudioContext there, resumes it there and plays one silent sample there, which is what iOS Safari needs. "Start without sound"
//     never calls it, so a visitor who declines sound never gets a context at all.
//   - The bytes of the next clips are fetched ahead (`prefetch`), with a plain fetch, before any gesture is needed; decoding waits for the context.
//   - A clip that cannot be fetched or decoded is a null buffer, once: `onFail` is told (the tour says "Narration could not load. Captions
//     are on."), and the tour goes on silent for that clip. Nothing here throws into the tour.
//   - Narration plays at normal speed only. At 0.5x or 2x a Web Audio source would change pitch; the tour mutes it and says so instead.
export type ClipSource = { url: string; durationMs: number };

type Playing = { id: string; src: AudioBufferSourceNode; ctxStart: number; offset: number; durationS: number; ended: boolean };

export class Narrator {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private cur: Playing | null = null;
  private failed = new Set<string>();
  private wantMuted = false;
  private paused = false;
  /** told once per clip that cannot play */
  onFail: (id: string) => void = () => {};
  /** told when the clip that was sounding has ended on its own */
  onEnded: (id: string) => void = () => {};
  constructor(private clips: Record<string, ClipSource>) {}

  /** has a context been made (only ever after a gesture) */
  get created(): boolean { return !!this.ctx; }
  get running(): boolean { return !!this.ctx && this.ctx.state === 'running'; }
  /** the clip sounding now, or null */
  get current(): string | null { return this.cur && !this.cur.ended ? this.cur.id : null; }
  has(id: string): boolean { return !!this.clips[id]; }

  /** MUST be called from a user gesture. Makes the context if there is none, resumes it, and unlocks it with one silent sample. */
  enable(): boolean {
    try {
      if (!this.ctx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC({ latencyHint: 'interactive' }) as AudioContext;
        this.gain = this.ctx.createGain();
        this.gain.gain.value = this.wantMuted ? 0 : 1;
        this.gain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume().catch(() => {});
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
      return true;
    } catch { return false; }
  }

  /** Fetch the bytes of these clips now (cached). Safe before a gesture: nothing is decoded or played. */
  prefetch(ids: string[]): void { for (const id of ids) void this.fetchBytes(id); }
  private fetchBytes(id: string): Promise<ArrayBuffer | null> {
    let p = this.bytes.get(id);
    if (!p) {
      const c = this.clips[id];
      p = c ? fetch(c.url).then(r => (r.ok ? r.arrayBuffer() : null), () => null) : Promise.resolve(null);
      this.bytes.set(id, p);
    }
    return p;
  }
  private decode(id: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id);
    if (!p) {
      const ctx = this.ctx;
      p = !ctx ? Promise.resolve(null) : this.fetchBytes(id).then(buf => {
        if (!buf) return null;
        // (decodeAudioData detaches what it is given, and the bytes stay cached; the callback form is the one old Safari has)
        return new Promise<AudioBuffer | null>(res => { try { const r = ctx.decodeAudioData(buf.slice(0), b => res(b), () => res(null)); if (r && (r as any).catch) (r as any).catch(() => res(null)); } catch { res(null); } });
      });
      this.buffers.set(id, p);
    }
    return p;
  }
  /** Decode these clips ahead (only once a context exists). */
  warm(ids: string[]): void { if (this.ctx) for (const id of ids) void this.decode(id); }

  /** Start a clip `offsetS` seconds in. Resolves true when it is sounding, false when it cannot (not enabled, failed, or past its end). */
  async play(id: string, offsetS = 0): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || !this.gain || this.failed.has(id) || !this.clips[id]) return false;
    this.stop();
    const token = (this.token = (this.token || 0) + 1);
    const buf = await this.decode(id);
    if (token !== this.token) return false;           // another clip was asked for (or a stop) while this one decoded
    if (!buf) { this.failed.add(id); this.onFail(id); return false; }
    const off = Math.max(0, offsetS);
    if (off >= buf.duration - 0.05) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(this.gain);
    const rec: Playing = { id, src, ctxStart: ctx.currentTime, offset: off, durationS: buf.duration, ended: false };
    src.onended = () => { if (this.cur === rec && !rec.ended) { rec.ended = true; this.onEnded(id); } };
    src.start(0, off);
    this.cur = rec;
    return true;
  }
  private token = 0;

  /** seconds into the clip that is sounding (frozen while paused), or null */
  position(): number | null {
    const c = this.cur, ctx = this.ctx;
    if (!c || c.ended || !ctx) return null;
    return Math.min(c.durationS, c.offset + (ctx.currentTime - c.ctxStart));
  }
  stop(): void {
    this.token++;
    const c = this.cur; this.cur = null;
    if (c && !c.ended) { c.ended = true; c.src.onended = null; try { c.src.stop(); } catch { /* already stopped */ } try { c.src.disconnect(); } catch { /* */ } }
  }
  /** Freeze the clock with the context. */
  pause(): void { this.paused = true; if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {}); }
  resume(): void { this.paused = false; if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  setMuted(m: boolean): void { this.wantMuted = m; if (this.gain) this.gain.gain.value = m ? 0 : 1; }
  /** a clip that failed once is not asked for again */
  hasFailed(id: string): boolean { return this.failed.has(id); }
  destroy(): void { this.stop(); const c = this.ctx; this.ctx = null; this.gain = null; if (c) void c.close().catch(() => {}); this.bytes.clear(); this.buffers.clear(); }
}
