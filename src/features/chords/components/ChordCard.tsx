import { Star, Volume2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { playChordPreview } from '../../../engines/audio/ChordPreviewSynth';
import {
  CHORD_CATEGORY_LABELS,
  type ChordDefinition,
} from '../chords.types';
import { ChordDiagram } from './ChordDiagram';

interface ChordCardProps {
  chord: ChordDefinition;
  isFavorite: boolean;
  onToggleFavorite: (chordId: string) => void;
}

export function ChordCard({
  chord,
  isFavorite,
  onToggleFavorite,
}: ChordCardProps) {
  return (
    <Card className="flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold tracking-tight text-(--st-text)">
              {chord.symbol}
            </h2>
            <span className="truncate text-xs font-medium text-(--st-text-muted)">
              {chord.name}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">
              {CHORD_CATEGORY_LABELS[chord.category]}
            </Badge>
            <Badge tone={chord.isBarre ? 'accent' : 'neutral'}>
              {chord.isBarre ? 'Barre' : 'Open'}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Strum ${chord.name}`}
            onClick={() => void playChordPreview(chord.frets)}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) transition-colors hover:border-(--st-border-strong) hover:text-(--st-text)"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={
              isFavorite
                ? `Remove ${chord.name} from favorites`
                : `Add ${chord.name} to favorites`
            }
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite(chord.id)}
            className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border transition-colors ${
              isFavorite
                ? 'border-(--st-accent)/40 bg-(--st-accent-soft) text-(--st-accent)'
                : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
            }`}
          >
            <Star
              className="h-4 w-4"
              fill={isFavorite ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div className="my-3">
        <ChordDiagram chord={chord} />
      </div>

      <div className="flex items-center justify-between border-t border-(--st-border) pt-2.5 text-xs text-(--st-text-muted)">
        <span>Notes: {chord.notes.join(' · ')}</span>
        <span className="font-mono">
          {chord.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}
        </span>
      </div>
    </Card>
  );
}

