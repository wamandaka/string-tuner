import { useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Pin,
  RotateCcw,
  Square,
} from 'lucide-react';
import { STANDARD_OPEN_MIDI } from '../../../engines/audio/ChordPreviewSynth';
import { NOTE_NAMES } from '../../../engines/pitch/NoteMapper';
import type { ChordDefinition } from '../../chords/chords.types';
import {
  STRING_1_MELODY_KEYS,
  STRING_2_MELODY_KEYS,
  type PlaygroundKeyMap,
  type RemappableActionId,
} from '../playground.types';
import { formatKeyBadge } from '../playgroundKeymapStorage';

interface GuitarNeckStageProps {
  activeChord: ChordDefinition;
  effectiveFrets: readonly [number, number, number, number, number, number];
  pinnedFrets: Record<number, number>;
  pinFretMode: boolean;
  onTogglePinFretMode: () => void;
  onClearPinnedFrets: () => void;
  progressionChords: readonly ChordDefinition[];
  activeSlotIndex: number;
  onSelectSlot: (index: number) => void;
  onPlayFret: (stringIndex: number, fret: number) => void;
  onPluckChordString: (stringIndex: number) => void;
  onStrumDown: () => void;
  onStrumUp: () => void;
  onMute: () => void;
  vibratingStrings: Record<number, boolean>;
  activePlayedNote: {
    stringIndex: number;
    fret: number;
    noteName: string;
  } | null;
  keyMap: PlaygroundKeyMap;
}

const FRET_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const INLAY_FRETS = new Set([3, 5, 7, 9]);

const STRING_ROWS = [
  {
    index: 0,
    stringNumber: 6,
    label: 'E',
    actionId: 'string-6' as RemappableActionId,
    pickClass: 'bg-rose-600 border-rose-300 text-white',
    dotClass: 'bg-rose-500 text-white',
    thicknessClass: 'h-[3px]',
  },
  {
    index: 1,
    stringNumber: 5,
    label: 'A',
    actionId: 'string-5' as RemappableActionId,
    pickClass: 'bg-amber-600 border-amber-300 text-white',
    dotClass: 'bg-amber-500 text-zinc-950',
    thicknessClass: 'h-[2.5px]',
  },
  {
    index: 2,
    stringNumber: 4,
    label: 'D',
    actionId: 'string-4' as RemappableActionId,
    pickClass: 'bg-emerald-600 border-emerald-300 text-white',
    dotClass: 'bg-emerald-500 text-zinc-950',
    thicknessClass: 'h-[2px]',
  },
  {
    index: 3,
    stringNumber: 3,
    label: 'G',
    actionId: 'string-3' as RemappableActionId,
    pickClass: 'bg-sky-600 border-sky-300 text-white',
    dotClass: 'bg-sky-400 text-zinc-950',
    thicknessClass: 'h-[1.75px]',
  },
  {
    index: 4,
    stringNumber: 2,
    label: 'B',
    actionId: 'string-2' as RemappableActionId,
    pickClass: 'bg-indigo-600 border-indigo-300 text-white',
    dotClass: 'bg-indigo-400 text-zinc-950',
    thicknessClass: 'h-[1.5px]',
  },
  {
    index: 5,
    stringNumber: 1,
    label: 'e',
    actionId: 'string-1' as RemappableActionId,
    pickClass: 'bg-purple-600 border-purple-300 text-white',
    dotClass: 'bg-purple-400 text-zinc-950',
    thicknessClass: 'h-[1.25px]',
  },
] as const;

