import {
  ArrowDown,
  Music,
  RotateCcw,
  Sliders,
  Trash2,
  VolumeX,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import type { ChordDefinition } from '../../chords/chords.types';
import {
  CUSTOM_STRING_MASK_PRESETS,
  CUSTOM_STRING_ORDER_PRESETS,
  type PlaygroundKeyMap,
  type StringMask,
} from '../playground.types';
import {
  applyCustomStringMask,
  detectVariationChordLabel,
  formatFretNoteName,
  formatFretsCompact,
} from '../playgroundChordUtils';
import { formatKeyBadge } from '../playgroundKeymapStorage';

interface CustomStringVariationPanelProps {
  activeChord: ChordDefinition;
  effectiveFrets: readonly [number, number, number, number, number, number];
  stringOverrides: Record<number, number>;
  customStringMask: StringMask;
  customStringOrder: readonly number[];
  keyMap: PlaygroundKeyMap;
  onSetStringOverride: (stringIndex: number, fret: number | null) => void;
  onResetOverrides: () => void;
  onToggleCustomString: (stringIndex: number) => void;
  onSetCustomStringMask: (mask: StringMask) => void;
  onSetCustomStringOrder: (order: number[]) => void;
  onStrumCustomStrings: () => void;
  onPickCustomStrings: () => void;
}

const STRING_INFO = [
  { index: 0, number: 6, name: 'E' },
  { index: 1, number: 5, name: 'A' },
  { index: 2, number: 4, name: 'D' },
  { index: 3, number: 3, name: 'G' },
  { index: 4, number: 2, name: 'B' },
  { index: 5, number: 1, name: 'e' },
] as const;

export function CustomStringVariationPanel({
  activeChord,
  effectiveFrets,
  stringOverrides,
  customStringMask,
  customStringOrder,
  keyMap,
  onSetStringOverride,
  onResetOverrides,
  onToggleCustomString,
  onSetCustomStringMask,
  onSetCustomStringOrder,
  onStrumCustomStrings,
  onPickCustomStrings,
}: CustomStringVariationPanelProps) {
  const hasOverrides = Object.keys(stringOverrides).length > 0;
  const variationLabel = detectVariationChordLabel(
    effectiveFrets,
    activeChord.symbol,
  );
  const maskedFrets = applyCustomStringMask(effectiveFrets, customStringMask);
  const activeCustomCount = customStringMask.filter(Boolean).length;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--st-border) pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-(--st-accent)" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-(--st-text)">
                Variasi Tekanan Senar &amp; Play by Custom String
              </h2>
              <span
                data-testid="variation-detected-label"
                className="rounded-md bg-(--st-accent-soft) px-2 py-0.5 font-mono text-[11px] font-bold text-(--st-accent)"
              >
                {variationLabel} ({formatFretsCompact(effectiveFrets)})
              </span>
            </div>
            <p className="text-xs text-(--st-text-muted)">
              Lepas tekanan senar jadi Open (0) untuk variasi (mis. C lepas S2
              → Cmaj7), mute (X), atau pilih senar &amp; urutan petik custom
            </p>
          </div>
        </div>

        {hasOverrides ? (
          <button
            type="button"
            onClick={onResetOverrides}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset ke {activeChord.symbol} Asli</span>
          </button>
        ) : null}
      </div>

      {/* Per-String Fret Variation + Active String Toggle Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STRING_INFO.map((str) => {
          const baseFret = activeChord.frets[str.index]!;
          const currentFret = effectiveFrets[str.index]!;
          const isOverridden = stringOverrides[str.index] !== undefined;
          const isCustomEnabled = customStringMask[str.index]!;
          const isOpen = currentFret === 0;
          const isMuted = currentFret < 0;

          return (
            <div
              key={str.number}
              className={`flex flex-col justify-between rounded-xl border p-2.5 transition-colors ${
                isOverridden
                  ? 'border-(--st-accent) bg-(--st-accent-soft)/40'
                  : 'border-(--st-border) bg-(--st-surface-elevated)'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-(--st-text)">
                  S{str.number} ({str.name})
                </span>

                <button
                  type="button"
                  aria-pressed={isCustomEnabled}
                  aria-label={`Aktifkan Senar ${str.number} (${str.name}) untuk Custom String`}
                  onClick={() => onToggleCustomString(str.index)}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                    isCustomEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                      : 'bg-(--st-surface) text-(--st-text-muted) line-through'
                  }`}
                >
                  {isCustomEnabled ? 'Aktif' : 'Skip'}
                </button>
              </div>

              <div className="my-1.5 text-center">
                <div className="font-mono text-sm font-extrabold text-(--st-text)">
                  {isMuted
                    ? '✕ Mute'
                    : isOpen
                      ? `Open · ${formatFretNoteName(str.index, 0)}`
                      : `Fret ${currentFret} · ${formatFretNoteName(str.index, currentFret)}`}
                </div>
                {isOverridden ? (
                  <div className="text-[10px] text-(--st-accent)">
                    Asli:{' '}
                    {baseFret < 0
                      ? 'X'
                      : baseFret === 0
                        ? 'Open'
                        : `Fret ${baseFret}`}
                  </div>
                ) : (
                  <div className="text-[10px] text-(--st-text-muted)">
                    Sesuai chord
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1">
                <button
                  type="button"
                  aria-pressed={isOpen}
                  aria-label={`Lepas Senar ${str.number} jadi Open (0)`}
                  onClick={() =>
                    onSetStringOverride(
                      str.index,
                      isOpen && isOverridden ? null : 0,
                    )
                  }
                  className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                    isOpen
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:text-(--st-text)'
                  }`}
                >
                  Lepas (0)
                </button>

                <button
                  type="button"
                  aria-pressed={isMuted}
                  aria-label={`Mute Senar ${str.number}`}
                  onClick={() =>
                    onSetStringOverride(
                      str.index,
                      isMuted && isOverridden ? null : -1,
                    )
                  }
                  className={`inline-flex items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                    isMuted
                      ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                      : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:text-(--st-text)'
                  }`}
                  title="Mute senar (tidak ditekan/dibunyikan)"
                >
                  <VolumeX className="h-3 w-3" aria-hidden="true" />
                </button>

                {isOverridden ? (
                  <button
                    type="button"
                    aria-label={`Kembalikan Senar ${str.number} ke asli`}
                    onClick={() => onSetStringOverride(str.index, null)}
                    className="rounded-md border border-(--st-border) bg-(--st-surface) px-1.5 py-1 text-[10px] font-semibold text-(--st-text-muted) hover:text-(--st-text)"
                  >
                    Asli
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Play by Custom String Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-(--st-border) pt-3 lg:grid-cols-12">
        <div className="flex flex-col gap-2 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
              Preset Pilihan Senar ({activeCustomCount}/6 aktif)
            </span>
            <span className="font-mono text-[10px] text-(--st-text-muted)">
              {formatFretsCompact(maskedFrets)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOM_STRING_MASK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSetCustomStringMask([...preset.mask] as StringMask)}
                className="min-h-7 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2 py-1 text-[11px] font-semibold text-(--st-text-muted) hover:border-(--st-accent) hover:text-(--st-text)"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onStrumCustomStrings}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-(--st-accent) px-3 py-1.5 text-xs font-semibold text-(--st-accent-text) hover:opacity-95"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Strum Custom Senar</span>
              <kbd className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px]">
                {formatKeyBadge(keyMap.bindings['strum-custom-string'])}
              </kbd>
            </button>

            <button
              type="button"
              onClick={onPickCustomStrings}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-(--st-border-strong) bg-(--st-surface-elevated) px-3 py-1.5 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
            >
              <Music className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Petik Urutan Senar</span>
              <kbd className="rounded bg-(--st-surface) px-1.5 py-0.5 font-mono text-[10px] text-(--st-accent)">
                {formatKeyBadge(keyMap.bindings['pick-custom-string'])}
              </kbd>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
              Urutan Petik Custom Senar
            </span>
            <div className="flex flex-wrap gap-1">
              {CUSTOM_STRING_ORDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSetCustomStringOrder([...preset.order])}
                  className="rounded-md border border-(--st-border) bg-(--st-surface-elevated) px-2 py-0.5 font-mono text-[10px] font-semibold text-(--st-text-muted) hover:border-(--st-accent) hover:text-(--st-text)"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1.5">
            {customStringOrder.length === 0 ? (
              <span className="text-xs text-(--st-text-muted)">
                Klik tombol +S6..+S1 di bawah untuk menyusun urutan petik senar
              </span>
            ) : (
              customStringOrder.map((stringIdx, stepIdx) => {
                const isEnabled =
                  customStringMask[stringIdx] &&
                  effectiveFrets[stringIdx]! >= 0;
                return (
                  <button
                    key={`${stringIdx}-${stepIdx}`}
                    type="button"
                    title="Klik untuk hapus langkah ini"
                    onClick={() =>
                      onSetCustomStringOrder(
                        customStringOrder.filter((_, idx) => idx !== stepIdx),
                      )
                    }
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
                      isEnabled
                        ? 'bg-(--st-accent-soft) text-(--st-accent) ring-1 ring-(--st-accent)/40'
                        : 'bg-(--st-surface) text-(--st-text-muted) line-through'
                    }`}
                  >
                    <span>S{6 - stringIdx}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {STRING_INFO.map((str) => (
                <button
                  key={str.number}
                  type="button"
                  aria-label={`Tambah Senar ${str.number} ke urutan petik`}
                  onClick={() =>
                    onSetCustomStringOrder([...customStringOrder, str.index])
                  }
                  className="min-h-7 rounded-lg border border-(--st-border) bg-(--st-surface) px-2 py-0.5 font-mono text-[11px] font-bold text-(--st-text) hover:border-(--st-accent)"
                >
                  +S{str.number}
                </button>
              ))}
            </div>

            {customStringOrder.length > 0 ? (
              <button
                type="button"
                onClick={() => onSetCustomStringOrder([])}
                className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-(--st-border) bg-(--st-surface) px-2 py-0.5 text-[11px] font-semibold text-(--st-text-muted) hover:text-(--st-danger)"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                <span>Kosongkan</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

