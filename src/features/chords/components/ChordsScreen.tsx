import { useMemo, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { CHORDS } from '../../../data/chords';
import {
  CHORD_CATEGORY_LABELS,
  type ChordCategory,
  type ChordFilterCategory,
} from '../chords.types';
import { ChordCard } from './ChordCard';

const CATEGORY_ORDER: readonly ChordCategory[] = [
  'major',
  'minor',
  'dominant7',
  'major7',
  'minor7',
  'sus2',
  'sus4',
  'diminished',
];

type VoicingShapeFilter = 'all' | 'open' | 'barre';

export function ChordsScreen() {
  const { favoriteChordIds, isFavoriteChord, toggleFavoriteChord } =
    usePreferences();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<ChordFilterCategory>('all');
  const [shapeFilter, setShapeFilter] = useState<VoicingShapeFilter>('all');

  const filteredChords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return CHORDS.filter((chord) => {
      if (selectedCategory === 'favorites' && !isFavoriteChord(chord.id)) {
        return false;
      }
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'favorites' &&
        chord.category !== selectedCategory
      ) {
        return false;
      }
      if (shapeFilter === 'open' && chord.isBarre) {
        return false;
      }
      if (shapeFilter === 'barre' && !chord.isBarre) {
        return false;
      }

      if (!query) {
        return true;
      }

      const categoryLabel = CHORD_CATEGORY_LABELS[chord.category].toLowerCase();
      return (
        chord.symbol.toLowerCase().includes(query) ||
        chord.name.toLowerCase().includes(query) ||
        chord.root.toLowerCase().includes(query) ||
        categoryLabel.includes(query)
      );
    });
  }, [isFavoriteChord, searchQuery, selectedCategory, shapeFilter]);

  return (
    <section
      aria-labelledby="chords-heading"
      className="mx-auto flex max-w-5xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1
            id="chords-heading"
            className="text-lg font-semibold tracking-tight text-[var(--st-text)]"
          >
            Guitar Chord Library
          </h1>
          <p className="text-xs text-[var(--st-text-muted)]">
            {CHORDS.length} offline voicings · Open &amp; barre diagrams with
            finger positions
          </p>
        </div>

        <div
          role="group"
          aria-label="Voicing shape filter"
          className="inline-flex rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-1"
        >
          {(['all', 'open', 'barre'] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              aria-pressed={shapeFilter === shape}
              onClick={() => setShapeFilter(shape)}
              className={`min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                shapeFilter === shape
                  ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                  : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
              }`}
            >
              {shape}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <label htmlFor="chord-search-input" className="visually-hidden">
          Search chords by name
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--st-text-muted)]"
          aria-hidden="true"
        />
        <input
          id="chord-search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search chords (e.g. Am, Fmaj7, Gsus4, Barre)..."
          className="min-h-11 w-full rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] py-2.5 pr-10 pl-10 text-sm text-[var(--st-text)] placeholder:text-[var(--st-text-muted)]"
        />
        {searchQuery ? (
          <button
            type="button"
            aria-label="Clear chord search"
            onClick={() => setSearchQuery('')}
            className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--st-text-muted)] hover:text-[var(--st-text)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Category Filter Chips */}
      <div
        role="group"
        aria-label="Filter chords by category"
        className="flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          aria-pressed={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
          className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedCategory === 'all'
              ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
              : 'border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text-muted)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]'
          }`}
        >
          All
        </button>

        <button
          type="button"
          aria-pressed={selectedCategory === 'favorites'}
          onClick={() => setSelectedCategory('favorites')}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedCategory === 'favorites'
              ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
              : 'border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text-muted)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]'
          }`}
        >
          <Star
            className="h-3.5 w-3.5"
            fill={selectedCategory === 'favorites' ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          <span>Favorites ({favoriteChordIds.length})</span>
        </button>

        {CATEGORY_ORDER.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(category)}
              className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                  : 'border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text-muted)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]'
              }`}
            >
              {CHORD_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[var(--st-text-muted)]">
        <span data-testid="chord-count">
          Showing {filteredChords.length}{' '}
          {filteredChords.length === 1 ? 'chord' : 'chords'}
        </span>
      </div>

      {/* Chord Cards Grid */}
      {filteredChords.length === 0 ? (
        <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-surface)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--st-text)]">
            {selectedCategory === 'favorites' && favoriteChordIds.length === 0
              ? 'No favorite chords saved yet.'
              : 'No matching chords found.'}
          </p>
          <p className="mt-1 text-xs text-[var(--st-text-muted)]">
            {selectedCategory === 'favorites' && favoriteChordIds.length === 0
              ? 'Tap the star icon on any chord card to save it for quick practice.'
              : 'Try clearing your search query or switching chord filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChords.map((chord) => (
            <ChordCard
              key={chord.id}
              chord={chord}
              isFavorite={isFavoriteChord(chord.id)}
              onToggleFavorite={toggleFavoriteChord}
            />
          ))}
        </div>
      )}
    </section>
  );
}
