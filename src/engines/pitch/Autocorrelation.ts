export interface AutocorrelationOptions {
  sampleRate: number;
  minFrequency?: number;
  maxFrequency?: number;
  clarityThreshold?: number;
  relativePeakThreshold?: number;
}

export interface AutocorrelationResult {
  frequency: number;
  lag: number;
  clarity: number;
}

const DEFAULT_MIN_FREQUENCY = 60;
const DEFAULT_MAX_FREQUENCY = 1100;
const DEFAULT_CLARITY_THRESHOLD = 0.6;
const DEFAULT_RELATIVE_PEAK_THRESHOLD = 0.92;

interface KeyMaximum {
  lag: number;
  value: number;
}

/**
 * Reusable analyzer implementing Normalized Square Difference Function (NSDF)
 * autocorrelation with McLeod key-maximum octave-error rejection and parabolic
 * sub-sample interpolation.
 */
export class AutocorrelationAnalyzer {
  private nsdfBuffer = new Float32Array(0);
  private prefixSquares = new Float64Array(0);
  private keyMaxima: KeyMaximum[] = [];

  analyze(
    centeredBuffer: Float32Array,
    options: AutocorrelationOptions,
  ): AutocorrelationResult | null {
    const {
      sampleRate,
      minFrequency = DEFAULT_MIN_FREQUENCY,
      maxFrequency = DEFAULT_MAX_FREQUENCY,
      clarityThreshold = DEFAULT_CLARITY_THRESHOLD,
      relativePeakThreshold = DEFAULT_RELATIVE_PEAK_THRESHOLD,
    } = options;

    const length = centeredBuffer.length;
    if (
      length < 256 ||
      !Number.isFinite(sampleRate) ||
      sampleRate <= 0 ||
      minFrequency <= 0 ||
      maxFrequency <= minFrequency
    ) {
      return null;
    }

    const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
    const maxLag = Math.min(
      Math.floor(length * 0.5),
      Math.ceil(sampleRate / minFrequency),
    );

    if (maxLag <= minLag + 2) {
      return null;
    }

    const integrationWindow = length - maxLag;
    if (integrationWindow < 64) {
      return null;
    }

    if (this.nsdfBuffer.length < maxLag + 1) {
      this.nsdfBuffer = new Float32Array(maxLag + 1);
    }
    if (this.prefixSquares.length < length + 1) {
      this.prefixSquares = new Float64Array(length + 1);
    }

    const prefix = this.prefixSquares;
    prefix[0] = 0;
    for (let i = 0; i < length; i++) {
      const v = centeredBuffer[i]!;
      prefix[i + 1] = prefix[i]! + v * v;
    }

    const windowEnergy0 = prefix[integrationWindow]! - prefix[0]!;
    if (windowEnergy0 <= 1e-10) {
      return null;
    }

    const nsdf = this.nsdfBuffer;
    // Compute lag 0 as reference, then evaluate lags [minLag - 1 .. maxLag].
    nsdf[0] = 1;
    const startLag = Math.max(1, minLag - 1);

    for (let lag = startLag; lag <= maxLag; lag++) {
      let acf = 0;
      for (let i = 0; i < integrationWindow; i++) {
        acf += centeredBuffer[i]! * centeredBuffer[i + lag]!;
      }

      const shiftedEnergy =
        prefix[integrationWindow + lag]! - prefix[lag]!;
      const denom = windowEnergy0 + shiftedEnergy;
      nsdf[lag] = denom > 1e-12 ? (2 * acf) / denom : 0;
    }

    // Collect key maxima (highest peak in each positive lobe above 0).
    this.keyMaxima.length = 0;
    let inPositiveLobe = false;
    let currentBestLag = -1;
    let currentBestVal = -Infinity;
    let overallMax = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      const value = nsdf[lag]!;
      if (value > 0) {
        if (!inPositiveLobe) {
          inPositiveLobe = true;
          currentBestLag = lag;
          currentBestVal = value;
        } else if (value > currentBestVal) {
          currentBestLag = lag;
          currentBestVal = value;
        }
      } else if (inPositiveLobe) {
        if (currentBestLag > minLag && currentBestLag < maxLag) {
          this.keyMaxima.push({ lag: currentBestLag, value: currentBestVal });
          if (currentBestVal > overallMax) {
            overallMax = currentBestVal;
          }
        }
        inPositiveLobe = false;
        currentBestLag = -1;
        currentBestVal = -Infinity;
      }
    }

    if (
      inPositiveLobe &&
      currentBestLag > minLag &&
      currentBestLag < maxLag
    ) {
      this.keyMaxima.push({ lag: currentBestLag, value: currentBestVal });
      if (currentBestVal > overallMax) {
        overallMax = currentBestVal;
      }
    }

    if (this.keyMaxima.length === 0 || overallMax < clarityThreshold) {
      return null;
    }

    // Pick the first key maximum that meets the relative peak threshold so
    // sub-harmonic lags (2 * T0) are avoided while weak-fundamental 2nd harmonic
    // false peaks (< 0.92 * overallMax) are skipped.
    const cutoff = overallMax * relativePeakThreshold;
    let chosen: KeyMaximum | null = null;
    for (let i = 0; i < this.keyMaxima.length; i++) {
      const peak = this.keyMaxima[i]!;
      if (peak.value >= cutoff) {
        chosen = peak;
        break;
      }
    }

    if (!chosen) {
      return null;
    }

    const lag = chosen.lag;
    const yLeft = nsdf[lag - 1]!;
    const yCenter = nsdf[lag]!;
    const yRight = nsdf[lag + 1]!;

    const denominator = 2 * (yLeft - 2 * yCenter + yRight);
    let delta = 0;
    if (Math.abs(denominator) > 1e-12) {
      delta = (yLeft - yRight) / denominator;
      if (delta > 0.5) delta = 0.5;
      if (delta < -0.5) delta = -0.5;
    }

    const refinedLag = lag + delta;
    const refinedClarity = Math.min(
      1,
      Math.max(0, yCenter - 0.25 * (yLeft - yRight) * delta),
    );
    const frequency = sampleRate / refinedLag;

    if (
      !Number.isFinite(frequency) ||
      frequency < minFrequency ||
      frequency > maxFrequency
    ) {
      return null;
    }

    return {
      frequency,
      lag: refinedLag,
      clarity: refinedClarity,
    };
  }
}

const sharedAnalyzer = new AutocorrelationAnalyzer();

/**
 * Pure helper for one-shot pitch extraction on centered or raw PCM buffers.
 */
export function detectPitchAutocorrelation(
  buffer: Float32Array,
  options: AutocorrelationOptions,
): AutocorrelationResult | null {
  return sharedAnalyzer.analyze(buffer, options);
}
