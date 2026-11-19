/**
 * Story sound cues and music beds, made in the browser (no downloads).
 *
 * Every `sfx.play { cue }` and `music.play { cue }` in Missions 1-10 has a
 * synthesized placeholder here, flagged as such (plan rule S2: synthesized
 * sound is a placeholder until recorded or designed samples replace it; S1:
 * nothing is "approved" before an ear review). A recorded file named
 * assets/sfx/<cue>.ogg will replace a cue when it exists (listed at build).
 *
 * The mix follows plan §6.6 in miniature: music sits under dialogue and ducks
 * while a line plays; everything goes through one compressor.
 */

export const SFX_CUES = [
  "cock_crow_wrong_time", "goat_bell_fast", "clock_strike_single_far", "rubber_stamp", "power_down_whine", "hostel_groan_wave", "knock_three",
  "radio_static", "three_notes", "wind_gust", "knuckle_crack", "ball_miss_whoosh", "goalpost_clang", "book_shut", "kettle_boil", "coil_hum_low", "coil_crack",
  "locker_creak_grand", "locker_slam", "keys_jingle_stairs", "phone_ring", "phone_text", "bank_alert", "pickup", "mission_pass", "door", "whistle", "kick", "light_back",
] as const;
export const MUSIC_CUES = ["main_theme_dawn", "queue_theme", "anthem_brass", "mystery_thread", "plug_theme", "dark_quiet"] as const;

/** Placeholder flags for the audio manifest (plan S1/S2). */
export const PLACEHOLDER = true;

type Note = [number, number, number]; // [semitone from A4, start beat, length beats]

