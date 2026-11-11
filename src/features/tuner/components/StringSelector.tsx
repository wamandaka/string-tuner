import { Lock, Sparkles } from 'lucide-react';
import type { GuitarStringTarget } from '../../../engines/pitch/NoteMapper';

interface StringSelectorProps {
  strings: readonly GuitarStringTarget[];
  manualStringNumber: 6 | 5 | 4 | 3 | 2 | 1 | null;
  detectedStringNumber: 6 | 5 | 4 | 3 | 2 | 1 | null;
  onSelectString: (stringNumber: 6 | 5 | 4 | 3 | 2 | 1) => void;
  onSelectAuto: () => void;
  disabled?: boolean;
}

export function StringSelector({
  strings,
  manualStringNumber,
  detectedStringNumber,
  onSelectString,
  onSelectAuto,
  disabled = false,
}: StringSelectorProps) {
  const isAuto = manualStringNumber === null;

  return (
    <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wider text-[var(--st-text-muted)] uppercase">
          {isAuto ? 'Auto String Detection' : `Locked to String ${manualStringNumber}`}
        </span>
        <button
          type="button"
          onClick={onSelectAuto}
          disabled={disabled}
          aria-pressed={isAuto}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
            isAuto
              ? 'border-[color-mix(in_srgb,var(--st-accent)_40%,transparent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
              : 'border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Auto</span>
        </button>
      </div>

      <div
        role="group"
        aria-label="Select guitar string"
        className="grid grid-cols-6 gap-1.5 sm:gap-2"
      >
        {strings.map((item) => {
          const isManualSelected = manualStringNumber === item.stringNumber;
          const isAutoMatched =
            isAuto && detectedStringNumber === item.stringNumber;
          const active = isManualSelected || isAutoMatched;

          return (
            <button
              key={item.stringNumber}
              type="button"
              disabled={disabled}
              aria-pressed={isManualSelected}
              aria-label={`String ${item.stringNumber}, ${item.label}, ${item.frequency.toFixed(2)} Hz${
                isManualSelected ? ' (selected manually)' : ''
              }`}
              onClick={() => onSelectString(item.stringNumber)}
              className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border px-1 py-1.5 transition-colors ${
                active
                  ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                  : 'border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text)] hover:border-[var(--st-border-strong)]'
              }`}
            >
              {isManualSelected ? (
                <Lock
                  className="absolute top-1 right-1 h-2.5 w-2.5"
                  aria-hidden="true"
                />
              ) : null}
              <span className="text-[10px] font-medium text-[var(--st-text-muted)]">
                {item.stringNumber}
              </span>
              <span className="text-sm font-bold leading-tight">
                {item.note}
                <sub className="ml-0.5 text-[10px] font-medium opacity-75">
                  {item.octave}
                </sub>
              </span>
              <span className="mt-0.5 hidden text-[10px] font-mono opacity-75 sm:inline">
                {Math.round(item.frequency)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

