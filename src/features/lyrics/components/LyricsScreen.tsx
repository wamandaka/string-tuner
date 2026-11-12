import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Disc3,
  Loader2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { parseSyncedLyrics } from '../../../engines/lyrics/lrcParser';
import {
  formatTrackDuration,
  getDisplayablePlainLyrics,
} from '../../../engines/lyrics/lrclibClient';
import type {
  LyricsDisplayMode,
  LyricsTrack,
} from '../../../engines/lyrics/lyrics.types';
import { useLyrics } from '../hooks/useLyrics';

const QUICK_SEARCH_PRESETS = [
  'Oasis Wonderwall',
  'Eagles Hotel California',
  'Green Day Good Riddance',
  'John Mayer Slow Dancing',
] as const;

type TextScale = 'sm' | 'md' | 'lg';

const TEXT_SCALE_CLASSES: Record<TextScale, string> = {
  sm: 'text-sm leading-relaxed',
  md: 'text-base leading-relaxed',
  lg: 'text-lg leading-loose',
};

export function LyricsScreen() {
  const { isOnline } = usePreferences();
  const {
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
  } = useLyrics({ isOnline });

  const [displayMode, setDisplayMode] = useState<LyricsDisplayMode>('plain');
  const [textScale, setTextScale] = useState<TextScale>('md');
  const [copiedTrackId, setCopiedTrackId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);

  const parsedSyncedLines = useMemo(() => {
    if (!selectedTrack?.syncedLyrics) {
      return [];
    }
    return parseSyncedLyrics(selectedTrack.syncedLyrics);
  }, [selectedTrack]);

  const plainLyricsText = useMemo(() => {
    if (!selectedTrack) {
      return '';
    }
    return getDisplayablePlainLyrics(selectedTrack);
  }, [selectedTrack]);

  // Reset per-song scroll & display mode gracefully when switching tracks.
  useEffect(() => {
    setAutoScroll(false);
    if (lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTop = 0;
    }
    if (selectedTrack && !selectedTrack.syncedLyrics) {
      setDisplayMode('plain');
    }
  }, [selectedTrack]);

  // Smooth optional auto-scroll while practicing hands-free.
  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    const container = lyricsScrollRef.current;
    if (!container) {
      return;
    }

    let rafId = 0;
    let lastTimestamp = performance.now();
    let carryPixels = 0;
    const pixelsPerSecond = 24;

    const tick = (now: number) => {
      const elapsedSeconds = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      carryPixels += elapsedSeconds * pixelsPerSecond;

      if (carryPixels >= 1) {
        const step = Math.floor(carryPixels);
        carryPixels -= step;
        container.scrollTop += step;
      }

      const reachedEnd =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 2;
      if (reachedEnd) {
        setAutoScroll(false);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoScroll]);

  const handleCopyLyrics = async (track: LyricsTrack) => {
    const content = getDisplayablePlainLyrics(track);
    if (!content) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${track.trackName} — ${track.artistName}\n\n${content}`,
      );
      setCopiedTrackId(track.id);
      window.setTimeout(() => {
        setCopiedTrackId((prev) => (prev === track.id ? null : prev));
      }, 2000);
    } catch {
      setCopiedTrackId(null);
    }
  };

  return (
    <section
      aria-labelledby="lyrics-heading"
      className="mx-auto flex max-w-5xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1
            id="lyrics-heading"
            className="text-lg font-semibold tracking-tight text-[var(--st-text)]"
          >
            Song Lyrics
          </h1>
          <p className="text-xs text-[var(--st-text-muted)]">
            Free LRCLIB lyrics lookup · Save favorites locally for offline
            practice
          </p>
        </div>

        <div
          role="group"
          aria-label="Lyrics source view"
          className="inline-flex rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-1"
        >
          <button
            type="button"
            aria-pressed={activeTab === 'search'}
            onClick={() => switchTab('search')}
            className={`min-h-8 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === 'search'
                ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
            }`}
          >
            Search ({results.length})
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'saved'}
            onClick={() => switchTab('saved')}
            className={`min-h-8 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === 'saved'
                ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
            }`}
          >
            Saved Offline ({savedTracks.length})
          </button>
        </div>
      </div>

      {/* Native form submit provides IME-safe Enter handling automatically */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <label htmlFor="lyrics-search-input" className="visually-hidden">
            Search song title or artist
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--st-text-muted)]"
            aria-hidden="true"
          />
          <input
            id="lyrics-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search song title or artist (e.g. Wonderwall, Hotel California)..."
            className="min-h-11 w-full rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] py-2.5 pr-10 pl-10 text-sm text-[var(--st-text)] placeholder:text-[var(--st-text-muted)]"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear lyrics search"
              className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--st-text-muted)] hover:bg-[var(--st-surface-elevated)] hover:text-[var(--st-text)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--st-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--st-accent-text)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Search Lyrics</span>
            </>
          )}
        </button>
      </form>

      {/* Quick song suggestions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-[var(--st-text-muted)]">
          Try:
        </span>
        {QUICK_SEARCH_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => void runSearch(preset)}
            className="min-h-8 rounded-full border border-[var(--st-border)] bg-[var(--st-surface)] px-3 py-1 text-xs font-medium text-[var(--st-text-muted)] transition-colors hover:border-[var(--st-accent)] hover:text-[var(--st-text)]"
          >
            {preset}
          </button>
        ))}
      </div>

      {!isOnline ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color-mix(in_srgb,var(--st-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--st-warn)_10%,transparent)] px-3.5 py-2.5 text-xs text-[var(--st-text)]"
        >
          <span className="inline-flex items-center gap-2">
            <WifiOff
              className="h-4 w-4 shrink-0 text-[var(--st-warn)]"
              aria-hidden="true"
            />
            <span>
              You are offline. Online lyrics search requires an internet
              connection, but your saved songs remain readable.
            </span>
          </span>
          {savedTracks.length > 0 && activeTab !== 'saved' ? (
            <button
              type="button"
              onClick={() => switchTab('saved')}
              className="font-semibold text-[var(--st-accent)] underline underline-offset-2"
            >
              Open Saved ({savedTracks.length})
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--st-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--st-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--st-text)]"
        >
          <span>{error}</span>
          {lastSearchedQuery ? (
            <button
              type="button"
              onClick={retrySearch}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--st-border-strong)] bg-[var(--st-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--st-text)] hover:bg-[var(--st-surface-elevated)]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* Track list column */}
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between px-1 py-0.5">
            <h2 className="text-xs font-semibold tracking-wider text-[var(--st-text-muted)] uppercase">
              {activeTab === 'saved'
                ? 'Saved Songs'
                : hasSearched
                  ? `Results for "${lastSearchedQuery}"`
                  : 'Results'}
            </h2>
            <span
              data-testid="lyrics-result-count"
              className="text-xs text-[var(--st-text-muted)]"
            >
              {visibleTracks.length}{' '}
              {visibleTracks.length === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-[var(--st-text-muted)]">
              <Loader2
                className="h-5 w-5 animate-spin text-[var(--st-accent)]"
                aria-hidden="true"
              />
              <span>Fetching tracks from LRCLIB...</span>
            </div>
          ) : visibleTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-3 py-10 text-center text-sm text-[var(--st-text-muted)]">
              <Music2 className="h-6 w-6 opacity-60" aria-hidden="true" />
              {activeTab === 'saved' ? (
                <p>
                  No saved lyrics yet. Search a song and click Save to keep it
                  available offline.
                </p>
              ) : hasSearched ? (
                <p>
                  No tracks matched &ldquo;{lastSearchedQuery}&rdquo;. Try a
                  broader song title or artist name.
                </p>
              ) : (
                <p>
                  Search any song title or artist above, or pick a quick preset
                  to load its lyrics.
                </p>
              )}
            </div>
          ) : (
            <ul
              aria-label="Lyrics track list"
              className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto pr-0.5"
            >
              {visibleTracks.map((track) => {
                const isSelected = selectedTrack?.id === track.id;
                const saved = isTrackSaved(track.id);
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedTrack(track)}
                      className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                          : 'border-[var(--st-border)] bg-[var(--st-surface-elevated)] hover:border-[var(--st-border-strong)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 font-semibold break-words text-[var(--st-text)]">
                          {track.trackName}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-[var(--st-text-muted)]">
                          {formatTrackDuration(track.durationSeconds)}
                        </span>
                      </div>
                      <span className="text-xs break-words text-[var(--st-text-muted)]">
                        {track.artistName}
                      </span>
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {track.syncedLyrics ? (
                          <Badge tone="accent">Synced</Badge>
                        ) : null}
                        {track.instrumental ? (
                          <Badge tone="warn">Instrumental</Badge>
                        ) : null}
                        {saved ? <Badge tone="neutral">Saved</Badge> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Lyrics detail column */}
        <Card className="flex min-h-[22rem] flex-col gap-4 p-4 sm:p-5">
          {selectedTrack ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--st-border)] pb-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold tracking-tight break-words text-[var(--st-text)]">
                    {selectedTrack.trackName}
                  </h2>
                  <p className="mt-0.5 text-sm break-words text-[var(--st-text-muted)]">
                    {selectedTrack.artistName}
                    {selectedTrack.albumName
                      ? ` · ${selectedTrack.albumName}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={isTrackSaved(selectedTrack.id)}
                    onClick={() => toggleSaveTrack(selectedTrack)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isTrackSaved(selectedTrack.id)
                        ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                        : 'border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text)] hover:border-[var(--st-border-strong)]'
                    }`}
                  >
                    <Bookmark
                      className="h-3.5 w-3.5"
                      fill={
                        isTrackSaved(selectedTrack.id) ? 'currentColor' : 'none'
                      }
                      aria-hidden="true"
                    />
                    <span>
                      {isTrackSaved(selectedTrack.id) ? 'Saved' : 'Save Offline'}
                    </span>
                  </button>

                  {plainLyricsText ? (
                    <button
                      type="button"
                      onClick={() => void handleCopyLyrics(selectedTrack)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--st-text)] transition-colors hover:border-[var(--st-border-strong)]"
                    >
                      {copiedTrackId === selectedTrack.id ? (
                        <>
                          <Check
                            className="h-3.5 w-3.5 text-[var(--st-accent)]"
                            aria-hidden="true"
                          />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Reader controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedTrack.syncedLyrics ? (
                    <div
                      role="group"
                      aria-label="Lyrics display format"
                      className="inline-flex rounded-xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] p-0.5"
                    >
                      {(['plain', 'synced'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={displayMode === mode}
                          onClick={() => setDisplayMode(mode)}
                          className={`min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                            displayMode === mode
                              ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                              : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
                          }`}
                        >
                          {mode === 'plain' ? 'Plain' : 'Synced'}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div
                    role="group"
                    aria-label="Lyrics text size"
                    className="inline-flex rounded-xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] p-0.5"
                  >
                    {(
                      [
                        { id: 'sm', label: 'S' },
                        { id: 'md', label: 'M' },
                        { id: 'lg', label: 'L' },
                      ] as const
                    ).map((size) => (
                      <button
                        key={size.id}
                        type="button"
                        aria-label={`Lyrics text size ${size.label}`}
                        aria-pressed={textScale === size.id}
                        onClick={() => setTextScale(size.id)}
                        className={`min-h-8 min-w-8 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                          textScale === size.id
                            ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                            : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                {plainLyricsText ? (
                  <button
                    type="button"
                    aria-pressed={autoScroll}
                    onClick={() => setAutoScroll((prev) => !prev)}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition-colors ${
                      autoScroll
                        ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                        : 'border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
                    }`}
                  >
                    {autoScroll ? (
                      <>
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Auto-Scroll On</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Auto-Scroll</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {/* Lyrics text body */}
              <div
                ref={lyricsScrollRef}
                data-testid="lyrics-reader-body"
                className="max-h-[28rem] flex-1 overflow-y-auto rounded-xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] p-4"
              >
                {selectedTrack.instrumental && !plainLyricsText ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-[var(--st-text-muted)]">
                    <Disc3 className="h-7 w-7 opacity-70" aria-hidden="true" />
                    <p>This track is marked as instrumental.</p>
                  </div>
                ) : displayMode === 'synced' && parsedSyncedLines.length > 0 ? (
                  <ol className={`flex flex-col gap-2 ${TEXT_SCALE_CLASSES[textScale]}`}>
                    {parsedSyncedLines.map((line) => (
                      <li key={line.id} className="flex items-baseline gap-3">
                        <span className="shrink-0 font-mono text-xs text-[var(--st-accent)]">
                          [{line.formattedTime}]
                        </span>
                        <span className="min-w-0 break-words text-[var(--st-text)]">
                          {line.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : plainLyricsText ? (
                  <div
                    className={`whitespace-pre-wrap break-words text-[var(--st-text)] ${TEXT_SCALE_CLASSES[textScale]}`}
                  >
                    {plainLyricsText}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-[var(--st-text-muted)]">
                    No lyrics text is attached to this entry. Try selecting another
                    matching version from the list.
                  </div>
                )}
              </div>

              <p className="text-right text-[11px] text-[var(--st-text-muted)]">
                Source: Public LRCLIB API (no API key required)
              </p>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-sm text-[var(--st-text-muted)]">
              <Music2 className="h-8 w-8 opacity-60" aria-hidden="true" />
              <p className="max-w-sm">
                Select a track from search results or your saved library to read
                full lyrics while you tune and play.
              </p>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

