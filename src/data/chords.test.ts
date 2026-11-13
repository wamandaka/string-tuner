import { describe, expect, it } from 'vitest';
import { CHORDS } from './chords';
import type { ChordCategory } from '../features/chords/chords.types';
import { getChordMidiNotes } from '../engines/audio/ChordPreviewSynth';

const PITCH_CLASS_MAP: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const REQUIRED_CATEGORIES: readonly ChordCategory[] = [
  'major',
  'minor',
  'dominant7',
  'major7',
  'minor7',
  'sus2',
  'sus4',
  'diminished',
];

describe('chords.json dataset validation', () => {
  const chords = CHORDS;

  it('contains unique chord IDs and symbols', () => {
    const ids = new Set<string>();
    const symbols = new Set<string>();
    for (const chord of chords) {
      expect(ids.has(chord.id)).toBe(false);
      expect(symbols.has(chord.symbol)).toBe(false);
      ids.add(chord.id);
      symbols.add(chord.symbol);
    }
  });

  it('includes chords for every required category plus open and barre shapes', () => {
    for (const category of REQUIRED_CATEGORIES) {
      const count = chords.filter((c) => c.category === category).length;
      expect(count).toBeGreaterThanOrEqual(4);
    }

    expect(chords.some((c) => !c.isBarre)).toBe(true);
    expect(chords.some((c) => c.isBarre && c.barre !== undefined)).toBe(true);
  });

  it('validates 6-string fret, finger, and barre invariants on every chord', () => {
    for (const chord of chords) {
      expect(chord.frets).toHaveLength(6);
      expect(chord.fingers).toHaveLength(6);
      expect(chord.baseFret).toBeGreaterThanOrEqual(1);
      expect(chord.notes.length).toBeGreaterThanOrEqual(3);

      let playableCount = 0;
      for (let i = 0; i < 6; i++) {
        const fret = chord.frets[i]!;
        const finger = chord.fingers[i]!;

        expect(Number.isInteger(fret)).toBe(true);
        expect(fret).toBeGreaterThanOrEqual(-1);
        expect(fret).toBeLessThanOrEqual(15);

        expect(Number.isInteger(finger)).toBe(true);
        expect(finger).toBeGreaterThanOrEqual(0);
        expect(finger).toBeLessThanOrEqual(4);

        if (fret <= 0) {
          expect(finger).toBe(0);
        } else {
          playableCount += 1;
          expect(finger).toBeGreaterThanOrEqual(1);
          expect(fret).toBeGreaterThanOrEqual(chord.baseFret);
          expect(fret).toBeLessThan(chord.baseFret + 5);
        }
        if (fret === 0) {
          playableCount += 1;
        }
      }

      expect(playableCount).toBeGreaterThanOrEqual(3);

      if (chord.barre) {
        const { fret, fromStringIndex, toStringIndex, finger } = chord.barre;
        expect(fromStringIndex).toBeGreaterThanOrEqual(0);
        expect(toStringIndex).toBeLessThanOrEqual(5);
        expect(fromStringIndex).toBeLessThan(toStringIndex);
        expect(fret).toBeGreaterThanOrEqual(chord.baseFret);
        expect(chord.frets[fromStringIndex]).toBe(fret);
        expect(chord.fingers[fromStringIndex]).toBe(finger);
        expect(chord.frets[toStringIndex]).toBe(fret);
        expect(chord.fingers[toStringIndex]).toBe(finger);
      }
    }
  });

  it('derives accurate pitch classes for every chord and distinguishes E Major from A Major', () => {
    for (const chord of chords) {
      const midiNotes = getChordMidiNotes(chord.frets);
      const soundedPitchClasses = new Set(
        midiNotes.map((n) => ((n.midi % 12) + 12) % 12),
      );
      const declaredPitchClasses = new Set(
        chord.notes.map((name) => PITCH_CLASS_MAP[name]),
      );

      for (const pc of soundedPitchClasses) {
        expect(declaredPitchClasses.has(pc)).toBe(true);
      }
      expect(soundedPitchClasses.has(PITCH_CLASS_MAP[chord.root]!)).toBe(true);
      expect(soundedPitchClasses.size).toBeGreaterThanOrEqual(3);
    }

    const eMajor = chords.find((c) => c.id === 'e-major')!;
    const aMajor = chords.find((c) => c.id === 'a-major')!;

    const eNotes = getChordMidiNotes(eMajor.frets);
    const aNotes = getChordMidiNotes(aMajor.frets);

    expect(eNotes.map((n) => n.noteName)).toEqual([
      'E2',
      'B2',
      'E3',
      'Ab3',
      'B3',
      'E4',
    ]);
    expect(aNotes.map((n) => n.noteName)).toEqual([
      'A2',
      'E3',
      'A3',
      'Db4',
      'E4',
    ]);
    expect(eNotes[0]!.midi).not.toBe(aNotes[0]!.midi);
  });
});