function getNoteName(stringIndex: number, fret: number): string {
  const midi = STANDARD_OPEN_MIDI[stringIndex]! + fret;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function GuitarNeckStage({
  activeChord,
  effectiveFrets,
  pinnedFrets,
  pinFretMode,
  onTogglePinFretMode,
  onClearPinnedFrets,
  progressionChords,
  activeSlotIndex,
  onSelectSlot,
  onPlayFret,
  onPluckChordString,
  onStrumDown,
  onStrumUp,
  onMute,
  vibratingStrings,
  activePlayedNote,
  keyMap,
}: GuitarNeckStageProps) {
  const isSweepingPicksRef = useRef(false);
  const lastPickStringRef = useRef<number | null>(null);
  const isSweepingNeckRef = useRef(false);
  const lastNeckCellRef = useRef<string | null>(null);

  const hasPinnedFrets = Object.keys(pinnedFrets).length > 0;

  const customKeyByCell = new Map<string, string>();
  for (const binding of keyMap.customFretBindings) {
    customKeyByCell.set(
      `${binding.stringIndex}:${binding.fret}`,
      formatKeyBadge(binding.key),
    );
  }

  const getCellHintKey = (stringIndex: number, fret: number): string | null => {
    const custom = customKeyByCell.get(`${stringIndex}:${fret}`);
    if (custom) return custom;
    if (!keyMap.enableFretMelodyKeys || fret > 9) return null;
    if (stringIndex === 5) {
      return formatKeyBadge(STRING_1_MELODY_KEYS[fret]!);
    }
    if (stringIndex === 4) {
      return formatKeyBadge(STRING_2_MELODY_KEYS[fret]!);
    }
    return null;
  };

  return (
    <div
      className="rounded-2xl border border-amber-900/40 bg-gradient-to-b from-stone-900 via-stone-950 to-zinc-950 p-3 text-stone-100 shadow-lg sm:p-4"
      onPointerUp={() => {
        isSweepingPicksRef.current = false;
        lastPickStringRef.current = null;
        isSweepingNeckRef.current = false;
        lastNeckCellRef.current = null;
      }}
      onPointerCancel={() => {
        isSweepingPicksRef.current = false;
        lastPickStringRef.current = null;
        isSweepingNeckRef.current = false;
        lastNeckCellRef.current = null;
      }}
    >
      {/* Stage Top Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-bold tracking-wide text-amber-300">
            Real Guitar Fretboard · Fingerstyle
          </span>
          {activePlayedNote ? (
            <span
              data-testid="active-played-note"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300"
            >
              {activePlayedNote.noteName} · Senar {6 - activePlayedNote.stringIndex}{' '}
              {activePlayedNote.fret === 0
                ? 'Open'
                : `Fret ${activePlayedNote.fret}`}
            </span>
          ) : (
            <span className="text-xs text-stone-400">
              Klik/geser pada fret 0–12 untuk main melodi, atau petik pick di
              lubang gitar
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={pinFretMode}
            onClick={onTogglePinFretMode}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              pinFretMode
                ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                : 'border-stone-700 bg-stone-800/80 text-stone-300 hover:border-stone-500'
            }`}
          >
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {pinFretMode ? 'Pin Fret: ON' : 'Pin Fret (Fingerstyle)'}
            </span>
          </button>

          {hasPinnedFrets ? (
            <button
              type="button"
              onClick={onClearPinnedFrets}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-stone-700 bg-stone-800/80 px-2.5 py-1 text-xs font-semibold text-stone-300 hover:border-stone-500 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset Pin</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Scrollable Acoustic Guitar Body + 12-Fret Neck */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[760px] rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-stone-900 p-2.5">
          {/* Fret Number Header */}
          <div className="mb-1 flex items-center">
            <div className="w-[210px] shrink-0 pl-2 text-[10px] font-semibold tracking-wider text-amber-300/80 uppercase">
              Soundhole &amp; Pick ({activeChord.symbol})
            </div>
            <div className="grid flex-1 grid-cols-13 text-center text-[10px] font-bold text-stone-300">
              {FRET_NUMBERS.map((fret) => (
                <div
                  key={fret}
                  className={`py-0.5 ${
                    fret === 0
                      ? 'text-amber-300'
                      : INLAY_FRETS.has(fret) || fret === 12
                        ? 'text-amber-200'
                        : 'text-stone-400'
                  }`}
                >
                  {fret === 0 ? 'Open' : fret}
                </div>
              ))}
            </div>
          </div>

          {/* Guitar Body + Fretboard Rows */}
          <div className="relative flex overflow-hidden rounded-xl border border-amber-700/40 bg-gradient-to-r from-[#5c3618] via-[#3e2412] to-[#271810] shadow-inner">
            {/* Decorative Acoustic Soundhole Rosette */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-[118px] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-amber-500/35 bg-stone-950/90 ring-4 ring-amber-300/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-[118px] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/25"
            />

            {/* Left Strum Controls + Soundhole Pick Column */}
            <div className="relative z-10 flex w-[210px] shrink-0 items-stretch border-r-4 border-stone-200/80">
              {/* Quick Strum/Mute Pads (Left Edge) */}
              <div className="flex w-16 shrink-0 flex-col justify-between gap-1 border-r border-amber-900/50 bg-stone-950/55 p-1.5">
                <button
                  type="button"
                  onClick={onStrumDown}
                  title={`Strum Down (${formatKeyBadge(keyMap.bindings['strum-down'])})`}
                  className="flex flex-1 flex-col items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/20 px-1 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Strum</span>
                  <kbd className="mt-0.5 rounded bg-black/40 px-1 text-[9px] text-amber-300">
                    {formatKeyBadge(keyMap.bindings['strum-down'])}
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={onStrumUp}
                  title={`Strum Up (${formatKeyBadge(keyMap.bindings['strum-up'])})`}
                  className="flex flex-1 flex-col items-center justify-center rounded-lg border border-stone-600/70 bg-stone-800/70 px-1 py-1 text-[10px] font-bold text-stone-200 hover:border-amber-400"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Up</span>
                  <kbd className="mt-0.5 rounded bg-black/40 px-1 text-[9px] text-stone-300">
                    {formatKeyBadge(keyMap.bindings['strum-up'])}
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={onMute}
                  title={`Mute (${formatKeyBadge(keyMap.bindings.mute)})`}
                  className="flex items-center justify-center gap-1 rounded-lg border border-stone-700 bg-stone-900/90 px-1 py-1.5 text-[10px] font-bold text-stone-300 hover:border-rose-400 hover:text-rose-200"
                >
                  <Square className="h-2.5 w-2.5" aria-hidden="true" />
                  <span>{formatKeyBadge(keyMap.bindings.mute)}</span>
                </button>
              </div>

              {/* Soundhole 6 Pick Buttons */}
              <div className="flex flex-1 flex-col justify-around py-1">
                {STRING_ROWS.map((row) => {
                  const fret = effectiveFrets[row.index]!;
                  const isMuted = fret < 0;
                  const noteLabel = isMuted
                    ? '✕'
                    : getNoteName(row.index, fret);
                  const isVibrating = Boolean(vibratingStrings[row.index]);
                  const shortcutKey = formatKeyBadge(
                    keyMap.bindings[row.actionId],
                  );

                  return (
                    <div
                      key={row.stringNumber}
                      className="relative flex h-9 items-center justify-center px-2"
                    >
                      {/* String across soundhole */}
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all ${row.thicknessClass} ${
                          isMuted
                            ? 'bg-stone-500/30'
                            : isVibrating
                              ? 'scale-y-150 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]'
                              : 'bg-stone-300/75'
                        }`}
                      />

                      <button
                        type="button"
                        disabled={isMuted}
                        aria-label={
                          isMuted
                            ? `Pick Senar ${row.stringNumber} (${row.label}): Muted`
                            : `Pick Senar ${row.stringNumber} (${row.label}), ${noteLabel}, key ${shortcutKey}`
                        }
                        onPointerDown={() => {
                          if (isMuted) return;
                          isSweepingPicksRef.current = true;
                          lastPickStringRef.current = row.index;
                          onPluckChordString(row.index);
                        }}
                        onPointerEnter={() => {
                          if (
                            isMuted ||
                            !isSweepingPicksRef.current ||
                            lastPickStringRef.current === row.index
                          ) {
                            return;
                          }
                          lastPickStringRef.current = row.index;
                          onPluckChordString(row.index);
                        }}
                        onClick={(event) => {
                          // Keyboard Enter/Space trigger click without pointerDown
                          if (event.detail === 0 && !isMuted) {
                            onPluckChordString(row.index);
                          }
                        }}
                        className={`relative z-10 inline-flex h-7 min-w-[92px] items-center justify-between gap-1 rounded-full border px-2 text-[11px] font-bold shadow transition-transform ${
                          isMuted
                            ? 'cursor-not-allowed border-stone-700 bg-stone-900/80 text-stone-500'
                            : isVibrating
                              ? `${row.pickClass} scale-105`
                              : `${row.pickClass} opacity-95 hover:scale-105`
                        }`}
                      >
                        <span className="font-mono text-[10px] opacity-85">
                          {shortcutKey}
                        </span>
                        <span>{noteLabel}</span>
                        <span className="text-[9px] opacity-80">
                          S{row.stringNumber}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 12-Fret Rosewood Fretboard */}
            <div className="relative z-10 flex-1 select-none">
              {/* Pearl Inlay Markers */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 grid grid-cols-13"
              >
                {FRET_NUMBERS.map((fret) => (
                  <div
                    key={fret}
                    className="flex flex-col items-center justify-center gap-12"
                  >
                    {INLAY_FRETS.has(fret) ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-100/20" />
                    ) : fret === 12 ? (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-100/25" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-100/25" />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex flex-col justify-around py-1">
                {STRING_ROWS.map((row) => {
                  const activeFret = effectiveFrets[row.index]!;
                  const isPinned = pinnedFrets[row.index] !== undefined;
                  const fingerNum = activeChord.fingers[row.index]!;
                  const isVibrating = Boolean(vibratingStrings[row.index]);

                  return (
                    <div
                      key={row.stringNumber}
                      className="relative grid h-9 grid-cols-13 items-center"
                    >
                      {/* Continuous String Wire across Fretboard */}
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all ${row.thicknessClass} ${
                          isVibrating
                            ? 'scale-y-150 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]'
                            : 'bg-stone-300/70'
                        }`}
                      />

                      {FRET_NUMBERS.map((fret) => {
                        const cellId = `${row.index}:${fret}`;
                        const noteLabel = getNoteName(row.index, fret);
                        const isChordDot = activeFret === fret;
                        const isMutedNut = fret === 0 && activeFret < 0;
                        const isJustPlayed =
                          activePlayedNote?.stringIndex === row.index &&
                          activePlayedNote?.fret === fret;
                        const hintKey = getCellHintKey(row.index, fret);

                        return (
                          <button
                            key={fret}
                            type="button"
                            aria-label={`Fretboard Senar ${row.stringNumber} Fret ${fret} (${noteLabel})`}
                            onPointerDown={() => {
                              isSweepingNeckRef.current = true;
                              lastNeckCellRef.current = cellId;
                              onPlayFret(row.index, fret);
                            }}
                            onPointerEnter={() => {
                              if (
                                !isSweepingNeckRef.current ||
                                lastNeckCellRef.current === cellId
                              ) {
                                return;
                              }
                              lastNeckCellRef.current = cellId;
                              onPlayFret(row.index, fret);
                            }}
                            onClick={(event) => {
                              if (event.detail === 0) {
                                onPlayFret(row.index, fret);
                              }
                            }}
                            className={`relative z-10 flex h-full w-full items-center justify-center border-r transition-colors ${
                              fret === 0
                                ? 'border-r-2 border-stone-200/70 bg-stone-950/35 hover:bg-amber-500/15'
                                : 'border-stone-400/40 hover:bg-amber-400/15'
                            } ${isJustPlayed ? 'bg-amber-400/25' : ''}`}
                          >
                            {isMutedNut ? (
                              <span
                                title="Muted string"
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-950/90 text-[11px] font-extrabold text-rose-400 ring-1 ring-rose-500/50"
                              >
                                ✕
                              </span>
                            ) : isChordDot ? (
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold shadow ${
                                  isPinned
                                    ? fret === 0
                                      ? 'border-2 border-emerald-400 bg-stone-900/95 text-emerald-300 ring-2 ring-emerald-400/40'
                                      : 'bg-emerald-400 text-zinc-950 ring-2 ring-white'
                                    : fret === 0
                                      ? 'border-2 border-amber-300 bg-stone-900/90 text-amber-200'
                                      : row.dotClass
                                }`}
                              >
                                {isPinned
                                  ? fret === 0
                                    ? 'O'
                                    : fret
                                  : fret === 0
                                    ? 'O'
                                    : fingerNum > 0
                                      ? fingerNum
                                      : fret}
                              </span>
                            ) : isJustPlayed ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-[10px] font-extrabold text-zinc-950 shadow">
                                {noteLabel}
                              </span>
                            ) : hintKey ? (
                              <kbd className="rounded bg-black/45 px-1 py-0.5 font-mono text-[9px] font-semibold text-stone-300/80">
                                {hintKey}
                              </kbd>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Stage Quick Chord Buttons (like Real Guitar screenshot) */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {progressionChords.map((chord, idx) => {
                const isActive = idx === activeSlotIndex;
                const actionKey = `chord-${idx + 1}` as RemappableActionId;
                const keyBadge = formatKeyBadge(keyMap.bindings[actionKey]);

                return (
                  <button
                    key={`${chord.id}-stage-${idx}`}
                    type="button"
                    onClick={() => onSelectSlot(idx)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all ${
                      isActive
                        ? 'border-amber-300 bg-amber-300 text-zinc-950 shadow'
                        : 'border-stone-600 bg-stone-800/90 text-stone-200 hover:border-amber-400'
                    }`}
                  >
                    <kbd
                      className={`rounded px-1 text-[10px] ${
                        isActive
                          ? 'bg-zinc-900/20 text-zinc-950'
                          : 'bg-black/40 text-amber-300'
                      }`}
                    >
                      {keyBadge}
                    </kbd>
                    <span>{chord.symbol}</span>
                  </button>
                );
              })}
            </div>

            {keyMap.playByCustomKeyOnly ? (
              <div className="text-[10px] font-semibold text-amber-300">
                Mode: Fokus Play by Custom Key Aktif
              </div>
            ) : keyMap.enableFretMelodyKeys ? (
              <div className="text-[10px] text-stone-400">
                Melodi Fret 0–9: Senar 1 (e) <kbd className="rounded bg-stone-800 px-1 text-stone-200">Q–P</kbd> · Senar 2 (B){' '}
                <kbd className="rounded bg-stone-800 px-1 text-stone-200">A–;</kbd>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

