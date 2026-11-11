export type ThemePreference = 'dark' | 'light' | 'system';

export type TuningPresetId =
  | 'standard'
  | 'drop-d'
  | 'half-step-down'
  | 'open-g'
  | 'dadgad';

export type TimeSignatureId = '2/4' | '3/4' | '4/4' | '6/8';

export interface UserPreferences {
  theme: ThemePreference;
  defaultTuningId: TuningPresetId;
  defaultChromatic: boolean;
  metronomeBpm: number;
  metronomeTimeSignature: TimeSignatureId;
  metronomeVolume: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  defaultTuningId: 'standard',
  defaultChromatic: false,
  metronomeBpm: 120,
  metronomeTimeSignature: '4/4',
  metronomeVolume: 0.8,
};

