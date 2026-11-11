import type { TuningPresetId } from '../../types/settings';
import { calculateCents } from './CentsCalculator';

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export interface MusicalNoteMatch {
  note: string;
  octave: number;
  label: string;
  midi: number;
  targetFrequency: number;
  cents: number;
}

export interface GuitarStringTarget {
  stringNumber: 6 | 5 | 4 | 3 | 2 | 1;
  note: string;
  octave: number;
  label: string;
  frequency: number;
}

export interface TuningPreset {
  id: TuningPresetId;
  name: string;
  description: string;
  strings: readonly GuitarStringTarget[];
}

export interface GuitarStringMatch {
  target: GuitarStringTarget;
  cents: number;
}

export const STANDARD_GUITAR_STRINGS: readonly GuitarStringTarget[] = [
  { stringNumber: 6, note: 'E', octave: 2, label: 'E2', frequency: 82.41 },
  { stringNumber: 5, note: 'A', octave: 2, label: 'A2', frequency: 110.0 },
  { stringNumber: 4, note: 'D', octave: 3, label: 'D3', frequency: 146.83 },
  { stringNumber: 3, note: 'G', octave: 3, label: 'G3', frequency: 196.0 },
  { stringNumber: 2, note: 'B', octave: 3, label: 'B3', frequency: 246.94 },
  { stringNumber: 1, note: 'E', octave: 4, label: 'E4', frequency: 329.63 },
] as const;

export const TUNING_PRESETS: readonly TuningPreset[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'E2 · A2 · D3 · G3 · B3 · E4',
    strings: STANDARD_GUITAR_STRINGS,
  },
  {
    id: 'drop-d',
    name: 'Drop D',
    description: 'D2 · A2 · D3 · G3 · B3 · E4',
    strings: [
      { stringNumber: 6, note: 'D', octave: 2, label: 'D2', frequency: 73.42 },
      { stringNumber: 5, note: 'A', octave: 2, label: 'A2', frequency: 110.0 },
      { stringNumber: 4, note: 'D', octave: 3, label: 'D3', frequency: 146.83 },
      { stringNumber: 3, note: 'G', octave: 3, label: 'G3', frequency: 196.0 },
      { stringNumber: 2, note: 'B', octave: 3, label: 'B3', frequency: 246.94 },
      { stringNumber: 1, note: 'E', octave: 4, label: 'E4', frequency: 329.63 },
    ],
  },
  {
    id: 'half-step-down',
    name: 'Half-Step Down',
    description: 'D#2 · G#2 · C#3 · F#3 · A#3 · D#4',
    strings: [
      { stringNumber: 6, note: 'D#', octave: 2, label: 'D#2', frequency: 77.78 },
      { stringNumber: 5, note: 'G#', octave: 2, label: 'G#2', frequency: 103.83 },
      { stringNumber: 4, note: 'C#', octave: 3, label: 'C#3', frequency: 138.59 },
      { stringNumber: 3, note: 'F#', octave: 3, label: 'F#3', frequency: 185.0 },
      { stringNumber: 2, note: 'A#', octave: 3, label: 'A#3', frequency: 233.08 },
      { stringNumber: 1, note: 'D#', octave: 4, label: 'D#4', frequency: 311.13 },
    ],
  },
  {
    id: 'open-g',
    name: 'Open G',
    description: 'D2 · G2 · D3 · G3 · B3 · D4',
    strings: [
      { stringNumber: 6, note: 'D', octave: 2, label: 'D2', frequency: 73.42 },
      { stringNumber: 5, note: 'G', octave: 2, label: 'G2', frequency: 98.0 },
      { stringNumber: 4, note: 'D', octave: 3, label: 'D3', frequency: 146.83 },
      { stringNumber: 3, note: 'G', octave: 3, label: 'G3', frequency: 196.0 },
      { stringNumber: 2, note: 'B', octave: 3, label: 'B3', frequency: 246.94 },
      { stringNumber: 1, note: 'D', octave: 4, label: 'D4', frequency: 293.66 },
    ],
  },
  {
    id: 'dadgad',
    name: 'DADGAD',
    description: 'D2 · A2 · D3 · G3 · A3 · D4',
    strings: [
      { stringNumber: 6, note: 'D', octave: 2, label: 'D2', frequency: 73.42 },
      { stringNumber: 5, note: 'A', octave: 2, label: 'A2', frequency: 110.0 },
      { stringNumber: 4, note: 'D', octave: 3, label: 'D3', frequency: 146.83 },
      { stringNumber: 3, note: 'G', octave: 3, label: 'G3', frequency: 196.0 },
      { stringNumber: 2, note: 'A', octave: 3, label: 'A3', frequency: 220.0 },
      { stringNumber: 1, note: 'D', octave: 4, label: 'D4', frequency: 293.66 },
    ],
  },
] as const;

export function getTuningPreset(id: TuningPresetId): TuningPreset {
  return TUNING_PRESETS.find((preset) => preset.id === id) ?? TUNING_PRESETS[0]!;
}

export function midiToFrequency(midi: number, referenceA4: number = 440): number {
  return referenceA4 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(
  frequency: number,
  referenceA4: number = 440,
): number {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError('Frequency must be a finite positive number.');
  }
  return 69 + 12 * Math.log2(frequency / referenceA4);
}

export function mapFrequencyToNote(
  frequency: number,
  referenceA4: number = 440,
): MusicalNoteMatch {
  const midiFloat = frequencyToMidi(frequency, referenceA4);
  const midi = Math.round(midiFloat);
  const targetFrequency = midiToFrequency(midi, referenceA4);
  const noteIndex = ((midi % 12) + 12) % 12;
  const note = NOTE_NAMES[noteIndex]!;
  const octave = Math.floor(midi / 12) - 1;
  const cents = calculateCents(frequency, targetFrequency);

  return {
    note,
    octave,
    label: `${note}${octave}`,
    midi,
    targetFrequency,
    cents,
  };
}

export function findClosestString(
  frequency: number,
  strings: readonly GuitarStringTarget[] = STANDARD_GUITAR_STRINGS,
): GuitarStringMatch {
  if (strings.length === 0) {
    throw new Error('At least one guitar string target is required.');
  }

  let bestTarget = strings[0]!;
  let bestCents = calculateCents(frequency, bestTarget.frequency);
  let bestAbsCents = Math.abs(bestCents);

  for (let i = 1; i < strings.length; i++) {
    const candidate = strings[i]!;
    const cents = calculateCents(frequency, candidate.frequency);
    const absCents = Math.abs(cents);
    if (absCents < bestAbsCents) {
      bestAbsCents = absCents;
      bestCents = cents;
      bestTarget = candidate;
    }
  }

  return {
    target: bestTarget,
    cents: bestCents,
  };
}

