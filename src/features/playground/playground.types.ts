import type { PlayPatternStyle } from '../../engines/audio/ChordPreviewSynth';

export interface ChordProgressionPreset {
  id: string;
  name: string;
  genre: string;
  description: string;
  chordIds: readonly string[];
  recommendedPattern: PlayPatternStyle;
  recommendedBpm: number;
}

export interface PlayPatternOption {
  id: PlayPatternStyle;
  label: string;
  mode: 'strum' | 'petik';
  description: string;
}

export const PLAY_PATTERN_OPTIONS: readonly PlayPatternOption[] = [
  {
    id: 'strum-down',
    label: 'Strum Down ↓',
    mode: 'strum',
    description: 'Genjreng dari senar bass (6) ke treble (1)',
  },
  {
    id: 'strum-up',
    label: 'Strum Up ↑',
    mode: 'strum',
    description: 'Genjreng dari senar treble (1) ke bass (6)',
  },
  {
    id: 'arpeggio-down',
    label: 'Arpeggio ↓',
    mode: 'petik',
    description: 'Petik berurutan dari senar bass ke senar atas',
  },
  {
    id: 'arpeggio-up',
    label: 'Arpeggio ↑',
    mode: 'petik',
    description: 'Petik berurutan dari senar 1 ke senar bass',
  },
  {
    id: 'arpeggio-down-up',
    label: 'Arpeggio ↓↑',
    mode: 'petik',
    description: 'Petik naik-turun penuh pada semua senar aktif',
  },
  {
    id: 'fingerpick',
    label: 'Fingerpick P-I-M-A',
    mode: 'petik',
    description: 'Pola petikan akustik klasik bass + senar atas',
  },
  {
    id: 'custom-string',
    label: 'Petik Custom Senar',
    mode: 'petik',
    description: 'Mainkan urutan & senar custom yang Anda pilih',
  },
] as const;

export const PROGRESSION_PRESETS: readonly ChordProgressionPreset[] = [
  {
    id: 'pop-c',
    name: 'Pop Anthem (C–G–Am–F)',
    genre: 'Pop',
    description: 'Progresi I–V–vi–IV paling populer untuk lagu pop modern.',
    chordIds: ['c-major', 'g-major', 'a-minor', 'f-major'],
    recommendedPattern: 'strum-down',
    recommendedBpm: 100,
  },
  {
    id: 'pop-g',
    name: 'Acoustic Hit (G–D–Em–C)',
    genre: 'Acoustic',
    description: 'Suara open chord gitar akustik yang hangat dan cerah.',
    chordIds: ['g-major', 'd-major', 'e-minor', 'c-major'],
    recommendedPattern: 'strum-down',
    recommendedBpm: 105,
  },
  {
    id: 'emotional-am',
    name: 'Emotional Ballad (Am–F–C–G)',
    genre: 'Ballad',
    description: 'Progresi minor melankolis, cocok untuk fingerpicking.',
    chordIds: ['a-minor', 'f-major', 'c-major', 'g-major'],
    recommendedPattern: 'fingerpick',
    recommendedBpm: 88,
  },
  {
    id: 'folk-d',
    name: 'Warm Campfire (D–A–Bm–G)',
    genre: 'Folk',
    description: 'Progresi folk dengan nuansa arpeggio naik-turun.',
    chordIds: ['d-major', 'a-major', 'b-minor', 'g-major'],
    recommendedPattern: 'arpeggio-down-up',
    recommendedBpm: 92,
  },
  {
    id: 'andalusian-am',
    name: 'Spanish Flamenco (Am–G–F–E7)',
    genre: 'Flamenco',
    description: 'Kadensa Andalusia klasik dengan akor dominan E7.',
    chordIds: ['a-minor', 'g-major', 'f-major', 'e-7'],
    recommendedPattern: 'strum-down',
    recommendedBpm: 112,
  },
  {
    id: 'jazz-c',
    name: 'Smooth Jazz Turnaround (Dm7–G7–Cmaj7–A7)',
    genre: 'Jazz',
    description: 'Progresi ii–V–I–VI7 dengan warna akor 7th yang kaya.',
    chordIds: ['d-m7', 'g-7', 'c-maj7', 'a-7'],
    recommendedPattern: 'fingerpick',
    recommendedBpm: 90,
  },
  {
    id: 'blues-e',
    name: 'Acoustic Blues (E7–A7–E7–B7)',
    genre: 'Blues',
    description: 'Progresi blues 7th yang kuat di kunci E.',
    chordIds: ['e-7', 'a-7', 'e-7', 'b-7'],
    recommendedPattern: 'strum-down',
    recommendedBpm: 108,
  },
  {
    id: 'dreamy-sus',
    name: 'Ambient Suspended (Asus2–Esus4–Dsus2–A)',
    genre: 'Ambient',
    description: 'Eksplorasi chord suspended yang terbuka dan atmosferik.',
    chordIds: ['a-sus2', 'e-sus4', 'd-sus2', 'a-major'],
    recommendedPattern: 'arpeggio-down',
    recommendedBpm: 84,
  },
] as const;

