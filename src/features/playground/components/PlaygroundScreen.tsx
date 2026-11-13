import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Keyboard,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Volume2,
  VolumeX,
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
  DEFAULT_CUSTOM_STRING_MASK,
  DEFAULT_CUSTOM_STRING_ORDER,
  PLAY_PATTERN_OPTIONS,
  PROGRESSION_PRESETS,
  STRING_1_MELODY_KEYS,
  STRING_2_MELODY_KEYS,
  type ChordProgressionPreset,
  type CustomChordKeyBinding,
  type PlaygroundKeyMap,
  type RemappableActionId,
  type StringMask,
} from '../playground.types';
import { applyCustomStringMask } from '../playgroundChordUtils';
import {
  loadPlaygroundKeyMap,
  normalizeKeyboardKey,
  resetPlaygroundKeyMap,
  savePlaygroundKeyMap,
} from '../playgroundKeymapStorage';
import { CustomKeyMapPanel } from './CustomKeyMapPanel';
import { CustomKeyPlayPanel } from './CustomKeyPlayPanel';
import { CustomStringVariationPanel } from './CustomStringVariationPanel';
import { GuitarNeckStage } from './GuitarNeckStage';

const MAX_PROGRESSION_SLOTS = 8;

const STRING_META = [
  { index: 0, label: 'E', stringNumber: 6, thicknessClass: 'h-[3px]' },
  { index: 1, label: 'A', stringNumber: 5, thicknessClass: 'h-[2.5px]' },
  { index: 2, label: 'D', stringNumber: 4, thicknessClass: 'h-[2px]' },
  { index: 3, label: 'G', stringNumber: 3, thicknessClass: 'h-[1.75px]' },
  { index: 4, label: 'B', stringNumber: 2, thicknessClass: 'h-[1.5px]' },
  { index: 5, label: 'e', stringNumber: 1, thicknessClass: 'h-[1.25px]' },
] as const;

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
  const [progressionIds, setProgressionIds] = useState<string[]>(() => [
    ...initialPreset.chordIds,
  ]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [pattern, setPattern] = useState<PlayPatternStyle>(
    initialPreset.recommendedPattern,
  );
  const [bpm, setBpm] = useState<number>(initialPreset.recommendedBpm);
  const [beatsPerChord, setBeatsPerChord] = useState<2 | 4>(4);
  const [isPlayingLoop, setIsPlayingLoop] = useState<boolean>(false);
  const [currentBeat, setCurrentBeat] = useState<number>(0);

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
  const [activeCustomKeyId, setActiveCustomKeyId] = useState<string | null>(
    null,
  );
  const [activePlayedNote, setActivePlayedNote] = useState<{
    stringIndex: number;
    fret: number;
    noteName: string;
  } | null>(null);

  const vibrationTimersRef = useRef<Map<number, number>>(new Map());
  const isPointerSweepingRef = useRef<boolean>(false);
  const lastSweptStringRef = useRef<number | null>(null);

  const progressionChords = useMemo(
    () =>
      progressionIds
        .map((id) => chordMap.get(id))
        .filter((item): item is ChordDefinition => item !== undefined),
    [chordMap, progressionIds],
  );

  const safeActiveIndex = Math.min(
    activeSlotIndex,
    Math.max(0, progressionChords.length - 1),
  );
  const activeChord = progressionChords[safeActiveIndex] ?? CHORDS[0]!;

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

  useEffect(() => {
    const stopSweep = () => {
      isPointerSweepingRef.current = false;
      lastSweptStringRef.current = null;
    };
    window.addEventListener('pointerup', stopSweep);
    window.addEventListener('pointercancel', stopSweep);
    return () => {
      window.removeEventListener('pointerup', stopSweep);
      window.removeEventListener('pointercancel', stopSweep);
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

  const playFretsWithPattern = useCallback(
    (
      frets: readonly [number, number, number, number, number, number],
      chosenPattern: PlayPatternStyle,
      customOrderOverride?: readonly number[],
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

      triggerFretsVisualPulse(frets);
      void playChordPreview(frets, {
        tone: guitarTone,
        pattern: chosenPattern,
      });
    },
    [
      customStringOrder,
      guitarTone,
      triggerFretsVisualPulse,
      triggerStringVibration,
    ],
  );

  const playChordWithPattern = useCallback(
    (chord: ChordDefinition, chosenPattern: PlayPatternStyle) => {
      if (chosenPattern === 'custom-string') {
        const masked = applyCustomStringMask(chord.frets, customStringMask);
        playFretsWithPattern(masked, 'custom-string', customStringOrder);
        return;
      }
      playFretsWithPattern(chord.frets, chosenPattern);
    },
    [customStringMask, customStringOrder, playFretsWithPattern],
  );

  const handleStrumCustomStrings = useCallback(() => {
    const masked = applyCustomStringMask(effectiveFrets, customStringMask);
    playFretsWithPattern(masked, 'strum-down');
  }, [customStringMask, effectiveFrets, playFretsWithPattern]);

  const handlePickCustomStrings = useCallback(() => {
    const masked = applyCustomStringMask(effectiveFrets, customStringMask);
    playFretsWithPattern(masked, 'custom-string', customStringOrder);
  }, [customStringMask, customStringOrder, effectiveFrets, playFretsWithPattern]);

  // Auto-play progression loop
  const activeSlotIndexRef = useRef(safeActiveIndex);
  activeSlotIndexRef.current = safeActiveIndex;

  const loopStateRef = useRef({
    slotIndex: safeActiveIndex,
    beat: 0,
  });

  useEffect(() => {
    if (!isPlayingLoop || progressionChords.length === 0) {
      return;
    }

    const startSlot = activeSlotIndexRef.current;
    loopStateRef.current = { slotIndex: startSlot, beat: 0 };
    setCurrentBeat(0);

    const firstChord = progressionChords[startSlot];
    if (firstChord) {
      playChordWithPattern(firstChord, pattern);
    }

    const beatIntervalMs = Math.round((60 / bpm) * 1000);
    const intervalId = window.setInterval(() => {
      const nextBeat = (loopStateRef.current.beat + 1) % beatsPerChord;
      if (nextBeat === 0) {
        const nextSlot =
          (loopStateRef.current.slotIndex + 1) % progressionChords.length;
        loopStateRef.current = { slotIndex: nextSlot, beat: 0 };
        setActiveSlotIndex(nextSlot);
        setCurrentBeat(0);
        const chord = progressionChords[nextSlot];
        if (chord) {
          playChordWithPattern(chord, pattern);
        }
      } else {
        loopStateRef.current = {
          slotIndex: loopStateRef.current.slotIndex,
          beat: nextBeat,
        };
        setCurrentBeat(nextBeat);
      }
    }, beatIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    beatsPerChord,
    bpm,
    isPlayingLoop,
    pattern,
    playChordWithPattern,
    progressionChords,
  ]);

  const handleChangeTone = (tone: GuitarToneType) => {
    setGuitarTone(tone);
    setGuitarTonePreference(tone);
  };

  const handleSelectPreset = (preset: ChordProgressionPreset) => {
    setIsPlayingLoop(false);
    setSelectedPresetId(preset.id);
    setProgressionIds([...preset.chordIds]);
    setActiveSlotIndex(0);
    setCurrentBeat(0);
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
      loopStateRef.current = { slotIndex: index, beat: 0 };
      setActiveSlotIndex(index);
      setCurrentBeat(0);
      setPinnedFrets({});
      if (shouldPlay) {
        const chord = progressionChords[index];
        if (chord) {
          playChordWithPattern(chord, pattern);
        }
      }
    },
    [pattern, playChordWithPattern, progressionChords],
  );

  const handleRemoveSlot = (index: number) => {
    if (progressionIds.length <= 1) {
      return;
    }
    setSelectedPresetId(null);
    const nextIds = progressionIds.filter((_, idx) => idx !== index);
    setProgressionIds(nextIds);
    if (activeSlotIndex >= nextIds.length) {
      setActiveSlotIndex(nextIds.length - 1);
    } else if (index < activeSlotIndex) {
      setActiveSlotIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const handlePickChord = (chord: ChordDefinition) => {
    setSelectedPresetId(null);
    setPinnedFrets({});
    if (pickerMode === 'add') {
      if (progressionIds.length < MAX_PROGRESSION_SLOTS) {
        const nextIndex = progressionIds.length;
        setProgressionIds((prev) => [...prev, chord.id]);
        setActiveSlotIndex(nextIndex);
      }
    } else if (pickerMode === 'replace') {
      setProgressionIds((prev) =>
        prev.map((id, idx) => (idx === safeActiveIndex ? chord.id : id)),
      );
    }
    setPickerMode('closed');
    playChordWithPattern(chord, pattern);
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

      playFretsWithPattern(
        binding.frets,
        binding.playMode,
        binding.customStringOrder,
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
            Susun progresi chord, pilih mode strum atau petik, dan mainkan
            senar secara interaktif
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={showKeyMapPanel}
            onClick={() => setShowKeyMapPanel((prev) => !prev)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              showKeyMapPanel
                ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                : 'border-(--st-border) bg-(--st-surface) text-(--st-text) hover:border-(--st-border-strong)'
            }`}
          >
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            <span>Custom Key</span>
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

      {/* Custom Keyboard Mapping Panel */}
      {showKeyMapPanel ? (
        <CustomKeyMapPanel
          keyMap={keyMap}
          onUpdateKeyMap={handleUpdateKeyMap}
          onResetKeyMap={handleResetKeyMap}
          onClose={() => setShowKeyMapPanel(false)}
          onCapturingChange={setIsCapturingKey}
        />
      ) : null}

      {/* Visual Real Guitar Fretboard & Fingerstyle Stage */}
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

      {/* String Pressure Variation (Open/Mute) & Play by Custom String */}
      <CustomStringVariationPanel
        activeChord={activeChord}
        effectiveFrets={effectiveFrets}
        stringOverrides={pinnedFrets}
        customStringMask={customStringMask}
        customStringOrder={customStringOrder}
        keyMap={keyMap}
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
      />

      {/* Play by Custom Key (Bind Chords, Variations & Custom Strings to Keys) */}
      <CustomKeyPlayPanel
        activeChord={activeChord}
        effectiveFrets={effectiveFrets}
        customStringMask={customStringMask}
        customStringOrder={customStringOrder}
        keyMap={keyMap}
        activeCustomKeyId={activeCustomKeyId}
        onUpdateKeyMap={handleUpdateKeyMap}
        onTriggerCustomBinding={handleTriggerCustomBinding}
        onCapturingChange={setIsCapturingCustomChordKey}
      />

      {/* Progression Presets & Progression Builder */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-(--st-text)">
              Progresi Chord
            </h2>
            <p className="text-xs text-(--st-text-muted)">
              Pilih preset populer atau susun progresi sendiri (maks.{' '}
              {MAX_PROGRESSION_SLOTS} chord)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setPickerMode((prev) => (prev === 'replace' ? 'closed' : 'replace'))
              }
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                pickerMode === 'replace'
                  ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                  : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text) hover:border-(--st-border-strong)'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ganti {activeChord.symbol}</span>
            </button>

            <button
              type="button"
              disabled={progressionIds.length >= MAX_PROGRESSION_SLOTS}
              onClick={() =>
                setPickerMode((prev) => (prev === 'add' ? 'closed' : 'add'))
              }
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-45 ${
                pickerMode === 'add'
                  ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                  : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text) hover:border-(--st-border-strong)'
              }`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Chord</span>
            </button>
          </div>
        </div>

        {/* Preset Chips */}
        <div
          role="group"
          aria-label="Chord progression presets"
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {PROGRESSION_PRESETS.map((preset) => {
            const active = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectPreset(preset)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                    : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
                }`}
              >
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active Progression Slots */}
        <div
          role="list"
          aria-label="Active chord progression"
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {progressionChords.map((chord, index) => {
            const isSelected = index === safeActiveIndex;
            return (
              <div
                key={`${chord.id}-${index}`}
                role="listitem"
                className={`relative flex items-center justify-between rounded-xl border p-2.5 transition-colors ${
                  isSelected
                    ? 'border-(--st-accent) bg-(--st-accent-soft)'
                    : 'border-(--st-border) bg-(--st-surface-elevated)'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectSlot(index)}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={`Slot ${index + 1}: ${chord.name}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      isSelected
                        ? 'bg-(--st-accent) text-(--st-accent-text)'
                        : 'bg-(--st-surface) text-(--st-text-muted)'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-base font-bold leading-tight text-(--st-text)">
                      {chord.symbol}
                    </div>
                    <div className="truncate text-[11px] text-(--st-text-muted)">
                      {chord.name}
                    </div>
                  </div>
                </button>

                {progressionChords.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Hapus ${chord.symbol} dari slot ${index + 1}`}
                    onClick={() => handleRemoveSlot(index)}
                    className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-(--st-text-muted) hover:bg-(--st-surface) hover:text-(--st-text)"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Chord Picker Drawer */}
        {pickerMode !== 'closed' ? (
          <div className="mt-3 rounded-xl border border-(--st-border-strong) bg-(--st-surface-elevated) p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-(--st-text)">
                {pickerMode === 'add'
                  ? 'Pilih chord untuk ditambahkan ke progresi:'
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
                  aria-label={`${chord.symbol} (${chord.name})`}
                  onClick={() => handlePickChord(chord)}
                  className="flex min-h-10 flex-col items-center justify-center rounded-lg border border-(--st-border) bg-(--st-surface) px-2 py-1 text-center transition-colors hover:border-(--st-accent) hover:bg-(--st-accent-soft)"
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

      {/* Auto-Play Loop & Strum/Petik Pattern Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                  ? 'border border-(--st-border-strong) bg-(--st-surface-elevated) text-(--st-text)'
                  : 'bg-(--st-accent) text-(--st-accent-text)'
              }`}
            >
              {isPlayingLoop ? (
                <>
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  <span>Stop Loop</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Play Progression</span>
                </>
              )}
            </button>

            <div
              role="group"
              aria-label="Beats per chord"
              className="inline-flex rounded-xl border border-(--st-border) bg-(--st-surface-elevated) p-1"
            >
              {([2, 4] as const).map((beats) => (
                <button
                  key={beats}
                  type="button"
                  aria-pressed={beatsPerChord === beats}
                  onClick={() => setBeatsPerChord(beats)}
                  className={`min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    beatsPerChord === beats
                      ? 'bg-(--st-accent) text-(--st-accent-text)'
                      : 'text-(--st-text-muted) hover:text-(--st-text)'
                  }`}
                >
                  {beats} Ketukan
                </button>
              ))}
            </div>

            {isPlayingLoop ? (
              <div
                aria-label="Beat indicator"
                className="flex items-center gap-1.5 px-1"
              >
                {Array.from({ length: beatsPerChord }, (_, idx) => (
                  <span
                    key={idx}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      currentBeat === idx
                        ? 'bg-(--st-accent)'
                        : 'bg-(--st-border-strong)'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="w-full sm:w-56">
            <Slider
              label="Tempo Loop"
              value={bpm}
              min={60}
              max={180}
              valueText={`${bpm} BPM`}
              onChange={setBpm}
            />
          </div>
        </div>

        {/* Pattern Mode Selector: Strum vs Petik */}
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-(--st-border) pt-3 md:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
              Mode Strum (Genjreng)
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

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
              Mode Petik (Fingerpicking / Arpeggio)
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
        </div>
      </Card>

      {/* Active Chord Deck & Interactive 6-String Plucking Board */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Chord Diagram + Quick Actions */}
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
              <span>Mute</span>
            </button>
          </div>

          <div className="my-2">
            <ChordDiagram chord={activeChord} guitarTone={guitarTone} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => playFretsWithPattern(effectiveFrets, 'strum-down')}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-(--st-accent) px-3 py-2 text-xs font-semibold text-(--st-accent-text) hover:opacity-95"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Strum Down</span>
            </button>

            <button
              type="button"
              onClick={() => playFretsWithPattern(effectiveFrets, 'strum-up')}
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
              onClick={() => playFretsWithPattern(effectiveFrets, 'fingerpick')}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-2 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
            >
              <Music className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Petik Fingerpick</span>
            </button>
          </div>
        </Card>

        {/* Right: 6-String Interactive Plucking Board */}
        <Card className="flex flex-col justify-between p-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-(--st-text)">
                Papan Senar Interaktif (Petik / Sapu Senar)
              </h2>
              <p className="text-xs text-(--st-text-muted)">
                Klik satu per satu untuk memetik polifonik, atau tahan &amp; geser
                melintasi senar untuk strum manual
              </p>
            </div>
            <span className="font-mono text-xs text-(--st-text-muted)">
              Notes: {activeChord.notes.join(' · ')}
            </span>
          </div>

          <div
            role="group"
            aria-label="Interactive 6-string plucking board"
            className="mt-3 flex flex-col gap-2 select-none"
          >
            {STRING_META.map((stringInfo) => {
              const fret = effectiveFrets[stringInfo.index]!;
              const isMuted = fret < 0;
              const noteLabel = isMuted
                ? 'Muted'
                : formatStringNote(stringInfo.index, fret);
              const isVibrating = Boolean(vibratingStrings[stringInfo.index]);

              return (
                <button
                  key={stringInfo.stringNumber}
                  type="button"
                  disabled={isMuted}
                  aria-label={
                    isMuted
                      ? `String ${stringInfo.stringNumber} (${stringInfo.label}): Muted`
                      : `Pluck string ${stringInfo.stringNumber} (${stringInfo.label}), ${noteLabel}`
                  }
                  onPointerDown={() => {
                    if (isMuted) return;
                    isPointerSweepingRef.current = true;
                    lastSweptStringRef.current = stringInfo.index;
                    handlePluckString(stringInfo.index);
                  }}
                  onPointerEnter={() => {
                    if (
                      isMuted ||
                      !isPointerSweepingRef.current ||
                      lastSweptStringRef.current === stringInfo.index
                    ) {
                      return;
                    }
                    lastSweptStringRef.current = stringInfo.index;
                    handlePluckString(stringInfo.index);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handlePluckString(stringInfo.index);
                    }
                  }}
                  className={`group flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                    isMuted
                      ? 'cursor-not-allowed border-(--st-border) bg-(--st-surface)/50 opacity-50'
                      : isVibrating
                        ? 'border-(--st-accent) bg-(--st-accent-soft)'
                        : 'cursor-pointer border-(--st-border) bg-(--st-surface-elevated) hover:border-(--st-border-strong)'
                  }`}
                >
                  <div className="flex w-20 shrink-0 items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-(--st-surface) text-xs font-bold text-(--st-text-muted)">
                      {stringInfo.stringNumber}
                    </span>
                    <div className="leading-tight">
                      <div className="text-xs font-bold text-(--st-text)">
                        {stringInfo.label}
                      </div>
                      <div className="text-[10px] text-(--st-text-muted)">
                        {isMuted
                          ? 'X'
                          : fret === 0
                            ? 'Open'
                            : `Fret ${fret}`}
                      </div>
                    </div>
                  </div>

                  {/* Visual Guitar String Line */}
                  <div className="relative flex flex-1 items-center py-2">
                    <span
                      aria-hidden="true"
                      className={`w-full rounded-full transition-transform duration-150 ${stringInfo.thicknessClass} ${
                        isMuted
                          ? 'bg-(--st-border-strong)'
                          : isVibrating
                            ? 'scale-y-150 bg-(--st-accent)'
                            : 'bg-(--st-text-muted)/55 group-hover:bg-(--st-text)'
                      }`}
                    />
                  </div>

                  <div className="flex w-16 shrink-0 items-center justify-end gap-1.5">
                    {isMuted ? (
                      <VolumeX
                        className="h-3.5 w-3.5 text-(--st-text-muted)"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${
                          isVibrating
                            ? 'bg-(--st-accent) text-(--st-accent-text)'
                            : 'bg-(--st-surface) text-(--st-text)'
                        }`}
                      >
                        {noteLabel}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}
