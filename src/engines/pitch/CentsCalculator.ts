export type TuningStatus = 'flat' | 'in-tune' | 'sharp';

export const DEFAULT_IN_TUNE_TOLERANCE_CENTS = 5;
export const MAX_DISPLAY_CENTS = 50;

/**
 * Calculates pitch deviation in cents using the standard logarithmic ratio:
 * cents = 1200 * log2(detectedFrequency / targetFrequency)
 */
export function calculateCents(
  detectedFrequency: number,
  targetFrequency: number,
): number {
  if (
    !Number.isFinite(detectedFrequency) ||
    !Number.isFinite(targetFrequency) ||
    detectedFrequency <= 0 ||
    targetFrequency <= 0
  ) {
    throw new RangeError(
      'Frequencies must be finite positive numbers to calculate cents.',
    );
  }

  return 1200 * Math.log2(detectedFrequency / targetFrequency);
}

export function getTuningStatus(
  cents: number,
  toleranceCents: number = DEFAULT_IN_TUNE_TOLERANCE_CENTS,
): TuningStatus {
  if (Math.abs(cents) <= toleranceCents) {
    return 'in-tune';
  }
  return cents < 0 ? 'flat' : 'sharp';
}

export function clampCentsForDisplay(
  cents: number,
  maxRange: number = MAX_DISPLAY_CENTS,
): number {
  if (!Number.isFinite(cents)) {
    return 0;
  }
  return Math.max(-maxRange, Math.min(maxRange, cents));
}