export type RemappableActionId =
  | 'string-6'
  | 'string-5'
  | 'string-4'
  | 'string-3'
  | 'string-2'
  | 'string-1'
  | 'strum-down'
  | 'strum-up'
  | 'arpeggio'
  | 'fingerpick'
  | 'strum-custom-string'
  | 'pick-custom-string'
  | 'mute'
  | 'chord-1'
  | 'chord-2'
  | 'chord-3'
  | 'chord-4'
  | 'chord-5'
  | 'chord-6'
  | 'chord-7'
  | 'chord-8';

export interface CustomFretKeyBinding {
  id: string;
  key: string;
  stringIndex: number;
  fret: number;
}

export interface CustomChordKeyBinding {
  id: string;
  key: string;
  label: string;
  chordId?: string;
  frets: [number, number, number, number, number, number];
  playMode: PlayPatternStyle;
  customStringOrder?: number[];
}

export interface PlaygroundKeyMap {
  bindings: Record<RemappableActionId, string>;
  autoStrumOnChordKey: boolean;
  enableFretMelodyKeys: boolean;
  playByCustomKeyOnly: boolean;
  customFretBindings: CustomFretKeyBinding[];
  customChordBindings: CustomChordKeyBinding[];
}

export type StringMask = [
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
];

export const DEFAULT_CUSTOM_STRING_MASK: StringMask = [
  true,
  true,
  true,
  true,
  true,
  true,
];

export const DEFAULT_CUSTOM_STRING_ORDER: readonly number[] = [
  1, 3, 4, 5, 4, 3,
];

export const CUSTOM_STRING_MASK_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  mask: StringMask;
}> = [
  { id: 'all', label: 'Semua (6–1)', mask: [true, true, true, true, true, true] },
  {
    id: 'middle-4',
    label: '4 Tengah (5–2)',
    mask: [false, true, true, true, true, false],
  },
  {
    id: 'bass-treble',
    label: 'Bass + Atas (5,3,2,1)',
    mask: [false, true, false, true, true, true],
  },
  {
    id: 'treble-3',
    label: '3 Atas (3,2,1)',
    mask: [false, false, false, true, true, true],
  },
  {
    id: 'bass-3',
    label: '3 Bass (6,5,4)',
    mask: [true, true, true, false, false, false],
  },
];

export const CUSTOM_STRING_ORDER_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  order: readonly number[];
}> = [
  { id: '5-3-2-1-2-3', label: '5→3→2→1→2→3', order: [1, 3, 4, 5, 4, 3] },
  {
    id: '6-4-3-2-1-2-3-4',
    label: '6→4→3→2→1→2→3→4',
    order: [0, 2, 3, 4, 5, 4, 3, 2],
  },
  { id: '5-4-3-2', label: '5→4→3→2', order: [1, 2, 3, 4] },
  { id: '6-3-2-1', label: '6→3→2→1', order: [0, 3, 4, 5] },
];

