import { useEffect, useState } from 'react';
import { Keyboard, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Switch';
import { STANDARD_OPEN_MIDI } from '../../../engines/audio/ChordPreviewSynth';
import { NOTE_NAMES } from '../../../engines/pitch/NoteMapper';
import {
  REMAPPABLE_ACTION_META,
  type CustomFretKeyBinding,
  type PlaygroundKeyMap,
  type RemappableActionId,
} from '../playground.types';
import {
  formatKeyBadge,
  normalizeKeyboardKey,
} from '../playgroundKeymapStorage';

interface CustomKeyMapPanelProps {
  keyMap: PlaygroundKeyMap;
  onUpdateKeyMap: (next: PlaygroundKeyMap) => void;
  onResetKeyMap: () => void;
  onClose: () => void;
  onCapturingChange?: (capturing: boolean) => void;
}

type CaptureTarget =
  | { type: 'action'; actionId: RemappableActionId }
  | { type: 'new-fret' };

const IGNORED_CAPTURE_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Tab',
]);

function formatNoteLabel(stringIndex: number, fret: number): string {
  const midi = STANDARD_OPEN_MIDI[stringIndex]! + fret;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function CustomKeyMapPanel({
  keyMap,
  onUpdateKeyMap,
  onResetKeyMap,
  onClose,
  onCapturingChange,
}: CustomKeyMapPanelProps) {
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(
    null,
  );
  const [newStringIndex, setNewStringIndex] = useState<number>(5);
  const [newFret, setNewFret] = useState<number>(0);

  useEffect(() => {
    onCapturingChange?.(captureTarget !== null);
  }, [captureTarget, onCapturingChange]);

  useEffect(() => {
    if (!captureTarget) {
      return;
    }

    const handleCaptureKeyDown = (event: KeyboardEvent) => {
      if (IGNORED_CAPTURE_KEYS.has(event.key)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setCaptureTarget(null);
        return;
      }

      const normalized = normalizeKeyboardKey(event.key);
      if (captureTarget.type === 'action') {
        onUpdateKeyMap({
          ...keyMap,
          bindings: {
            ...keyMap.bindings,
            [captureTarget.actionId]: normalized,
          },
        });
      } else {
        const entry: CustomFretKeyBinding = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          key: normalized,
          stringIndex: newStringIndex,
          fret: newFret,
        };
        onUpdateKeyMap({
          ...keyMap,
          customFretBindings: [...keyMap.customFretBindings, entry],
        });
      }

      setCaptureTarget(null);
    };

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleCaptureKeyDown, true);
    };
  }, [captureTarget, keyMap, newFret, newStringIndex, onUpdateKeyMap]);

  const stringActions = REMAPPABLE_ACTION_META.filter(
    (m) => m.group === 'strings',
  );
  const patternActions = REMAPPABLE_ACTION_META.filter(
    (m) => m.group === 'patterns',
  );
  const chordActions = REMAPPABLE_ACTION_META.filter(
    (m) => m.group === 'chords',
  );

  return (
    <Card className="border-(--st-accent)/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--st-border) pb-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-(--st-accent)" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-(--st-text)">
              Pengaturan Keyboard &amp; Custom Key
            </h2>
            <p className="text-xs text-(--st-text-muted)">
              Klik tombol key lalu tekan tombol keyboard yang diinginkan (Esc
              untuk batal)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onResetKeyMap}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1 text-xs font-semibold text-(--st-text-muted) hover:text-(--st-text)"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            aria-label="Tutup pengaturan keyboard"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--st-text-muted) hover:bg-(--st-surface-elevated) hover:text-(--st-text)"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Behavior Toggles */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-2">
          <div>
            <div className="text-xs font-semibold text-(--st-text)">
              Auto-Strum Saat Ganti Chord
            </div>
            <div className="text-[11px] text-(--st-text-muted)">
              Langsung bunyikan chord ketika tombol slot 1–8 ditekan
            </div>
          </div>
          <Switch
            label="Auto-Strum Saat Ganti Chord"
            checked={keyMap.autoStrumOnChordKey}
            onChange={(checked) =>
              onUpdateKeyMap({ ...keyMap, autoStrumOnChordKey: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-2">
          <div>
            <div className="text-xs font-semibold text-(--st-text)">
              Baris Melodi Fret (Q–P &amp; A–;)
            </div>
            <div className="text-[11px] text-(--st-text-muted)">
              Q–P memetik Senar 1 Fret 0–9, A–; memetik Senar 2 Fret 0–9
            </div>
          </div>
          <Switch
            label="Baris Melodi Fret"
            checked={keyMap.enableFretMelodyKeys}
            onChange={(checked) =>
              onUpdateKeyMap({ ...keyMap, enableFretMelodyKeys: checked })
            }
          />
        </div>
      </div>

      {/* Remappable Action Grids */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
            Petik Senar Aktif
          </h3>
          <div className="flex flex-col gap-1.5">
            {stringActions.map((meta) => {
              const isCapturing =
                captureTarget?.type === 'action' &&
                captureTarget.actionId === meta.id;
              return (
                <div
                  key={meta.id}
                  className="flex items-center justify-between rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1.5"
                >
                  <span className="text-xs text-(--st-text)">{meta.label}</span>
                  <button
                    type="button"
                    aria-label={`Ubah tombol ${meta.label}`}
                    onClick={() =>
                      setCaptureTarget({ type: 'action', actionId: meta.id })
                    }
                    className={`min-h-7 min-w-14 rounded-md border px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
                      isCapturing
                        ? 'border-(--st-accent) bg-(--st-accent) text-(--st-accent-text)'
                        : 'border-(--st-border-strong) bg-(--st-surface) text-(--st-text)'
                    }`}
                  >
                    {isCapturing
                      ? 'Tekan...'
                      : formatKeyBadge(keyMap.bindings[meta.id])}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
            Strum &amp; Pola Petik
          </h3>
          <div className="flex flex-col gap-1.5">
            {patternActions.map((meta) => {
              const isCapturing =
                captureTarget?.type === 'action' &&
                captureTarget.actionId === meta.id;
              return (
                <div
                  key={meta.id}
                  className="flex items-center justify-between rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2.5 py-1.5"
                >
                  <span className="text-xs text-(--st-text)">{meta.label}</span>
                  <button
                    type="button"
                    aria-label={`Ubah tombol ${meta.label}`}
                    onClick={() =>
                      setCaptureTarget({ type: 'action', actionId: meta.id })
                    }
                    className={`min-h-7 min-w-14 rounded-md border px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
                      isCapturing
                        ? 'border-(--st-accent) bg-(--st-accent) text-(--st-accent-text)'
                        : 'border-(--st-border-strong) bg-(--st-surface) text-(--st-text)'
                    }`}
                  >
                    {isCapturing
                      ? 'Tekan...'
                      : formatKeyBadge(keyMap.bindings[meta.id])}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-(--st-text-muted) uppercase">
            Slot Progresi Chord
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {chordActions.map((meta) => {
              const isCapturing =
                captureTarget?.type === 'action' &&
                captureTarget.actionId === meta.id;
              return (
                <div
                  key={meta.id}
                  className="flex items-center justify-between rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2 py-1.5"
                >
                  <span className="text-[11px] text-(--st-text)">
                    {meta.label.replace('Chord ', '')}
                  </span>
                  <button
                    type="button"
                    aria-label={`Ubah tombol ${meta.label}`}
                    onClick={() =>
                      setCaptureTarget({ type: 'action', actionId: meta.id })
                    }
                    className={`min-h-7 min-w-9 rounded-md border px-1.5 py-0.5 font-mono text-xs font-bold transition-colors ${
                      isCapturing
                        ? 'border-(--st-accent) bg-(--st-accent) text-(--st-accent-text)'
                        : 'border-(--st-border-strong) bg-(--st-surface) text-(--st-text)'
                    }`}
                  >
                    {isCapturing
                      ? '...'
                      : formatKeyBadge(keyMap.bindings[meta.id])}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom Fret Note Bindings */}
      <div className="mt-4 border-t border-(--st-border) pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-(--st-text)">
              Custom Key untuk Nada Fret Spesifik (Fingerstyle)
            </h3>
            <p className="text-[11px] text-(--st-text-muted)">
              Ikat tombol keyboard apa pun ke senar &amp; fret tertentu (0–12)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Pilih senar custom key"
              value={newStringIndex}
              onChange={(event) => setNewStringIndex(Number(event.target.value))}
              className="min-h-8 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2 text-xs text-(--st-text)"
            >
              <option value={0}>Senar 6 (E)</option>
              <option value={1}>Senar 5 (A)</option>
              <option value={2}>Senar 4 (D)</option>
              <option value={3}>Senar 3 (G)</option>
              <option value={4}>Senar 2 (B)</option>
              <option value={5}>Senar 1 (e)</option>
            </select>

            <select
              aria-label="Pilih fret custom key"
              value={newFret}
              onChange={(event) => setNewFret(Number(event.target.value))}
              className="min-h-8 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2 text-xs text-(--st-text)"
            >
              {Array.from({ length: 13 }, (_, fret) => (
                <option key={fret} value={fret}>
                  {fret === 0 ? 'Open (0)' : `Fret ${fret}`} (
                  {formatNoteLabel(newStringIndex, fret)})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setCaptureTarget({ type: 'new-fret' })}
              className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                captureTarget?.type === 'new-fret'
                  ? 'border-(--st-accent) bg-(--st-accent) text-(--st-accent-text)'
                  : 'border-(--st-border-strong) bg-(--st-surface-elevated) text-(--st-text) hover:border-(--st-accent)'
              }`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {captureTarget?.type === 'new-fret'
                  ? 'Tekan Tombol...'
                  : 'Bind Key'}
              </span>
            </button>
          </div>
        </div>

        {keyMap.customFretBindings.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {keyMap.customFretBindings.map((binding) => (
              <div
                key={binding.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-(--st-border) bg-(--st-surface-elevated) px-2 py-1 text-xs"
              >
                <kbd className="rounded bg-(--st-surface) px-1.5 py-0.5 font-mono text-[11px] font-bold text-(--st-accent)">
                  {formatKeyBadge(binding.key)}
                </kbd>
                <span className="text-(--st-text)">
                  Senar {6 - binding.stringIndex} ·{' '}
                  {binding.fret === 0 ? 'Open' : `Fret ${binding.fret}`} (
                  {formatNoteLabel(binding.stringIndex, binding.fret)})
                </span>
                <button
                  type="button"
                  aria-label={`Hapus binding ${formatKeyBadge(binding.key)}`}
                  onClick={() =>
                    onUpdateKeyMap({
                      ...keyMap,
                      customFretBindings: keyMap.customFretBindings.filter(
                        (item) => item.id !== binding.id,
                      ),
                    })
                  }
                  className="text-(--st-text-muted) hover:text-(--st-danger)"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

