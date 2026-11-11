import {
  hasValidSignal,
  prepareTimeDomainBuffer,
} from '../audio/AudioBufferProcessor';
import { AutocorrelationAnalyzer } from './Autocorrelation';
import {
  DEFAULT_IN_TUNE_TOLERANCE_CENTS,
  calculateCents,
  getTuningStatus,
  type TuningStatus,
} from './CentsCalculator';
import {
  STANDARD_GUITAR_STRINGS,
  findClosestString,
  mapFrequencyToNote,
  type GuitarStringTarget,
} from './NoteMapper';

export interface PitchDetectorConfig {
  minFrequency?: number;
  maxFrequency?: number;
  minRms?: number;
  minClarity?: number;
  referenceA4?: number;
  inTuneToleranceCents?: number;
  smoothing?: boolean;
}

export interface PitchAnalysisOptions {
  sampleRate: number;
  mode: 'guitar' | 'chromatic';
  strings?: readonly GuitarStringTarget[];
  manualStringNumber?: 6 | 5 | 4 | 3 | 2 | 1 | null;
}

export interface PitchDetectionResult {
  frequency: number;
  rawFrequency: number;
  clarity: number;
  rms: number;
  note: string;
  octave: number;
  noteLabel: string;
  targetFrequency: number;
  cents: number;
  status: TuningStatus;
  matchedString: GuitarStringTarget | null;
}

export class PitchDetector {
  private readonly analyzer = new AutocorrelationAnalyzer();
  private centeredBuffer = new Float32Array(0);

  private readonly minFrequency: number;
  private readonly maxFrequency: number;
  private readonly minRms: number;
  private readonly minClarity: number;
  private readonly referenceA4: number;
  private readonly inTuneToleranceCents: number;
  private readonly smoothingEnabled: boolean;

  private recentFrequencies: number[] = [];
  private smoothedFrequency: number | null = null;
  private silenceFrames = 0;

  constructor(config: PitchDetectorConfig = {}) {
    this.minFrequency = config.minFrequency ?? 60;
    this.maxFrequency = config.maxFrequency ?? 1100;
    this.minRms = config.minRms ?? 0.008;
    this.minClarity = config.minClarity ?? 0.6;
    this.referenceA4 = config.referenceA4 ?? 440;
    this.inTuneToleranceCents =
      config.inTuneToleranceCents ?? DEFAULT_IN_TUNE_TOLERANCE_CENTS;
    this.smoothingEnabled = config.smoothing ?? true;
  }

  reset(): void {
    this.recentFrequencies.length = 0;
    this.smoothedFrequency = null;
    this.silenceFrames = 0;
  }

  detect(
    rawSamples: Float32Array,
    options: PitchAnalysisOptions,
  ): PitchDetectionResult | null {
    if (this.centeredBuffer.length < rawSamples.length) {
      this.centeredBuffer = new Float32Array(rawSamples.length);
    }

    const centered =
      this.centeredBuffer.length === rawSamples.length
        ? this.centeredBuffer
        : this.centeredBuffer.subarray(0, rawSamples.length);

    const { rms } = prepareTimeDomainBuffer(rawSamples, centered);
    if (!hasValidSignal(rms, this.minRms)) {
      this.handleWeakFrame();
      return null;
    }

    const acfResult = this.analyzer.analyze(centered, {
      sampleRate: options.sampleRate,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      clarityThreshold: this.minClarity,
    });

    if (!acfResult) {
      this.handleWeakFrame();
      return null;
    }

    this.silenceFrames = 0;
    const rawFrequency = acfResult.frequency;
    const frequency = this.smoothingEnabled
      ? this.stabilizeFrequency(rawFrequency)
      : rawFrequency;

    if (options.mode === 'guitar') {
      const strings = options.strings ?? STANDARD_GUITAR_STRINGS;
      const manualTarget =
        options.manualStringNumber != null
          ? (strings.find(
              (item) => item.stringNumber === options.manualStringNumber,
            ) ?? null)
          : null;

      if (manualTarget) {
        const cents = calculateCents(frequency, manualTarget.frequency);
        return {
          frequency,
          rawFrequency,
          clarity: acfResult.clarity,
          rms,
          note: manualTarget.note,
          octave: manualTarget.octave,
          noteLabel: manualTarget.label,
          targetFrequency: manualTarget.frequency,
          cents,
          status: getTuningStatus(cents, this.inTuneToleranceCents),
          matchedString: manualTarget,
        };
      }

      const closest = findClosestString(frequency, strings);
      return {
        frequency,
        rawFrequency,
        clarity: acfResult.clarity,
        rms,
        note: closest.target.note,
        octave: closest.target.octave,
        noteLabel: closest.target.label,
        targetFrequency: closest.target.frequency,
        cents: closest.cents,
        status: getTuningStatus(closest.cents, this.inTuneToleranceCents),
        matchedString: closest.target,
      };
    }

    const noteMatch = mapFrequencyToNote(frequency, this.referenceA4);
    return {
      frequency,
      rawFrequency,
      clarity: acfResult.clarity,
      rms,
      note: noteMatch.note,
      octave: noteMatch.octave,
      noteLabel: noteMatch.label,
      targetFrequency: noteMatch.targetFrequency,
      cents: noteMatch.cents,
      status: getTuningStatus(noteMatch.cents, this.inTuneToleranceCents),
      matchedString: null,
    };
  }

  private handleWeakFrame(): void {
    this.silenceFrames += 1;
    if (this.silenceFrames >= 6) {
      this.reset();
    }
  }

  private stabilizeFrequency(rawFrequency: number): number {
    this.recentFrequencies.push(rawFrequency);
    if (this.recentFrequencies.length > 3) {
      this.recentFrequencies.shift();
    }

    let candidate = rawFrequency;
    if (this.recentFrequencies.length === 3) {
      const sorted = [...this.recentFrequencies].sort((a, b) => a - b);
      candidate = sorted[1]!;
    }

    if (this.smoothedFrequency == null) {
      this.smoothedFrequency = candidate;
      return candidate;
    }

    // Reset EMA immediately if pitch jumps by more than 40 cents (new string/note)
    const jumpCents = Math.abs(calculateCents(candidate, this.smoothedFrequency));
    if (jumpCents > 40) {
      this.smoothedFrequency = candidate;
      return candidate;
    }

    this.smoothedFrequency = this.smoothedFrequency * 0.65 + candidate * 0.35;
    return this.smoothedFrequency;
  }
}

