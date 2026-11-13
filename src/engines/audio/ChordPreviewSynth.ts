import {
  safeReadStorage,
  safeWriteStorage,
} from '../../stores/preferencesStorage';

export const STANDARD_OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;

export const SOUNDFONT_NOTE_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

export type GuitarToneType = 'steel' | 'nylon' | 'synth';
export type StrumDirection = 'down' | 'up';
export type PlayPatternStyle =
  | 'strum-down'
  | 'strum-up'
  | 'arpeggio-down'
  | 'arpeggio-up'
  | 'arpeggio-down-up'
  | 'fingerpick';

export interface ChordNoteInfo {
  stringIndex: number;
  fret: number;
  midi: number;
  noteName: string;
  frequency: number;
}

export interface PlayPatternStep {
  note: ChordNoteInfo;
  delaySeconds: number;
  gain: number;
}

export interface PlayChordOptions {
  tone?: GuitarToneType;
  arpeggio?: boolean;
  direction?: StrumDirection;
  pattern?: PlayPatternStyle;
  strumIntervalMs?: number;
}

export interface PlayStringOptions {
  tone?: GuitarToneType;
  polyphonic?: boolean;
}

const GUITAR_TONE_STORAGE_KEY = 'string-tune:guitar-tone';
const VALID_TONES = new Set<GuitarToneType>(['steel', 'nylon', 'synth']);

const SOUNDFONT_BASE_URLS: Record<
  Exclude<GuitarToneType, 'synth'>,
  { primary: string; fallback: string }
> = {
  steel: {
    primary:
      'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/MusyngKite/acoustic_guitar_steel-mp3',
    fallback:
      'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_steel-mp3',
  },
  nylon: {
    primary:
      'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/MusyngKite/acoustic_guitar_nylon-mp3',
    fallback:
      'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3',
  },
};

const sampleBufferCache = new Map<string, AudioBuffer>();
const inflightSampleFetches = new Map<string, Promise<AudioBuffer | null>>();

let sharedPreviewContext: AudioContext | null = null;
let activeMasterGain: GainNode | null = null;
let activeSources: AudioBufferSourceNode[] = [];
let activePlaybackId = 0;
const activeStringVoices = new Map<
  number,
  { gain: GainNode; source: AudioBufferSourceNode }
>();
const stringPlaybackIds = new Map<number, number>();
let globalStopCounter = 0;

function getPreviewContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const win = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx = window.AudioContext ?? win.webkitAudioContext;
  if (!Ctx) {
    return null;
  }
  if (!sharedPreviewContext || sharedPreviewContext.state === 'closed') {
    sharedPreviewContext = new Ctx();
  }
  return sharedPreviewContext;
}

/**
 * Converts a MIDI note number to the flat-based note naming format used by
 * midi-js-soundfonts (e.g. 40 -> "E2", 56 -> "Ab3", 61 -> "Db4").
 */
