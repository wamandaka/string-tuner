import { describe, expect, it } from 'vitest';
import {
  calculateCents,
  clampCentsForDisplay,
  getTuningStatus,
} from './CentsCalculator';

describe('CentsCalculator', () => {
  it('returns 0 cents when detected frequency matches target frequency', () => {
    expect(calculateCents(440, 440)).toBe(0);
    expect(calculateCents(82.41, 82.41)).toBe(0);
  });

  it('computes +1200 cents for one octave up and -1200 cents for one octave down', () => {
    expect(calculateCents(880, 440)).toBeCloseTo(1200, 6);
    expect(calculateCents(220, 440)).toBeCloseTo(-1200, 6);
  });

  it('computes +100 cents for one equal-tempered semitone sharp', () => {
    const semitoneUp = 440 * Math.pow(2, 1 / 12);
    expect(calculateCents(semitoneUp, 440)).toBeCloseTo(100, 6);
  });

  it('throws on invalid non-positive or non-finite frequencies', () => {
    expect(() => calculateCents(0, 440)).toThrow(RangeError);
    expect(() => calculateCents(440, -10)).toThrow(RangeError);
    expect(() => calculateCents(Number.NaN, 440)).toThrow(RangeError);
  });

  it('classifies tuning status around the tolerance window', () => {
    expect(getTuningStatus(0)).toBe('in-tune');
    expect(getTuningStatus(-4.9)).toBe('in-tune');
    expect(getTuningStatus(5.0)).toBe('in-tune');
    expect(getTuningStatus(-5.1)).toBe('flat');
    expect(getTuningStatus(5.1)).toBe('sharp');
  });

  it('clamps display cents within [-50, 50]', () => {
    expect(clampCentsForDisplay(-120)).toBe(-50);
    expect(clampCentsForDisplay(78)).toBe(50);
    expect(clampCentsForDisplay(14.5)).toBe(14.5);
  });
});

