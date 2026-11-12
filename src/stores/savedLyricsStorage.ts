import type { LyricsTrack } from '../engines/lyrics/lyrics.types';
import {
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from './preferencesStorage';

const SAVED_LYRICS_KEY = 'stringtune:saved-lyrics:v1';

function isValidSavedTrack(value: unknown): value is LyricsTrack {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'number' &&
    Number.isFinite(item.id) &&
    typeof item.trackName === 'string' &&
    typeof item.artistName === 'string' &&
    typeof item.albumName === 'string' &&
    typeof item.durationSeconds === 'number' &&
    typeof item.instrumental === 'boolean' &&
    (item.plainLyrics === null || typeof item.plainLyrics === 'string') &&
    (item.syncedLyrics === null || typeof item.syncedLyrics === 'string')
  );
}

export function loadSavedLyrics(): LyricsTrack[] {
  const raw = safeReadStorage(SAVED_LYRICS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidSavedTrack);
  } catch {
    return [];
  }
}

export function persistSavedLyrics(tracks: readonly LyricsTrack[]): void {
  safeWriteStorage(SAVED_LYRICS_KEY, JSON.stringify(tracks));
}

export function clearSavedLyrics(): void {
  safeRemoveStorage(SAVED_LYRICS_KEY);
}

