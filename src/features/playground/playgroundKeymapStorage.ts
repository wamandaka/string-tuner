import type { PlayPatternStyle } from '../../engines/audio/ChordPreviewSynth';
import {
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from '../../stores/preferencesStorage';
import {
  DEFAULT_PLAYGROUND_KEYMAP,
  type CustomChordKeyBinding,
  type CustomFretKeyBinding,
  type PlaygroundKeyMap,
  type RemappableActionId,
} from './playground.types';

const KEYMAP_STORAGE_KEY = 'stringtune:playground-keymap:v1';

const VALID_ACTION_IDS = Object.keys(
  DEFAULT_PLAYGROUND_KEYMAP.bindings,
) as RemappableActionId[];

const VALID_PLAY_MODES = new Set<PlayPatternStyle>([
  'strum-down',
  'strum-up',
  'arpeggio-down',
  'arpeggio-up',
  'arpeggio-down-up',
  'fingerpick',
  'custom-string',
]);

/**
 * Normalizes a KeyboardEvent.key string into a consistent canonical token.
 */
export function normalizeKeyboardKey(rawKey: string): string {
  if (rawKey === ' ' || rawKey === 'Spacebar') {
    return 'Space';
  }
  if (rawKey.length === 1) {
    return rawKey.toLowerCase();
  }
  return rawKey;
}

/**
 * Formats a canonical key token for compact UI keycaps.
 */
export function formatKeyBadge(key: string): string {
  switch (key) {
    case 'Space':
      return 'Space';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'Enter':
      return '↵';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

function cloneDefaultKeyMap(): PlaygroundKeyMap {
  return {
    bindings: { ...DEFAULT_PLAYGROUND_KEYMAP.bindings },
    autoStrumOnChordKey: DEFAULT_PLAYGROUND_KEYMAP.autoStrumOnChordKey,
    enableFretMelodyKeys: DEFAULT_PLAYGROUND_KEYMAP.enableFretMelodyKeys,
    playByCustomKeyOnly: DEFAULT_PLAYGROUND_KEYMAP.playByCustomKeyOnly,
    customFretBindings: [],
    customChordBindings: [],
  };
}

/**
 * Loads the persisted keyboard mapping for the Guitar Playground.
 */
export function loadPlaygroundKeyMap(): PlaygroundKeyMap {
  const raw = safeReadStorage(KEYMAP_STORAGE_KEY);
  const fallback = cloneDefaultKeyMap();
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlaygroundKeyMap>;
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }

    const bindings = { ...fallback.bindings };
    if (parsed.bindings && typeof parsed.bindings === 'object') {
      for (const actionId of VALID_ACTION_IDS) {
        const candidate = parsed.bindings[actionId];
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          bindings[actionId] = normalizeKeyboardKey(candidate);
        }
      }
    }

    const customFretBindings: CustomFretKeyBinding[] = [];
    if (Array.isArray(parsed.customFretBindings)) {
      for (const entry of parsed.customFretBindings) {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof entry.id === 'string' &&
          typeof entry.key === 'string' &&
          entry.key.trim().length > 0 &&
          Number.isInteger(entry.stringIndex) &&
          entry.stringIndex >= 0 &&
          entry.stringIndex <= 5 &&
          Number.isInteger(entry.fret) &&
          entry.fret >= 0 &&
          entry.fret <= 12
        ) {
          customFretBindings.push({
            id: entry.id,
            key: normalizeKeyboardKey(entry.key),
            stringIndex: entry.stringIndex,
            fret: entry.fret,
          });
        }
      }
    }

    const customChordBindings: CustomChordKeyBinding[] = [];
    if (Array.isArray(parsed.customChordBindings)) {
      for (const entry of parsed.customChordBindings) {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof entry.id === 'string' &&
          typeof entry.key === 'string' &&
          entry.key.trim().length > 0 &&
          typeof entry.label === 'string' &&
          Array.isArray(entry.frets) &&
          entry.frets.length === 6 &&
          entry.frets.every(
            (f) => Number.isInteger(f) && f >= -1 && f <= 12,
          ) &&
          typeof entry.playMode === 'string' &&
          VALID_PLAY_MODES.has(entry.playMode as PlayPatternStyle)
        ) {
          const frets = [
            entry.frets[0]!,
            entry.frets[1]!,
            entry.frets[2]!,
            entry.frets[3]!,
            entry.frets[4]!,
            entry.frets[5]!,
          ] as [number, number, number, number, number, number];
          const customStringOrder = Array.isArray(entry.customStringOrder)
            ? entry.customStringOrder.filter(
                (s) => Number.isInteger(s) && s >= 0 && s <= 5,
              )
            : undefined;
          customChordBindings.push({
            id: entry.id,
            key: normalizeKeyboardKey(entry.key),
            label: entry.label,
            chordId: typeof entry.chordId === 'string' ? entry.chordId : undefined,
            frets,
            playMode: entry.playMode as PlayPatternStyle,
            customStringOrder:
              customStringOrder && customStringOrder.length > 0
                ? customStringOrder
                : undefined,
          });
        }
      }
    }

    return {
      bindings,
      autoStrumOnChordKey:
        typeof parsed.autoStrumOnChordKey === 'boolean'
          ? parsed.autoStrumOnChordKey
          : fallback.autoStrumOnChordKey,
      enableFretMelodyKeys:
        typeof parsed.enableFretMelodyKeys === 'boolean'
          ? parsed.enableFretMelodyKeys
          : fallback.enableFretMelodyKeys,
      playByCustomKeyOnly:
        typeof parsed.playByCustomKeyOnly === 'boolean'
          ? parsed.playByCustomKeyOnly
          : fallback.playByCustomKeyOnly,
      customFretBindings,
      customChordBindings,
    };
  } catch {
    return fallback;
  }
}

/**
 * Saves the user's custom Guitar Playground keyboard mapping.
 */
export function savePlaygroundKeyMap(keyMap: PlaygroundKeyMap): void {
  safeWriteStorage(KEYMAP_STORAGE_KEY, JSON.stringify(keyMap));
}

/**
 * Resets the stored keyboard mapping back to defaults.
 */
export function resetPlaygroundKeyMap(): PlaygroundKeyMap {
  safeRemoveStorage(KEYMAP_STORAGE_KEY);
  return cloneDefaultKeyMap();
}

