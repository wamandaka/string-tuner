import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LyricsApiError, searchLyrics } from '../../../engines/lyrics/lrclibClient';
import type { LyricsTrack } from '../../../engines/lyrics/lyrics.types';
import {
  loadSavedLyrics,
  persistSavedLyrics,
} from '../../../stores/savedLyricsStorage';

export type LyricsTab = 'search' | 'saved';

interface UseLyricsOptions {
  isOnline: boolean;
}

function pickInitialTrack(tracks: readonly LyricsTrack[]): LyricsTrack | null {
  return (
    tracks.find((track) => Boolean(track.plainLyrics || track.syncedLyrics)) ??
    tracks[0] ??
    null
  );
}

export function useLyrics({ isOnline }: UseLyricsOptions) {
  const [query, setQuery] = useState('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LyricsTab>('search');
  const [results, setResults] = useState<LyricsTrack[]>([]);
  const [savedTracks, setSavedTracks] = useState<LyricsTrack[]>(() =>
    loadSavedLyrics(),
  );
  const [selectedTrack, setSelectedTrack] = useState<LyricsTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const savedIdSet = useMemo(
    () => new Set(savedTracks.map((track) => track.id)),
    [savedTracks],
  );

  const isTrackSaved = useCallback(
    (trackId: number) => savedIdSet.has(trackId),
    [savedIdSet],
  );

  const toggleSaveTrack = useCallback((track: LyricsTrack) => {
    setSavedTracks((prev) => {
      const exists = prev.some((item) => item.id === track.id);
      const next = exists
        ? prev.filter((item) => item.id !== track.id)
        : [track, ...prev];
      persistSavedLyrics(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const targetQuery = (overrideQuery ?? query).trim();
      if (overrideQuery !== undefined) {
        setQuery(overrideQuery);
      }
      if (!targetQuery) {
        setError('Enter a song title or artist name to search.');
        return;
      }

      if (!isOnline) {
        setError(
          'You are offline. Reconnect to search LRCLIB or open your Saved Offline lyrics.',
        );
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setActiveTab('search');
      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      setLastSearchedQuery(targetQuery);

      try {
        const tracks = await searchLyrics(targetQuery, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setResults(tracks);
        setSelectedTrack(pickInitialTrack(tracks));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof LyricsApiError) {
          setError(
            `Unable to fetch lyrics (${err.message}). Please try again in a moment.`,
          );
        } else {
          setError(
            'Network error while contacting the lyrics service. Check your connection and try again.',
          );
        }
        setResults([]);
        setSelectedTrack(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [isOnline, query],
  );

  const retrySearch = useCallback(() => {
    const target = lastSearchedQuery || query;
    void runSearch(target);
  }, [lastSearchedQuery, query, runSearch]);

  const clearSearch = useCallback(() => {
    abortControllerRef.current?.abort();
    setQuery('');
    setLastSearchedQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
    setIsLoading(false);
    if (activeTab === 'search') {
      setSelectedTrack(null);
    }
  }, [activeTab]);

  const switchTab = useCallback(
    (nextTab: LyricsTab) => {
      setActiveTab(nextTab);
      if (nextTab === 'saved') {
        setSelectedTrack((current) =>
          current && savedIdSet.has(current.id)
            ? current
            : (savedTracks[0] ?? null),
        );
      } else {
        setSelectedTrack((current) =>
          current && results.some((item) => item.id === current.id)
            ? current
            : pickInitialTrack(results),
        );
      }
    },
    [results, savedIdSet, savedTracks],
  );

  const visibleTracks = activeTab === 'saved' ? savedTracks : results;

  return {
    query,
    setQuery,
    lastSearchedQuery,
    activeTab,
    switchTab,
    results,
    savedTracks,
    visibleTracks,
    selectedTrack,
    setSelectedTrack,
    isLoading,
    error,
    hasSearched,
    isTrackSaved,
    toggleSaveTrack,
    runSearch,
    retrySearch,
    clearSearch,
  };
}

