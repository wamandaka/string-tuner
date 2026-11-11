export interface BufferMetrics {
  rms: number;
  peak: number;
}

/**
 * Removes DC offset into `output` (which may alias `input`) and computes RMS + peak
 * without heap allocations.
 */
export function prepareTimeDomainBuffer(
  input: Float32Array,
  output: Float32Array,
): BufferMetrics {
  const length = Math.min(input.length, output.length);
  if (length === 0) {
    return { rms: 0, peak: 0 };
  }

  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += input[i]!;
  }
  const mean = sum / length;

  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const centered = input[i]! - mean;
    output[i] = centered;
    sumSquares += centered * centered;
    const abs = centered < 0 ? -centered : centered;
    if (abs > peak) {
      peak = abs;
    }
  }

  return {
    rms: Math.sqrt(sumSquares / length),
    peak,
  };
}

export function computeRms(buffer: Float32Array): number {
  if (buffer.length === 0) {
    return 0;
  }
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i]!;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / buffer.length);
}

export function hasValidSignal(rms: number, minRms: number = 0.008): boolean {
  return Number.isFinite(rms) && rms >= minRms;
}