const MUSIC: Record<string, { bpm: number; wave: OscillatorType; notes: Note[]; bars: number; vol: number; pad?: number[] }> = {
  main_theme_dawn: { bpm: 72, wave: "triangle", vol: 0.12, bars: 8, pad: [-12, -5, 0], notes: [[3, 0, 1], [7, 1, 1], [10, 2, 2], [8, 4, 1], [7, 5, 1], [3, 6, 2], [5, 8, 1], [7, 9, 1], [12, 10, 2], [10, 12, 3], [7, 15, 1], [3, 16, 2], [5, 18, 1], [3, 19, 1], [0, 20, 4], [-2, 24, 2], [0, 26, 2], [3, 28, 4]] },
  queue_theme: { bpm: 96, wave: "square", vol: 0.05, bars: 4, notes: [[0, 0, 0.5], [0, 1, 0.5], [3, 2, 0.5], [0, 3, 0.5], [-2, 4, 0.5], [-2, 5, 0.5], [0, 6, 1], [5, 8, 0.5], [3, 9, 0.5], [0, 10, 0.5], [-2, 11, 0.5], [0, 12, 2]] },
  anthem_brass: { bpm: 84, wave: "sawtooth", vol: 0.05, bars: 4, pad: [-12, -8, -5], notes: [[0, 0, 1], [4, 1, 1], [7, 2, 2], [9, 4, 1], [7, 5, 1], [4, 6, 2], [5, 8, 1], [4, 9, 1], [2, 10, 1], [0, 11, 1], [7, 12, 4]] },
  mystery_thread: { bpm: 54, wave: "sine", vol: 0.1, bars: 4, pad: [-24, -17, -12], notes: [[3, 0, 3], [2, 4, 3], [-1, 8, 3], [6, 12, 4]] },
  plug_theme: { bpm: 112, wave: "square", vol: 0.045, bars: 2, notes: [[0, 0, 0.5], [7, 0.75, 0.25], [5, 1, 0.5], [3, 1.5, 0.5], [0, 2, 0.5], [3, 3, 0.5], [5, 3.5, 0.5], [7, 4, 1], [10, 5, 0.5], [7, 6, 1], [3, 7, 1]] },
  dark_quiet: { bpm: 48, wave: "sine", vol: 0.08, bars: 4, pad: [-24, -21], notes: [[-1, 0, 6], [0, 8, 6]] },
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer = 0;
  private musicCue: string | null = null;
  private hum: { osc: OscillatorNode; g: GainNode } | null = null;
  muted = false;

  /** Call from a user gesture (Play button) so the browser allows sound. */
  start(): void {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.8;
      this.out.connect(comp).connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.8;
      this.musicGain.connect(this.out);
    } catch {
      this.ctx = null;
    }
  }

  private vol = 0.8;

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.05);
  }

  /** Effects and music volume from the settings (0..1). */
  setVolume(v: number): void {
    this.vol = 0.8 * Math.max(0, Math.min(1, v));
    if (this.out && this.ctx && !this.muted) this.out.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05);
  }

  /** Dialogue ducks the music (−8 dB, 150 ms attack / 600 ms release). */
  duck(on: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0.8, this.ctx.currentTime, on ? 0.05 : 0.2);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slide = 0, dest?: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(dest ?? this.out!);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, vol: number, f0: number, f1: number, q = 1): void {
    const c = this.ctx!;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, start);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.05, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f).connect(g).connect(this.out!);
    s.start(start);
  }

  play(cue: string): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    switch (cue) {
      case "cock_crow_wrong_time":
        this.tone(520, t, 0.25, "sawtooth", 0.08, 1.4);
        this.tone(740, t + 0.25, 0.7, "sawtooth", 0.08, 0.7);
        break;
      case "goat_bell_fast":
        for (let k = 0; k < 8; k++) this.tone(1760 + (k % 2) * 220, t + k * 0.11, 0.25, "triangle", 0.12);
        this.tone(330, t + 0.6, 0.4, "sawtooth", 0.06, 0.8);
        break;
      case "clock_strike_single_far":
        [1, 2.76, 5.4].forEach((m, i) => this.tone(196 * m, t, 4 - i, "sine", 0.18 / (i + 1)));
        break;
      case "rubber_stamp":
        this.noise(t, 0.12, 0.5, 300, 120, 2);
        this.tone(90, t, 0.12, "sine", 0.4);
        break;
      case "power_down_whine":
        this.tone(880, t, 1.4, "sawtooth", 0.08, 0.1);
        break;
      case "light_back":
        this.tone(110, t, 1.0, "sawtooth", 0.06, 6);
        break;
      case "hostel_groan_wave":
        for (let k = 0; k < 5; k++) this.noise(t + k * 0.25, 1.2, 0.08, 300 - k * 30, 200, 3);
        break;
      case "knock_three":
        for (let k = 0; k < 3; k++) {
          this.noise(t + k * 0.32, 0.07, 0.5, 600, 250, 3);
          this.tone(140, t + k * 0.32, 0.08, "sine", 0.4);
        }
        break;
      case "radio_static":
        this.noise(t, 2.4, 0.12, 2400, 1800, 0.3);
        break;
      case "three_notes":
        [0, 7, 3].forEach((s, i) => this.tone(440 * 2 ** (s / 12), t + i * 0.7, 0.9, "sine", 0.18));
        break;
      case "wind_gust":
        this.noise(t, 2.2, 0.25, 300, 900, 0.6);
        break;
      case "knuckle_crack":
        for (let k = 0; k < 4; k++) this.noise(t + k * 0.06, 0.03, 0.6, 3000, 2500, 4);
        break;
      case "ball_miss_whoosh":
        this.noise(t, 0.45, 0.3, 500, 2500, 1.5);
        break;
      case "goalpost_clang":
        [1, 2.4, 3.9, 5.2].forEach((m, i) => this.tone(520 * m, t, 1.4 - i * 0.2, "sine", 0.2 / (i + 1)));
        break;
      case "book_shut":
        this.noise(t, 0.12, 0.6, 500, 150, 1);
        this.tone(70, t, 0.15, "sine", 0.5);
        break;
      case "kettle_boil":
        this.noise(t, 2.5, 0.1, 3500, 4500, 2);
        break;
      case "coil_hum_low":
        this.humOn(55, 6);
        break;
      case "coil_crack":
        // A sharp crack, a fizzing tail and a low thump.
        this.noise(t, 0.05, 0.9, 4000, 1500, 0.6);
        this.noise(t + 0.03, 0.4, 0.25, 6000, 3000, 3);
        this.tone(90, t, 0.25, "sine", 0.35, 0.4);
        break;
      case "locker_creak_grand":
        this.tone(180, t, 1.1, "sawtooth", 0.05, 1.6);
        this.noise(t, 1.1, 0.05, 900, 1400, 6);
        break;
      case "locker_slam":
        this.noise(t, 0.25, 0.7, 900, 200, 1);
        this.tone(160, t, 0.4, "square", 0.2, 0.6);
        break;
      case "keys_jingle_stairs":
        for (let k = 0; k < 7; k++) this.tone(3000 + Math.random() * 1500, t + k * 0.09 + Math.random() * 0.04, 0.15, "triangle", 0.06);
        break;
      case "phone_ring":
        for (let k = 0; k < 2; k++) {
          this.tone(988, t + k * 0.45, 0.18, "square", 0.06);
          this.tone(784, t + k * 0.45 + 0.2, 0.18, "square", 0.06);
        }
        break;
      case "phone_text":
        this.tone(1318, t, 0.08, "sine", 0.12);
        this.tone(1760, t + 0.1, 0.12, "sine", 0.12);
        break;
      case "bank_alert":
        [0, 4, 7, 12].forEach((s, i) => this.tone(660 * 2 ** (s / 12), t + i * 0.08, 0.2, "triangle", 0.1));
        break;
      case "pickup":
        this.tone(880, t, 0.12, "triangle", 0.12, 1.5);
        break;
      case "mission_pass":
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(392 * 2 ** (s / 12), t + i * 0.12, 0.5, "triangle", 0.12));
        break;
      case "door":
        this.noise(t, 0.2, 0.3, 400, 150, 1);
        break;
      case "whistle":
        this.tone(2400, t, 0.5, "sine", 0.12, 1.05);
        break;
      case "kick":
        this.noise(t, 0.08, 0.6, 250, 100, 1);
        this.tone(80, t, 0.1, "sine", 0.4);
        break;
    }
  }

  /**
   * The Garden coil's standing hum: two detuned low oscillators (55 Hz and its
   * fifth) through one gain, started once and only ever turned up or down.
   * level 0..1 (the caller applies distance falloff and the coil's state);
   * pitch rises a little when the coil is lit.
   */
  coilHum(level: number, lit: boolean): void {
    if (!this.ctx || !this.out) return;
    const c = this.ctx;
    if (!this.coil) {
      if (level <= 0.001) return;
      const g = c.createGain();
      g.gain.value = 0;
      const a = c.createOscillator(), b = c.createOscillator();
      a.type = "sine";
      b.type = "triangle";
      a.frequency.value = 55;
      b.frequency.value = 82.6;
      const bg = c.createGain();
      bg.gain.value = 0.25;
      a.connect(g);
      b.connect(bg).connect(g);
      g.connect(this.out);
      a.start();
      b.start();
      this.coil = { g, a, b, level: 0 };
    }
    const target = Math.max(0, Math.min(1, level)) * 0.28;
    if (Math.abs(target - this.coil.level) > 0.002) {
      this.coil.level = target;
      this.coil.g.gain.setTargetAtTime(target, c.currentTime, 0.25);
    }
    const f = lit ? 61 : 55;
    if (Math.abs(this.coil.a.frequency.value - f) > 0.5) {
      this.coil.a.frequency.setTargetAtTime(f, c.currentTime, 0.6);
      this.coil.b.frequency.setTargetAtTime(f * 1.502, c.currentTime, 0.6);
    }
  }
  private coil: { g: GainNode; a: OscillatorNode; b: OscillatorNode; level: number } | null = null;

  private humOn(freq: number, secs: number): void {
    const c = this.ctx!;
    this.hum?.osc.stop();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 1);
    g.gain.setValueAtTime(0.22, c.currentTime + secs - 1);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + secs);
    o.connect(g).connect(this.out!);
    o.start();
    o.stop(c.currentTime + secs + 0.1);
    this.hum = { osc: o, g };
  }

  /** A looping music bed (or null to fade the current one out). */
  music(cue: string | null): void {
    if (!this.ctx || !this.musicGain) return;
    if (cue === this.musicCue) return;
    this.musicCue = cue;
    clearInterval(this.musicTimer);
    if (!cue) return;
    const m = MUSIC[cue];
    if (!m) return;
    const beat = 60 / m.bpm;
    const loopLen = m.bars * 4 * beat;
    const schedule = () => {
      if (this.musicCue !== cue || !this.ctx) return;
      const t0 = this.ctx.currentTime + 0.05;
      for (const [s, b, l] of m.notes) this.tone(440 * 2 ** (s / 12), t0 + b * beat, l * beat * 0.95, m.wave, m.vol, 0, this.musicGain!);
      for (const p of m.pad ?? []) this.tone(440 * 2 ** (p / 12), t0, loopLen, "sine", m.vol * 0.5, 0, this.musicGain!);
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, loopLen * 1000);
  }
}
