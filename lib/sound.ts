"use client";

// All sounds are synthesized in-browser via the Web Audio API — no
// external audio files, no licensing concerns, no network requests.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const MUTE_KEY = "qc_sound_muted";

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(MUTE_KEY);
  // Default to muted until the person explicitly turns sound on — this also
  // guarantees the very tap that unmutes is a real user gesture, which
  // browsers require before they'll actually let audio play.
  if (stored === null) return true;
  return stored === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

// Must be called synchronously inside a click/tap event handler. Creates
// (or resumes) the AudioContext and plays a near-silent blip so iOS/Safari
// and other strict browsers actually unlock audio output for this page.
export function unlockAudio(): void {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.01);
}

function tone(
  freq: number,
  duration: number,
  opts: { type?: OscillatorType; delay?: number; peak?: number } = {}
) {
  if (isMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const { type = "sine", delay = 0, peak = 0.18 } = opts;
  const startAt = audioCtx.currentTime + delay;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export function playTick() {
  tone(880, 0.07, { type: "square", peak: 0.12 });
}

export function playCountdownGo() {
  tone(660, 0.12, { type: "square" });
  tone(990, 0.22, { delay: 0.13, type: "square", peak: 0.22 });
}

export function playCorrect() {
  tone(523.25, 0.1, { delay: 0 });
  tone(659.25, 0.1, { delay: 0.09 });
  tone(783.99, 0.18, { delay: 0.18, peak: 0.22 });
}

export function playWrong() {
  tone(196, 0.28, { type: "sawtooth", peak: 0.16 });
  tone(146.83, 0.32, { type: "sawtooth", delay: 0.08, peak: 0.16 });
}

export function playFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(f, 0.28, { delay: i * 0.14, peak: 0.2 }));
}

export function playReveal() {
  tone(440, 0.1, { delay: 0 });
  tone(880, 0.16, { delay: 0.1, peak: 0.2 });
}

export function playFlip() {
  tone(300, 0.06, { type: "triangle", peak: 0.14 });
  tone(500, 0.09, { type: "triangle", delay: 0.05, peak: 0.14 });
}
