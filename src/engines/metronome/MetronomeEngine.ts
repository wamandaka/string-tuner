import type {
  ScheduledBeatEvent,
  TimeSignatureConfig,
} from '../../features/metronome/metronome.types';
import type { TimeSignatureId } from '../../types/settings';

export const MIN_BPM = 40;
export const MAX_BPM = 240;

export const TIME_SIGNATURES: Record<TimeSignatureId, TimeSignatureConfig> = {
  '2/4': { id: '2/4', beatsPerMeasure: 2, beatUnit: 4, label: '2/4' },
  '3/4': { id: '3/4', beatsPerMeasure: 3, beatUnit: 4, label: '3/4' },
  '4/4': { id: '4/4', beatsPerMeasure: 4, beatUnit: 4, label: '4/4' },
  '6/8': { id: '6/8', beatsPerMeasure: 6, beatUnit: 8, label: '6/8' },
};

export const TIME_SIGNATURE_LIST: readonly TimeSignatureConfig[] = [
  TIME_SIGNATURES['2/4'],
  TIME_SIGNATURES['3/4'],
  TIME_SIGNATURES['4/4'],
  TIME_SIGNATURES['6/8'],
];

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) {
    return 120;
  }
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function getSecondsPerBeat(bpm: number): number {
  const safeBpm = clampBpm(bpm);
  return 60 / safeBpm;
}

export function getTempoMarking(bpm: number): string {
  const safeBpm = clampBpm(bpm);
  if (safeBpm < 60) return 'Largo';
  if (safeBpm < 66) return 'Larghetto';
  if (safeBpm < 76) return 'Adagio';
  if (safeBpm < 108) return 'Andante';
  if (safeBpm < 120) return 'Moderato';
  if (safeBpm < 156) return 'Allegro';
  if (safeBpm < 200) return 'Vivace';
  return 'Presto';
}

export function computeTapTempoBpm(
  tapTimestampsMs: readonly number[],
  maxGapMs: number = 2000,
): number | null {
  if (tapTimestampsMs.length < 2) {
    return null;
  }

  // Filter contiguous sequence backward from latest tap
  const intervals: number[] = [];
  for (let i = tapTimestampsMs.length - 1; i > 0; i--) {
    const delta = tapTimestampsMs[i]! - tapTimestampsMs[i - 1]!;
    if (delta <= 0 || delta > maxGapMs) {
      break;
    }
    intervals.push(delta);
    if (intervals.length >= 6) {
      break;
    }
  }

  if (intervals.length === 0) {
    return null;
  }

  let sum = 0;
  for (let i = 0; i < intervals.length; i++) {
    sum += intervals[i]!;
  }
  const avgIntervalMs = sum / intervals.length;
  return clampBpm(60000 / avgIntervalMs);
}

type AudioContextConstructor = typeof AudioContext;

function createAudioContext(): AudioContext {
  const win = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const Ctx = window.AudioContext ?? win.webkitAudioContext;
  if (!Ctx) {
    throw new Error('Web Audio API is unavailable in this browser.');
  }
  return new Ctx({ latencyHint: 'interactive' });
}

export interface MetronomeEngineConfig {
  bpm?: number;
  timeSignature?: TimeSignatureId;
  volume?: number;
}

/**
 * Lookahead metronome scheduler strictly synchronized to AudioContext.currentTime.
 * Timers are only used to wake up the lookahead queue; actual sound onset times
 * are stamped onto Web Audio nodes ahead of playback.
 */
