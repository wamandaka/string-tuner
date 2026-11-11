import rawChordsData from './chords.json';
import type { ChordDefinition } from '../features/chords/chords.types';

export const CHORDS: readonly ChordDefinition[] =
  rawChordsData as unknown as ChordDefinition[];

