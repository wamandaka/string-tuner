import { useEffect, useMemo, useState } from 'react';
import { Guitar, Search, Star, Volume2, X } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { useRouter } from '../../../app/router';
import { CHORDS } from '../../../data/chords';
import {
  getGuitarTonePreference,
  preloadChordSamples,
  setGuitarTonePreference,
  type GuitarToneType,
} from '../../../engines/audio/ChordPreviewSynth';
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

const GUITAR_TONE_OPTIONS: ReadonlyArray<{
  id: GuitarToneType;
  label: string;
}> = [
  { id: 'steel', label: 'Steel Guitar' },
  { id: 'nylon', label: 'Nylon Guitar' },
  { id: 'synth', label: 'Acoustic Synth' },
];

export function ChordsScreen() {
  const { favoriteChordIds, isFavoriteChord, toggleFavoriteChord } =
    usePreferences();
  const { navigate } = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<ChordFilterCategory>('all');
  const [shapeFilter, setShapeFilter] = useState<VoicingShapeFilter>('all');
  const [guitarTone, setGuitarTone] = useState<GuitarToneType>(() =>
    getGuitarTonePreference(),
  );

  useEffect(() => {
    if (guitarTone === 'synth') {
      return;
    }
    void preloadChordSamples(
      CHORDS.slice(0, 12).map((chord) => chord.frets),
      guitarTone,
    );
  }, [guitarTone]);

  const handleChangeGuitarTone = (tone: GuitarToneType) => {
    setGuitarTone(tone);
    setGuitarTonePreference(tone);
  };

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
            className="text-lg font-semibold tracking-tight text-(--st-text)"
          >
            Guitar Chord Library
          </h1>
          <p className="text-xs text-(--st-text-muted)">
            {CHORDS.length} offline voicings · Open &amp; barre diagrams with
            finger positions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('playground')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-(--st-accent) px-3 py-1.5 text-xs font-semibold text-(--st-accent-text) transition-opacity hover:opacity-95"
          >
            <Guitar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Open Playground</span>
          </button>

          <div
            role="group"
            aria-label="Guitar sound"
            className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-(--st-border) bg-(--st-surface) p-1"
          >
            <Volume2
              className="mx-1.5 h-3.5 w-3.5 shrink-0 text-(--st-text-muted)"
              aria-hidden="true"
            />
            {GUITAR_TONE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={guitarTone === option.id}
                onClick={() => handleChangeGuitarTone(option.id)}
                className={`min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  guitarTone === option.id
                    ? 'bg-(--st-accent) text-(--st-accent-text)'
                    : 'text-(--st-text-muted) hover:text-(--st-text)'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Voicing shape filter"
            className="inline-flex rounded-xl border border-(--st-border) bg-(--st-surface) p-1"
          >
            {(['all', 'open', 'barre'] as const).map((shape) => (
              <button
                key={shape}
                type="button"
                aria-pressed={shapeFilter === shape}
                onClick={() => setShapeFilter(shape)}
                className={`min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  shapeFilter === shape
                    ? 'bg-(--st-accent) text-(--st-accent-text)'
                    : 'text-(--st-text-muted) hover:text-(--st-text)'
                }`}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <label htmlFor="chord-search-input" className="visually-hidden">
          Search chords by name
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-(--st-text-muted)"
          aria-hidden="true"
        />
        <input
          id="chord-search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search chords (e.g. Am, Fmaj7, Gsus4, Barre)..."
          className="min-h-11 w-full rounded-xl border border-(--st-border) bg-(--st-surface) py-2.5 pr-10 pl-10 text-sm text-(--st-text) placeholder:text-(--st-text-muted)"
        />
        {searchQuery ? (
          <button
            type="button"
            aria-label="Clear chord search"
            onClick={() => setSearchQuery('')}
            className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-(--st-text-muted) hover:text-(--st-text)"
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
              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
              : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
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
              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
              : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
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
                  ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                  : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
              }`}
            >
              {CHORD_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-(--st-text-muted)">
        <span data-testid="chord-count">
          Showing {filteredChords.length}{' '}
          {filteredChords.length === 1 ? 'chord' : 'chords'}
        </span>
      </div>

      {/* Chord Cards Grid */}
      {filteredChords.length === 0 ? (
        <div className="rounded-2xl border border-(--st-border) bg-(--st-surface) p-8 text-center">
          <p className="text-sm font-medium text-(--st-text)">
            {selectedCategory === 'favorites' && favoriteChordIds.length === 0
              ? 'No favorite chords saved yet.'
              : 'No matching chords found.'}
          </p>
          <p className="mt-1 text-xs text-(--st-text-muted)">
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
              guitarTone={guitarTone}
            />
          ))}
        </div>
      )}
    </section>
  );
}
