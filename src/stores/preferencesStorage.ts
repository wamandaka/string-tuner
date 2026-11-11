import {
  DEFAULT_PREFERENCES,
  type ThemePreference,
  type TimeSignatureId,
  type TuningPresetId,
  type UserPreferences,
} from '../types/settings';

const PREFERENCES_KEY = 'stringtune:preferences:v1';
export const THEME_STORAGE_KEY = 'stringtune:theme';

const VALID_THEMES = new Set<ThemePreference>(['dark', 'light', 'system']);
const VALID_TUNINGS = new Set<TuningPresetId>([
  'standard',
  'drop-d',
  'half-step-down',
  'open-g',
  'dadgad',
]);
const VALID_TIME_SIGNATURES = new Set<TimeSignatureId>(['2/4', '3/4', '4/4', '6/8']);

const memoryFallback = new Map<string, string>();

export function safeReadStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function safeWriteStorage(key: string, value: string): void {
  memoryFallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private-mode restrictions; in-memory fallback remains active.
  }
}

export function safeRemoveStorage(key: string): void {
  memoryFallback.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage restrictions.
  }
}

export function loadPreferences(): UserPreferences {
  const raw = safeReadStorage(PREFERENCES_KEY);
  const rawTheme = safeReadStorage(THEME_STORAGE_KEY);

  let parsed: Partial<UserPreferences> = {};
  if (raw) {
    try {
      const candidate = JSON.parse(raw) as unknown;
      if (candidate && typeof candidate === 'object') {
        parsed = candidate as Partial<UserPreferences>;
      }
    } catch {
      parsed = {};
    }
  }

  const themeCandidate =
    rawTheme && VALID_THEMES.has(rawTheme as ThemePreference)
      ? (rawTheme as ThemePreference)
      : parsed.theme;

  const theme =
    themeCandidate && VALID_THEMES.has(themeCandidate)
      ? themeCandidate
      : DEFAULT_PREFERENCES.theme;

  const defaultTuningId =
    parsed.defaultTuningId && VALID_TUNINGS.has(parsed.defaultTuningId)
      ? parsed.defaultTuningId
      : DEFAULT_PREFERENCES.defaultTuningId;

  const defaultChromatic =
    typeof parsed.defaultChromatic === 'boolean'
      ? parsed.defaultChromatic
      : DEFAULT_PREFERENCES.defaultChromatic;

  const metronomeBpm =
    typeof parsed.metronomeBpm === 'number' &&
    Number.isFinite(parsed.metronomeBpm)
      ? Math.min(240, Math.max(40, Math.round(parsed.metronomeBpm)))
      : DEFAULT_PREFERENCES.metronomeBpm;

  const metronomeTimeSignature =
    parsed.metronomeTimeSignature &&
    VALID_TIME_SIGNATURES.has(parsed.metronomeTimeSignature)
      ? parsed.metronomeTimeSignature
      : DEFAULT_PREFERENCES.metronomeTimeSignature;

  const metronomeVolume =
    typeof parsed.metronomeVolume === 'number' &&
    Number.isFinite(parsed.metronomeVolume)
      ? Math.min(1, Math.max(0, parsed.metronomeVolume))
      : DEFAULT_PREFERENCES.metronomeVolume;

  return {
    theme,
    defaultTuningId,
    defaultChromatic,
    metronomeBpm,
    metronomeTimeSignature,
    metronomeVolume,
  };
}

export function savePreferences(preferences: UserPreferences): void {
  safeWriteStorage(PREFERENCES_KEY, JSON.stringify(preferences));
  safeWriteStorage(THEME_STORAGE_KEY, preferences.theme);
}

export function resetStoredPreferences(): UserPreferences {
  safeRemoveStorage(PREFERENCES_KEY);
  safeWriteStorage(THEME_STORAGE_KEY, DEFAULT_PREFERENCES.theme);
  return { ...DEFAULT_PREFERENCES };
}

export function applyThemeToDocument(
  theme: ThemePreference,
  systemPrefersDark: boolean,
): 'dark' | 'light' {
  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  const metaContent = theme === 'system' ? 'light dark' : theme;
  if (schemeMeta) {
    schemeMeta.setAttribute('content', metaContent);
  }

  const resolved: 'dark' | 'light' =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  if (themeColorMeta) {
    themeColorMeta.setAttribute(
      'content',
      resolved === 'dark' ? '#090b0e' : '#f4f6f8',
    );
  }

  return resolved;
}

