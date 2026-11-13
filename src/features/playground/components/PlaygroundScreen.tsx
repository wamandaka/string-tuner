import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  HelpCircle,
  Keyboard,
  Music,
  Pause,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Sliders,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Slider } from '../../../components/ui/Slider';
import { CHORDS } from '../../../data/chords';
import {
  getGuitarTonePreference,
  playChordPreview,
  playStringPreview,
  preloadChordSamples,
  setGuitarTonePreference,
  STANDARD_OPEN_MIDI,
  stopChordPreview,
  type CustomRhythmStep,
  type GuitarToneType,
  type PlayPatternStyle,
} from '../../../engines/audio/ChordPreviewSynth';
import { NOTE_NAMES } from '../../../engines/pitch/NoteMapper';
import {
  CHORD_CATEGORY_LABELS,
  type ChordCategory,
  type ChordDefinition,
} from '../../chords/chords.types';
import { ChordDiagram } from '../../chords/components/ChordDiagram';
import {
  DEFAULT_CUSTOM_RHYTHM_STEPS,
  DEFAULT_CUSTOM_STRING_MASK,
  DEFAULT_CUSTOM_STRING_ORDER,
  PLAY_PATTERN_OPTIONS,
  PROGRESSION_PRESETS,
  STRING_1_MELODY_KEYS,
  STRING_2_MELODY_KEYS,
  type ChordProgressionPreset,
  type CustomChordKeyBinding,
  type PlaygroundKeyMap,
  type ProgressionSlot,
  type RemappableActionId,
  type SlotCustomAssignment,
  type StringMask,
} from '../playground.types';
import {
  applyCustomStringMask,
  calculateMinimumBeatsForPattern,
  estimatePatternDurationMs,
  getPlayPatternShortLabel,
} from '../playgroundChordUtils';
import {
  loadPlaygroundKeyMap,
  normalizeKeyboardKey,
  resetPlaygroundKeyMap,
  savePlaygroundKeyMap,
} from '../playgroundKeymapStorage';
import { CustomKeyMapPanel } from './CustomKeyMapPanel';
import { CustomKeyPlayPanel } from './CustomKeyPlayPanel';
import { CustomRhythmPanel } from './CustomRhythmPanel';
import { CustomStringVariationPanel } from './CustomStringVariationPanel';
import { GuitarNeckStage } from './GuitarNeckStage';

type ChordDragPayload =
  | { kind: 'slot'; fromIndex: number }
  | { kind: 'picker'; chordId: string }
  | { kind: 'custom-rhythm'; steps: CustomRhythmStep[] };

function clampBeats(value: number): number {
  if (!Number.isFinite(value)) {
    return 4;
  }
  return Math.min(32, Math.max(1, Math.round(value)));
}

function clampRepeat(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(8, Math.max(1, Math.round(value)));
}

const MAX_PROGRESSION_SLOTS = 12;

type PlaygroundTabId = 'play' | 'variation' | 'custom-key';

const GUITAR_TONE_OPTIONS: ReadonlyArray<{
  id: GuitarToneType;
  label: string;
}> = [
  { id: 'steel', label: 'Steel Guitar' },
  { id: 'nylon', label: 'Nylon Guitar' },
  { id: 'synth', label: 'Acoustic Synth' },
];

const PICKER_CATEGORIES: readonly ChordCategory[] = [
  'major',
  'minor',
  'dominant7',
  'major7',
  'minor7',
  'sus2',
  'sus4',
  'diminished',
];

