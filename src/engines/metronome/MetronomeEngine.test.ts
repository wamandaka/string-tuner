import { describe, expect, it } from 'vitest';
import {
  MAX_BPM,
  MIN_BPM,
  TIME_SIGNATURES,
  clampBpm,
  computeTapTempoBpm,
  getSecondsPerBeat,
  getTempoMarking,
} from './MetronomeEngine';

describe('MetronomeEngine timing helpers', () => {
  it('clamps BPM strictly within [40, 240]', () => {
    expect(clampBpm(10)).toBe(MIN_BPM);
    expect(clampBpm(40)).toBe(40);
    expect(clampBpm(120.4)).toBe(120);
    expect(clampBpm(240)).toBe(240);
    expect(clampBpm(320)).toBe(MAX_BPM);
    expect(clampBpm(Number.NaN)).toBe(120);
  });

  it('computes exact seconds per beat across BPM range', () => {
    expect(getSecondsPerBeat(60)).toBeCloseTo(1.0, 6);
    expect(getSecondsPerBeat(120)).toBeCloseTo(0.5, 6);
    expect(getSecondsPerBeat(240)).toBeCloseTo(0.25, 6);
    expect(getSecondsPerBeat(40)).toBeCloseTo(1.5, 6);
  });

  it('exposes all required time signatures with expected beat counts', () => {
    expect(TIME_SIGNATURES['2/4'].beatsPerMeasure).toBe(2);
    expect(TIME_SIGNATURES['3/4'].beatsPerMeasure).toBe(3);
    expect(TIME_SIGNATURES['4/4'].beatsPerMeasure).toBe(4);
    expect(TIME_SIGNATURES['6/8'].beatsPerMeasure).toBe(6);
  });

  it('calculates tap tempo from recent intervals and ignores stale gaps', () => {
    expect(computeTapTempoBpm([1000])).toBeNull();
    // 500ms apart => 120 BPM
    expect(computeTapTempoBpm([1000, 1500, 2000, 2500])).toBe(120);
    // Stale 5s pause followed by 1000ms apart => 60 BPM
    expect(computeTapTempoBpm([1000, 1500, 7000, 8000, 9000])).toBe(60);
  });

  it('maps BPM values to musical tempo markings', () => {
    expect(getTempoMarking(48)).toBe('Largo');
    expect(getTempoMarking(88)).toBe('Andante');
    expect(getTempoMarking(120)).toBe('Allegro');
    expect(getTempoMarking(210)).toBe('Presto');
  });
});

