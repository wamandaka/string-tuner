import { CHORDS } from '../../data/chords';
import { STANDARD_OPEN_MIDI } from '../../engines/audio/ChordPreviewSynth';
import { NOTE_NAMES } from '../../engines/pitch/NoteMapper';
import type { StringMask } from './playground.types';

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

