import { CHORDS } from '../../data/chords';
import {
  STANDARD_OPEN_MIDI,
  type CustomRhythmStep,
  type PlayPatternStyle,
} from '../../engines/audio/ChordPreviewSynth';
import { NOTE_NAMES } from '../../engines/pitch/NoteMapper';
import {
  DEFAULT_CUSTOM_RHYTHM_STEPS,
  PLAY_PATTERN_OPTIONS,
  type StringMask,
} from './playground.types';

/**
 * Formats a single guitar string & fret position into a pitch name (e.g. "C4").
 */
export function formatFretNoteName(stringIndex: number, fret: number): string {
  const midi = STANDARD_OPEN_MIDI[stringIndex]! + fret;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

/**
 * Applies a 6-string active mask to a chord voicing, converting disabled strings to muted (-1).
 */
export function applyCustomStringMask(
  frets: readonly [number, number, number, number, number, number],
  mask: StringMask,
): [number, number, number, number, number, number] {
  return [
    mask[0] ? frets[0]! : -1,
    mask[1] ? frets[1]! : -1,
    mask[2] ? frets[2]! : -1,
    mask[3] ? frets[3]! : -1,
    mask[4] ? frets[4]! : -1,
    mask[5] ? frets[5]! : -1,
  ];
}

/**
 * Formats a 6-string fret array into compact guitar notation like "X-3-2-0-0-0".
 */
export function formatFretsCompact(
  frets: readonly [number, number, number, number, number, number],
): string {
  return frets.map((fret) => (fret < 0 ? 'X' : String(fret))).join('-');
}

/**
 * Detects whether a custom or varied 6-string voicing matches a known chord in the library
 * (either exact fret voicing or matching pitch-class set).
 */
export function detectVariationChordLabel(
  frets: readonly [number, number, number, number, number, number],
  baseSymbol: string,
): string {
  for (const chord of CHORDS) {
    if (chord.frets.every((fret, idx) => fret === frets[idx])) {
      return chord.symbol === baseSymbol
        ? chord.symbol
        : `${baseSymbol} → ${chord.symbol}`;
    }
  }

  const soundedNotes = new Set<string>();
  for (let i = 0; i < frets.length; i++) {
    const fret = frets[i]!;
    if (fret >= 0) {
      const midi = STANDARD_OPEN_MIDI[i]! + fret;
      soundedNotes.add(NOTE_NAMES[((midi % 12) + 12) % 12]!);
    }
  }

  if (soundedNotes.size >= 3) {
    for (const chord of CHORDS) {
      const chordSet = new Set(chord.notes);
      if (
        chordSet.size === soundedNotes.size &&
        Array.from(soundedNotes).every((n) => chordSet.has(n))
      ) {
        return `${baseSymbol} ≈ ${chord.symbol}`;
      }
    }
  }

  return `${baseSymbol} Custom`;
}

/**
 * Computes the rhythm step duration in milliseconds (eighth-note grid synced to BPM,
 * matching ChordPreviewSynth's minimum 80ms floor).
 */
export function getRhythmStepMsForBpm(bpm: number): number {
  const safeBpm = Math.max(40, bpm);
  return Math.max(80, Math.round((60 / safeBpm / 2) * 1000));
}

/**
 * Estimates total playback duration in milliseconds for a given chord + play pattern
 * so auto-play can wait for longer picking/rhythm sequences instead of cutting them off.
 */
export function estimatePatternDurationMs(params: {
  pattern: PlayPatternStyle;
  frets: readonly [number, number, number, number, number, number];
  bpm: number;
  customRhythmSteps?: readonly CustomRhythmStep[];
  customStringOrder?: readonly number[];
}): number {
  const { pattern, frets, bpm, customRhythmSteps, customStringOrder } = params;
  const activeCount = frets.reduce((acc, fret) => (fret >= 0 ? acc + 1 : acc), 0);

  switch (pattern) {
    case 'strum-down':
      return Math.max(1, activeCount) * 42 + 80;
    case 'strum-up':
      return Math.max(1, activeCount) * 38 + 80;
    case 'arpeggio-down':
    case 'arpeggio-up':
      return Math.max(1, activeCount) * 130 + 60;
    case 'arpeggio-down-up': {
      const upCount = Math.max(0, activeCount - 2);
      return Math.max(1, activeCount + upCount) * 120 + 60;
    }
    case 'fingerpick':
      return 6 * 130 + 60;
    case 'custom-string': {
      const playableSet = new Set<number>();
      for (let i = 0; i < frets.length; i++) {
        if (frets[i]! >= 0) {
          playableSet.add(i);
        }
      }
      const orderCount =
        customStringOrder && customStringOrder.length > 0
          ? customStringOrder.filter((idx) => playableSet.has(idx)).length
          : activeCount;
      return Math.max(1, orderCount) * 125 + 60;
    }
    case 'custom-rhythm': {
      const steps =
        customRhythmSteps && customRhythmSteps.length > 0
          ? customRhythmSteps
          : DEFAULT_CUSTOM_RHYTHM_STEPS;
      const stepMs = getRhythmStepMsForBpm(bpm);
      return steps.length * stepMs;
    }
  }
}

/**
 * Calculates how many whole beats (clamped 1..32) are required at the given BPM
 * to finish a pattern cleanly without premature chord transitions.
 */
export function calculateMinimumBeatsForPattern(
  durationMs: number,
  bpm: number,
): number {
  const safeBpm = Math.max(40, bpm);
  const beatMs = (60 / safeBpm) * 1000;
  // Allow tiny 15ms rounding tolerance so exact 8 eighth-notes map to 4 beats cleanly
  return Math.min(32, Math.max(1, Math.ceil(Math.max(1, durationMs - 15) / beatMs)));
}

/**
 * Returns a concise human-readable Indonesian label for a PlayPatternStyle.
 */
export function getPlayPatternShortLabel(pattern: PlayPatternStyle): string {
  switch (pattern) {
    case 'custom-rhythm':
      return 'Pola Custom';
    case 'custom-string':
      return 'Petik Senar';
    case 'arpeggio-down-up':
      return 'Arpeggio ↓↑';
    case 'fingerpick':
      return 'Fingerpick';
    default:
      return (
        PLAY_PATTERN_OPTIONS.find((item) => item.id === pattern)?.label ??
        pattern
      );
  }
}


