import {
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from './preferencesStorage';

const FAVORITES_KEY = 'stringtune:favorite-chords:v1';

export function loadFavoriteChordIds(): string[] {
  const raw = safeReadStorage(FAVORITES_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function saveFavoriteChordIds(ids: readonly string[]): void {
  safeWriteStorage(FAVORITES_KEY, JSON.stringify([...new Set(ids)]));
}

export function clearFavoriteChordIds(): void {
  safeRemoveStorage(FAVORITES_KEY);
}