export const SAMPLE_VARIATION_CUSTOM_KEYS: readonly CustomChordKeyBinding[] = [
  {
    id: 'sample-c-open',
    key: 'u',
    label: 'C Asli',
    chordId: 'c-major',
    frets: [-1, 3, 2, 0, 1, 0],
    playMode: 'strum-down',
  },
  {
    id: 'sample-c-no-s2',
    key: 'i',
    label: 'C Lepas S2 (Cmaj7)',
    chordId: 'c-major',
    frets: [-1, 3, 2, 0, 0, 0],
    playMode: 'strum-down',
  },
  {
    id: 'sample-c-no-s4',
    key: 'o',
    label: 'C Lepas S4 (Petik 5-3-2-1)',
    chordId: 'c-major',
    frets: [-1, 3, 0, 0, 1, 0],
    playMode: 'custom-string',
    customStringOrder: [1, 3, 4, 5, 4, 3],
  },
];

export const STRING_1_MELODY_KEYS = [
  'q',
  'w',
  'e',
  'r',
  't',
  'y',
  'u',
  'i',
  'o',
  'p',
] as const;

export const STRING_2_MELODY_KEYS = [
  'a',
  's',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  ';',
] as const;

export const DEFAULT_PLAYGROUND_KEYMAP: PlaygroundKeyMap = {
  bindings: {
    'string-6': 'z',
    'string-5': 'x',
    'string-4': 'c',
    'string-3': 'v',
    'string-2': 'b',
    'string-1': 'n',
    'strum-down': 'Space',
    'strum-up': 'ArrowUp',
    arpeggio: '[',
    fingerpick: ']',
    'strum-custom-string': ',',
    'pick-custom-string': '.',
    mute: 'm',
    'chord-1': '1',
    'chord-2': '2',
    'chord-3': '3',
    'chord-4': '4',
    'chord-5': '5',
    'chord-6': '6',
    'chord-7': '7',
    'chord-8': '8',
  },
  autoStrumOnChordKey: true,
  enableFretMelodyKeys: true,
  playByCustomKeyOnly: false,
  customFretBindings: [],
  customChordBindings: [],
};

export const REMAPPABLE_ACTION_META: ReadonlyArray<{
  id: RemappableActionId;
  label: string;
  group: 'strings' | 'patterns' | 'chords';
}> = [
  { id: 'string-6', label: 'Petik Senar 6 (E)', group: 'strings' },
  { id: 'string-5', label: 'Petik Senar 5 (A)', group: 'strings' },
  { id: 'string-4', label: 'Petik Senar 4 (D)', group: 'strings' },
  { id: 'string-3', label: 'Petik Senar 3 (G)', group: 'strings' },
  { id: 'string-2', label: 'Petik Senar 2 (B)', group: 'strings' },
  { id: 'string-1', label: 'Petik Senar 1 (e)', group: 'strings' },
  { id: 'strum-down', label: 'Strum Down ↓', group: 'patterns' },
  { id: 'strum-up', label: 'Strum Up ↑', group: 'patterns' },
  { id: 'arpeggio', label: 'Petik Arpeggio', group: 'patterns' },
  { id: 'fingerpick', label: 'Petik Fingerpick', group: 'patterns' },
  { id: 'strum-custom-string', label: 'Strum Custom Senar', group: 'patterns' },
  { id: 'pick-custom-string', label: 'Petik Urutan Senar', group: 'patterns' },
  { id: 'mute', label: 'Mute Senar', group: 'patterns' },
  { id: 'chord-1', label: 'Chord Slot 1', group: 'chords' },
  { id: 'chord-2', label: 'Chord Slot 2', group: 'chords' },
  { id: 'chord-3', label: 'Chord Slot 3', group: 'chords' },
  { id: 'chord-4', label: 'Chord Slot 4', group: 'chords' },
  { id: 'chord-5', label: 'Chord Slot 5', group: 'chords' },
  { id: 'chord-6', label: 'Chord Slot 6', group: 'chords' },
  { id: 'chord-7', label: 'Chord Slot 7', group: 'chords' },
  { id: 'chord-8', label: 'Chord Slot 8', group: 'chords' },
] as const;