function formatStringNote(stringIndex: number, fret: number): string {
  const midi = STANDARD_OPEN_MIDI[stringIndex]! + fret;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function PlaygroundScreen() {
  const chordMap = useMemo(() => {
    const map = new Map<string, ChordDefinition>();
    for (const chord of CHORDS) {
      map.set(chord.id, chord);
    }
    return map;
  }, []);

  const initialPreset = PROGRESSION_PRESETS[0]!;

  const [guitarTone, setGuitarTone] = useState<GuitarToneType>(() =>
    getGuitarTonePreference(),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    initialPreset.id,
  );
  const [progressionSlots, setProgressionSlots] = useState<ProgressionSlot[]>(
    () => initialPreset.chordIds.map((chordId) => ({ chordId })),
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [pattern, setPattern] = useState<PlayPatternStyle>(
    initialPreset.recommendedPattern,
  );
  const [bpm, setBpm] = useState<number>(initialPreset.recommendedBpm);
  const [beatsPerChord, setBeatsPerChord] = useState<number>(4);
  const [autoFitBeats, setAutoFitBeats] = useState<boolean>(true);
  const [isPlayingLoop, setIsPlayingLoop] = useState<boolean>(false);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [currentRepeat, setCurrentRepeat] = useState<number>(0);

  const [pickerMode, setPickerMode] = useState<'closed' | 'add' | 'replace'>(
    'closed',
  );
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [pickerCategory, setPickerCategory] = useState<'all' | ChordCategory>(
    'all',
  );

  const [vibratingStrings, setVibratingStrings] = useState<
    Record<number, boolean>
  >({});
  const [keyMap, setKeyMap] = useState<PlaygroundKeyMap>(() =>
    loadPlaygroundKeyMap(),
  );
  const [activeTab, setActiveTab] = useState<PlaygroundTabId>('play');
  const [showQuickGuide, setShowQuickGuide] = useState<boolean>(true);
  const [showKeyMapPanel, setShowKeyMapPanel] = useState<boolean>(false);
  const [isCapturingKey, setIsCapturingKey] = useState<boolean>(false);
  const [isCapturingCustomChordKey, setIsCapturingCustomChordKey] =
    useState<boolean>(false);
  const [pinFretMode, setPinFretMode] = useState<boolean>(false);
  const [pinnedFrets, setPinnedFrets] = useState<Record<number, number>>({});
  const [customStringMask, setCustomStringMask] = useState<StringMask>(() => [
    ...DEFAULT_CUSTOM_STRING_MASK,
  ]);
  const [customStringOrder, setCustomStringOrder] = useState<number[]>(() => [
    ...DEFAULT_CUSTOM_STRING_ORDER,
  ]);
  const [customRhythmSteps, setCustomRhythmSteps] = useState<CustomRhythmStep[]>(
    () => [...DEFAULT_CUSTOM_RHYTHM_STEPS],
  );
  const [activeCustomKeyId, setActiveCustomKeyId] = useState<string | null>(
    null,
  );
  const [activePlayedNote, setActivePlayedNote] = useState<{
    stringIndex: number;
    fret: number;
    noteName: string;
  } | null>(null);

  const vibrationTimersRef = useRef<Map<number, number>>(new Map());

  const progressionChords = useMemo(
    () =>
      progressionSlots
        .map((slot) => chordMap.get(slot.chordId))
        .filter((item): item is ChordDefinition => item !== undefined),
    [chordMap, progressionSlots],
  );

  const safeActiveIndex = Math.min(
    activeSlotIndex,
    Math.max(0, progressionChords.length - 1),
  );
  const activeChord = progressionChords[safeActiveIndex] ?? CHORDS[0]!;
  const activeSlot = progressionSlots[safeActiveIndex];

  const effectiveFrets = useMemo<
    readonly [number, number, number, number, number, number]
  >(() => {
    const next = [...activeChord.frets] as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (const [key, fretVal] of Object.entries(pinnedFrets)) {
      const idx = Number(key);
      if (idx >= 0 && idx <= 5 && fretVal >= -1 && fretVal <= 12) {
        next[idx] = fretVal;
      }
    }
    return next;
  }, [activeChord.frets, pinnedFrets]);

  useEffect(() => {
    if (guitarTone === 'synth') {
      return;
    }
    void preloadChordSamples(
      progressionChords.map((chord) => chord.frets),
      guitarTone,
    );
  }, [guitarTone, progressionChords]);

  useEffect(() => {
    const timers = vibrationTimersRef.current;
    return () => {
      stopChordPreview();
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const triggerStringVibration = useCallback((stringIndex: number) => {
    setVibratingStrings((prev) => ({ ...prev, [stringIndex]: true }));
    const existing = vibrationTimersRef.current.get(stringIndex);
    if (existing !== undefined) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      setVibratingStrings((prev) => ({ ...prev, [stringIndex]: false }));
      vibrationTimersRef.current.delete(stringIndex);
    }, 340);
    vibrationTimersRef.current.set(stringIndex, timer);
  }, []);

  const triggerFretsVisualPulse = useCallback(
    (frets: readonly [number, number, number, number, number, number]) => {
      for (let i = 0; i < frets.length; i++) {
        if (frets[i]! >= 0) {
          triggerStringVibration(i);
        }
      }
    },
    [triggerStringVibration],
  );

  const rhythmStepMs = Math.round((60 / bpm / 2) * 1000);

  const playFretsWithPattern = useCallback(
    (
      frets: readonly [number, number, number, number, number, number],
      chosenPattern: PlayPatternStyle,
      customOrderOverride?: readonly number[],
      customRhythmOverride?: readonly CustomRhythmStep[],
    ) => {
      if (chosenPattern === 'custom-string') {
        const order = customOrderOverride ?? customStringOrder;
        for (const strIdx of order) {
          if (frets[strIdx]! >= 0) {
            triggerStringVibration(strIdx);
          }
        }
        void playChordPreview(frets, {
          tone: guitarTone,
          pattern: chosenPattern,
          customStringOrder: order,
        });
        return;
      }

      if (chosenPattern === 'custom-rhythm') {
        triggerFretsVisualPulse(frets);
        void playChordPreview(frets, {
          tone: guitarTone,
          pattern: 'custom-rhythm',
          customRhythmSteps: customRhythmOverride ?? customRhythmSteps,
          rhythmStepMs,
        });
        return;
      }

      triggerFretsVisualPulse(frets);
      void playChordPreview(frets, {
        tone: guitarTone,
        pattern: chosenPattern,
      });
    },
    [
      customRhythmSteps,
      customStringOrder,
      guitarTone,
      rhythmStepMs,
      triggerFretsVisualPulse,
      triggerStringVibration,
    ],
  );

  const playChordWithPattern = useCallback(
    (
      chord: ChordDefinition,
      chosenPattern: PlayPatternStyle,
      customOrderOverride?: readonly number[],
      customRhythmOverride?: readonly CustomRhythmStep[],
    ) => {
      if (chosenPattern === 'custom-string') {
        const masked = applyCustomStringMask(chord.frets, customStringMask);
        playFretsWithPattern(
          masked,
          'custom-string',
          customOrderOverride ?? customStringOrder,
        );
        return;
      }
      if (chosenPattern === 'custom-rhythm') {
        const masked = applyCustomStringMask(chord.frets, customStringMask);
        playFretsWithPattern(
          masked,
          'custom-rhythm',
          undefined,
          customRhythmOverride ?? customRhythmSteps,
        );
        return;
      }
      playFretsWithPattern(chord.frets, chosenPattern);
    },
    [
      customRhythmSteps,
      customStringMask,
      customStringOrder,
      playFretsWithPattern,
    ],
  );

  const resolveSlotConfig = useCallback(
    (slotIndex: number) => {
      const slot = progressionSlots[slotIndex];
      const chord = progressionChords[slotIndex] ?? activeChord;
      const slotPattern = slot?.custom?.pattern ?? pattern;
      const slotCustomSteps = slot?.custom?.customRhythmSteps ?? customRhythmSteps;
      const slotCustomOrder = slot?.custom?.customStringOrder ?? customStringOrder;
      const baseBeats = clampBeats(slot?.custom?.beats ?? beatsPerChord);
      const durationMs = estimatePatternDurationMs({
        pattern: slotPattern,
        frets: chord.frets,
        bpm,
        customRhythmSteps: slotCustomSteps,
        customStringOrder: slotCustomOrder,
      });
      const minPatternBeats = calculateMinimumBeatsForPattern(durationMs, bpm);
      const resolvedBeats = autoFitBeats
        ? Math.max(baseBeats, minPatternBeats)
        : baseBeats;
      const repeat = clampRepeat(slot?.custom?.repeat ?? 1);

      return {
        slotPattern,
        slotCustomSteps,
        slotCustomOrder,
        baseBeats,
        minPatternBeats,
        resolvedBeats,
        repeat,
        durationMs,
        hasCustomPattern: Boolean(slot?.custom?.pattern),
        hasCustomBeats: slot?.custom?.beats !== undefined,
        hasCustomRepeat: repeat > 1,
      };
    },
    [
      activeChord,
      autoFitBeats,
      beatsPerChord,
      bpm,
      customRhythmSteps,
      customStringOrder,
      pattern,
      progressionChords,
      progressionSlots,
    ],
  );

  const activeSlotResolved = useMemo(
    () => resolveSlotConfig(safeActiveIndex),
    [resolveSlotConfig, safeActiveIndex],
  );

  const playSlotAt = useCallback(
    (index: number, chordOverride?: ChordDefinition) => {
      const chord = chordOverride ?? progressionChords[index];
      if (!chord) {
        return;
      }
      const cfg = resolveSlotConfig(index);
      playChordWithPattern(
        chord,
        cfg.slotPattern,
        cfg.slotCustomOrder,
        cfg.slotCustomSteps,
      );
    },
    [playChordWithPattern, progressionChords, resolveSlotConfig],
  );

  const handleStrumCustomStrings = useCallback(() => {
    const masked = applyCustomStringMask(effectiveFrets, customStringMask);
    playFretsWithPattern(masked, 'strum-down');
  }, [customStringMask, effectiveFrets, playFretsWithPattern]);

  const handlePickCustomStrings = useCallback(() => {
    const masked = applyCustomStringMask(effectiveFrets, customStringMask);
    playFretsWithPattern(masked, 'custom-string', customStringOrder);
  }, [customStringMask, customStringOrder, effectiveFrets, playFretsWithPattern]);

  const handlePlayCustomRhythm = useCallback(
    (overrideSteps?: readonly CustomRhythmStep[]) => {
      const masked = applyCustomStringMask(effectiveFrets, customStringMask);
      playFretsWithPattern(
        masked,
        'custom-rhythm',
        undefined,
        overrideSteps ?? customRhythmSteps,
      );
    },
    [customRhythmSteps, customStringMask, effectiveFrets, playFretsWithPattern],
  );

  // Auto-play progression loop (per-slot patterns + custom / auto-fit beats)
  const activeSlotIndexRef = useRef(safeActiveIndex);
  activeSlotIndexRef.current = safeActiveIndex;
  const resolveSlotConfigRef = useRef(resolveSlotConfig);
  resolveSlotConfigRef.current = resolveSlotConfig;
  const playSlotAtRef = useRef(playSlotAt);
  playSlotAtRef.current = playSlotAt;

  const loopStateRef = useRef({
    slotIndex: safeActiveIndex,
    repeatIndex: 0,
    beat: 0,
  });

  useEffect(() => {
    if (!isPlayingLoop || progressionChords.length === 0) {
      return;
    }

    const startSlot = activeSlotIndexRef.current;
    loopStateRef.current = { slotIndex: startSlot, repeatIndex: 0, beat: 0 };
    setCurrentBeat(0);
    setCurrentRepeat(0);

    playSlotAtRef.current(startSlot);

    const beatIntervalMs = Math.round((60 / bpm) * 1000);
    const intervalId = window.setInterval(() => {
      const currSlot = loopStateRef.current.slotIndex;
      const currRepeat = loopStateRef.current.repeatIndex;
      const slotCfg = resolveSlotConfigRef.current(currSlot);
      const totalBeatsForSlot = Math.max(1, slotCfg.resolvedBeats);
      const totalRepeatsForSlot = Math.max(1, slotCfg.repeat);
      const nextBeat = loopStateRef.current.beat + 1;

      if (nextBeat < totalBeatsForSlot) {
        loopStateRef.current = {
          slotIndex: currSlot,
          repeatIndex: currRepeat,
          beat: nextBeat,
        };
        setCurrentBeat(nextBeat);
        return;
      }

      const nextRepeat = currRepeat + 1;
      if (nextRepeat < totalRepeatsForSlot) {
        // Replay the same chord + pattern cleanly without switching slot yet
        loopStateRef.current = {
          slotIndex: currSlot,
          repeatIndex: nextRepeat,
          beat: 0,
        };
        setCurrentBeat(0);
        setCurrentRepeat(nextRepeat);
        playSlotAtRef.current(currSlot);
        return;
      }

      const nextSlot = (currSlot + 1) % progressionChords.length;
      loopStateRef.current = { slotIndex: nextSlot, repeatIndex: 0, beat: 0 };
      setActiveSlotIndex(nextSlot);
      setCurrentBeat(0);
      setCurrentRepeat(0);
      playSlotAtRef.current(nextSlot);
    }, beatIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [bpm, isPlayingLoop, progressionChords.length]);

  const handleChangeTone = (tone: GuitarToneType) => {
    setGuitarTone(tone);
    setGuitarTonePreference(tone);
  };

  const handleSelectPreset = (preset: ChordProgressionPreset) => {
    setIsPlayingLoop(false);
    setSelectedPresetId(preset.id);
    setProgressionSlots(preset.chordIds.map((chordId) => ({ chordId })));
    setActiveSlotIndex(0);
    setCurrentBeat(0);
    setCurrentRepeat(0);
    setPinnedFrets({});
    setPattern(preset.recommendedPattern);
    setBpm(preset.recommendedBpm);
    const firstChord = chordMap.get(preset.chordIds[0]!);
    if (firstChord) {
      playChordWithPattern(firstChord, preset.recommendedPattern);
    }
  };

  const handleSelectSlot = useCallback(
    (index: number, shouldPlay: boolean = true) => {
      loopStateRef.current = { slotIndex: index, repeatIndex: 0, beat: 0 };
      setActiveSlotIndex(index);
      setCurrentBeat(0);
      setCurrentRepeat(0);
      setPinnedFrets({});
      if (shouldPlay) {
        playSlotAt(index);
      }
    },
    [playSlotAt],
  );

  const chordDragRef = useRef<ChordDragPayload | null>(null);
  const [dragOverSlotIdx, setDragOverSlotIdx] = useState<number | null>(null);
  const [dragOverGrid, setDragOverGrid] = useState(false);

  const readChordDragPayload = (event: DragEvent<HTMLElement>): ChordDragPayload | null => {
    if (chordDragRef.current) {
      return chordDragRef.current;
    }
    try {
      const rawRhythm = event.dataTransfer?.getData(
        'application/x-stringtuner-rhythm',
      );
      if (rawRhythm) {
        return {
          kind: 'custom-rhythm',
          steps: JSON.parse(rawRhythm) as CustomRhythmStep[],
        };
      }
      const raw = event.dataTransfer?.getData('application/json');
      if (raw) {
        return JSON.parse(raw) as ChordDragPayload;
      }
    } catch {
      // Ignore malformed external drag payload
    }
    return null;
  };

  const handleAssignSlotCustom = useCallback(
    (slotIndex: number, patch: Partial<SlotCustomAssignment>) => {
      setSelectedPresetId(null);
      setProgressionSlots((prev) =>
        prev.map((slot, idx) => {
          if (idx !== slotIndex) {
            return slot;
          }
          const merged: SlotCustomAssignment = {
            ...slot.custom,
            ...patch,
          };
          // Normalize cleared fields
          if (patch.pattern === undefined && 'pattern' in patch) {
            delete merged.pattern;
            delete merged.customRhythmSteps;
            delete merged.customStringOrder;
          }
          if (patch.beats === undefined && 'beats' in patch) {
            delete merged.beats;
          }
          if (
            'repeat' in patch &&
            (patch.repeat === undefined || patch.repeat <= 1)
          ) {
            delete merged.repeat;
          }
          const hasAny =
            merged.pattern !== undefined ||
            merged.beats !== undefined ||
            (merged.repeat !== undefined && merged.repeat > 1);
          return hasAny
            ? { chordId: slot.chordId, custom: merged }
            : { chordId: slot.chordId };
        }),
      );
    },
    [],
  );

  const handleDuplicateSlot = useCallback(
    (index: number) => {
      if (progressionSlots.length >= MAX_PROGRESSION_SLOTS) {
        return;
      }
      const sourceSlot = progressionSlots[index];
      if (!sourceSlot) {
        return;
      }
      setSelectedPresetId(null);
      setPinnedFrets({});
      const clonedCustom: SlotCustomAssignment | undefined = sourceSlot.custom
        ? {
            ...sourceSlot.custom,
            customRhythmSteps: sourceSlot.custom.customRhythmSteps
              ? [...sourceSlot.custom.customRhythmSteps]
              : undefined,
            customStringOrder: sourceSlot.custom.customStringOrder
              ? [...sourceSlot.custom.customStringOrder]
              : undefined,
          }
        : undefined;
      const copySlot: ProgressionSlot = clonedCustom
        ? { chordId: sourceSlot.chordId, custom: clonedCustom }
        : { chordId: sourceSlot.chordId };

      const nextIndex = index + 1;
      setProgressionSlots((prev) => {
        const next = [...prev];
        next.splice(nextIndex, 0, copySlot);
        return next;
      });
      loopStateRef.current = { slotIndex: nextIndex, repeatIndex: 0, beat: 0 };
      setActiveSlotIndex(nextIndex);
      setCurrentBeat(0);
      setCurrentRepeat(0);
      const chord = chordMap.get(copySlot.chordId);
      if (chord) {
        playChordWithPattern(
          chord,
          clonedCustom?.pattern ?? pattern,
          clonedCustom?.customStringOrder,
          clonedCustom?.customRhythmSteps,
        );
      }
    },
    [chordMap, pattern, playChordWithPattern, progressionSlots],
  );

  const handleReorderSlots = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= progressionSlots.length ||
        toIndex >= progressionSlots.length
      ) {
        return;
      }
      setSelectedPresetId(null);
      setPinnedFrets({});
      setProgressionSlots((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) {
          return prev;
        }
        next.splice(toIndex, 0, moved);
        return next;
      });
      setActiveSlotIndex((prevActive) => {
        let nextActive = prevActive;
        if (prevActive === fromIndex) {
          nextActive = toIndex;
        } else if (fromIndex < prevActive && toIndex >= prevActive) {
          nextActive = prevActive - 1;
        } else if (fromIndex > prevActive && toIndex <= prevActive) {
          nextActive = prevActive + 1;
        }
        loopStateRef.current = { slotIndex: nextActive, repeatIndex: 0, beat: 0 };
        return nextActive;
      });
      setCurrentBeat(0);
      setCurrentRepeat(0);
    },
    [progressionSlots.length],
  );

  const handleDropPickerChord = useCallback(
    (chordId: string, targetSlotIndex?: number) => {
      const chord = chordMap.get(chordId);
      if (!chord) {
        return;
      }
      setSelectedPresetId(null);
      setPinnedFrets({});
      if (
        targetSlotIndex !== undefined &&
        targetSlotIndex >= 0 &&
        targetSlotIndex < progressionSlots.length
      ) {
        setProgressionSlots((prev) =>
          prev.map((slot, idx) =>
            idx === targetSlotIndex ? { ...slot, chordId: chord.id } : slot,
          ),
        );
        setActiveSlotIndex(targetSlotIndex);
        loopStateRef.current = { slotIndex: targetSlotIndex, repeatIndex: 0, beat: 0 };
        setCurrentBeat(0);
        setCurrentRepeat(0);
        playSlotAt(targetSlotIndex, chord);
        return;
      }
      if (progressionSlots.length < MAX_PROGRESSION_SLOTS) {
        const nextIndex = progressionSlots.length;
        setProgressionSlots((prev) => [...prev, { chordId: chord.id }]);
        setActiveSlotIndex(nextIndex);
        loopStateRef.current = { slotIndex: nextIndex, repeatIndex: 0, beat: 0 };
        setCurrentBeat(0);
        setCurrentRepeat(0);
        playChordWithPattern(chord, pattern);
      }
    },
    [chordMap, pattern, playChordWithPattern, playSlotAt, progressionSlots.length],
  );

  const handleRemoveSlot = (index: number) => {
    if (progressionSlots.length <= 1) {
      return;
    }
    setSelectedPresetId(null);
    const nextSlots = progressionSlots.filter((_, idx) => idx !== index);
    setProgressionSlots(nextSlots);
    if (activeSlotIndex >= nextSlots.length) {
      setActiveSlotIndex(nextSlots.length - 1);
    } else if (index < activeSlotIndex) {
      setActiveSlotIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const handlePickChord = (chord: ChordDefinition) => {
    setSelectedPresetId(null);
    setPinnedFrets({});
    if (pickerMode === 'add') {
      if (progressionSlots.length < MAX_PROGRESSION_SLOTS) {
        const nextIndex = progressionSlots.length;
        setProgressionSlots((prev) => [...prev, { chordId: chord.id }]);
        setActiveSlotIndex(nextIndex);
      }
      setPickerMode('closed');
      playChordWithPattern(chord, pattern);
    } else if (pickerMode === 'replace') {
      setProgressionSlots((prev) =>
        prev.map((slot, idx) =>
          idx === safeActiveIndex ? { ...slot, chordId: chord.id } : slot,
        ),
      );
      setPickerMode('closed');
      playSlotAt(safeActiveIndex, chord);
    } else {
      setPickerMode('closed');
    }
  };

  const handlePluckString = useCallback(
    (stringIndex: number) => {
      const fret = effectiveFrets[stringIndex]!;
      if (fret < 0) {
        return;
      }
      setActivePlayedNote({
        stringIndex,
        fret,
        noteName: formatStringNote(stringIndex, fret),
      });
      triggerStringVibration(stringIndex);
      void playStringPreview(stringIndex, fret, {
        tone: guitarTone,
        polyphonic: true,
      });
    },
    [effectiveFrets, guitarTone, triggerStringVibration],
  );

  const handleSetStringOverride = useCallback(
    (stringIndex: number, fret: number | null) => {
      if (stringIndex < 0 || stringIndex > 5) {
        return;
      }
      setPinnedFrets((prev) => {
        const next = { ...prev };
        if (fret === null || fret === activeChord.frets[stringIndex]) {
          delete next[stringIndex];
        } else {
          next[stringIndex] = fret;
        }
        return next;
      });
      if (fret !== null && fret >= 0) {
        setActivePlayedNote({
          stringIndex,
          fret,
          noteName: formatStringNote(stringIndex, fret),
        });
        triggerStringVibration(stringIndex);
        void playStringPreview(stringIndex, fret, {
          tone: guitarTone,
          polyphonic: true,
        });
      }
    },
    [activeChord.frets, guitarTone, triggerStringVibration],
  );

  const handlePlayFret = useCallback(
    (stringIndex: number, fret: number) => {
      if (fret < 0 || fret > 12 || stringIndex < 0 || stringIndex > 5) {
        return;
      }
      let noteFretToPlay = fret;
      if (pinFretMode) {
        if (
          pinnedFrets[stringIndex] === undefined &&
          activeChord.frets[stringIndex] === fret &&
          fret > 0
        ) {
          noteFretToPlay = 0;
        }
        setPinnedFrets((prev) => {
          const next = { ...prev };
          if (next[stringIndex] === fret) {
            delete next[stringIndex];
          } else if (
            prev[stringIndex] === undefined &&
            activeChord.frets[stringIndex] === fret &&
            fret > 0
          ) {
            // Release pressed chord fret to Open (0) for chord variation
            next[stringIndex] = 0;
          } else {
            next[stringIndex] = fret;
          }
          return next;
        });
      }
      setActivePlayedNote({
        stringIndex,
        fret: noteFretToPlay,
        noteName: formatStringNote(stringIndex, noteFretToPlay),
      });
      triggerStringVibration(stringIndex);
      void playStringPreview(stringIndex, noteFretToPlay, {
        tone: guitarTone,
        polyphonic: true,
      });
    },
    [activeChord.frets, guitarTone, pinFretMode, pinnedFrets, triggerStringVibration],
  );

  const handleTriggerCustomBinding = useCallback(
    (binding: CustomChordKeyBinding) => {
      setIsPlayingLoop(false);
      setActiveCustomKeyId(binding.id);

      let targetBaseChord = activeChord;
      if (binding.chordId) {
        const slotIdx = progressionChords.findIndex(
          (c) => c.id === binding.chordId,
        );
        if (slotIdx >= 0) {
          setActiveSlotIndex(slotIdx);
          targetBaseChord = progressionChords[slotIdx]!;
        }
      }

      const nextOverrides: Record<number, number> = {};
      for (let i = 0; i < 6; i++) {
        if (binding.frets[i] !== targetBaseChord.frets[i]) {
          nextOverrides[i] = binding.frets[i]!;
        }
      }
      setPinnedFrets(nextOverrides);
      if (binding.customStringOrder && binding.customStringOrder.length > 0) {
        setCustomStringOrder([...binding.customStringOrder]);
      }
      if (binding.customRhythmSteps && binding.customRhythmSteps.length > 0) {
        setCustomRhythmSteps([...binding.customRhythmSteps]);
      }

      playFretsWithPattern(
        binding.frets,
        binding.playMode,
        binding.customStringOrder,
        binding.customRhythmSteps,
      );
    },
    [activeChord, playFretsWithPattern, progressionChords],
  );

  const handleUpdateKeyMap = (next: PlaygroundKeyMap) => {
    setKeyMap(next);
    savePlaygroundKeyMap(next);
  };

  const handleResetKeyMap = () => {
    setKeyMap(resetPlaygroundKeyMap());
  };

  // Keyboard & Custom Key Listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isCapturingKey ||
        isCapturingCustomChordKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = normalizeKeyboardKey(event.key);

      // 1. Play by Custom Key (Custom Chord / Variation / Custom String triggers)
      const customChord = keyMap.customChordBindings.find((b) => b.key === key);
      if (customChord) {
        event.preventDefault();
        handleTriggerCustomBinding(customChord);
        return;
      }

      // 2. Custom per-fret bindings
      const customFret = keyMap.customFretBindings.find((b) => b.key === key);
      if (customFret) {
        event.preventDefault();
        handlePlayFret(customFret.stringIndex, customFret.fret);
        return;
      }

      // 3. Pluck active string 6..1
      const stringActions: Array<{ id: RemappableActionId; index: number }> = [
        { id: 'string-6', index: 0 },
        { id: 'string-5', index: 1 },
        { id: 'string-4', index: 2 },
        { id: 'string-3', index: 3 },
        { id: 'string-2', index: 4 },
        { id: 'string-1', index: 5 },
      ];
      for (const item of stringActions) {
        if (keyMap.bindings[item.id] === key) {
          event.preventDefault();
          handlePluckString(item.index);
          return;
        }
      }

      // 4. Strum / Picking / Custom String / Mute actions
      if (keyMap.bindings['strum-down'] === key) {
        event.preventDefault();
        playFretsWithPattern(effectiveFrets, 'strum-down');
        return;
      }
      if (keyMap.bindings['strum-up'] === key) {
        event.preventDefault();
        playFretsWithPattern(effectiveFrets, 'strum-up');
        return;
      }
      if (keyMap.bindings.arpeggio === key) {
        event.preventDefault();
        playFretsWithPattern(effectiveFrets, 'arpeggio-down-up');
        return;
      }
      if (keyMap.bindings.fingerpick === key) {
        event.preventDefault();
        playFretsWithPattern(effectiveFrets, 'fingerpick');
        return;
      }
      if (keyMap.bindings['strum-custom-string'] === key) {
        event.preventDefault();
        handleStrumCustomStrings();
        return;
      }
      if (keyMap.bindings['pick-custom-string'] === key) {
        event.preventDefault();
        handlePickCustomStrings();
        return;
      }
      if (keyMap.bindings['play-custom-rhythm'] === key) {
        event.preventDefault();
        handlePlayCustomRhythm();
        return;
      }
      if (keyMap.bindings.mute === key) {
        event.preventDefault();
        setIsPlayingLoop(false);
        stopChordPreview();
        return;
      }

      // 5. Chord progression slots 1..8
      for (let i = 0; i < 8; i++) {
        const actionId = `chord-${i + 1}` as RemappableActionId;
        if (keyMap.bindings[actionId] === key && i < progressionChords.length) {
          event.preventDefault();
          handleSelectSlot(i, keyMap.autoStrumOnChordKey);
          return;
        }
      }

      // 6. Direct Fretboard Melody Keys (Q-P = String 1 Frets 0-9, A-; = String 2 Frets 0-9)
      if (keyMap.enableFretMelodyKeys && !keyMap.playByCustomKeyOnly) {
        const s1Fret = STRING_1_MELODY_KEYS.indexOf(
          key as (typeof STRING_1_MELODY_KEYS)[number],
        );
        if (s1Fret >= 0) {
          event.preventDefault();
          handlePlayFret(5, s1Fret);
          return;
        }
        const s2Fret = STRING_2_MELODY_KEYS.indexOf(
          key as (typeof STRING_2_MELODY_KEYS)[number],
        );
        if (s2Fret >= 0) {
          event.preventDefault();
          handlePlayFret(4, s2Fret);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    effectiveFrets,
    handlePickCustomStrings,
    handlePlayCustomRhythm,
    handlePlayFret,
    handlePluckString,
    handleSelectSlot,
    handleStrumCustomStrings,
    handleTriggerCustomBinding,
    isCapturingCustomChordKey,
    isCapturingKey,
    keyMap,
    playFretsWithPattern,
    progressionChords.length,
  ]);

  const filteredPickerChords = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    return CHORDS.filter((chord) => {
      if (pickerCategory !== 'all' && chord.category !== pickerCategory) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        chord.symbol.toLowerCase().includes(query) ||
        chord.name.toLowerCase().includes(query) ||
        chord.root.toLowerCase().includes(query)
      );
    });
  }, [pickerCategory, pickerSearch]);

  const strumPatterns = PLAY_PATTERN_OPTIONS.filter((p) => p.mode === 'strum');
  const petikPatterns = PLAY_PATTERN_OPTIONS.filter((p) => p.mode === 'petik');

  const hasOverrides = Object.keys(pinnedFrets).length > 0;

  return (
    <section
      aria-labelledby="playground-heading"
      className="mx-auto flex max-w-5xl flex-col gap-4"
    >
      {/* Header & Guitar Sound Tone */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="playground-heading"
            className="text-lg font-semibold tracking-tight text-(--st-text)"
          >
            Guitar Playground
          </h1>
          <p className="text-xs text-(--st-text-muted)">
            Pilih chord, klik tombol Genjreng atau petik senar di layar seperti
            gitar asli.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={showQuickGuide}
            onClick={() => setShowQuickGuide((prev) => !prev)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              showQuickGuide
                ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                : 'border-(--st-border) bg-(--st-surface) text-(--st-text) hover:border-(--st-border-strong)'
            }`}
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>Panduan</span>
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
                onClick={() => handleChangeTone(option.id)}
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
        </div>
      </div>

      {/* Simple 3-Step Beginner Guide */}
      {showQuickGuide ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-(--st-accent)/30 bg-(--st-accent-soft)/45 px-3.5 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-(--st-text)">
            <span>
              <strong className="text-(--st-accent)">1. Pilih Kunci:</strong>{' '}
              Klik tombol chord di bawah gitar (C, G, Am, F) atau tekan angka{' '}
              <kbd className="rounded bg-(--st-surface) px-1 py-0.5 font-mono text-[10px]">
                1–4
              </kbd>
              .
            </span>
            <span>
              <strong className="text-(--st-accent)">2. Mainkan:</strong> Klik{' '}
              <strong>Genjreng</strong> (atau{' '}
              <kbd className="rounded bg-(--st-surface) px-1 py-0.5 font-mono text-[10px]">
                Space
              </kbd>
              ), atau klik senar berwarna untuk petik satu per satu.
            </span>
            <span>
              <strong className="text-(--st-accent)">3. Eksplorasi:</strong>{' '}
              Pakai 3 tab di bawah untuk atur lagu, variasi jari, &amp; tombol
              keyboard.
            </span>
          </div>
          <button
            type="button"
            aria-label="Tutup panduan cepat"
            onClick={() => setShowQuickGuide(false)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-(--st-text-muted) hover:bg-(--st-surface) hover:text-(--st-text)"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Visual Real Guitar Stage (Always Visible) */}
      <GuitarNeckStage
        activeChord={activeChord}
        effectiveFrets={effectiveFrets}
        pinnedFrets={pinnedFrets}
        pinFretMode={pinFretMode}
        onTogglePinFretMode={() => setPinFretMode((prev) => !prev)}
        onClearPinnedFrets={() => setPinnedFrets({})}
        progressionChords={progressionChords}
        activeSlotIndex={safeActiveIndex}
        onSelectSlot={(idx) => handleSelectSlot(idx)}
        onPlayFret={handlePlayFret}
        onPluckChordString={handlePluckString}
        onStrumDown={() => playFretsWithPattern(effectiveFrets, 'strum-down')}
        onStrumUp={() => playFretsWithPattern(effectiveFrets, 'strum-up')}
        onMute={() => {
          setIsPlayingLoop(false);
          stopChordPreview();
        }}
        vibratingStrings={vibratingStrings}
        activePlayedNote={activePlayedNote}
        keyMap={keyMap}
      />

      {/* 3 Simple Navigation Tabs Below Guitar */}
      <div
        role="tablist"
        aria-label="Mode Playground"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'play'}
          onClick={() => setActiveTab('play')}
          className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
            activeTab === 'play'
              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-text)'
              : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
          }`}
        >
          <Music
            className={`h-4 w-4 shrink-0 ${
              activeTab === 'play' ? 'text-(--st-accent)' : ''
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-xs font-bold text-(--st-text)">
              1. Main Chord &amp; Lagu
            </div>
            <div className="text-[11px] text-(--st-text-muted)">
              Pilih lagu, pola genjreng/petik &amp; putar otomatis
            </div>
          </div>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'variation'}
          onClick={() => setActiveTab('variation')}
          className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
            activeTab === 'variation'
              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-text)'
              : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
          }`}
        >
          <Sliders
            className={`h-4 w-4 shrink-0 ${
              activeTab === 'variation' ? 'text-(--st-accent)' : ''
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-(--st-text)">
              <span>2. Variasi &amp; Custom Senar</span>
              {hasOverrides ? (
                <span className="h-2 w-2 rounded-full bg-(--st-accent)" />
              ) : null}
            </div>
            <div className="text-[11px] text-(--st-text-muted)">
              Lepas jari (open), matikan senar &amp; urutan petik
            </div>
          </div>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'custom-key'}
          onClick={() => setActiveTab('custom-key')}
          className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
            activeTab === 'custom-key'
              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-text)'
              : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
          }`}
        >
          <Keyboard
            className={`h-4 w-4 shrink-0 ${
              activeTab === 'custom-key' ? 'text-(--st-accent)' : ''
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-(--st-text)">
              <span>3. Main Pakai Keyboard</span>
              {keyMap.customChordBindings.length > 0 ? (
                <span className="rounded bg-(--st-accent) px-1.5 py-0.2 text-[10px] text-(--st-accent-text)">
                  {keyMap.customChordBindings.length}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-(--st-text-muted)">
              Simpan kunci/variasi ke tombol &amp; atur shortcut
            </div>
          </div>
        </button>
      </div>

      {/* TAB 1: Main Chord & Lagu */}
      {activeTab === 'play' ? (
        <div className="flex flex-col gap-4">
          {/* Progression Presets & Timeline Builder (Redesigned for clarity) */}
          <Card className="p-4">
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--st-border) pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-(--st-text)">
                    Pilihan Progresi Lagu &amp; Urutan Chord
                  </h2>
                  <span className="rounded-full bg-(--st-surface-elevated) px-2 py-0.5 font-mono text-[11px] font-semibold text-(--st-text-muted)">
                    {progressionSlots.length}/{MAX_PROGRESSION_SLOTS} slot
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-(--st-text-muted)">
                  Pilih template lagu atau susun chord Anda sendiri. Klik{' '}
                  <strong className="text-(--st-text)">1x</strong> pada kartu
                  untuk mengulang petikan di chord yang sama (mis. 2x), atau
                  seret untuk mengubah urutan.
                </p>
              </div>

              <button
                type="button"
                disabled={progressionSlots.length >= MAX_PROGRESSION_SLOTS}
                onClick={() =>
                  setPickerMode((prev) => (prev === 'add' ? 'closed' : 'add'))
                }
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-45 ${
                  pickerMode === 'add'
                    ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                    : 'bg-(--st-accent) border-transparent text-(--st-accent-text) hover:opacity-95'
                }`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tambah Chord</span>
              </button>
            </div>

            {/* Step 1: Song Template Presets */}
            <div className="mt-3">
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
                1. Template Progresi Populer (Opsional)
              </span>
              <div
                role="group"
                aria-label="Chord progression presets"
                className="flex flex-wrap gap-1.5"
              >
                {PROGRESSION_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-label={preset.name}
                      aria-pressed={active}
                      onClick={() => handleSelectPreset(preset)}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                          : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
                      }`}
                    >
                      <span>{preset.name}</span>
                      <span className="rounded bg-(--st-surface) px-1.5 py-0.5 text-[10px] font-medium opacity-80">
                        {preset.genre}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Visual Chord Timeline */}
            <div className="mt-3.5">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
                  2. Urutan Chord Anda (Klik untuk mainkan · Seret untuk tukar
                  posisi)
                </span>
                <span className="text-[11px] text-(--st-text-muted)">
                  Sedang dipilih:{' '}
                  <strong className="text-(--st-accent)">
                    Slot {safeActiveIndex + 1} ({activeChord.symbol})
                  </strong>
                </span>
              </div>

              <div
                role="list"
                aria-label="Active chord progression"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverGrid(true);
                }}
                onDragLeave={() => setDragOverGrid(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload = readChordDragPayload(event);
                  chordDragRef.current = null;
                  setDragOverSlotIdx(null);
                  setDragOverGrid(false);
                  if (payload?.kind === 'picker') {
                    handleDropPickerChord(payload.chordId);
                  }
                }}
                className={`grid grid-cols-1 gap-2 rounded-xl transition-all sm:grid-cols-2 lg:grid-cols-4 ${
                  dragOverGrid && dragOverSlotIdx === null
                    ? 'ring-2 ring-(--st-accent)/60 ring-offset-2 ring-offset-(--st-surface)'
                    : ''
                }`}
              >
                {progressionChords.map((chord, index) => {
                  const isSelected = index === safeActiveIndex;
                  const isDragOver = dragOverSlotIdx === index;
                  const slotMeta = progressionSlots[index]?.custom;
                  const slotRepeat = clampRepeat(slotMeta?.repeat ?? 1);
                  const slotHasCustomPattern = Boolean(slotMeta?.pattern);
                  const slotHasCustomBeats = slotMeta?.beats !== undefined;
                  return (
                    <div
                      key={`${chord.id}-${index}`}
                      role="listitem"
                      draggable
                      title="Seret untuk menukar posisi urutan chord, atau lepas pola custom ke sini"
                      onDragStart={(event) => {
                        const payload: ChordDragPayload = {
                          kind: 'slot',
                          fromIndex: index,
                        };
                        chordDragRef.current = payload;
                        try {
                          if (event.dataTransfer) {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData(
                              'application/json',
                              JSON.stringify(payload),
                            );
                          }
                        } catch {
                          // Ignore synthetic jsdom dataTransfer restrictions
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragOverSlotIdx(index);
                      }}
                      onDragLeave={() =>
                        setDragOverSlotIdx((prev) =>
                          prev === index ? null : prev,
                        )
                      }
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const payload = readChordDragPayload(event);
                        chordDragRef.current = null;
                        setDragOverSlotIdx(null);
                        setDragOverGrid(false);
                        if (payload?.kind === 'slot') {
                          handleReorderSlots(payload.fromIndex, index);
                        } else if (payload?.kind === 'picker') {
                          handleDropPickerChord(payload.chordId, index);
                        } else if (payload?.kind === 'custom-rhythm') {
                          handleAssignSlotCustom(index, {
                            pattern: 'custom-rhythm',
                            customRhythmSteps: [...payload.steps],
                          });
                          setActiveSlotIndex(index);
                          playChordWithPattern(
                            chord,
                            'custom-rhythm',
                            undefined,
                            payload.steps,
                          );
                        }
                      }}
                      onDragEnd={() => {
                        chordDragRef.current = null;
                        setDragOverSlotIdx(null);
                        setDragOverGrid(false);
                      }}
                      className={`relative flex cursor-grab flex-col justify-between gap-2 rounded-2xl border p-2.5 transition-all active:cursor-grabbing ${
                        isDragOver
                          ? 'border-(--st-accent) bg-(--st-accent-soft) ring-2 ring-(--st-accent)'
                          : isSelected
                            ? 'border-(--st-accent) bg-(--st-accent-soft) shadow-sm'
                            : 'border-(--st-border) bg-(--st-surface-elevated) hover:border-(--st-border-strong)'
                      }`}
                    >
                      {/* Top mini toolbar on card */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <GripVertical
                            className="h-3.5 w-3.5 shrink-0 text-(--st-text-muted)/60"
                            aria-hidden="true"
                          />
                          <span
                            className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-bold ${
                              isSelected
                                ? 'bg-(--st-accent) text-(--st-accent-text)'
                                : 'bg-(--st-surface) text-(--st-text-muted)'
                            }`}
                          >
                            {index + 1}
                          </span>

                          <button
                            type="button"
                            title="Klik untuk ubah berapa kali chord ini diputar (1x–4x)"
                            aria-label={`Ulang pola di Slot ${index + 1} (${chord.symbol}): ${slotRepeat}x`}
                            onClick={(event) => {
                              event.stopPropagation();
                              const nextRepeat =
                                slotRepeat >= 4 ? 1 : slotRepeat + 1;
                              handleAssignSlotCustom(index, {
                                repeat: nextRepeat,
                              });
                            }}
                            className={`inline-flex h-5 items-center gap-0.5 rounded-md border px-1.5 font-mono text-[10px] font-bold transition-colors ${
                              slotRepeat > 1
                                ? 'border-sky-400/60 bg-sky-500/20 text-sky-300'
                                : 'border-(--st-border) bg-(--st-surface) text-(--st-text-muted) hover:border-sky-400/50 hover:text-(--st-text)'
                            }`}
                          >
                            <Repeat className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>{slotRepeat}x</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title={`Ganti chord di Slot ${index + 1}`}
                            aria-label={`Ganti chord di Slot ${index + 1} (${chord.symbol})`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveSlotIndex(index);
                              setPickerMode('replace');
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-(--st-text-muted) hover:bg-(--st-surface) hover:text-(--st-text)"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          </button>

                          {progressionSlots.length < MAX_PROGRESSION_SLOTS ? (
                            <button
                              type="button"
                              title={`Duplikat ${chord.symbol} beserta polanya ke slot sebelah`}
                              aria-label={`Duplikat Slot ${index + 1} (${chord.symbol})`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDuplicateSlot(index);
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-(--st-text-muted) hover:bg-(--st-surface) hover:text-(--st-text)"
                            >
                              <Copy className="h-3 w-3" aria-hidden="true" />
                            </button>
                          ) : null}

                          {progressionChords.length > 1 ? (
                            <button
                              type="button"
                              title={`Hapus ${chord.symbol}`}
                              aria-label={`Hapus ${chord.symbol} dari slot ${index + 1}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveSlot(index);
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-(--st-text-muted) hover:bg-(--st-surface) hover:text-(--st-danger)"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Main clickable chord card body */}
                      <button
                        type="button"
                        onClick={() => handleSelectSlot(index)}
                        aria-current={isSelected ? 'true' : undefined}
                        aria-label={`Slot ${index + 1}: ${chord.name}`}
                        className="flex min-w-0 flex-1 flex-col items-start text-left"
                      >
                        <div className="flex w-full items-baseline justify-between gap-1.5">
                          <span className="text-lg font-extrabold leading-tight text-(--st-text)">
                            {chord.symbol}
                          </span>
                          {isSelected && isPlayingLoop && slotRepeat > 1 ? (
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-300">
                              Putaran {currentRepeat + 1}/{slotRepeat}
                            </span>
                          ) : null}
                        </div>
                        <span className="max-w-full truncate text-[11px] text-(--st-text-muted)">
                          {chord.name}
                        </span>
                      </button>

                      {/* Optional custom pattern / beat pills */}
                      {slotHasCustomPattern || slotHasCustomBeats ? (
                        <div className="flex flex-wrap gap-1 border-t border-(--st-border)/60 pt-1.5">
                          {slotMeta?.pattern ? (
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                              {getPlayPatternShortLabel(slotMeta.pattern)}
                            </span>
                          ) : null}
                          {slotMeta?.beats !== undefined ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                              {slotMeta.beats} ketuk
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {progressionSlots.length < MAX_PROGRESSION_SLOTS ? (
                  <button
                    type="button"
                    aria-label="Tambah slot baru ke urutan"
                    onClick={() =>
                      setPickerMode((prev) => (prev === 'add' ? 'closed' : 'add'))
                    }
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-(--st-border-strong) bg-(--st-surface-elevated)/40 p-2.5 text-xs font-semibold text-(--st-text-muted) transition-colors hover:border-(--st-accent) hover:bg-(--st-accent-soft)/30 hover:text-(--st-accent)"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Slot Baru</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Chord Picker Drawer */}
            {pickerMode !== 'closed' ? (
              <div className="mt-3 rounded-2xl border border-(--st-accent)/40 bg-(--st-surface-elevated) p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-(--st-text)">
                    {pickerMode === 'add'
                      ? 'Pilih atau seret chord baru ke urutan di atas:'
                      : `Pilih chord pengganti untuk Slot ${safeActiveIndex + 1} (${activeChord.symbol}):`}
                  </span>
                  <button
                    type="button"
                    aria-label="Tutup pemilih chord"
                    onClick={() => setPickerMode('closed')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-(--st-text-muted) hover:text-(--st-text)"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-(--st-text-muted)"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      aria-label="Cari chord untuk progresi"
                      value={pickerSearch}
                      onChange={(event) => setPickerSearch(event.target.value)}
                      placeholder="Cari chord (C, Am, Fmaj7, Dsus4...)"
                      className="min-h-9 w-full rounded-lg border border-(--st-border) bg-(--st-surface) py-1.5 pr-3 pl-8 text-xs text-(--st-text) placeholder:text-(--st-text-muted)"
                    />
                  </div>

                  <select
                    aria-label="Filter kategori chord"
                    value={pickerCategory}
                    onChange={(event) =>
                      setPickerCategory(event.target.value as 'all' | ChordCategory)
                    }
                    className="min-h-9 rounded-lg border border-(--st-border) bg-(--st-surface) px-2.5 text-xs text-(--st-text)"
                  >
                    <option value="all">Semua Kategori</option>
                    {PICKER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CHORD_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2.5 grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-6">
                  {filteredPickerChords.map((chord) => (
                    <button
                      key={chord.id}
                      type="button"
                      draggable
                      title="Klik atau seret ke slot progresi"
                      aria-label={`${chord.symbol} (${chord.name})`}
                      onDragStart={(event) => {
                        const payload: ChordDragPayload = {
                          kind: 'picker',
                          chordId: chord.id,
                        };
                        chordDragRef.current = payload;
                        try {
                          if (event.dataTransfer) {
                            event.dataTransfer.effectAllowed = 'copyMove';
                            event.dataTransfer.setData(
                              'application/json',
                              JSON.stringify(payload),
                            );
                          }
                        } catch {
                          // Ignore synthetic jsdom dataTransfer restrictions
                        }
                      }}
                      onDragEnd={() => {
                        chordDragRef.current = null;
                        setDragOverSlotIdx(null);
                        setDragOverGrid(false);
                      }}
                      onClick={() => handlePickChord(chord)}
                      className="flex min-h-10 cursor-grab flex-col items-center justify-center rounded-lg border border-(--st-border) bg-(--st-surface) px-2 py-1 text-center transition-colors hover:border-(--st-accent) hover:bg-(--st-accent-soft) active:cursor-grabbing"
                    >
                      <span className="text-xs font-bold text-(--st-text)">
                        {chord.symbol}
                      </span>
                      <span className="max-w-full truncate text-[10px] text-(--st-text-muted)">
                        {chord.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {/* Auto-Play Loop & Active Chord Diagram */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: Loop & Pattern Selector */}
            <Card className="flex flex-col justify-between p-4 lg:col-span-7">
              <div>
                <h2 className="text-sm font-semibold text-(--st-text)">
                  Iringan Otomatis &amp; Gaya Main
                </h2>
                <p className="text-xs text-(--st-text-muted)">
                  Putar semua chord secara otomatis atau pilih gaya genjreng /
                  petikan
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPlayingLoop) {
                          setIsPlayingLoop(false);
                          stopChordPreview();
                        } else {
                          setIsPlayingLoop(true);
                        }
                      }}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                        isPlayingLoop
                          ? 'border border-(--st-border-strong) bg-(--st-surface) text-(--st-text)'
                          : 'bg-(--st-accent) text-(--st-accent-text)'
                      }`}
                    >
                      {isPlayingLoop ? (
                        <>
                          <Pause className="h-4 w-4" aria-hidden="true" />
                          <span>Berhenti</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" aria-hidden="true" />
                          <span>Putar Otomatis</span>
                        </>
                      )}
                    </button>

                    <div
                      role="group"
                      aria-label="Beats per chord"
                      className="flex flex-wrap items-center gap-1 rounded-xl border border-(--st-border) bg-(--st-surface) p-1"
                    >
                      {([2, 4, 6, 8] as const).map((beats) => (
                        <button
                          key={beats}
                          type="button"
                          aria-pressed={beatsPerChord === beats}
                          onClick={() => setBeatsPerChord(beats)}
                          className={`min-h-8 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                            beatsPerChord === beats
                              ? 'bg-(--st-accent) text-(--st-accent-text)'
                              : 'text-(--st-text-muted) hover:text-(--st-text)'
                          }`}
                        >
                          {beats} Ketukan
                        </button>
                      ))}

                      <div className="flex items-center gap-1 pl-1">
                        <button
                          type="button"
                          aria-label="Kurangi ketukan global"
                          onClick={() =>
                            setBeatsPerChord((prev) => clampBeats(prev - 1))
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface-elevated) text-xs font-bold text-(--st-text) hover:border-(--st-accent)"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={32}
                          aria-label="Ketukan custom per chord"
                          value={beatsPerChord}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            if (Number.isFinite(parsed) && parsed > 0) {
                              setBeatsPerChord(clampBeats(parsed));
                            }
                          }}
                          className="h-7 w-11 rounded-md border border-(--st-border) bg-(--st-surface-elevated) text-center font-mono text-xs font-bold text-(--st-text)"
                        />
                        <button
                          type="button"
                          aria-label="Tambah ketukan global"
                          onClick={() =>
                            setBeatsPerChord((prev) => clampBeats(prev + 1))
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface-elevated) text-xs font-bold text-(--st-text) hover:border-(--st-accent)"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-pressed={autoFitBeats}
                        title="Otomatis perpanjang ketukan saat pola petikan/strum lebih panjang agar tidak terpotong sebelum ganti chord"
                        onClick={() => setAutoFitBeats((prev) => !prev)}
                        className={`min-h-8 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                          autoFitBeats
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                            : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:text-(--st-text)'
                        }`}
                      >
                        Pas Pola {autoFitBeats ? '✓' : ''}
                      </button>
                    </div>

                    {isPlayingLoop ? (
                      <div className="flex items-center gap-2 px-1">
                        {activeSlotResolved.resolvedBeats <= 8 ? (
                          <div
                            aria-label="Beat indicator"
                            className="flex items-center gap-1.5"
                          >
                            {Array.from(
                              { length: activeSlotResolved.resolvedBeats },
                              (_, idx) => (
                                <span
                                  key={idx}
                                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                                    currentBeat === idx
                                      ? 'bg-(--st-accent)'
                                      : 'bg-(--st-border-strong)'
                                  }`}
                                />
                              ),
                            )}
                          </div>
                        ) : (
                          <span
                            aria-label="Beat indicator"
                            className="rounded-lg bg-(--st-accent-soft) px-2 py-1 font-mono text-xs font-bold text-(--st-accent)"
                          >
                            Ketukan {currentBeat + 1}/
                            {activeSlotResolved.resolvedBeats}
                          </span>
                        )}
                        {activeSlotResolved.repeat > 1 ? (
                          <span className="rounded-lg bg-sky-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">
                            Ulang {currentRepeat + 1}/{activeSlotResolved.repeat}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full sm:w-52">
                    <Slider
                      label="Kecepatan"
                      value={bpm}
                      min={60}
                      max={180}
                      valueText={`${bpm} BPM`}
                      onChange={setBpm}
                    />
                  </div>
                </div>

                {/* Anti cut-off info / quick adjust */}
                {autoFitBeats &&
                activeSlotResolved.resolvedBeats >
                  activeSlotResolved.baseBeats ? (
                  <p className="mt-2 text-[11px] text-emerald-300">
                    Pas Pola aktif: <strong>Slot {safeActiveIndex + 1} ({activeChord.symbol})</strong> otomatis diberi{' '}
                    <strong>{activeSlotResolved.resolvedBeats} ketukan</strong> di {bpm} BPM agar petikan selesai utuh sebelum pindah chord.
                  </p>
                ) : !autoFitBeats &&
                  activeSlotResolved.minPatternBeats >
                    activeSlotResolved.baseBeats ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
                    <span>
                      Di {bpm} BPM, pola untuk <strong>{activeChord.symbol}</strong> butuh sekitar{' '}
                      <strong>{activeSlotResolved.minPatternBeats} ketukan</strong> agar tidak terpotong ({activeSlotResolved.baseBeats} ketukan terlalu singkat).
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoFitBeats(true)}
                      className="rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-100 hover:bg-amber-500/30"
                    >
                      Aktifkan Pas Pola
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Pattern Mode Selector: Strum vs Petik */}
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
                    Cara Genjreng (Strum)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {strumPatterns.map((item) => {
                      const active = pattern === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active}
                          title={item.description}
                          onClick={() => {
                            setPattern(item.id);
                            if (item.id === 'custom-rhythm') {
                              handlePlayCustomRhythm();
                            } else {
                              playFretsWithPattern(effectiveFrets, item.id);
                            }
                          }}
                          className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                              : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:text-(--st-text)'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
                    Cara Petik (Fingerstyle / Arpeggio)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {petikPatterns.map((item) => {
                      const active = pattern === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active}
                          title={item.description}
                          onClick={() => {
                            setPattern(item.id);
                            if (item.id === 'custom-string') {
                              handlePickCustomStrings();
                            } else {
                              playFretsWithPattern(effectiveFrets, item.id);
                            }
                          }}
                          className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                              : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:text-(--st-text)'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-Slot Custom Assignment & Custom Beats */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-(--st-text)">
                      Khusus Slot {safeActiveIndex + 1} ({activeChord.symbol}):
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAssignSlotCustom(safeActiveIndex, {
                          pattern,
                          customRhythmSteps:
                            pattern === 'custom-rhythm'
                              ? [...customRhythmSteps]
                              : undefined,
                          customStringOrder:
                            pattern === 'custom-string'
                              ? [...customStringOrder]
                              : undefined,
                        })
                      }
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-purple-400/50 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-500/20"
                    >
                      <Pin className="h-3 w-3" aria-hidden="true" />
                      <span>
                        Assign &ldquo;{getPlayPatternShortLabel(pattern)}&rdquo; ke Slot ini
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-(--st-text-muted)">
                        Ulang Pola:
                      </span>
                      <button
                        type="button"
                        aria-label="Kurangi pengulangan pola slot ini"
                        onClick={() =>
                          handleAssignSlotCustom(safeActiveIndex, {
                            repeat: clampRepeat(activeSlotResolved.repeat - 1),
                          })
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface) font-bold text-(--st-text) hover:border-(--st-accent)"
                      >
                        -
                      </button>
                      <span
                        data-testid="active-slot-repeat"
                        className="inline-flex h-7 min-w-9 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface) px-1.5 font-mono text-xs font-bold text-(--st-text)"
                      >
                        {activeSlotResolved.repeat}x
                      </span>
                      <button
                        type="button"
                        aria-label="Tambah pengulangan pola slot ini"
                        onClick={() =>
                          handleAssignSlotCustom(safeActiveIndex, {
                            repeat: clampRepeat(activeSlotResolved.repeat + 1),
                          })
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface) font-bold text-(--st-text) hover:border-(--st-accent)"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-(--st-text-muted)">
                        Ketukan Slot:
                      </span>
                      <button
                        type="button"
                        aria-label="Kurangi ketukan khusus slot ini"
                        onClick={() =>
                          handleAssignSlotCustom(safeActiveIndex, {
                            beats: clampBeats(activeSlotResolved.baseBeats - 1),
                          })
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface) font-bold text-(--st-text) hover:border-(--st-accent)"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={32}
                        aria-label="Ketukan khusus slot aktif"
                        value={activeSlot?.custom?.beats ?? beatsPerChord}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (Number.isFinite(parsed) && parsed > 0) {
                            handleAssignSlotCustom(safeActiveIndex, {
                              beats: clampBeats(parsed),
                            });
                          }
                        }}
                        className="h-7 w-11 rounded-md border border-(--st-border) bg-(--st-surface) text-center font-mono text-xs font-bold text-(--st-text)"
                      />
                      <button
                        type="button"
                        aria-label="Tambah ketukan khusus slot ini"
                        onClick={() =>
                          handleAssignSlotCustom(safeActiveIndex, {
                            beats: clampBeats(activeSlotResolved.baseBeats + 1),
                          })
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--st-border) bg-(--st-surface) font-bold text-(--st-text) hover:border-(--st-accent)"
                      >
                        +
                      </button>
                    </div>

                    {activeSlotResolved.hasCustomPattern ||
                    activeSlotResolved.hasCustomBeats ||
                    activeSlotResolved.hasCustomRepeat ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleAssignSlotCustom(safeActiveIndex, {
                            pattern: undefined,
                            beats: undefined,
                            repeat: undefined,
                          })
                        }
                        className="ml-1 inline-flex min-h-7 items-center gap-1 rounded-md border border-(--st-border) bg-(--st-surface) px-2 py-0.5 text-[11px] font-semibold text-(--st-text-muted) hover:text-(--st-danger)"
                      >
                        Reset Slot
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            {/* Right: Active Chord Diagram + Quick Actions */}
            <Card className="flex flex-col justify-between p-4 lg:col-span-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-(--st-text)">
                      {activeChord.symbol}
                    </h2>
                    <span className="text-xs font-medium text-(--st-text-muted)">
                      {activeChord.name}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">
                      {CHORD_CATEGORY_LABELS[activeChord.category]}
                    </Badge>
                    <Badge tone={activeChord.isBarre ? 'accent' : 'neutral'}>
                      {activeChord.isBarre ? 'Barre' : 'Open'}
                    </Badge>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Mute guitar sound"
                  onClick={() => {
                    setIsPlayingLoop(false);
                    stopChordPreview();
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1 text-xs font-semibold text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)"
                >
                  <Square className="h-3 w-3" aria-hidden="true" />
                  <span>Diam</span>
                </button>
              </div>

              <div className="my-2">
                <ChordDiagram chord={activeChord} guitarTone={guitarTone} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    playFretsWithPattern(effectiveFrets, 'strum-down')
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-(--st-accent) px-3 py-2 text-xs font-semibold text-(--st-accent-text) hover:opacity-95"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Strum Down</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    playFretsWithPattern(effectiveFrets, 'strum-up')
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-(--st-border-strong) bg-(--st-surface-elevated) px-3 py-2 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Strum Up</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    playFretsWithPattern(effectiveFrets, 'arpeggio-down-up')
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-2 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
                >
                  <Music className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Petik Arpeggio</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    playFretsWithPattern(effectiveFrets, 'fingerpick')
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-2 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
                >
                  <Music className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Petik Fingerpick</span>
                </button>
              </div>
            </Card>
          </div>

          {/* Custom Strum & Custom Petik Rhythm Builder */}
          <CustomRhythmPanel
            steps={customRhythmSteps}
            isActivePattern={pattern === 'custom-rhythm'}
            bpm={bpm}
            keyMap={keyMap}
            activeSlotLabel={`Slot ${safeActiveIndex + 1} (${activeChord.symbol})`}
            isAssignedToActiveSlot={
              activeSlot?.custom?.pattern === 'custom-rhythm'
            }
            onChangeSteps={setCustomRhythmSteps}
            onSelectPreset={(presetSteps) => {
              const next = [...presetSteps];
              setCustomRhythmSteps(next);
              setPattern('custom-rhythm');
              handlePlayCustomRhythm(next);
            }}
            onPlayCustomRhythm={() => handlePlayCustomRhythm()}
            onUseAsAutoPattern={() => {
              setPattern('custom-rhythm');
              handlePlayCustomRhythm();
            }}
            onAssignToActiveSlot={() => {
              handleAssignSlotCustom(safeActiveIndex, {
                pattern: 'custom-rhythm',
                customRhythmSteps: [...customRhythmSteps],
              });
              handlePlayCustomRhythm();
            }}
            onClearSlotAssignment={() =>
              handleAssignSlotCustom(safeActiveIndex, { pattern: undefined })
            }
            onDragAssignStart={(dragSteps) => {
              chordDragRef.current = {
                kind: 'custom-rhythm',
                steps: dragSteps,
              };
            }}
            onDragAssignEnd={() => {
              chordDragRef.current = null;
              setDragOverSlotIdx(null);
            }}
          />
        </div>
      ) : null}

      {/* TAB 2: Variasi & Custom Senar */}
      {activeTab === 'variation' ? (
        <CustomStringVariationPanel
          activeChord={activeChord}
          effectiveFrets={effectiveFrets}
          stringOverrides={pinnedFrets}
          customStringMask={customStringMask}
          customStringOrder={customStringOrder}
          keyMap={keyMap}
          activeSlotLabel={`Slot ${safeActiveIndex + 1} (${activeChord.symbol})`}
          isStringOrderAssignedToSlot={
            activeSlot?.custom?.pattern === 'custom-string'
          }
          onSetStringOverride={handleSetStringOverride}
          onResetOverrides={() => setPinnedFrets({})}
          onToggleCustomString={(idx) =>
            setCustomStringMask((prev) => {
              const next = [...prev] as StringMask;
              next[idx] = !next[idx];
              return next;
            })
          }
          onSetCustomStringMask={setCustomStringMask}
          onSetCustomStringOrder={setCustomStringOrder}
          onStrumCustomStrings={handleStrumCustomStrings}
          onPickCustomStrings={handlePickCustomStrings}
          onAssignCustomStringToSlot={() => {
            handleAssignSlotCustom(safeActiveIndex, {
              pattern: 'custom-string',
              customStringOrder: [...customStringOrder],
            });
            handlePickCustomStrings();
          }}
          onClearSlotAssignment={() =>
            handleAssignSlotCustom(safeActiveIndex, { pattern: undefined })
          }
        />
      ) : null}

      {/* TAB 3: Main Pakai Keyboard (Custom Key & Shortcut Settings) */}
      {activeTab === 'custom-key' ? (
        <div className="flex flex-col gap-4">
          <CustomKeyPlayPanel
            activeChord={activeChord}
            effectiveFrets={effectiveFrets}
            customStringMask={customStringMask}
            customStringOrder={customStringOrder}
            customRhythmSteps={customRhythmSteps}
            keyMap={keyMap}
            activeCustomKeyId={activeCustomKeyId}
            onUpdateKeyMap={handleUpdateKeyMap}
            onTriggerCustomBinding={handleTriggerCustomBinding}
            onCapturingChange={setIsCapturingCustomChordKey}
          />

          <div className="flex justify-end">
            <button
              type="button"
              aria-expanded={showKeyMapPanel}
              onClick={() => setShowKeyMapPanel((prev) => !prev)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showKeyMapPanel
                  ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                  : 'border-(--st-border) bg-(--st-surface) text-(--st-text) hover:border-(--st-border-strong)'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {showKeyMapPanel
                  ? 'Tutup Pengaturan Tombol Bawaan'
                  : 'Atur Tombol Bawaan Keyboard (Spasi, 1–8, Z–N)'}
              </span>
            </button>
          </div>

          {showKeyMapPanel ? (
            <CustomKeyMapPanel
              keyMap={keyMap}
              onUpdateKeyMap={handleUpdateKeyMap}
              onResetKeyMap={handleResetKeyMap}
              onClose={() => setShowKeyMapPanel(false)}
              onCapturingChange={setIsCapturingKey}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
