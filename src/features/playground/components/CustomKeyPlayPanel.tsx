import { useEffect, useState } from 'react';
import { Keyboard, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Switch';
import type { PlayPatternStyle } from '../../../engines/audio/ChordPreviewSynth';
import type { ChordDefinition } from '../../chords/chords.types';
import {
  SAMPLE_VARIATION_CUSTOM_KEYS,
  type CustomChordKeyBinding,
  type PlaygroundKeyMap,
  type StringMask,
} from '../playground.types';
import {
  applyCustomStringMask,
  detectVariationChordLabel,
  formatFretsCompact,
} from '../playgroundChordUtils';
import {
  formatKeyBadge,
  normalizeKeyboardKey,
} from '../playgroundKeymapStorage';

interface CustomKeyPlayPanelProps {
  activeChord: ChordDefinition;
  effectiveFrets: readonly [number, number, number, number, number, number];
  customStringMask: StringMask;
  customStringOrder: readonly number[];
  keyMap: PlaygroundKeyMap;
  activeCustomKeyId: string | null;
  onUpdateKeyMap: (next: PlaygroundKeyMap) => void;
  onTriggerCustomBinding: (binding: CustomChordKeyBinding) => void;
  onCapturingChange?: (capturing: boolean) => void;
}

const IGNORED_CAPTURE_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Tab',
]);

const CUSTOM_KEY_PLAY_MODE_OPTIONS: ReadonlyArray<{
  id: PlayPatternStyle;
  label: string;
}> = [
  { id: 'strum-down', label: 'Strum Down ↓' },
  { id: 'strum-up', label: 'Strum Up ↑' },
  { id: 'custom-string', label: 'Petik Custom Senar' },
  { id: 'fingerpick', label: 'Fingerpick' },
  { id: 'arpeggio-down-up', label: 'Arpeggio ↓↑' },
];

