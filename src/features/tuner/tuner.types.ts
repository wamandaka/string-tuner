import type { MicrophoneErrorCode } from '../../engines/audio/MicrophoneManager';
import type { TuningStatus } from '../../engines/pitch/CentsCalculator';
import type { GuitarStringTarget } from '../../engines/pitch/NoteMapper';
import type { TuningPresetId } from '../../types/settings';

export type TunerRunState = 'idle' | 'starting' | 'active' | 'error';
export type TunerMode = 'guitar' | 'chromatic';

export interface TunerErrorInfo {
  code: MicrophoneErrorCode;
  title: string;
  message: string;
}

export interface TunerReading {
  frequency: number;
  targetFrequency: number;
  note: string;
  octave: number;
  noteLabel: string;
  cents: number;
  status: TuningStatus;
  clarity: number;
  rms: number;
  matchedString: GuitarStringTarget | null;
}

export interface UseTunerOptions {
  initialMode: TunerMode;
  initialTuningId: TuningPresetId;
}
