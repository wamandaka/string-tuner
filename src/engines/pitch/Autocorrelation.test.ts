import { describe, expect, it } from 'vitest';
import { detectPitchAutocorrelation } from './Autocorrelation';
import { calculateCents } from './CentsCalculator';
import { STANDARD_GUITAR_STRINGS } from './NoteMapper';

function generateSine(
  frequency: number,
  sampleRate: number,
  length: number,
  amplitude = 0.6,
  dcOffset = 0,
): Float32Array {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] =
      dcOffset +
      amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

function generateHarmonicTone(
  frequency: number,
  sampleRate: number,
  length: number,
  harmonics: readonly number[],
  noiseLevel = 0,
): Float32Array {
  const buffer = new Float32Array(length);
  // Deterministic pseudo-random generator for reproducible tests
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < length; i++) {
    let value = 0;
    for (let h = 0; h < harmonics.length; h++) {
      value +=
        harmonics[h]! *
        Math.sin((2 * Math.PI * frequency * (h + 1) * i) / sampleRate);
    }
    if (noiseLevel > 0) {
      value += noiseLevel * nextRand();
    }
    buffer[i] = value;
  }
  return buffer;
}

describe('Autocorrelation', () => {
  it.each([44100, 48000])(
    'detects all standard guitar frequencies within ±2 cents at %i Hz',
    (sampleRate) => {
      for (const target of STANDARD_GUITAR_STRINGS) {
        const samples = generateSine(target.frequency, sampleRate, 4096);
        const result = detectPitchAutocorrelation(samples, { sampleRate });
        expect(result).not.toBeNull();
        const errorCents = Math.abs(
          calculateCents(result!.frequency, target.frequency),
        );
        expect(errorCents).toBeLessThan(2);
        expect(result!.clarity).toBeGreaterThan(0.95);
      }
    },
  );

  it('detects chromatic pitches accurately within ±2 cents', () => {
    const sampleRate = 48000;
    const testFrequencies = [73.42, 98.0, 130.81, 220.0, 293.66, 440.0, 659.25];
    for (const freq of testFrequencies) {
      const samples = generateSine(freq, sampleRate, 4096);
      const result = detectPitchAutocorrelation(samples, { sampleRate });
      expect(result).not.toBeNull();
      expect(Math.abs(calculateCents(result!.frequency, freq))).toBeLessThan(2);
    }
  });

  it('avoids octave errors when second harmonic is stronger than fundamental', () => {
    const sampleRate = 48000;
    const fundamental = 82.41; // E2
    const samples = generateHarmonicTone(
      fundamental,
      sampleRate,
      4096,
      [0.3, 0.9, 0.45, 0.2],
      0.03,
    );
    const result = detectPitchAutocorrelation(samples, { sampleRate });
    expect(result).not.toBeNull();
    expect(
      Math.abs(calculateCents(result!.frequency, fundamental)),
    ).toBeLessThan(3);
  });

  it('rejects pure white noise', () => {
    const sampleRate = 48000;
    const buffer = new Float32Array(4096);
    let seed = 42;
    for (let i = 0; i < buffer.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      buffer[i] = ((seed / 0xffffffff) * 2 - 1) * 0.4;
    }
    const result = detectPitchAutocorrelation(buffer, { sampleRate });
    expect(result).toBeNull();
  });

  it('returns null for silence', () => {
    const buffer = new Float32Array(4096);
    expect(
      detectPitchAutocorrelation(buffer, { sampleRate: 48000 }),
    ).toBeNull();
  });
});

