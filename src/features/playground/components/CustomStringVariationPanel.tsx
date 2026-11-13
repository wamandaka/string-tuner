import { useRef, useState, type DragEvent } from 'react';
import {
  ArrowDown,
  GripVertical,
  Music,
  Pin,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  VolumeX,
  X,
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
  activeSlotLabel?: string;
  isStringOrderAssignedToSlot?: boolean;
  onSetStringOverride: (stringIndex: number, fret: number | null) => void;
  onResetOverrides: () => void;
  onToggleCustomString: (stringIndex: number) => void;
  onSetCustomStringMask: (mask: StringMask) => void;
  onSetCustomStringOrder: (order: number[]) => void;
  onStrumCustomStrings: () => void;
  onPickCustomStrings: () => void;
  onAssignCustomStringToSlot?: () => void;
  onClearSlotAssignment?: () => void;
}

const STRING_INFO = [
  { index: 0, number: 6, name: 'E (Paling Tebal)' },
  { index: 1, number: 5, name: 'A' },
  { index: 2, number: 4, name: 'D' },
  { index: 3, number: 3, name: 'G' },
  { index: 4, number: 2, name: 'B' },
  { index: 5, number: 1, name: 'e (Paling Tipis)' },
] as const;

type StringOrderDragPayload =
  | { kind: 'reorder'; fromIndex: number }
  | { kind: 'palette'; stringIndex: number };

