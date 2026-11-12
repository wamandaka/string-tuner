import { describe, expect, it, vi } from 'vitest';
import {
  formatTrackDuration,
  getDisplayablePlainLyrics,
  LyricsApiError,
  normalizeLrclibTrack,
  searchLyrics,
} from './lrclibClient';

describe('lrclibClient', () => {
  it('returns empty array for blank query without calling fetch', async () => {
    const mockFetch = vi.fn<typeof fetch>();
    const results = await searchLyrics('   ', { fetchImpl: mockFetch });
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches, normalizes, and deduplicates tracks from LRCLIB search endpoint', async () => {
    const payload = [
      {
        id: 101,
        trackName: 'Wonderwall',
        artistName: 'Oasis',
        albumName: "(What's the Story) Morning Glory?",
        duration: 258.6,
        instrumental: false,
        plainLyrics: 'Today is gonna be the day',
        syncedLyrics: '[00:14.15] Today is gonna be the day',
      },
      {
        id: 101,
        trackName: 'Wonderwall',
        artistName: 'Oasis',
      },
      {
        invalid: true,
      },
    ];

    const mockFetch = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const results = await searchLyrics('Oasis Wonderwall', {
      fetchImpl: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://lrclib.net/api/search?q=Oasis%20Wonderwall',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(results).toEqual([
      {
        id: 101,
        trackName: 'Wonderwall',
        artistName: 'Oasis',
        albumName: "(What's the Story) Morning Glory?",
        durationSeconds: 259,
        instrumental: false,
        plainLyrics: 'Today is gonna be the day',
        syncedLyrics: '[00:14.15] Today is gonna be the day',
      },
    ]);
  });

  it('throws LyricsApiError when server returns non-OK HTTP status', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () =>
      new Response('Service unavailable', { status: 503 }),
    );

    await expect(
      searchLyrics('Blackbird', { fetchImpl: mockFetch }),
    ).rejects.toThrowError(LyricsApiError);
  });

  it('formats durations and falls back cleanly for plain lyrics extraction', () => {
    expect(formatTrackDuration(259)).toBe('4:19');
    expect(formatTrackDuration(0)).toBe('--:--');

    const normalized = normalizeLrclibTrack({
      id: 7,
      name: 'Classical Gas',
      artistName: 'Mason Williams',
      duration: 185,
      instrumental: true,
      plainLyrics: '',
      syncedLyrics: '[00:05.00] Instrumental melody',
    });

    expect(normalized).not.toBeNull();
    expect(getDisplayablePlainLyrics(normalized!)).toBe('Instrumental melody');
  });
});

