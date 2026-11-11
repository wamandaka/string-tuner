import { describe, expect, it } from 'vitest';
import {
  STANDARD_GUITAR_STRINGS,
  findClosestString,
  mapFrequencyToNote,
  midiToFrequency,
} from './NoteMapper';

describe('NoteMapper', () => {
  it('maps A4 = 440 Hz accurately with 0 cents deviation', () => {
    const match = mapFrequencyToNote(440);
    expect(match.note).toBe('A');
    expect(match.octave).toBe(4);
    expect(match.label).toBe('A4');
    expect(match.midi).toBe(69);
    expect(match.cents).toBeCloseTo(0, 6);
  });

  it('maps all standard guitar open string frequencies accurately', () => {
    for (const stringTarget of STANDARD_GUITAR_STRINGS) {
      const match = mapFrequencyToNote(stringTarget.frequency);
      expect(match.note).toBe(stringTarget.note);
      expect(match.octave).toBe(stringTarget.octave);
      expect(match.label).toBe(stringTarget.label);
      expect(Math.abs(match.cents)).toBeLessThan(0.2);
    }
  });

  it('matches closest guitar string in cents space rather than linear Hz', () => {
    // Geometric midpoint between E2 (82.41) and A2 (110) is ~95.21 Hz (not linear 96.2)
    expect(findClosestString(93).target.label).toBe('E2');
    expect(findClosestString(98).target.label).toBe('A2');
    expect(findClosestString(146.83).target.label).toBe('D3');
    expect(findClosestString(196.0).target.label).toBe('G3');
    expect(findClosestString(246.94).target.label).toBe('B3');
    expect(findClosestString(329.63).target.label).toBe('E4');
  });

  it('calculates expected MIDI frequencies', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(40)).toBeCloseTo(82.4069, 3);
  });
});

