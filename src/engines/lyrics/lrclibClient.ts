import type { LyricsTrack } from './lyrics.types';

const LRCLIB_SEARCH_URL = 'https://lrclib.net/api/search';

export class LyricsApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LyricsApiError';
    this.status = status;
  }
}

interface RawLrclibTrack {
  id?: unknown;
  name?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  albumName?: unknown;
  duration?: unknown;
  instrumental?: unknown;
  plainLyrics?: unknown;
  syncedLyrics?: unknown;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLrclibTrack(raw: unknown): LyricsTrack | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as RawLrclibTrack;
  const id = typeof record.id === 'number' && Number.isFinite(record.id) ? record.id : null;
  const trackName =
    asNonEmptyString(record.trackName) ?? asNonEmptyString(record.name);
  const artistName = asNonEmptyString(record.artistName) ?? 'Unknown Artist';

  if (id === null || !trackName) {
    return null;
  }

  const durationSeconds =
    typeof record.duration === 'number' &&
    Number.isFinite(record.duration) &&
    record.duration >= 0
      ? Math.round(record.duration)
      : 0;

  return {
    id,
    trackName,
    artistName,
    albumName: asNonEmptyString(record.albumName) ?? 'Single / Unknown Album',
    durationSeconds,
    instrumental: Boolean(record.instrumental),
    plainLyrics: asNonEmptyString(record.plainLyrics),
    syncedLyrics: asNonEmptyString(record.syncedLyrics),
  };
}

export function formatTrackDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '--:--';
  }
  const rounded = Math.round(durationSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function getDisplayablePlainLyrics(track: LyricsTrack): string {
  if (track.plainLyrics) {
    return track.plainLyrics;
  }
  if (track.syncedLyrics) {
    return track.syncedLyrics
      .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return '';
}

export async function searchLyrics(
  query: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<LyricsTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const fetchFn = options?.fetchImpl ?? fetch;
  const url = `${LRCLIB_SEARCH_URL}?q=${encodeURIComponent(trimmed)}`;

  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new LyricsApiError(
      `Lyrics service returned HTTP ${response.status}`,
      response.status,
    );
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }

  const normalized: LyricsTrack[] = [];
  const seenIds = new Set<number>();

  for (const item of payload) {
    const track = normalizeLrclibTrack(item);
    if (!track || seenIds.has(track.id)) {
      continue;
    }
    seenIds.add(track.id);
    normalized.push(track);
  }

  return normalized;
}

