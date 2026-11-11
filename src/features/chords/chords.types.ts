export type ChordCategory =
  | 'major'
  | 'minor'
  | 'dominant7'
  | 'major7'
  | 'minor7'
  | 'sus2'
  | 'sus4'
  | 'diminished';

export interface ChordBarre {
  fret: number;
  fromStringIndex: number; // 0 (low E6) .. 5 (high E1)
  toStringIndex: number; // 0 .. 5
  finger: 1 | 2 | 3 | 4;
}

export interface ChordDefinition {
  id: string;
  name: string;
  symbol: string;
  root: string;
  category: ChordCategory;
  frets: [number, number, number, number, number, number];
  fingers: [number, number, number, number, number, number];
  baseFret: number;
  isBarre: boolean;
  barre?: ChordBarre;
  notes: readonly string[];
}

export type ChordFilterCategory = 'all' | 'favorites' | ChordCategory;

export const CHORD_CATEGORY_LABELS: Record<ChordCategory, string> = {
  major: 'Major',
  minor: 'Minor',
  dominant7: 'Dom 7th',
  major7: 'Maj 7th',
  minor7: 'Min 7th',
  sus2: 'Sus2',
  sus4: 'Sus4',
  diminished: 'Diminished',
};

export const FINGER_NAMES: Record<number, string> = {
  1: 'Index',
  2: 'Middle',
  3: 'Ring',
  4: 'Pinky',
};

