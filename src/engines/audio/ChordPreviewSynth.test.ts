import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PitchDetector } from '../pitch/PitchDetector';
import {
  buildPlayPatternSequence,
  clearChordSampleCache,
  disposeChordPreviewContext,
  getChordMidiNotes,
  getGuitarTonePreference,
  midiToSoundfontNoteName,
  playChordPreview,
  playStringPreview,
  setGuitarTonePreference,
  synthesizePluckedStringBuffer,
} from './ChordPreviewSynth';

function createFakeAudioBuffer(
  length: number,
  sampleRate: number,
  fillValue = 0,
): AudioBuffer {
  const channel = new Float32Array(length);
  if (fillValue !== 0) {
    channel.fill(fillValue);
  }
  return {
    length,
    sampleRate,
    duration: length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => channel,
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe('ChordPreviewSynth', () => {
  const originalAudioContext = window.AudioContext;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearChordSampleCache();
    setGuitarTonePreference('steel');
  });

  afterEach(async () => {
    await disposeChordPreviewContext();
    window.AudioContext = originalAudioContext;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('maps MIDI note numbers to soundfont flat note names', () => {
    expect(midiToSoundfontNoteName(40)).toBe('E2');
    expect(midiToSoundfontNoteName(45)).toBe('A2');
    expect(midiToSoundfontNoteName(56)).toBe('Ab3');
    expect(midiToSoundfontNoteName(61)).toBe('Db4');
    expect(midiToSoundfontNoteName(64)).toBe('E4');
  });

  it('resolves distinct bass roots and thirds for E Major and A Major', () => {
    const eNotes = getChordMidiNotes([0, 2, 2, 1, 0, 0]);
    const aNotes = getChordMidiNotes([-1, 0, 2, 2, 2, 0]);

    expect(eNotes).toHaveLength(6);
    expect(aNotes).toHaveLength(5);

    // Bass root: E2 (40) vs A2 (45)
    expect(eNotes[0]!.midi).toBe(40);
    expect(eNotes[0]!.noteName).toBe('E2');
    expect(eNotes[0]!.frequency).toBeCloseTo(82.41, 1);

    expect(aNotes[0]!.midi).toBe(45);
    expect(aNotes[0]!.noteName).toBe('A2');
    expect(aNotes[0]!.frequency).toBeCloseTo(110.0, 1);

    // Major 3rd: G#3/Ab3 (56) vs C#4/Db4 (61)
    expect(eNotes[3]!.midi).toBe(56);
    expect(eNotes[3]!.noteName).toBe('Ab3');
    expect(aNotes[3]!.midi).toBe(61);
    expect(aNotes[3]!.noteName).toBe('Db4');
  });

  it('synthesizes decaying Karplus-Strong buffers with distinct frequencies for E2 vs A2', () => {
    const mockCtx = {
      sampleRate: 44100,
      createBuffer: (_channels: number, length: number, sampleRate: number) =>
        createFakeAudioBuffer(length, sampleRate),
    } as unknown as BaseAudioContext;

    const e2Buffer = synthesizePluckedStringBuffer(mockCtx, 82.41, 0, 1.0);
    const a2Buffer = synthesizePluckedStringBuffer(mockCtx, 110.0, 1, 1.0);

    const e2Data = e2Buffer.getChannelData(0);
    const a2Data = a2Buffer.getChannelData(0);

    let e2PeakEarly = 0;
    let e2PeakLate = 0;
    for (let i = 0; i < 4410; i++) {
      e2PeakEarly = Math.max(e2PeakEarly, Math.abs(e2Data[i]!));
    }
    for (let i = 35000; i < e2Data.length; i++) {
      e2PeakLate = Math.max(e2PeakLate, Math.abs(e2Data[i]!));
    }

    expect(e2PeakEarly).toBeGreaterThan(0.2);
    expect(e2PeakLate).toBeLessThan(e2PeakEarly);

    const detector = new PitchDetector({ smoothing: false });
    const e2Pitch = detector.detect(e2Data.subarray(4410, 4410 + 4096), {
      sampleRate: 44100,
      mode: 'chromatic',
    });
    detector.reset();
    const a2Pitch = detector.detect(a2Data.subarray(4410, 4410 + 4096), {
      sampleRate: 44100,
      mode: 'chromatic',
    });

    expect(e2Pitch).not.toBeNull();
    expect(a2Pitch).not.toBeNull();
    expect(e2Pitch!.noteLabel).toBe('E2');
    expect(a2Pitch!.noteLabel).toBe('A2');
    expect(e2Pitch!.frequency).toBeCloseTo(82.41, 0);
    expect(a2Pitch!.frequency).toBeCloseTo(110.0, 0);
  });

  it('persists and validates guitar tone preferences', () => {
    expect(getGuitarTonePreference()).toBe('steel');
    setGuitarTonePreference('nylon');
    expect(getGuitarTonePreference()).toBe('nylon');
    setGuitarTonePreference('synth');
    expect(getGuitarTonePreference()).toBe('synth');
  });

  it('uses fetched public soundfont buffers when online and falls back to Karplus-Strong when fetch fails', async () => {
    const playedSources: Array<{ buffer: AudioBuffer | null; startTime: number }> =
      [];

    class MockAudioContext {
      sampleRate = 44100;
      currentTime = 1.0;
      state: AudioContextState = 'running';
      destination = {} as AudioDestinationNode;

      resume = vi.fn(async () => {
        this.state = 'running';
      });
      createBuffer = (_ch: number, length: number, sampleRate: number) =>
        createFakeAudioBuffer(length, sampleRate);
      createGain = () => ({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
      });
      createBufferSource = () => {
        const entry = {
          buffer: null as AudioBuffer | null,
          startTime: 0,
          connect: vi.fn(),
          start: vi.fn((when = 0) => {
            entry.startTime = when;
          }),
          stop: vi.fn(),
        };
        playedSources.push(entry);
        return entry;
      };
      decodeAudioData = vi.fn(async (arr: ArrayBuffer) => {
        const view = new Uint8Array(arr);
        return createFakeAudioBuffer(4096, 44100, view[0] ?? 0.5);
      });
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    // 1. Successful public soundfont fetch: tag byte distinguishes each note
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const tag = url.includes('/E2.mp3')
        ? 0.11
        : url.includes('/A2.mp3')
          ? 0.22
          : 0.33;
      const bytes = new Uint8Array([Math.round(tag * 100)]);
      return new Response(bytes.buffer, { status: 200 });
    }) as unknown as typeof fetch;

    await playChordPreview([0, 2, 2, 1, 0, 0], { tone: 'steel' });
    expect(playedSources).toHaveLength(6);
    expect(playedSources[0]!.buffer!.getChannelData(0)[0]).toBe(11);

    playedSources.length = 0;
    await playChordPreview([-1, 0, 2, 2, 2, 0], { tone: 'steel' });
    expect(playedSources).toHaveLength(5);
    expect(playedSources[0]!.buffer!.getChannelData(0)[0]).toBe(22);

    // 2. Network failure fallback: uses Karplus-Strong synthesized buffers seamlessly
    clearChordSampleCache();
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network unavailable');
    }) as unknown as typeof fetch;

    playedSources.length = 0;
    await playStringPreview(0, 0, { tone: 'steel' });
    expect(playedSources).toHaveLength(1);
    const fallbackSamples = playedSources[0]!.buffer!.getChannelData(0);
    expect(fallbackSamples.length).toBeGreaterThan(44100);
    expect(Math.max(...Array.from(fallbackSamples.slice(0, 1000)).map(Math.abs))).toBeGreaterThan(0.1);
  });

  it('builds distinct directional strum and picking sequences via buildPlayPatternSequence', () => {
    const notes = getChordMidiNotes([0, 2, 2, 1, 0, 0]); // E2, B2, E3, Ab3, B3, E4

    const strumDown = buildPlayPatternSequence(notes, 'strum-down');
    expect(strumDown.map((s) => s.note.noteName)).toEqual([
      'E2',
      'B2',
      'E3',
      'Ab3',
      'B3',
      'E4',
    ]);
    expect(strumDown[1]!.delaySeconds).toBeLessThan(0.06);

    const strumUp = buildPlayPatternSequence(notes, 'strum-up');
    expect(strumUp.map((s) => s.note.noteName)).toEqual([
      'E4',
      'B3',
      'Ab3',
      'E3',
      'B2',
      'E2',
    ]);

    const arpDown = buildPlayPatternSequence(notes, 'arpeggio-down');
    expect(arpDown.map((s) => s.note.noteName)).toEqual([
      'E2',
      'B2',
      'E3',
      'Ab3',
      'B3',
      'E4',
    ]);
    expect(arpDown[1]!.delaySeconds).toBeGreaterThan(0.1);

    const arpUp = buildPlayPatternSequence(notes, 'arpeggio-up');
    expect(arpUp.map((s) => s.note.noteName)).toEqual([
      'E4',
      'B3',
      'Ab3',
      'E3',
      'B2',
      'E2',
    ]);

    const arpDownUp = buildPlayPatternSequence(notes, 'arpeggio-down-up');
    expect(arpDownUp.map((s) => s.note.noteName)).toEqual([
      'E2',
      'B2',
      'E3',
      'Ab3',
      'B3',
      'E4',
      'B3',
      'Ab3',
      'E3',
      'B2',
    ]);

    const fingerpick = buildPlayPatternSequence(notes, 'fingerpick');
    expect(fingerpick.map((s) => s.note.noteName)).toEqual([
      'E2',
      'Ab3',
      'B3',
      'E4',
      'B3',
      'Ab3',
    ]);
  });

  it('plays polyphonic strings simultaneously without cancelling other strings', async () => {
    const sources: Array<{ stop: ReturnType<typeof vi.fn> }> = [];

    class MockPolyAudioContext {
      sampleRate = 44100;
      currentTime = 2.0;
      state: AudioContextState = 'running';
      destination = {} as AudioDestinationNode;
      resume = vi.fn(async () => undefined);
      createBuffer = (_ch: number, length: number, sampleRate: number) =>
        createFakeAudioBuffer(length, sampleRate);
      createGain = () => ({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
      });
      createBufferSource = () => {
        const src = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        sources.push(src);
        return src;
      };
    }

    window.AudioContext =
      MockPolyAudioContext as unknown as typeof AudioContext;

    await playStringPreview(0, 0, { tone: 'synth', polyphonic: true });
    await playStringPreview(3, 1, { tone: 'synth', polyphonic: true });

    expect(sources).toHaveLength(2);
    // Plucking string 3 must NOT stop string 0
    expect(sources[0]!.stop).not.toHaveBeenCalled();

    // Re-plucking string 0 damps only the previous voice on string 0
    await playStringPreview(0, 0, { tone: 'synth', polyphonic: true });
    expect(sources).toHaveLength(3);
    expect(sources[0]!.stop).toHaveBeenCalledTimes(1);
    expect(sources[1]!.stop).not.toHaveBeenCalled();
  });

  it('builds custom-string sequences in requested string order while skipping muted strings', () => {
    // C Major with unpressed String 2 (Cmaj7): [-1, 3, 2, 0, 0, 0]
    const cMaj7Notes = getChordMidiNotes([-1, 3, 2, 0, 0, 0]);
    // Request order: S6(0 - muted), S5(1), S3(3), S2(4), S1(5), S3(3)
    const sequence = buildPlayPatternSequence(
      cMaj7Notes,
      'custom-string',
      0.1,
      [0, 1, 3, 4, 5, 3],
    );

    expect(sequence.map((s) => s.note.stringIndex)).toEqual([1, 3, 4, 5, 3]);
    expect(sequence[0]!.delaySeconds).toBeCloseTo(0);
    expect(sequence[1]!.delaySeconds).toBeCloseTo(0.1);
    expect(sequence[4]!.delaySeconds).toBeCloseTo(0.4);
  });

  it('builds custom-rhythm sequences with strum-down, strum-up, chuck, rest, and pluck-bass', () => {
    const cNotes = getChordMidiNotes([-1, 3, 2, 0, 1, 0]); // 5 notes
    const sequence = buildPlayPatternSequence(
      cNotes,
      'custom-rhythm',
      undefined,
      undefined,
      [
        { kind: 'pluck-bass' },
        { kind: 'rest' },
        { kind: 'strum-down' },
        { kind: 'chuck' },
        { kind: 'strum-up' },
      ],
      0.25,
    );

    // step 0: pluck-bass (1 note at 0.0s)
    // step 1: rest (0 notes)
    // step 2: strum-down (5 notes starting at 0.50s)
    // step 3: chuck (1 percussive hit at 0.75s with isChuck + stopsPrevious)
    // step 4: strum-up (5 notes reversed starting at 1.00s)
    expect(sequence).toHaveLength(1 + 5 + 1 + 5);
    expect(sequence[0]!.note.stringIndex).toBe(1); // A2 bass root of C
    expect(sequence[0]!.delaySeconds).toBeCloseTo(0);

    expect(sequence[1]!.delaySeconds).toBeCloseTo(0.5);
    expect(sequence[1]!.note.stringIndex).toBe(1);
    expect(sequence[5]!.note.stringIndex).toBe(5);

    const chuckStep = sequence[6]!;
    expect(chuckStep.isChuck).toBe(true);
    expect(chuckStep.stopsPrevious).toBe(true);
    expect(chuckStep.delaySeconds).toBeCloseTo(0.75);

    expect(sequence[7]!.delaySeconds).toBeCloseTo(1.0);
    expect(sequence[7]!.note.stringIndex).toBe(5);
  });
});

