import type { TimeSignatureId } from '../../types/settings';

export type MetronomeStatus = 'stopped' | 'playing' | 'paused';

export interface TimeSignatureConfig {
  id: TimeSignatureId;
  beatsPerMeasure: number;
  beatUnit: 4 | 8;
  label: string;
}

export interface ScheduledBeatEvent {
  beatIndex: number; // 0-based
  beatNumber: number; // 1-based
  isAccent: boolean;
  audioTime: number;
}