export function midiToSoundfontNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${SOUNDFONT_NOTE_NAMES[pitchClass]!}${octave}`;
}

/**
 * Resolves all unmuted strings of a 6-string chord voicing into MIDI, note name,
 * and frequency metadata ordered from lowest string (6 / index 0) to highest (1 / index 5).
 */
export function getChordMidiNotes(
  frets: readonly [number, number, number, number, number, number],
): ChordNoteInfo[] {
  const notes: ChordNoteInfo[] = [];

  for (let stringIndex = 0; stringIndex < frets.length; stringIndex++) {
    const fret = frets[stringIndex]!;
    if (fret < 0) {
      continue;
    }

    const midi = STANDARD_OPEN_MIDI[stringIndex]! + fret;
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    notes.push({
      stringIndex,
      fret,
      midi,
      noteName: midiToSoundfontNoteName(midi),
      frequency,
    });
  }

  return notes;
}

/**
 * Generates a realistic plucked acoustic guitar string AudioBuffer using
 * fractional-delay Karplus-Strong physical modeling with bass harmonic warmth
 * so bass roots (E2, A2, D3) remain clear and distinct even on small speakers
 * or when offline.
 */
export function synthesizePluckedStringBuffer(
  ctx: BaseAudioContext,
  frequency: number,
  stringIndex: number,
  durationSeconds: number = 2.4,
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const totalSamples = Math.max(1, Math.round(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const output = buffer.getChannelData(0);

  const clampedFreq = Math.max(40, Math.min(2000, frequency));
  const exactDelay = sampleRate / clampedFreq;
  const intDelay = Math.max(2, Math.floor(exactDelay));
  const frac = exactDelay - intDelay;

  const ringBuffer = new Float32Array(intDelay + 2);

  // Deterministic pseudo-random excitation blended with warm guitar body harmonics
  // so bass strings (stringIndex 0..2) project strong 2nd/3rd harmonics.
  let seed = (Math.round(clampedFreq * 100) + (stringIndex + 1) * 7919) >>> 0;
  const bassWeight = Math.max(0, 1 - stringIndex / 4);

  for (let i = 0; i < intDelay; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const phase = (2 * Math.PI * i) / exactDelay;
    const harmonics =
      0.55 * Math.sin(phase) +
      (0.32 + 0.14 * bassWeight) * Math.sin(2 * phase) +
      (0.18 + 0.1 * bassWeight) * Math.sin(3 * phase) +
      0.08 * Math.sin(4 * phase);

    ringBuffer[i] = 0.55 * noise + 0.45 * harmonics;
  }

  // Smooth the initial burst once to emulate flesh/pick contact damping.
  for (let i = 1; i < intDelay; i++) {
    ringBuffer[i] = 0.65 * ringBuffer[i]! + 0.35 * ringBuffer[i - 1]!;
  }

  const lossFactor = 0.9965 - stringIndex * 0.00055;
  const brightness = 0.52 - stringIndex * 0.03;
  let writePos = 0;
  let prevSample = ringBuffer[intDelay - 1] ?? 0;

  const attackSamples = Math.min(totalSamples, Math.round(sampleRate * 0.004));
  const releaseStart = Math.max(
    attackSamples,
    totalSamples - Math.round(sampleRate * 0.18),
  );

  let peak = 0.0001;
  for (let n = 0; n < totalSamples; n++) {
    const readIndexA = writePos;
    const readIndexB = (writePos + 1) % intDelay;
    const delayed =
      ringBuffer[readIndexA]! * (1 - frac) + ringBuffer[readIndexB]! * frac;

    const filtered =
      lossFactor * (brightness * delayed + (1 - brightness) * prevSample);
    prevSample = delayed;
    ringBuffer[writePos] = filtered;
    writePos = (writePos + 1) % intDelay;

    let env = 1;
    if (n < attackSamples) {
      env = n / Math.max(1, attackSamples);
    } else if (n > releaseStart) {
      env = Math.max(0, (totalSamples - n) / Math.max(1, totalSamples - releaseStart));
    }

    const sample = delayed * env;
    output[n] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) {
      peak = abs;
    }
  }

  const norm = peak > 0.001 ? 0.85 / peak : 1;
  for (let n = 0; n < totalSamples; n++) {
    output[n] = output[n]! * norm;
  }

  return buffer;
}

async function fetchAndDecodeAudio(
  ctx: BaseAudioContext,
  url: string,
  timeoutMs: number,
): Promise<AudioBuffer | null> {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller !== null
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetch(url, {
      mode: 'cors',
      signal: controller?.signal,
    });
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return null;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

async function fetchNoteSampleBuffer(
  ctx: BaseAudioContext,
  noteName: string,
  tone: Exclude<GuitarToneType, 'synth'>,
  timeoutMs: number = 2200,
): Promise<AudioBuffer | null> {
  const cacheKey = `${tone}:${noteName}`;
  const cached = sampleBufferCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const existingPromise = inflightSampleFetches.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const urls = SOUNDFONT_BASE_URLS[tone];
  const fetchPromise = (async (): Promise<AudioBuffer | null> => {
    const primaryBuffer = await fetchAndDecodeAudio(
      ctx,
      `${urls.primary}/${noteName}.mp3`,
      timeoutMs,
    );
    if (primaryBuffer) {
      sampleBufferCache.set(cacheKey, primaryBuffer);
      return primaryBuffer;
    }

    const fallbackBuffer = await fetchAndDecodeAudio(
      ctx,
      `${urls.fallback}/${noteName}.mp3`,
      timeoutMs,
    );
    if (fallbackBuffer) {
      sampleBufferCache.set(cacheKey, fallbackBuffer);
      return fallbackBuffer;
    }

    return null;
  })();

  inflightSampleFetches.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inflightSampleFetches.delete(cacheKey);
  }
}

function fadeOutVoice(
  ctx: AudioContext,
  gainNode: GainNode,
  sources: AudioBufferSourceNode[],
): void {
  const now = ctx.currentTime;
  try {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.025);
  } catch {
    // Ignore gain automation errors if context is closing.
  }

  for (const source of sources) {
    try {
      source.stop(now + 0.03);
    } catch {
      // Ignore already-stopped sources.
    }
  }
}

/**
 * Stops and smoothly fades out any currently sounding chord or string preview
 * so consecutive previews never overlap or muddy each other.
 */
export function stopChordPreview(): void {
  activePlaybackId += 1;
  globalStopCounter += 1;
  const ctx = sharedPreviewContext;
  const previousGain = activeMasterGain;
  const previousSources = activeSources;
  const previousStringVoices = Array.from(activeStringVoices.values());

  activeMasterGain = null;
  activeSources = [];
  activeStringVoices.clear();

  if (ctx) {
    if (previousGain) {
      fadeOutVoice(ctx, previousGain, previousSources);
    }
    for (const voice of previousStringVoices) {
      fadeOutVoice(ctx, voice.gain, [voice.source]);
    }
  }
}

/**
 * Returns the persisted guitar playback tone ('steel', 'nylon', or 'synth').
 */
export function getGuitarTonePreference(): GuitarToneType {
  const stored = safeReadStorage(GUITAR_TONE_STORAGE_KEY);
  if (stored && VALID_TONES.has(stored as GuitarToneType)) {
    return stored as GuitarToneType;
  }
  return 'steel';
}

/**
 * Persists the user's preferred guitar playback tone.
 */
export function setGuitarTonePreference(tone: GuitarToneType): void {
  if (VALID_TONES.has(tone)) {
    safeWriteStorage(GUITAR_TONE_STORAGE_KEY, tone);
  }
}

/**
 * Clears cached soundfont audio buffers (useful for tests or memory cleanup).
 */
export function clearChordSampleCache(): void {
  sampleBufferCache.clear();
  inflightSampleFetches.clear();
}

/**
 * Stops playback and closes the shared preview AudioContext.
 */
export async function disposeChordPreviewContext(): Promise<void> {
  stopChordPreview();
  const ctx = sharedPreviewContext;
  sharedPreviewContext = null;
  if (ctx && ctx.state !== 'closed' && typeof ctx.close === 'function') {
    await ctx.close().catch(() => undefined);
  }
}

function getStringVelocityGain(
  strumIndex: number,
  totalStrings: number,
): number {
  if (strumIndex === 0) {
    return 0.96;
  }
  if (totalStrings <= 1) {
    return 0.9;
  }
  const progress = strumIndex / (totalStrings - 1);
  // Keep bass root prominent while naturally tapering highest treble strings.
  return 0.88 - progress * 0.16;
}

/**
 * Builds a timed note sequence for directional strums and picking/arpeggio patterns.
 */
export function buildPlayPatternSequence(
  notes: readonly ChordNoteInfo[],
  pattern: PlayPatternStyle,
  strumIntervalSeconds?: number,
): PlayPatternStep[] {
  if (notes.length === 0) {
    return [];
  }

  const total = notes.length;

  switch (pattern) {
    case 'strum-down': {
      const step = strumIntervalSeconds ?? 0.042;
      return notes.map((note, idx) => ({
        note,
        delaySeconds: idx * step,
        gain: getStringVelocityGain(idx, total),
      }));
    }
    case 'strum-up': {
      const step = strumIntervalSeconds ?? 0.038;
      const reversed = [...notes].reverse();
      return reversed.map((note, idx) => ({
        note,
        delaySeconds: idx * step,
        gain: total <= 1 ? 0.88 : 0.88 - (idx / (total - 1)) * 0.12,
      }));
    }
    case 'arpeggio-down': {
      const step = 0.13;
      return notes.map((note, idx) => ({
        note,
        delaySeconds: idx * step,
        gain: getStringVelocityGain(idx, total),
      }));
    }
    case 'arpeggio-up': {
      const step = 0.13;
      const reversed = [...notes].reverse();
      return reversed.map((note, idx) => ({
        note,
        delaySeconds: idx * step,
        gain: total <= 1 ? 0.88 : 0.88 - (idx / (total - 1)) * 0.12,
      }));
    }
    case 'arpeggio-down-up': {
      const step = 0.12;
      const upNotes = notes.slice(1, -1).reverse();
      const ordered = [...notes, ...upNotes];
      return ordered.map((note, idx) => ({
        note,
        delaySeconds: idx * step,
        gain: idx === 0 ? 0.96 : 0.84,
      }));
    }
    case 'fingerpick': {
      const step = 0.13;
      const bass = notes[0]!;
      const midLow = notes[Math.min(total - 1, Math.max(0, total - 3))]!;
      const midHigh = notes[Math.min(total - 1, Math.max(0, total - 2))]!;
      const treble = notes[total - 1]!;
      const patternNotes = [bass, midLow, midHigh, treble, midHigh, midLow];
      return patternNotes.map((note, idx) => ({
        note,
        delaySeconds: idx * step,
        gain: idx === 0 ? 0.96 : 0.82,
      }));
    }
  }
}

/**
 * Plays a realistic guitar chord strum or picking pattern using free public
 * guitar soundfont samples (jsDelivr / GitHub Pages midi-js-soundfonts) with
 * automatic Karplus-Strong physical modeling fallback when offline or unavailable.
 */
export async function playChordPreview(
  frets: readonly [number, number, number, number, number, number],
  options?: PlayChordOptions,
): Promise<void> {
  const ctx = getPreviewContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  stopChordPreview();
  const playbackId = activePlaybackId;

  const notes = getChordMidiNotes(frets);
  if (notes.length === 0) {
    return;
  }

  const pattern: PlayPatternStyle =
    options?.pattern ??
    (options?.arpeggio
      ? 'arpeggio-down'
      : options?.direction === 'up'
        ? 'strum-up'
        : 'strum-down');

  const strumIntervalSeconds =
    options?.strumIntervalMs !== undefined
      ? Math.max(0.01, options.strumIntervalMs / 1000)
      : undefined;

  const sequence = buildPlayPatternSequence(notes, pattern, strumIntervalSeconds);
  const tone = options?.tone ?? getGuitarTonePreference();
  let remoteBuffers: Array<AudioBuffer | null>;

  if (tone === 'synth') {
    remoteBuffers = notes.map(() => null);
  } else {
    remoteBuffers = await Promise.all(
      notes.map((note) => fetchNoteSampleBuffer(ctx, note.noteName, tone)),
    );
  }

  // Abort if another chord or stop call happened while fetching samples.
  if (playbackId !== activePlaybackId || ctx.state === 'closed') {
    return;
  }

  const bufferByStringIndex = new Map<number, AudioBuffer>();
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]!;
    const resolved =
      remoteBuffers[i] ??
      synthesizePluckedStringBuffer(ctx, note.frequency, note.stringIndex, 2.4);
    bufferByStringIndex.set(note.stringIndex, resolved);
  }

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.75, ctx.currentTime);
  master.connect(ctx.destination);
  activeMasterGain = master;

  const baseTime = ctx.currentTime + 0.02;
  const startedSources: AudioBufferSourceNode[] = [];

  for (const step of sequence) {
    const buffer = bufferByStringIndex.get(step.note.stringIndex);
    if (!buffer) {
      continue;
    }

    const startTime = baseTime + step.delaySeconds;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(step.gain, startTime);

    source.connect(noteGain);
    noteGain.connect(master);

    source.start(startTime);
    startedSources.push(source);
  }

  activeSources = startedSources;
}

/**
 * Plays a single plucked guitar string for interactive diagram inspection or
 * polyphonic string picking on the playground deck.
 */
export async function playStringPreview(
  stringIndex: number,
  fret: number,
  options?: PlayStringOptions,
): Promise<void> {
  if (fret < 0 || stringIndex < 0 || stringIndex >= STANDARD_OPEN_MIDI.length) {
    return;
  }

  const ctx = getPreviewContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const polyphonic = options?.polyphonic !== false;
  if (!polyphonic) {
    stopChordPreview();
  }

  const stopTokenAtStart = globalStopCounter;
  const nextStringPluckId = (stringPlaybackIds.get(stringIndex) ?? 0) + 1;
  stringPlaybackIds.set(stringIndex, nextStringPluckId);

  const midi = STANDARD_OPEN_MIDI[stringIndex]! + fret;
  const noteName = midiToSoundfontNoteName(midi);
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const tone = options?.tone ?? getGuitarTonePreference();

  const remoteBuffer =
    tone === 'synth'
      ? null
      : await fetchNoteSampleBuffer(ctx, noteName, tone);

  if (
    stopTokenAtStart !== globalStopCounter ||
    stringPlaybackIds.get(stringIndex) !== nextStringPluckId ||
    ctx.state === 'closed'
  ) {
    return;
  }

  const previousStringVoice = activeStringVoices.get(stringIndex);
  if (previousStringVoice) {
    fadeOutVoice(ctx, previousStringVoice.gain, [previousStringVoice.source]);
    activeStringVoices.delete(stringIndex);
  }

  const buffer =
    remoteBuffer ?? synthesizePluckedStringBuffer(ctx, frequency, stringIndex, 2.2);

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.8, ctx.currentTime);
  voiceGain.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(voiceGain);
  source.start(ctx.currentTime + 0.01);

  activeStringVoices.set(stringIndex, { gain: voiceGain, source });
}

/**
 * Background-warms public guitar soundfont note buffers for common chord voicings.
 */
export async function preloadChordSamples(
  fretsList: ReadonlyArray<readonly [number, number, number, number, number, number]>,
  tone: Exclude<GuitarToneType, 'synth'> = 'steel',
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }
  const ctx = getPreviewContext();
  if (!ctx) {
    return;
  }

  const uniqueNotes = new Set<string>();
  for (const frets of fretsList) {
    for (const note of getChordMidiNotes(frets)) {
      uniqueNotes.add(note.noteName);
    }
  }

  await Promise.allSettled(
    Array.from(uniqueNotes).map((noteName) =>
      fetchNoteSampleBuffer(ctx, noteName, tone, 3000),
    ),
  );
}