export function CustomKeyPlayPanel({
  activeChord,
  effectiveFrets,
  customStringMask,
  customStringOrder,
  keyMap,
  activeCustomKeyId,
  onUpdateKeyMap,
  onTriggerCustomBinding,
  onCapturingChange,
}: CustomKeyPlayPanelProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedPlayMode, setSelectedPlayMode] =
    useState<PlayPatternStyle>('strum-down');
  const [customLabel, setCustomLabel] = useState('');

  const maskedFrets = applyCustomStringMask(effectiveFrets, customStringMask);
  const detectedName = detectVariationChordLabel(
    maskedFrets,
    activeChord.symbol,
  );

  useEffect(() => {
    onCapturingChange?.(isCapturing);
  }, [isCapturing, onCapturingChange]);

  useEffect(() => {
    if (!isCapturing) {
      return;
    }

    const handleCapture = (event: KeyboardEvent) => {
      if (IGNORED_CAPTURE_KEYS.has(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setIsCapturing(false);
        return;
      }

      const normalizedKey = normalizeKeyboardKey(event.key);
      const entry: CustomChordKeyBinding = {
        id: `ck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: normalizedKey,
        label: customLabel.trim() || detectedName,
        chordId: activeChord.id,
        frets: maskedFrets,
        playMode: selectedPlayMode,
        customStringOrder:
          selectedPlayMode === 'custom-string'
            ? [...customStringOrder]
            : undefined,
      };

      const filtered = keyMap.customChordBindings.filter(
        (b) => b.key !== normalizedKey,
      );
      onUpdateKeyMap({
        ...keyMap,
        customChordBindings: [...filtered, entry],
      });
      setCustomLabel('');
      setIsCapturing(false);
    };

    window.addEventListener('keydown', handleCapture, true);
    return () => {
      window.removeEventListener('keydown', handleCapture, true);
    };
  }, [
    activeChord.id,
    customLabel,
    customStringOrder,
    detectedName,
    isCapturing,
    keyMap,
    maskedFrets,
    onUpdateKeyMap,
    selectedPlayMode,
  ]);

  const handleLoadSampleVariations = () => {
    const existingKeys = new Set(keyMap.customChordBindings.map((b) => b.key));
    const additions = SAMPLE_VARIATION_CUSTOM_KEYS.filter(
      (sample) => !existingKeys.has(sample.key),
    ).map((sample) => ({ ...sample, frets: [...sample.frets] as [number, number, number, number, number, number] }));

    if (additions.length === 0) {
      return;
    }

    onUpdateKeyMap({
      ...keyMap,
      customChordBindings: [...keyMap.customChordBindings, ...additions],
    });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--st-border) pb-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-(--st-accent)" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-(--st-text)">
              Play by Custom Key (Chord, Variasi Senar &amp; Custom String)
            </h2>
            <p className="text-xs text-(--st-text-muted)">
              Simpan voicing atau variasi chord aktif ke tombol keyboard mana
              pun lalu tekan tombolnya untuk langsung main
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1">
            <span className="text-[11px] font-semibold text-(--st-text)">
              Fokus Custom Key (Kunci Q–P)
            </span>
            <Switch
              label="Fokus Custom Key"
              checked={keyMap.playByCustomKeyOnly}
              onChange={(checked) =>
                onUpdateKeyMap({ ...keyMap, playByCustomKeyOnly: checked })
              }
            />
          </div>

          <button
            type="button"
            onClick={handleLoadSampleVariations}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1 text-xs font-semibold text-(--st-text) hover:border-(--st-accent)"
          >
            <Sparkles className="h-3.5 w-3.5 text-(--st-accent)" aria-hidden="true" />
            <span>Contoh Variasi C (U/I/O)</span>
          </button>
        </div>
      </div>

      {/* Bind Current Voicing & Variation to a Keyboard Key */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) p-2.5">
        <span className="rounded-md bg-(--st-surface) px-2 py-1 font-mono text-xs font-bold text-(--st-accent)">
          {detectedName} · {formatFretsCompact(maskedFrets)}
        </span>

        <input
          type="text"
          aria-label="Label custom key voicing"
          value={customLabel}
          onChange={(event) => setCustomLabel(event.target.value)}
          placeholder={`Nama pad (default: ${detectedName})`}
          className="min-h-8 min-w-44 flex-1 rounded-lg border border-(--st-border) bg-(--st-surface) px-2.5 text-xs text-(--st-text) placeholder:text-(--st-text-muted)"
        />

        <select
          aria-label="Pola main custom key"
          value={selectedPlayMode}
          onChange={(event) =>
            setSelectedPlayMode(event.target.value as PlayPatternStyle)
          }
          className="min-h-8 rounded-lg border border-(--st-border) bg-(--st-surface) px-2 text-xs text-(--st-text)"
        >
          {CUSTOM_KEY_PLAY_MODE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setIsCapturing((prev) => !prev)}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
            isCapturing
              ? 'bg-amber-400 text-zinc-950'
              : 'bg-(--st-accent) text-(--st-accent-text) hover:opacity-95'
          }`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {isCapturing
              ? 'Tekan Tombol Keyboard... (Esc batal)'
              : 'Bind ke Custom Key'}
          </span>
        </button>
      </div>

      {/* Bound Custom Key Performance Pads */}
      {keyMap.customChordBindings.length === 0 ? (
        <p className="mt-3 text-xs text-(--st-text-muted)">
          Belum ada Custom Key voicing. Ubah tekanan senar di atas (misal
          lepas S2 pada kunci C) lalu klik{' '}
          <strong className="text-(--st-text)">Bind ke Custom Key</strong> atau
          muat{' '}
          <strong className="text-(--st-text)">Contoh Variasi C (U/I/O)</strong>
          .
        </p>
      ) : (
        <div
          role="list"
          aria-label="Custom key chord pads"
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {keyMap.customChordBindings.map((binding) => {
            const isActive = activeCustomKeyId === binding.id;
            const badgeKey = formatKeyBadge(binding.key);
            return (
              <div
                key={binding.id}
                role="listitem"
                className={`flex items-center justify-between gap-2 rounded-xl border p-2 transition-colors ${
                  isActive
                    ? 'border-(--st-accent) bg-(--st-accent-soft)'
                    : 'border-(--st-border) bg-(--st-surface-elevated)'
                }`}
              >
                <button
                  type="button"
                  aria-label={`Mainkan Custom Key ${badgeKey}: ${binding.label}`}
                  onClick={() => onTriggerCustomBinding(binding)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <kbd className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-(--st-accent) px-2 font-mono text-xs font-extrabold text-(--st-accent-text)">
                    {badgeKey}
                  </kbd>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-(--st-text)">
                      {binding.label}
                    </div>
                    <div className="truncate font-mono text-[10px] text-(--st-text-muted)">
                      {formatFretsCompact(binding.frets)} · {binding.playMode}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-label={`Hapus Custom Key ${badgeKey}`}
                  onClick={() =>
                    onUpdateKeyMap({
                      ...keyMap,
                      customChordBindings: keyMap.customChordBindings.filter(
                        (item) => item.id !== binding.id,
                      ),
                    })
                  }
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-(--st-text-muted) hover:bg-(--st-surface) hover:text-(--st-danger)"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

