/**
 * Ambient sound, made in the browser (no audio downloads): birdsong by day,
 * crickets at night, a low wash of distant traffic that swells near the
 * roads, and generators humming in the town after dark. Starts only after
 * the player presses Play (browsers unlock audio on a tap, plan rule S7).
 *
 * These are placeholders until recorded ambience arrives (plan rule S2).
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private traffic: GainNode | null = null;
  private gen: GainNode | null = null;
  private crickets: GainNode | null = null;
  private nextChirp = 0;
  muted = false;

  start(): void {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(ctx.destination);
      // Brown noise for traffic.
      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      this.traffic = ctx.createGain();
      this.traffic.gain.value = 0;
      noise.connect(lp).connect(this.traffic).connect(this.master);
      noise.start();
      // Generator hum: a buzzy 100 Hz tone, low-passed.
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 98;
      const glp = ctx.createBiquadFilter();
      glp.type = "lowpass";
      glp.frequency.value = 260;
      this.gen = ctx.createGain();
      this.gen.gain.value = 0;
      osc.connect(glp).connect(this.gen).connect(this.master);
      osc.start();
      // Crickets: a fast-pulsed high tone.
      const cr = ctx.createOscillator();
      cr.frequency.value = 4400;
      const am = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 28;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(am.gain);
      am.gain.value = 0.5;
      this.crickets = ctx.createGain();
      this.crickets.gain.value = 0;
      cr.connect(am).connect(this.crickets).connect(this.master);
      cr.start();
      lfo.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.2);
  }

  private chirp(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    const base = 2600 + Math.random() * 2200;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const s = t + i * 0.11;
      o.frequency.setValueAtTime(base * (1 + (i % 2) * 0.18), s);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, s + 0.06);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.05 * (0.4 + Math.random() * 0.6), s + 0.015);
      g.gain.linearRampToValueAtTime(0, s + 0.09);
    }
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    o.connect(g).connect(pan).connect(this.master!);
    o.start(t);
    o.stop(t + notes * 0.11 + 0.1);
  }

  /** Called every frame with how near the roads and generators are (0..1) and how dark it is. */
  update(night: number, nearRoad: number, nearGenerator: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    this.traffic!.gain.setTargetAtTime(0.05 + nearRoad * 0.16, now, 0.5);
    this.gen!.gain.setTargetAtTime(night * nearGenerator * 0.05, now, 0.6);
    this.crickets!.gain.setTargetAtTime(night * 0.012, now, 1);
    if (now > this.nextChirp && night < 0.6) {
      this.chirp();
      this.nextChirp = now + 0.6 + Math.random() * 3.5 * (1 + night * 3);
    }
  }
}
