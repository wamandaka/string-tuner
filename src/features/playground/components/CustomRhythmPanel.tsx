import { useRef, useState, type DragEvent } from 'react';
import { GripVertical, Music, Pin, Play, Trash2, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import type { CustomRhythmStep } from '../../../engines/audio/ChordPreviewSynth';
import {
  CUSTOM_RHYTHM_PRESETS,
  type PlaygroundKeyMap,
} from '../playground.types';
import {
  calculateMinimumBeatsForPattern,
  getRhythmStepMsForBpm,
} from '../playgroundChordUtils';
import { formatKeyBadge } from '../playgroundKeymapStorage';

interface CustomRhythmPanelProps {
  steps: readonly CustomRhythmStep[];
  isActivePattern: boolean;
  bpm: number;
  keyMap: PlaygroundKeyMap;
  activeSlotLabel?: string;
  isAssignedToActiveSlot?: boolean;
  onChangeSteps: (next: CustomRhythmStep[]) => void;
  onSelectPreset: (steps: readonly CustomRhythmStep[]) => void;
  onPlayCustomRhythm: () => void;
  onUseAsAutoPattern: () => void;
  onAssignToActiveSlot?: () => void;
  onClearSlotAssignment?: () => void;
  onDragAssignStart?: (steps: CustomRhythmStep[]) => void;
  onDragAssignEnd?: () => void;
}

function formatStepBadge(step: CustomRhythmStep): {
  symbol: string;
  subLabel: string;
  colorClass: string;
} {
  switch (step.kind) {
    case 'strum-down':
      return {
        symbol: '↓',
        subLabel: 'Turun',
        colorClass:
          'border-amber-500/60 bg-amber-500/15 text-amber-300',
      };
    case 'strum-up':
      return {
        symbol: '↑',
        subLabel: 'Naik',
        colorClass:
          'border-sky-500/60 bg-sky-500/15 text-sky-300',
      };
    case 'chuck':
      return {
        symbol: '×',
        subLabel: 'Mute',
        colorClass:
          'border-rose-500/60 bg-rose-500/15 text-rose-300',
      };
    case 'rest':
      return {
        symbol: '—',
        subLabel: 'Jeda',
        colorClass:
          'border-(--st-border) bg-(--st-surface) text-(--st-text-muted)',
      };
    case 'pluck-bass':
      return {
        symbol: 'Bass',
        subLabel: 'Petik',
        colorClass:
          'border-emerald-500/60 bg-emerald-500/15 text-emerald-300',
      };
    case 'pluck':
      return {
        symbol: `S${6 - step.stringIndex}`,
        subLabel: 'Petik',
        colorClass:
          'border-purple-500/60 bg-purple-500/15 text-purple-300',
      };
  }
}

type RhythmDragPayload =
  | { kind: 'reorder'; fromIndex: number }
  | { kind: 'palette'; step: CustomRhythmStep };

export function CustomRhythmPanel({
  steps,
  isActivePattern,
  bpm,
  keyMap,
  activeSlotLabel,
  isAssignedToActiveSlot = false,
  onChangeSteps,
  onSelectPreset,
  onPlayCustomRhythm,
  onUseAsAutoPattern,
  onAssignToActiveSlot,
  onClearSlotAssignment,
  onDragAssignStart,
  onDragAssignEnd,
}: CustomRhythmPanelProps) {
  const stepMs = getRhythmStepMsForBpm(bpm);
  const patternDurationMs = steps.length * stepMs;
  const recommendedBeats = calculateMinimumBeatsForPattern(
    patternDurationMs,
    bpm,
  );
  const dragPayloadRef = useRef<RhythmDragPayload | null>(null);
  const [dragOverStepIdx, setDragOverStepIdx] = useState<number | null>(null);
  const [dragOverList, setDragOverList] = useState(false);

  const startDrag = (
    event: DragEvent<HTMLElement>,
    payload: RhythmDragPayload,
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

  const readDragPayload = (
    event: DragEvent<HTMLElement>,
  ): RhythmDragPayload | null => {
    if (dragPayloadRef.current) {
      return dragPayloadRef.current;
    }
    try {
      const raw = event.dataTransfer?.getData('application/json');
      if (raw) {
        return JSON.parse(raw) as RhythmDragPayload;
      }
    } catch {
      // Ignore invalid drag data
    }
    return null;
  };

  const clearDragState = () => {
    dragPayloadRef.current = null;
    setDragOverStepIdx(null);
    setDragOverList(false);
  };

  const handleDropOnStep = (
    event: DragEvent<HTMLElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event);
    clearDragState();
    if (!payload) {
      return;
    }
    if (payload.kind === 'reorder') {
      const { fromIndex } = payload;
      if (
        fromIndex === targetIndex ||
        fromIndex < 0 ||
        fromIndex >= steps.length
      ) {
        return;
      }
      const next = [...steps];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return;
      }
      next.splice(targetIndex, 0, moved);
      onChangeSteps(next);
      return;
    }
    const next = [...steps];
    next.splice(targetIndex, 0, payload.step);
    onChangeSteps(next);
  };

  const handleDropOnList = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const payload = readDragPayload(event);
    clearDragState();
    if (!payload) {
      return;
    }
    if (payload.kind === 'palette') {
      onChangeSteps([...steps, payload.step]);
      return;
    }
    const { fromIndex } = payload;
    if (fromIndex < 0 || fromIndex >= steps.length - 1) {
      return;
    }
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    next.push(moved);
    onChangeSteps(next);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--st-border) pb-3">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-(--st-accent)" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-(--st-text)">
              Custom Pola Genjreng &amp; Petik (Strum / Petik Rhythm)
            </h2>
            <p className="text-xs text-(--st-text-muted)">
              Pilih irama populer atau susun sendiri pola genjreng (↓ ↑ × —)
              dan petikan senar Anda ({bpm} BPM · Durasi pola{' '}
              {(patternDurationMs / 1000).toFixed(2)} dtk ≈ {recommendedBeats}{' '}
              ketukan)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAssignToActiveSlot && activeSlotLabel ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-pressed={isAssignedToActiveSlot}
                onClick={onAssignToActiveSlot}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isAssignedToActiveSlot
                    ? 'border-purple-400/70 bg-purple-500/15 text-purple-300'
                    : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text) hover:border-purple-400/60'
                }`}
              >
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {isAssignedToActiveSlot
                    ? `Terpasang di ${activeSlotLabel} ✓`
                    : `Assign ke ${activeSlotLabel}`}
                </span>
              </button>

              {isAssignedToActiveSlot && onClearSlotAssignment ? (
                <button
                  type="button"
                  title={`Lepas pola khusus dari ${activeSlotLabel}`}
                  aria-label={`Lepas pola khusus dari ${activeSlotLabel}`}
                  onClick={onClearSlotAssignment}
                  className="inline-flex min-h-9 items-center justify-center rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-2 text-(--st-text-muted) hover:text-(--st-danger)"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}

              {onDragAssignStart ? (
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  title="Seret lalu lepas ke kartu slot chord mana saja di atas"
                  aria-label="Seret pola custom ke slot chord"
                  onDragStart={(event) => {
                    onDragAssignStart([...steps]);
                    try {
                      if (event.dataTransfer) {
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData(
                          'application/x-stringtuner-rhythm',
                          JSON.stringify(steps),
                        );
                      }
                    } catch {
                      // Ignore synthetic jsdom dataTransfer restrictions
                    }
                  }}
                  onDragEnd={() => onDragAssignEnd?.()}
                  className="inline-flex min-h-9 cursor-grab items-center gap-1 rounded-xl border border-dashed border-purple-400/50 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/20 active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Seret ke Slot</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            aria-pressed={isActivePattern}
            onClick={onUseAsAutoPattern}
            className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActivePattern
                ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:text-(--st-text)'
            }`}
          >
            {isActivePattern
              ? 'Dipakai untuk Putar Otomatis ✓'
              : 'Pakai untuk Putar Otomatis'}
          </button>

          <button
            type="button"
            onClick={onPlayCustomRhythm}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-(--st-accent) px-3.5 py-1.5 text-xs font-semibold text-(--st-accent-text) hover:opacity-95"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mainkan Custom Pola</span>
            <kbd className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px]">
              {formatKeyBadge(keyMap.bindings['play-custom-rhythm'])}
            </kbd>
          </button>
        </div>
      </div>

      {/* Popular Strumming / Picking Presets */}
      <div className="mt-3">
        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
          Pilih Cepat Pola Populer (1 Klik Langsung Bunyi)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_RHYTHM_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.steps)}
              className="inline-flex min-h-9 flex-col items-start rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-1.5 text-left transition-colors hover:border-(--st-accent) hover:bg-(--st-accent-soft)/40"
            >
              <span className="text-xs font-bold text-(--st-text)">
                {preset.label}
              </span>
              <span className="font-mono text-[10px] text-(--st-accent)">
                {preset.notation}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Rhythm Steps Sequence */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
            Urutan Pola Anda (Seret untuk urutkan, atau klik untuk hapus)
          </span>
          {steps.length > 0 ? (
            <button
              type="button"
              onClick={() => onChangeSteps([])}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-(--st-text-muted) hover:text-(--st-danger)"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              <span>Kosongkan</span>
            </button>
          ) : null}
        </div>

        <div
          role="list"
          aria-label="Custom strum and picking sequence"
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverList(true);
          }}
          onDragLeave={() => setDragOverList(false)}
          onDrop={handleDropOnList}
          className={`flex min-h-14 flex-wrap items-center gap-1.5 rounded-xl border p-2.5 transition-all ${
            dragOverList && dragOverStepIdx === null
              ? 'border-(--st-accent) bg-(--st-accent-soft)/25 ring-2 ring-(--st-accent)/60'
              : 'border-(--st-border) bg-(--st-surface-elevated)'
          }`}
        >
          {steps.length === 0 ? (
            <span className="text-xs text-(--st-text-muted)">
              Belum ada langkah. Klik atau seret tombol + ↓ Turun, + ↑ Naik,
              atau + Petik di bawah ke kotak ini.
            </span>
          ) : (
            steps.map((step, idx) => {
              const badge = formatStepBadge(step);
              const isDropTarget = dragOverStepIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="listitem"
                  draggable
                  title="Seret untuk pindah posisi, atau klik untuk hapus"
                  aria-label={`Hapus langkah ${idx + 1}: ${badge.symbol} ${badge.subLabel}`}
                  onDragStart={(event) =>
                    startDrag(event, { kind: 'reorder', fromIndex: idx })
                  }
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragOverStepIdx(idx);
                  }}
                  onDragLeave={() =>
                    setDragOverStepIdx((prev) => (prev === idx ? null : prev))
                  }
                  onDrop={(event) => handleDropOnStep(event, idx)}
                  onDragEnd={clearDragState}
                  onClick={() =>
                    onChangeSteps(steps.filter((_, i) => i !== idx))
                  }
                  className={`flex min-w-12 cursor-grab items-center gap-1 rounded-lg border px-2 py-1 transition-all hover:scale-95 active:cursor-grabbing ${badge.colorClass} ${
                    isDropTarget ? 'ring-2 ring-(--st-accent)' : ''
                  }`}
                >
                  <GripVertical
                    className="h-3 w-3 shrink-0 opacity-50"
                    aria-hidden="true"
                  />
                  <span className="flex flex-col items-center justify-center">
                    <span className="font-mono text-sm leading-tight font-extrabold">
                      {badge.symbol}
                    </span>
                    <span className="text-[9px] font-semibold opacity-85">
                      {badge.subLabel}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Add Strum or Pluck Step Buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          draggable
          title="Klik untuk tambah, atau seret ke urutan pola di atas"
          onDragStart={(event) =>
            startDrag(event, { kind: 'palette', step: { kind: 'strum-down' } })
          }
          onDragEnd={clearDragState}
          onClick={() => onChangeSteps([...steps, { kind: 'strum-down' }])}
          className="min-h-8 cursor-grab rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20 active:cursor-grabbing"
        >
          + ↓ Turun
        </button>
        <button
          type="button"
          draggable
          title="Klik untuk tambah, atau seret ke urutan pola di atas"
          onDragStart={(event) =>
            startDrag(event, { kind: 'palette', step: { kind: 'strum-up' } })
          }
          onDragEnd={clearDragState}
          onClick={() => onChangeSteps([...steps, { kind: 'strum-up' }])}
          className="min-h-8 cursor-grab rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300 hover:bg-sky-500/20 active:cursor-grabbing"
        >
          + ↑ Naik
        </button>
        <button
          type="button"
          draggable
          title="Klik untuk tambah, atau seret ke urutan pola di atas"
          onDragStart={(event) =>
            startDrag(event, { kind: 'palette', step: { kind: 'chuck' } })
          }
          onDragEnd={clearDragState}
          onClick={() => onChangeSteps([...steps, { kind: 'chuck' }])}
          className="min-h-8 cursor-grab rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20 active:cursor-grabbing"
        >
          + × Mute (Chuck)
        </button>
        <button
          type="button"
          draggable
          title="Klik untuk tambah, atau seret ke urutan pola di atas"
          onDragStart={(event) =>
            startDrag(event, { kind: 'palette', step: { kind: 'rest' } })
          }
          onDragEnd={clearDragState}
          onClick={() => onChangeSteps([...steps, { kind: 'rest' }])}
          className="min-h-8 cursor-grab rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1 text-xs font-bold text-(--st-text-muted) hover:text-(--st-text) active:cursor-grabbing"
        >
          + — Jeda
        </button>
        <button
          type="button"
          draggable
          title="Klik untuk tambah, atau seret ke urutan pola di atas"
          onDragStart={(event) =>
            startDrag(event, { kind: 'palette', step: { kind: 'pluck-bass' } })
          }
          onDragEnd={clearDragState}
          onClick={() => onChangeSteps([...steps, { kind: 'pluck-bass' }])}
          className="min-h-8 cursor-grab rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 active:cursor-grabbing"
        >
          + Petik Bass
        </button>

        <span className="mx-1 text-[11px] text-(--st-text-muted)">|</span>

        {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
          <button
            key={stringIndex}
            type="button"
            draggable
            title="Klik untuk tambah, atau seret ke urutan pola di atas"
            aria-label={`Tambah langkah Petik Senar ${6 - stringIndex}`}
            onDragStart={(event) =>
              startDrag(event, {
                kind: 'palette',
                step: { kind: 'pluck', stringIndex },
              })
            }
            onDragEnd={clearDragState}
            onClick={() =>
              onChangeSteps([...steps, { kind: 'pluck', stringIndex }])
            }
            className="min-h-8 cursor-grab rounded-lg border border-(--st-border) bg-(--st-surface) px-2 py-1 font-mono text-xs font-bold text-(--st-text) hover:border-purple-400 hover:text-purple-300 active:cursor-grabbing"
          >
            +S{6 - stringIndex}
          </button>
        ))}
      </div>
    </Card>
  );
}

