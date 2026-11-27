import { getBrowserStorage } from "@/core";
import { MUTE_STORAGE_KEY } from "../config";
import { uiStore } from "../ui/store";

export type SfxName =
  | "gather"
  | "craft"
  | "hit"
  | "block"
  | "boss_phase"
  | "pickup"
  | "nightfall"
  | "riposte_arm"
  | "riposte_strike"
  | "ui";

interface Tone {
  freq: number;
  endFreq?: number;
  start: number;
  dur: number;
  type: OscillatorType;
  gain: number;
}

const SOUNDS: Record<SfxName, Tone[]> = {
  gather: [
    {
      freq: 220,
      endFreq: 140,
      start: 0,
      dur: 0.09,
      type: "square",
      gain: 0.12,
    },
    {
      freq: 330,
      endFreq: 200,
      start: 0.05,
      dur: 0.08,
      type: "triangle",
      gain: 0.1,
    },
  ],
  craft: [
    { freq: 392, start: 0, dur: 0.09, type: "square", gain: 0.1 },
    { freq: 523, start: 0.09, dur: 0.09, type: "square", gain: 0.1 },
    { freq: 784, start: 0.18, dur: 0.16, type: "triangle", gain: 0.12 },
  ],
  hit: [
    {
      freq: 180,
      endFreq: 50,
      start: 0,
      dur: 0.14,
      type: "sawtooth",
      gain: 0.16,
    },
  ],
  block: [
    {
      freq: 1568,
      endFreq: 962,
      start: 0,
      dur: 0.11,
      type: "triangle",
      gain: 0.14,
    },
    { freq: 2319, start: 0.012, dur: 0.08, type: "sine", gain: 0.08 },
  ],
  boss_phase: [
    {
      freq: 116,
      endFreq: 43,
      start: 0,
      dur: 0.42,
      type: "triangle",
      gain: 0.2,
    },
    { freq: 76, endFreq: 37, start: 0.05, dur: 0.52, type: "sine", gain: 0.15 },
  ],
  pickup: [
    { freq: 660, start: 0, dur: 0.06, type: "square", gain: 0.08 },
    { freq: 990, start: 0.06, dur: 0.09, type: "square", gain: 0.08 },
  ],
  nightfall: [
    {
      freq: 196,
      endFreq: 98,
      start: 0,
      dur: 0.7,
      type: "triangle",
      gain: 0.16,
    },
    { freq: 147, endFreq: 73, start: 0.25, dur: 0.9, type: "sine", gain: 0.14 },
  ],
  riposte_arm: [
    {
      freq: 587,
      endFreq: 880,
      start: 0,
      dur: 0.08,
      type: "triangle",
      gain: 0.14,
    },
    { freq: 1175, start: 0.04, dur: 0.09, type: "sine", gain: 0.1 },
  ],
  riposte_strike: [
    {
      freq: 320,
      endFreq: 110,
      start: 0,
      dur: 0.14,
      type: "sawtooth",
      gain: 0.18,
    },
    {
      freq: 784,
      endFreq: 523,
      start: 0.02,
      dur: 0.11,
      type: "triangle",
      gain: 0.12,
    },
  ],
  ui: [{ freq: 480, start: 0, dur: 0.05, type: "square", gain: 0.06 }],
};

type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;
let muted = readMuted();
let gestureBound = false;

function readMuted(): boolean {
  try {
    return getBrowserStorage()?.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function audioCtor(): AudioCtor | null {
  const w = window as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function unlock(): void {
  const Ctor = audioCtor();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

/** Creates/resumes the AudioContext on the first real user gesture (autoplay policy). */
export function bindAudioUnlock(): () => void {
  if (gestureBound) return () => undefined;
  gestureBound = true;
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const handler = (): void => unlock();
  for (const name of events)
    window.addEventListener(name, handler, { passive: true });
  return () => {
    for (const name of events) window.removeEventListener(name, handler);
    gestureBound = false;
  };
}

export function isMuted(): boolean {
  return muted;
}

export function syncMuteState(): void {
  uiStore.set({ muted });
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    getBrowserStorage()?.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage may be unavailable; the toggle still works for this session.
  }
  uiStore.set({ muted });
}

export function toggleMuted(): void {
  setMuted(!muted);
}

/** Plays a short generated effect. Silent until a gesture unlocked the context, or when muted. */
export function playSfx(name: SfxName): void {
  if (muted || !context || context.state !== "running") return;
  const ctx = context;
  const now = ctx.currentTime;
  for (const tone of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    const t0 = now + tone.start;
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.endFreq)
      osc.frequency.exponentialRampToValueAtTime(tone.endFreq, t0 + tone.dur);
    gain.gain.setValueAtTime(tone.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tone.dur + 0.02);
  }
}
