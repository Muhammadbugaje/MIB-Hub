/**
 * The sound studio on /admin/games/<slug>/sounds/<id>: upload, record and edit
 * a replacement sound. Plain DOM (no framework), bound to the markup in that
 * page by data attributes.
 *
 *   Upload  pick a file; its length is measured here, then the server checks
 *           its real type, size and length again. "Edit first" opens it in the editor.
 *   Record  asks for the microphone, shows a level meter, counts in 3-2-1,
 *           records (up to 30 s) with MediaRecorder; play the take, re-take,
 *           edit or save it.
 *   Edit    a waveform with trim start/end, fade in/out, volume and normalise;
 *           preview; "Save as new version" renders the edit with an
 *           OfflineAudioContext (mono, at a rate that fits 2 MB) to a WAV file
 *           and uploads it.
 * Every save goes through the page's own form (action=upload), so the server
 * checks and audits it like any upload.
 */
import { applyEdit, encodeWav, fitRate, peaks, soundEnd, type EditSettings } from "../../games/sounds/dsp.ts";
import { audio, decodeUrl, originalBuffer, playBuffer, stop, type PreviewEntry } from "./sound-kit.ts";

const MAX_RECORD_SECONDS = 30;

export function mountStudio(root: HTMLElement): void {
  const entry = JSON.parse(root.dataset.entry ?? "{}") as PreviewEntry;
  const maxBytes = Number(root.dataset.maxBytes ?? 2 * 1024 * 1024);
  const maxSecs = Number(root.dataset.maxSeconds ?? 120);
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const msgEl = q("[data-studio-msg]");
  const msg = (text: string, bad = false) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.toggle("is-bad", bad);
  };

  /* ---------- tabs ---------- */
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const show = (name: string) => {
    for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === name));
    root.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== name));
    if (name !== "record") releaseMic();
  };
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab ?? "upload")));

  /* ---------- saving: through the hidden form, as a normal upload ---------- */
  const saveForm = q<HTMLFormElement>("[data-save-form]");
  function submitFile(bytes: Uint8Array, name: string, type: string, seconds: number, source: "record" | "edit", note: string) {
    if (!saveForm) return;
    if (bytes.length > maxBytes) return msg(`That is ${(bytes.length / 1048576).toFixed(1)} MB; sounds must be 2 MB or smaller. Trim it shorter.`, true);
    if (seconds > maxSecs) return msg(`Sounds can be at most ${maxSecs} seconds long. Trim it shorter.`, true);
    const input = saveForm.querySelector<HTMLInputElement>("input[type=file]")!;
    const dt = new DataTransfer();
    dt.items.add(new File([bytes.buffer as ArrayBuffer], name, { type }));
    input.files = dt.files;
    saveForm.querySelector<HTMLInputElement>("[name=source]")!.value = source;
    saveForm.querySelector<HTMLInputElement>("[name=duration]")!.value = seconds.toFixed(3);
    saveForm.querySelector<HTMLInputElement>("[name=note]")!.value = note.slice(0, 200);
    msg("Saving…");
    // requestSubmit is Safari 16+; submit() does the same here (no submit handlers on this form).
    if (typeof saveForm.requestSubmit === "function") saveForm.requestSubmit();
    else saveForm.submit();
  }

  /** Render a buffer (already edited) to a mono WAV that fits the size limit, with an OfflineAudioContext. */
  async function toWav(buf: AudioBuffer): Promise<{ bytes: Uint8Array; seconds: number }> {
    const seconds = buf.duration;
    const rate = fitRate(seconds, buf.sampleRate, maxBytes);
    if (!rate) throw new Error(`Too long to fit 2 MB: keep it under ${Math.floor(maxBytes / 22050)} seconds.`);
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start();
    const out = await off.startRendering();
    return { bytes: encodeWav([out.getChannelData(0)], rate), seconds: out.duration };
  }

  /* ---------- upload ---------- */
  const upForm = q<HTMLFormElement>("[data-upload-form]");
  const upFile = upForm?.querySelector<HTMLInputElement>("input[type=file]");
  const upDur = upForm?.querySelector<HTMLInputElement>("[name=duration]");
  let upBuffer: AudioBuffer | null = null;
  upFile?.addEventListener("change", () => {
    upBuffer = null;
    const f = upFile.files?.[0];
    if (!f) return;
    if (f.size > maxBytes) msg(`That file is ${(f.size / 1048576).toFixed(1)} MB; sounds must be 2 MB or smaller. Use "Edit first" to trim it.`, true);
    else msg("");
    f.arrayBuffer()
      .then((ab) => audio().decodeAudioData(ab))
      .then(
        (b) => {
          upBuffer = b;
          if (upDur) upDur.value = b.duration.toFixed(3);
          msg(`${f.name}: ${b.duration.toFixed(2)} s.${b.duration > maxSecs ? ` Too long: at most ${maxSecs} s.` : ""}`, b.duration > maxSecs);
        },
        () => msg("This browser cannot play that file. Upload WAV, MP3, OGG or M4A.", true),
      );
  });
  q("[data-up-play]")?.addEventListener("click", () => (upBuffer ? playBuffer(upBuffer) : msg("Choose a file first.", true)));
  q("[data-up-edit]")?.addEventListener("click", () => {
    if (!upBuffer) return msg("Choose a file first.", true);
    loadEditor(upBuffer, `the file ${upFile?.files?.[0]?.name ?? ""}`);
    show("edit");
  });
  upForm?.addEventListener("submit", () => msg("Uploading…"));

  /* ---------- record ---------- */
  const recLevel = q("[data-rec-level]");
  const recTime = q("[data-rec-time]");
  const recStart = q<HTMLButtonElement>("[data-rec-start]");
  const recStop = q<HTMLButtonElement>("[data-rec-stop]");
  const recTake = q("[data-rec-take]");
  const recAllow = q<HTMLButtonElement>("[data-rec-allow]");
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let meterRaf = 0;
  let recorder: MediaRecorder | null = null;
  let take: AudioBuffer | null = null;
  let recTimer = 0;

  function meter() {
    if (!analyser || !recLevel) return;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    recLevel.style.width = `${Math.min(100, Math.round(peak * 140))}%`;
    recLevel.classList.toggle("is-hot", peak > 0.95);
    meterRaf = requestAnimationFrame(meter);
  }
  async function allowMic(): Promise<boolean> {
    if (stream) return true;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      msg("This browser cannot record. Try Chrome, Edge, Firefox or Safari 14.1+.", true);
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      msg(e instanceof DOMException && e.name === "NotAllowedError" ? "Microphone blocked. Allow it in the browser's address bar, then try again." : "No microphone found.", true);
      return false;
    }
    const a = audio();
    analyser = a.createAnalyser();
    analyser.fftSize = 1024;
    a.createMediaStreamSource(stream).connect(analyser);
    meter();
    if (recAllow) recAllow.hidden = true;
    if (recStart) recStart.disabled = false;
    msg("Microphone on. Watch the meter: speak up until it moves, but keep it out of the red.");
    return true;
  }
  function releaseMic() {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    cancelAnimationFrame(meterRaf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    analyser = null;
    if (recAllow) recAllow.hidden = false;
    if (recStart) recStart.disabled = true;
  }
  function beep(at: number, high: boolean) {
    const a = audio();
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.value = high ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    o.connect(g);
    g.connect(a.destination);
    o.start(at);
    o.stop(at + 0.15);
  }
  function pickMime(): string {
    for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"]) if (MediaRecorder.isTypeSupported?.(m)) return m;
    return "";
  }
  async function startRecording() {
    if (!(await allowMic()) || !stream) return;
    stop();
    take = null;
    if (recTake) recTake.hidden = true;
    if (recStart) recStart.disabled = true;
    const countIn = q<HTMLInputElement>("[data-rec-countin]")?.checked;
    if (countIn) {
      const a = audio();
      for (let i = 0; i < 3; i++) beep(a.currentTime + i * 0.6, false);
      for (const n of [3, 2, 1]) {
        msg(`Recording in ${n}…`);
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    const chunks: Blob[] = [];
    const mime = pickMime();
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      clearInterval(recTimer);
      if (recStop) recStop.disabled = true;
      if (recStart) recStart.disabled = !stream;
      new Blob(chunks, { type: recorder?.mimeType || mime })
        .arrayBuffer()
        .then((ab) => audio().decodeAudioData(ab))
        .then(
          (b) => {
            take = b;
            if (recTake) recTake.hidden = false;
            msg(`Take ready: ${b.duration.toFixed(1)} s. Play it, re-take, edit it, or save it.`);
          },
          () => msg("Could not read the recording. Try again.", true),
        );
    };
    const t0 = Date.now();
    recorder.start();
    if (recStop) recStop.disabled = false;
    msg("Recording… press Stop when you are done.");
    recTimer = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      if (recTime) recTime.textContent = `${s.toFixed(1)} s`;
      if (s >= MAX_RECORD_SECONDS && recorder?.state === "recording") recorder.stop();
    }, 100);
  }
  recAllow?.addEventListener("click", () => void allowMic());
  recStart?.addEventListener("click", () => void startRecording());
  recStop?.addEventListener("click", () => recorder?.state === "recording" && recorder.stop());
  q("[data-rec-play]")?.addEventListener("click", () => take && playBuffer(take));
  q("[data-rec-retake]")?.addEventListener("click", () => void startRecording());
  q("[data-rec-edit]")?.addEventListener("click", () => {
    if (!take) return;
    loadEditor(take, "your recording", "record");
    show("edit");
  });
  q("[data-rec-save]")?.addEventListener("click", () => {
    if (!take) return;
    const ch = channelsOf(take);
    const end = Math.max(0.05, soundEnd(ch, take.sampleRate));
    const edited = toBuffer(applyEdit(ch, take.sampleRate, { start: 0, end, fadeIn: 0.005, fadeOut: 0.02, gain: 1, normalise: false }), take.sampleRate);
    toWav(edited).then(
      (w) => submitFile(w.bytes, `${entry.id.replace(/[^a-z0-9_-]/gi, "_")}-recording.wav`, "audio/wav", w.seconds, "record", "Recorded in the admin"),
      (e: Error) => msg(e.message, true),
    );
  });

  /* ---------- edit ---------- */
  const canvas = q<HTMLCanvasElement>("[data-ed-wave]");
  const inputs = {
    start: q<HTMLInputElement>("[data-ed=start]"),
    end: q<HTMLInputElement>("[data-ed=end]"),
    fadeIn: q<HTMLInputElement>("[data-ed=fadeIn]"),
    fadeOut: q<HTMLInputElement>("[data-ed=fadeOut]"),
    gain: q<HTMLInputElement>("[data-ed=gain]"),
    normalise: q<HTMLInputElement>("[data-ed=normalise]"),
  };
  const edInfo = q("[data-ed-info]");
  const edControls = q("[data-ed-controls]");
  let ed: { buf: AudioBuffer; ch: Float32Array[]; label: string; from: "edit" | "record" } | null = null;

  function channelsOf(b: AudioBuffer): Float32Array[] {
    return Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
  }
  function toBuffer(ch: Float32Array[], rate: number): AudioBuffer {
    const b = audio().createBuffer(Math.max(1, ch.length), Math.max(1, ch[0]?.length ?? 1), rate);
    ch.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    return b;
  }
  function settings(): EditSettings {
    const n = (el: HTMLInputElement | null, d: number) => (el ? Number(el.value) : d);
    return {
      start: n(inputs.start, 0),
      end: n(inputs.end, ed?.buf.duration ?? 0),
      fadeIn: n(inputs.fadeIn, 0),
      fadeOut: n(inputs.fadeOut, 0),
      gain: n(inputs.gain, 100) / 100,
      normalise: !!inputs.normalise?.checked,
    };
  }
  function label(name: string, text: string) {
    const o = q(`[data-ed-out=${name}]`);
    if (o) o.textContent = text;
  }
  function draw() {
    if (!canvas || !ed) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
    const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
    const c = canvas.getContext("2d");
    if (!c) return;
    const css = getComputedStyle(canvas);
    const wave = css.getPropertyValue("--wave").trim() || "#3dd68c";
    const dim = css.getPropertyValue("--wave-dim").trim() || "rgba(128,128,128,.35)";
    const s = settings();
    const dur = ed.buf.duration || 1;
    const x0 = (s.start / dur) * w;
    const x1 = (s.end / dur) * w;
    c.clearRect(0, 0, w, h);
    const pk = peaks(ed.ch[0]!, Math.max(1, Math.floor(w / dpr)));
    // Drawn scaled up (up to 8x) so quiet sounds are still visible; the sound itself is not changed.
    const top = pk.reduce((m, p) => Math.max(m, p.max, -p.min), 0);
    const zoom = top > 0 ? Math.min(8, 0.95 / top) : 1;
    const bw = w / pk.length;
    pk.forEach((p, i) => {
      const x = i * bw;
      c.fillStyle = x >= x0 && x <= x1 ? wave : dim;
      const y0 = h / 2 - p.max * (h / 2) * zoom;
      const y1 = h / 2 - p.min * (h / 2) * zoom;
      c.fillRect(x, y0, Math.max(1, bw - 0.5), Math.max(1, y1 - y0));
    });
    // fades, drawn as lines over the kept part
    c.strokeStyle = css.getPropertyValue("--fade").trim() || "#f6c445";
    c.lineWidth = 2 * dpr;
    c.beginPath();
    c.moveTo(x0, h);
    c.lineTo(x0 + (s.fadeIn / dur) * w, 2 * dpr);
    c.lineTo(x1 - (s.fadeOut / dur) * w, 2 * dpr);
    c.lineTo(x1, h);
    c.stroke();
  }
  function refresh() {
    if (!ed) return;
    const s = settings();
    if (inputs.start && inputs.end && s.start > s.end - 0.02) {
      inputs.start.value = String(Math.max(0, s.end - 0.02));
    }
    const t = settings();
    const len = Math.max(0, t.end - t.start);
    label("start", `${t.start.toFixed(2)} s`);
    label("end", `${t.end.toFixed(2)} s`);
    label("fadeIn", `${t.fadeIn.toFixed(2)} s`);
    label("fadeOut", `${t.fadeOut.toFixed(2)} s`);
    label("gain", `${Math.round(t.gain * 100)}%`);
    const rate = fitRate(len, ed.buf.sampleRate, maxBytes);
    if (edInfo) {
      edInfo.textContent = `Editing ${ed.label}. Kept: ${len.toFixed(2)} s of ${ed.buf.duration.toFixed(2)} s.` + (rate ? ` Saves as a ${Math.round(rate / 100) / 10} kHz WAV.` : " Too long to fit 2 MB: trim it.");
    }
    draw();
  }
  function loadEditor(buf: AudioBuffer, what: string, from: "edit" | "record" = "edit") {
    stop();
    ed = { buf, ch: channelsOf(buf), label: what, from };
    const d = buf.duration;
    const end = Math.min(d, Math.max(0.05, soundEnd(ed.ch, buf.sampleRate)) || d);
    for (const el of [inputs.start, inputs.end, inputs.fadeIn, inputs.fadeOut]) if (el) el.max = d.toFixed(3);
    if (inputs.fadeIn) inputs.fadeIn.max = Math.min(d, 5).toFixed(3);
    if (inputs.fadeOut) inputs.fadeOut.max = Math.min(d, 5).toFixed(3);
    if (inputs.start) inputs.start.value = "0";
    if (inputs.end) inputs.end.value = end.toFixed(3);
    if (inputs.fadeIn) inputs.fadeIn.value = "0";
    if (inputs.fadeOut) inputs.fadeOut.value = "0";
    if (inputs.gain) inputs.gain.value = "100";
    if (inputs.normalise) inputs.normalise.checked = false;
    if (edControls) edControls.hidden = false;
    refresh();
    msg(`Loaded ${what} into the editor.`);
  }
  function edited(): AudioBuffer | null {
    if (!ed) return null;
    const s = settings();
    if (s.end - s.start < 0.05) {
      msg("Keep at least 0.05 seconds.", true);
      return null;
    }
    return toBuffer(applyEdit(ed.ch, ed.buf.sampleRate, s), ed.buf.sampleRate);
  }
  Object.values(inputs).forEach((el) => el?.addEventListener("input", refresh));
  window.addEventListener("resize", draw);
  canvas?.addEventListener("pointerdown", (e) => {
    // Click the waveform to move the nearest trim handle there.
    if (!ed || !inputs.start || !inputs.end) return;
    const r = canvas.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * ed.buf.duration;
    const s = settings();
    if (Math.abs(t - s.start) < Math.abs(t - s.end)) inputs.start.value = String(Math.max(0, Math.min(t, s.end - 0.02)));
    else inputs.end.value = String(Math.max(t, s.start + 0.02));
    refresh();
  });
  q("[data-ed-source-load]")?.addEventListener("click", () => {
    const sel = q<HTMLSelectElement>("[data-ed-source]");
    const v = sel?.value ?? "original";
    const what = sel?.selectedOptions[0]?.textContent?.trim() ?? v;
    msg("Loading…");
    const p = v === "original" ? originalBuffer(entry) : decodeUrl(v);
    p.then(
      (b) => loadEditor(b, what.toLowerCase()),
      (e: Error) => msg(e.message, true),
    );
  });
  q("[data-ed-play]")?.addEventListener("click", () => {
    const b = edited();
    if (b) playBuffer(b);
  });
  q("[data-ed-stop]")?.addEventListener("click", () => stop());
  q("[data-ed-save]")?.addEventListener("click", () => {
    const b = edited();
    if (!b || !ed) return;
    const s = settings();
    const parts = [`from ${ed.label}`, `${s.start.toFixed(2)}–${s.end.toFixed(2)} s`];
    if (s.fadeIn || s.fadeOut) parts.push(`fade ${s.fadeIn.toFixed(2)}/${s.fadeOut.toFixed(2)} s`);
    if (s.normalise) parts.push("normalised");
    if (s.gain !== 1) parts.push(`volume ${Math.round(s.gain * 100)}%`);
    const from = ed.from;
    toWav(b).then(
      (w) => submitFile(w.bytes, `${entry.id.replace(/[^a-z0-9_-]/gi, "_")}-edit.wav`, "audio/wav", w.seconds, from, `Edited ${parts.join(", ")}`),
      (e: Error) => msg(e.message, true),
    );
  });
  // "Edit" on a saved version
  document.querySelectorAll<HTMLButtonElement>("[data-edit-url]").forEach((btn) =>
    btn.addEventListener("click", () => {
      msg("Loading…");
      decodeUrl(btn.dataset.editUrl ?? "").then(
        (b) => {
          loadEditor(b, btn.dataset.editLabel ?? "a saved version");
          show("edit");
          root.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        (e: Error) => msg(e.message, true),
      );
    }),
  );
  window.addEventListener("pagehide", releaseMic);
  const start = location.hash === "#record" ? "record" : location.hash === "#edit" ? "edit" : "upload";
  show(start);
}
