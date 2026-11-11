import { describe, expect, it } from 'vitest';
import {
  computeRms,
  hasValidSignal,
  prepareTimeDomainBuffer,
} from './AudioBufferProcessor';

describe('AudioBufferProcessor', () => {
  it('removes DC offset and computes accurate RMS and peak', () => {
    const input = new Float32Array([0.5, 1.5, 0.5, -0.5]);
    const output = new Float32Array(4);

    const metrics = prepareTimeDomainBuffer(input, output);
    // Mean is 0.5 -> centered values are [0, 1, 0, -1]
    expect(output[0]).toBeCloseTo(0, 6);
    expect(output[1]).toBeCloseTo(1, 6);
    expect(output[2]).toBeCloseTo(0, 6);
    expect(output[3]).toBeCloseTo(-1, 6);
    expect(metrics.peak).toBeCloseTo(1, 6);
    expect(metrics.rms).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('computes RMS and enforces noise gate thresholds', () => {
    const quiet = new Float32Array([0.001, -0.001, 0.001, -0.001]);
    const rms = computeRms(quiet);
    expect(rms).toBeCloseTo(0.001, 6);
    expect(hasValidSignal(rms, 0.008)).toBe(false);
    expect(hasValidSignal(0.02, 0.008)).toBe(true);
  });
});