export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sessionGain: GainNode | null = null;
  private schedulerTimerId: number | null = null;

  private bpm: number;
  private timeSignature: TimeSignatureId;
  private volume: number;

  private isPlaying = false;
  private currentBeatIndex = 0;
  private nextBeatAudioTime = 0;

  // Lookahead tuning parameters
  private readonly lookaheadIntervalMs = 25;
  private readonly scheduleAheadTimeSec = 0.12;

  private beatQueue: ScheduledBeatEvent[] = [];

  constructor(config: MetronomeEngineConfig = {}) {
    this.bpm = clampBpm(config.bpm ?? 120);
    this.timeSignature = config.timeSignature ?? '4/4';
    this.volume = Math.min(1, Math.max(0, config.volume ?? 0.8));
  }

  setBpm(nextBpm: number): void {
    this.bpm = clampBpm(nextBpm);
  }

  setTimeSignature(nextSignature: TimeSignatureId): void {
    this.timeSignature = nextSignature;
    const totalBeats = TIME_SIGNATURES[nextSignature].beatsPerMeasure;
    if (this.currentBeatIndex >= totalBeats) {
      this.currentBeatIndex = 0;
    }
  }

  setVolume(nextVolume: number): void {
    this.volume = Math.min(1, Math.max(0, nextVolume));
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.audioContext.currentTime,
        0.015,
      );
    }
  }

  getAudioTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  async start(): Promise<void> {
    if (this.isPlaying) {
      return;
    }

    if (!this.audioContext) {
      this.audioContext = createAudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create a clean per-session GainNode so pause/reset silences queued beats immediately
    if (this.sessionGain) {
      try {
        this.sessionGain.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
    }
    this.sessionGain = this.audioContext.createGain();
    this.sessionGain.gain.value = 1;
    if (this.masterGain) {
      this.sessionGain.connect(this.masterGain);
    }

    this.beatQueue.length = 0;
    this.isPlaying = true;
    this.nextBeatAudioTime = this.audioContext.currentTime + 0.03;

    this.scheduleLoop();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.schedulerTimerId !== null) {
      window.clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
    if (this.sessionGain) {
      try {
        this.sessionGain.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
      this.sessionGain = null;
    }
    this.beatQueue.length = 0;
  }

  reset(): void {
    this.pause();
    this.currentBeatIndex = 0;
  }

  async dispose(): Promise<void> {
    this.reset();
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
      this.masterGain = null;
    }
    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      if (ctx.state !== 'closed') {
        await ctx.close().catch(() => undefined);
      }
    }
  }

  /**
   * Drains scheduled beat events whose Web Audio timestamp has been reached
   * and returns the latest due beat for UI synchronization.
   */
  consumeDueBeat(): ScheduledBeatEvent | null {
    if (!this.audioContext || this.beatQueue.length === 0) {
      return null;
    }

    const now = this.audioContext.currentTime;
    let latestDue: ScheduledBeatEvent | null = null;

    while (
      this.beatQueue.length > 0 &&
      this.beatQueue[0]!.audioTime <= now + 0.005
    ) {
      latestDue = this.beatQueue.shift()!;
    }

    return latestDue;
  }

  private scheduleLoop = (): void => {
    if (!this.isPlaying || !this.audioContext) {
      return;
    }

    const horizon = this.audioContext.currentTime + this.scheduleAheadTimeSec;
    while (this.nextBeatAudioTime < horizon) {
      this.scheduleSingleBeat(this.currentBeatIndex, this.nextBeatAudioTime);
      this.advanceBeat();
    }

    this.schedulerTimerId = window.setTimeout(
      this.scheduleLoop,
      this.lookaheadIntervalMs,
    );
  };

  private scheduleSingleBeat(beatIndex: number, audioTime: number): void {
    if (!this.audioContext || !this.sessionGain) {
      return;
    }

    const isAccent = beatIndex === 0;
    const osc = this.audioContext.createOscillator();
    const clickGain = this.audioContext.createGain();

    osc.type = isAccent ? 'triangle' : 'sine';
    const startFreq = isAccent ? 1320 : 880;
    const endFreq = isAccent ? 880 : 620;
    const duration = isAccent ? 0.042 : 0.032;
    const peakGain = isAccent ? 0.95 : 0.55;

    osc.frequency.setValueAtTime(startFreq, audioTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioTime + duration);

    clickGain.gain.setValueAtTime(0.0001, audioTime);
    clickGain.gain.linearRampToValueAtTime(peakGain, audioTime + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, audioTime + duration);

    osc.connect(clickGain);
    clickGain.connect(this.sessionGain);

    osc.start(audioTime);
    osc.stop(audioTime + duration + 0.005);

    this.beatQueue.push({
      beatIndex,
      beatNumber: beatIndex + 1,
      isAccent,
      audioTime,
    });
  }

  private advanceBeat(): void {
    const beatsPerMeasure = TIME_SIGNATURES[this.timeSignature].beatsPerMeasure;
    this.nextBeatAudioTime += getSecondsPerBeat(this.bpm);
    this.currentBeatIndex = (this.currentBeatIndex + 1) % beatsPerMeasure;
  }
}

