import { describe, expect, it } from 'vitest';
import { PitchDetector } from './PitchDetector';

function createWave(
  frequency: number,
  sampleRate: number,
  length: number,
  amplitude = 0.5,
  dcOffset = 0.15,
): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] =
      dcOffset + amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return out;
}

describe('PitchDetector', () => {
  it('removes DC offset and matches automatic guitar strings', () => {
    const detector = new PitchDetector({ smoothing: false });
    const samples = createWave(110.0, 48000, 4096, 0.4, 0.25);

    const result = detector.detect(samples, {
      sampleRate: 48000,
      mode: 'guitar',
    });

    expect(result).not.toBeNull();
    expect(result!.noteLabel).toBe('A2');
    expect(result!.matchedString?.stringNumber).toBe(5);
    expect(Math.abs(result!.cents)).toBeLessThan(2);
    expect(result!.status).toBe('in-tune');
  });

  it('measures cents deviation against manually selected target string', () => {
    const detector = new PitchDetector({ smoothing: false });
    // Slightly flat E2 (~80 Hz vs 82.41 Hz)
    const samples = createWave(80.0, 48000, 4096, 0.5, 0);

    const result = detector.detect(samples, {
      sampleRate: 48000,
      mode: 'guitar',
      manualStringNumber: 6,
    });

    expect(result).not.toBeNull();
    expect(result!.matchedString?.stringNumber).toBe(6);
    expect(result!.noteLabel).toBe('E2');
    expect(result!.cents).toBeLessThan(-40);
    expect(result!.status).toBe('flat');
  });

  it('detects arbitrary chromatic notes when in chromatic mode', () => {
    const detector = new PitchDetector({ smoothing: false });
    // F#4 (~369.99 Hz), slightly sharp (~373 Hz)
    const samples = createWave(373, 48000, 4096, 0.5, 0);

    const result = detector.detect(samples, {
      sampleRate: 48000,
      mode: 'chromatic',
    });

    expect(result).not.toBeNull();
    expect(result!.noteLabel).toBe('F#4');
    expect(result!.matchedString).toBeNull();
    expect(result!.cents).toBeGreaterThan(10);
    expect(result!.status).toBe('sharp');
  });

  it('rejects low-amplitude background hum below noise gate', () => {
    const detector = new PitchDetector({ minRms: 0.01 });
    const quietHum = createWave(82.41, 48000, 4096, 0.002, 0);

    const result = detector.detect(quietHum, {
      sampleRate: 48000,
      mode: 'guitar',
    });

    expect(result).toBeNull();
  });
});