export function CustomStringVariationPanel({
  activeChord,
  effectiveFrets,
  stringOverrides,
  customStringMask,
  customStringOrder,
  keyMap,
  activeSlotLabel,
  isStringOrderAssignedToSlot = false,
  onSetStringOverride,
  onResetOverrides,
  onToggleCustomString,
  onSetCustomStringMask,
  onSetCustomStringOrder,
  onStrumCustomStrings,
  onPickCustomStrings,
  onAssignCustomStringToSlot,
  onClearSlotAssignment,
}: CustomStringVariationPanelProps) {
  const dragPayloadRef = useRef<StringOrderDragPayload | null>(null);
  const [dragOverOrderIdx, setDragOverOrderIdx] = useState<number | null>(null);
  const [dragOverOrderList, setDragOverOrderList] = useState(false);

  const startOrderDrag = (
    event: DragEvent<HTMLElement>,
    payload: StringOrderDragPayload,
  ) => {
    dragPayloadRef.current = payload;
    try {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed =
          payload.kind === 'reorder' ? 'move' : 'copyMove';
        event.dataTransfer.setData('application/json', JSON.stringify(payload));
      }
    } catch {
      // Ignore synthetic jsdom dataTransfer restrictions
    }
  };

  const readOrderDragPayload = (
    event: DragEvent<HTMLElement>,
  ): StringOrderDragPayload | null => {
    if (dragPayloadRef.current) {
      return dragPayloadRef.current;
    }
    try {
      const raw = event.dataTransfer?.getData('application/json');
      if (raw) {
        return JSON.parse(raw) as StringOrderDragPayload;
      }
    } catch {
      // Ignore invalid drag data
    }
    return null;
  };

  const clearOrderDrag = () => {
    dragPayloadRef.current = null;
    setDragOverOrderIdx(null);
    setDragOverOrderList(false);
  };

  const handleDropOnOrderChip = (
    event: DragEvent<HTMLElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readOrderDragPayload(event);
    clearOrderDrag();
    if (!payload) {
      return;
    }
    if (payload.kind === 'reorder') {
      const { fromIndex } = payload;
      if (
        fromIndex === targetIndex ||
        fromIndex < 0 ||
        fromIndex >= customStringOrder.length
      ) {
        return;
      }
      const next = [...customStringOrder];
      const [moved] = next.splice(fromIndex, 1);
      if (moved === undefined) {
        return;
      }
      next.splice(targetIndex, 0, moved);
      onSetCustomStringOrder(next);
      return;
    }
    const next = [...customStringOrder];
    next.splice(targetIndex, 0, payload.stringIndex);
    onSetCustomStringOrder(next);
  };

  const handleDropOnOrderContainer = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const payload = readOrderDragPayload(event);
    clearOrderDrag();
    if (!payload) {
      return;
    }
    if (payload.kind === 'palette') {
      onSetCustomStringOrder([...customStringOrder, payload.stringIndex]);
      return;
    }
    const { fromIndex } = payload;
    if (fromIndex < 0 || fromIndex >= customStringOrder.length - 1) {
      return;
    }
    const next = [...customStringOrder];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) {
      return;
    }
    next.push(moved);
    onSetCustomStringOrder(next);
  };

  const hasOverrides = Object.keys(stringOverrides).length > 0;
  const variationLabel = detectVariationChordLabel(
    effectiveFrets,
    activeChord.symbol,
  );
  const maskedFrets = applyCustomStringMask(effectiveFrets, customStringMask);
  const activeCustomCount = customStringMask.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Step A: Finger Pressure Variation */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-(--st-border) pb-3">
          <div className="flex items-start gap-2">
            <Sliders
              className="mt-0.5 h-4 w-4 shrink-0 text-(--st-accent)"
              aria-hidden="true"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-(--st-text)">
                  1. Ubah Tekanan Jari (Variasi Chord)
                </h2>
                <span
                  data-testid="variation-detected-label"
                  className="rounded-md bg-(--st-accent-soft) px-2 py-0.5 font-mono text-[11px] font-bold text-(--st-accent)"
                >
                  {variationLabel} ({formatFretsCompact(effectiveFrets)})
                </span>
              </div>
              <p className="mt-0.5 text-xs text-(--st-text-muted)">
                Klik <strong>Lepas (0)</strong> untuk melepas jari agar senar
                berbunyi terbuka (contoh: di kunci <strong>C</strong>, lepas
                Senar 2 jadi <strong>Cmaj7</strong>), atau klik{' '}
                <strong>Matikan</strong> agar senar tidak ikut berbunyi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {activeChord.id === 'c-major' && stringOverrides[4] !== 0 ? (
              <button
                type="button"
                onClick={() => onSetStringOverride(4, 0)}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-(--st-accent)/50 bg-(--st-accent-soft) px-2.5 py-1 text-xs font-semibold text-(--st-accent) hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Coba: Lepas Senar 2 (Jadi Cmaj7)</span>
              </button>
            ) : null}

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
        </div>

        {/* 6 String Variation Cards */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STRING_INFO.map((str) => {
            const baseFret = activeChord.frets[str.index]!;
            const currentFret = effectiveFrets[str.index]!;
            const isOverridden = stringOverrides[str.index] !== undefined;
            const isOpen = currentFret === 0;
            const isMuted = currentFret < 0;

            return (
              <div
                key={str.number}
                className={`flex flex-col justify-between rounded-xl border p-2.5 transition-colors ${
                  isOverridden
                    ? 'border-(--st-accent) bg-(--st-accent-soft)/35'
                    : 'border-(--st-border) bg-(--st-surface-elevated)'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-(--st-text)">
                    Senar {str.number}
                  </div>
                  <div className="text-[10px] text-(--st-text-muted)">
                    Nada dasar {str.name}
                  </div>
                </div>

                <div className="my-2 rounded-lg bg-(--st-surface) px-2 py-1.5 text-center">
                  <div className="text-xs font-bold text-(--st-text)">
                    {isMuted
                      ? 'Mati (✕)'
                      : isOpen
                        ? `Lepas · ${formatFretNoteName(str.index, 0)}`
                        : `Fret ${currentFret} · ${formatFretNoteName(str.index, currentFret)}`}
                  </div>
                  {isOverridden ? (
                    <div className="text-[10px] text-(--st-accent)">
                      Asli:{' '}
                      {baseFret < 0
                        ? 'Mati'
                        : baseFret === 0
                          ? 'Lepas'
                          : `Fret ${baseFret}`}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1">
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
                    title="Matikan senar agar tidak berbunyi"
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
      </Card>

      {/* Step B: Play by Custom String */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--st-border) pb-3">
          <div>
            <h2 className="text-sm font-semibold text-(--st-text)">
              2. Mainkan Senar Pilihan (Play by Custom String)
            </h2>
            <p className="text-xs text-(--st-text-muted)">
              Pilih senar mana saja yang ingin dibunyikan dan tentukan urutan
              petikannya ({activeCustomCount}/6 senar aktif)
            </p>
          </div>
          <span className="font-mono text-xs text-(--st-text-muted)">
            Aktif: {formatFretsCompact(maskedFrets)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Select Which Strings Sound */}
          <div className="flex flex-col gap-2.5 lg:col-span-5">
            <span className="text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
              Pilih Senar yang Berbunyi
            </span>

            <div className="grid grid-cols-3 gap-1.5">
              {STRING_INFO.map((str) => {
                const isCustomEnabled = customStringMask[str.index]!;
                return (
                  <button
                    key={str.number}
                    type="button"
                    aria-pressed={isCustomEnabled}
                    aria-label={`Aktifkan Senar ${str.number} (${str.name.charAt(0)}) untuk Custom String`}
                    onClick={() => onToggleCustomString(str.index)}
                    className={`min-h-9 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${
                      isCustomEnabled
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                        : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) line-through'
                    }`}
                  >
                    Senar {str.number} ({str.name.charAt(0)})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_STRING_MASK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    onSetCustomStringMask([...preset.mask] as StringMask)
                  }
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
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-(--st-accent) px-3 py-1.5 text-xs font-semibold text-(--st-accent-text) hover:opacity-95"
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
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-(--st-border-strong) bg-(--st-surface-elevated) px-3 py-1.5 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
              >
                <Music className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Petik Urutan Senar</span>
                <kbd className="rounded bg-(--st-surface) px-1.5 py-0.5 font-mono text-[10px] text-(--st-accent)">
                  {formatKeyBadge(keyMap.bindings['pick-custom-string'])}
                </kbd>
              </button>
            </div>
          </div>

          {/* Custom String Picking Order */}
          <div className="flex flex-col gap-2.5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
                Urutan Petikan (Seret untuk urutkan, atau klik untuk hapus)
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

            <div
              role="list"
              aria-label="Custom string picking order"
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverOrderList(true);
              }}
              onDragLeave={() => setDragOverOrderList(false)}
              onDrop={handleDropOnOrderContainer}
              className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border px-3 py-2 transition-all ${
                dragOverOrderList && dragOverOrderIdx === null
                  ? 'border-(--st-accent) bg-(--st-accent-soft)/25 ring-2 ring-(--st-accent)/60'
                  : 'border-(--st-border) bg-(--st-surface-elevated)'
              }`}
            >
              {customStringOrder.length === 0 ? (
                <span className="text-xs text-(--st-text-muted)">
                  Klik atau seret tombol +Senar di bawah ke kotak ini
                </span>
              ) : (
                customStringOrder.map((stringIdx, stepIdx) => {
                  const isEnabled =
                    customStringMask[stringIdx] &&
                    effectiveFrets[stringIdx]! >= 0;
                  const isDropTarget = dragOverOrderIdx === stepIdx;
                  return (
                    <button
                      key={`${stringIdx}-${stepIdx}`}
                      type="button"
                      role="listitem"
                      draggable
                      title="Seret untuk pindah posisi, atau klik untuk hapus"
                      onDragStart={(event) =>
                        startOrderDrag(event, {
                          kind: 'reorder',
                          fromIndex: stepIdx,
                        })
                      }
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragOverOrderIdx(stepIdx);
                      }}
                      onDragLeave={() =>
                        setDragOverOrderIdx((prev) =>
                          prev === stepIdx ? null : prev,
                        )
                      }
                      onDrop={(event) => handleDropOnOrderChip(event, stepIdx)}
                      onDragEnd={clearOrderDrag}
                      onClick={() =>
                        onSetCustomStringOrder(
                          customStringOrder.filter((_, idx) => idx !== stepIdx),
                        )
                      }
                      className={`inline-flex cursor-grab items-center gap-1 rounded-lg px-2 py-1 font-mono text-xs font-bold transition-all active:cursor-grabbing ${
                        isEnabled
                          ? 'bg-(--st-accent-soft) text-(--st-accent) ring-1 ring-(--st-accent)/40'
                          : 'bg-(--st-surface) text-(--st-text-muted) line-through'
                      } ${isDropTarget ? 'ring-2 ring-(--st-accent)' : ''}`}
                    >
                      <GripVertical
                        className="h-3 w-3 shrink-0 opacity-50"
                        aria-hidden="true"
                      />
                      <span>Senar {6 - stringIdx}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {STRING_INFO.map((str) => (
                  <button
                    key={str.number}
                    type="button"
                    draggable
                    title="Klik untuk tambah, atau seret ke kotak Urutan Petikan"
                    aria-label={`Tambah Senar ${str.number} ke urutan petik`}
                    onDragStart={(event) =>
                      startOrderDrag(event, {
                        kind: 'palette',
                        stringIndex: str.index,
                      })
                    }
                    onDragEnd={clearOrderDrag}
                    onClick={() =>
                      onSetCustomStringOrder([...customStringOrder, str.index])
                    }
                    className="min-h-8 cursor-grab rounded-lg border border-(--st-border) bg-(--st-surface) px-2.5 py-1 font-mono text-xs font-bold text-(--st-text) hover:border-(--st-accent) active:cursor-grabbing"
                  >
                    +S{str.number}
                  </button>
                ))}
              </div>

              {customStringOrder.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSetCustomStringOrder([])}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-(--st-border) bg-(--st-surface) px-2.5 py-1 text-xs font-semibold text-(--st-text-muted) hover:text-(--st-danger)"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  <span>Kosongkan</span>
                </button>
              ) : null}
            </div>

            {onAssignCustomStringToSlot && activeSlotLabel ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  aria-pressed={isStringOrderAssignedToSlot}
                  onClick={onAssignCustomStringToSlot}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    isStringOrderAssignedToSlot
                      ? 'border-purple-400/70 bg-purple-500/15 text-purple-300'
                      : 'border-(--st-border) bg-(--st-surface) text-(--st-text) hover:border-purple-400/60'
                  }`}
                >
                  <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {isStringOrderAssignedToSlot
                      ? `Urutan Petik Terpasang di ${activeSlotLabel} ✓`
                      : `Assign Urutan Petik ke ${activeSlotLabel}`}
                  </span>
                </button>
                {isStringOrderAssignedToSlot && onClearSlotAssignment ? (
                  <button
                    type="button"
                    aria-label={`Lepas urutan petik khusus dari ${activeSlotLabel}`}
                    onClick={onClearSlotAssignment}
                    className="inline-flex min-h-8 items-center justify-center rounded-lg border border-(--st-border) bg-(--st-surface) px-2 text-(--st-text-muted) hover:text-(--st-danger)"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
