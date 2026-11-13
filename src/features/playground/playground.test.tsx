import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../app/providers/PreferencesProvider';
import { RouterProvider } from '../../app/router';
import { CHORDS } from '../../data/chords';
import * as ChordPreviewSynth from '../../engines/audio/ChordPreviewSynth';
import { PlaygroundScreen } from './components/PlaygroundScreen';
import { PROGRESSION_PRESETS } from './playground.types';
import {
  loadPlaygroundKeyMap,
  normalizeKeyboardKey,
  resetPlaygroundKeyMap,
  savePlaygroundKeyMap,
} from './playgroundKeymapStorage';

function renderPlayground() {
  return render(
    <PreferencesProvider>
      <RouterProvider>
        <PlaygroundScreen />
      </RouterProvider>
    </PreferencesProvider>,
  );
}

describe('Guitar Playground', () => {
  beforeEach(() => {
    resetPlaygroundKeyMap();
    vi.spyOn(ChordPreviewSynth, 'playChordPreview').mockResolvedValue(undefined);
    vi.spyOn(ChordPreviewSynth, 'playStringPreview').mockResolvedValue(
      undefined,
    );
    vi.spyOn(ChordPreviewSynth, 'preloadChordSamples').mockResolvedValue(
      undefined,
    );
    vi.spyOn(ChordPreviewSynth, 'stopChordPreview').mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ensures all PROGRESSION_PRESETS reference valid chord IDs in CHORDS', () => {
    const validIds = new Set(CHORDS.map((c) => c.id));
    for (const preset of PROGRESSION_PRESETS) {
      expect(preset.chordIds.length).toBeGreaterThanOrEqual(3);
      for (const chordId of preset.chordIds) {
        expect(validIds.has(chordId)).toBe(true);
      }
    }
  });

  it('switches progression presets, customizes chords, and triggers strum & petik modes', () => {
    renderPlayground();

    expect(
      screen.getByRole('heading', { name: 'Guitar Playground' }),
    ).toBeVisible();

    // Switch preset to Emotional Ballad (Am-F-C-G)
    fireEvent.click(
      screen.getByRole('button', { name: 'Emotional Ballad (Am–F–C–G)' }),
    );
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledWith(
      [-1, 0, 2, 2, 1, 0], // Am
      expect.objectContaining({ pattern: 'fingerpick' }),
    );

    // Add a chord (E7) to the progression
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Chord' }));
    const searchInput = screen.getByLabelText('Cari chord untuk progresi');
    fireEvent.change(searchInput, { target: { value: 'E7' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'E7 (E Dominant 7th)' }),
    );

    expect(
      screen.getByRole('button', { name: /Slot 5: E Dominant 7th/i }),
    ).toBeVisible();

    // Trigger Strum Up and Petik Arpeggio
    fireEvent.click(screen.getByRole('button', { name: 'Strum Up' }));
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [0, 2, 0, 1, 0, 0],
      expect.objectContaining({ pattern: 'strum-up' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Petik Arpeggio' }));
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [0, 2, 0, 1, 0, 0],
      expect.objectContaining({ pattern: 'arpeggio-down-up' }),
    );

    // Pluck individual string 6 (E2) via Soundhole Pick on E7
    const string6Btn = screen.getByRole('button', {
      name: /Pick Senar 6 \(E\), E2/i,
    });
    fireEvent.pointerDown(string6Btn);
    expect(ChordPreviewSynth.playStringPreview).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({ polyphonic: true }),
    );

    // Switch back to Pop Anthem where C Major has muted string 6
    fireEvent.click(
      screen.getByRole('button', { name: 'Pop Anthem (C–G–Am–F)' }),
    );
    expect(
      screen.getByRole('button', { name: 'Pick Senar 6 (E): Muted' }),
    ).toBeDisabled();
  });

  it('plays individual fret notes on the 12-fret neck and supports fingerstyle fret pinning', () => {
    renderPlayground();

    // Click Fret 3 on String 1 (index 5) -> G4
    const fretCell = screen.getByRole('button', {
      name: 'Fretboard Senar 1 Fret 3 (G4)',
    });
    fireEvent.pointerDown(fretCell);
    expect(ChordPreviewSynth.playStringPreview).toHaveBeenCalledWith(
      5,
      3,
      expect.objectContaining({ polyphonic: true }),
    );
    expect(screen.getByTestId('active-played-note')).toHaveTextContent(
      'G4 · Senar 1 Fret 3',
    );

    // Enable Edit Jari di Fret mode and pin Fret 3 on String 1 over C Major [-1, 3, 2, 0, 1, 0]
    fireEvent.click(
      screen.getByRole('button', { name: /Edit Jari di Fret/i }),
    );
    fireEvent.pointerDown(fretCell);

    fireEvent.click(screen.getByRole('button', { name: 'Strum Down' }));
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [-1, 3, 2, 0, 1, 3],
      expect.objectContaining({ pattern: 'strum-down' }),
    );
  });

  it('plays strings, strums, fret melodies, and allows custom key remapping & storage', () => {
    renderPlayground();

    // Default keyboard shortcuts:
    // '2' switches to slot 2 (G Major: [3, 2, 0, 0, 0, 3]) and auto-strums
    fireEvent.keyDown(window, { key: '2' });
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [3, 2, 0, 0, 0, 3],
      expect.objectContaining({ pattern: 'strum-down' }),
    );

    // 'z' plucks String 6 (index 0, fret 3 on G Major)
    fireEvent.keyDown(window, { key: 'z' });
    expect(ChordPreviewSynth.playStringPreview).toHaveBeenLastCalledWith(
      0,
      3,
      expect.objectContaining({ polyphonic: true }),
    );

    // 'q' plucks String 1 Fret 0 (open E4)
    fireEvent.keyDown(window, { key: 'q' });
    expect(ChordPreviewSynth.playStringPreview).toHaveBeenLastCalledWith(
      5,
      0,
      expect.objectContaining({ polyphonic: true }),
    );

    // 'Space' strums down
    fireEvent.keyDown(window, { key: ' ' });
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [3, 2, 0, 0, 0, 3],
      expect.objectContaining({ pattern: 'strum-down' }),
    );

    // Open Tab 3 -> Pengaturan Tombol Bawaan -> Remap 'Strum Down ↓' from Space to 'k'
    fireEvent.click(
      screen.getByRole('tab', { name: /3\. Main Pakai Keyboard/i }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Atur Tombol Bawaan Keyboard/i,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ubah tombol Strum Down ↓' }));
    fireEvent.keyDown(window, { key: 'K' });

    const saved = loadPlaygroundKeyMap();
    expect(saved.bindings['strum-down']).toBe('k');

    // Now pressing 'k' triggers Strum Down
    vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
    fireEvent.keyDown(window, { key: 'k' });
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledTimes(1);

    // Storage helpers sanity check
    expect(normalizeKeyboardKey(' ')).toBe('Space');
    savePlaygroundKeyMap({
      ...saved,
      customFretBindings: [
        { id: 'test-1', key: 'r', stringIndex: 2, fret: 4 },
      ],
    });
    expect(loadPlaygroundKeyMap().customFretBindings).toHaveLength(1);
  });

  it('supports chord string variations (open/mute), play by custom string, and play by custom key', () => {
    renderPlayground();

    // Open Tab 2: Variasi & Custom Senar
    fireEvent.click(
      screen.getByRole('tab', { name: /2\. Variasi & Custom Senar/i }),
    );

    // Starts on C Major [-1, 3, 2, 0, 1, 0]
    expect(screen.getByTestId('variation-detected-label')).toHaveTextContent(
      'C (X-3-2-0-1-0)',
    );

    // Release Senar 2 (B) from fret 1 to Open (0) -> Cmaj7 variation [-1, 3, 2, 0, 0, 0]
    fireEvent.click(
      screen.getByRole('button', { name: 'Lepas Senar 2 jadi Open (0)' }),
    );
    expect(screen.getByTestId('variation-detected-label')).toHaveTextContent(
      'C → Cmaj7 (X-3-2-0-0-0)',
    );
    expect(ChordPreviewSynth.playStringPreview).toHaveBeenLastCalledWith(
      4,
      0,
      expect.objectContaining({ polyphonic: true }),
    );

    // Open Tab 3: Main Pakai Keyboard -> Bind this variation to custom key 'u'
    fireEvent.click(
      screen.getByRole('tab', { name: /3\. Main Pakai Keyboard/i }),
    );
    const labelInput = screen.getByLabelText('Label custom key voicing');
    fireEvent.change(labelInput, { target: { value: 'C Var Lepas S2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bind ke Custom Key' }));
    fireEvent.keyDown(window, { key: 'u' });

    const persisted = loadPlaygroundKeyMap();
    expect(persisted.customChordBindings).toHaveLength(1);
    expect(persisted.customChordBindings[0]).toMatchObject({
      key: 'u',
      label: 'C Var Lepas S2',
      frets: [-1, 3, 2, 0, 0, 0],
    });

    // Switch to Slot 2 (G Major) first, then press 'u' to trigger the C variation by Custom Key
    fireEvent.keyDown(window, { key: '2' });
    vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
    fireEvent.keyDown(window, { key: 'u' });
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledWith(
      [-1, 3, 2, 0, 0, 0],
      expect.objectContaining({ pattern: 'strum-down' }),
    );

    // Back to Tab 2: Test Play by Custom String
    fireEvent.click(
      screen.getByRole('tab', { name: /2\. Variasi & Custom Senar/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset ke C Asli' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Aktifkan Senar 1 (e) untuk Custom String',
      }),
    );

    vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
    fireEvent.keyDown(window, { key: ',' }); // Strum Custom Senar
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledWith(
      [-1, 3, 2, 0, 1, -1],
      expect.objectContaining({ pattern: 'strum-down' }),
    );

    fireEvent.keyDown(window, { key: '.' }); // Petik Urutan Senar
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [-1, 3, 2, 0, 1, -1],
      expect.objectContaining({
        pattern: 'custom-string',
        customStringOrder: [1, 3, 4, 5, 4, 3],
      }),
    );

    // Mute Senar 4 for further variation
    fireEvent.click(screen.getByRole('button', { name: 'Mute Senar 4' }));
    expect(screen.getByTestId('variation-detected-label')).toHaveTextContent(
      'X-3-X-0-1-0',
    );
  });

  it('builds and plays custom strum and custom petik rhythm patterns', () => {
    renderPlayground();

    // Select 'Pelan / Ballad' preset in Custom Pola Genjreng & Petik
    fireEvent.click(screen.getByRole('button', { name: /Pelan \/ Ballad/i }));
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
      [-1, 3, 2, 0, 1, 0],
      expect.objectContaining({
        pattern: 'custom-rhythm',
        customRhythmSteps: [
          { kind: 'strum-down' },
          { kind: 'rest' },
          { kind: 'strum-down' },
          { kind: 'strum-up' },
        ],
      }),
    );

    // Append a percussive chuck and a bass pluck
    fireEvent.click(screen.getByRole('button', { name: '+ × Mute (Chuck)' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Petik Bass' }));

    vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
    fireEvent.keyDown(window, { key: '/' }); // Play Custom Pola shortcut
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledWith(
      [-1, 3, 2, 0, 1, 0],
      expect.objectContaining({
        pattern: 'custom-rhythm',
        customRhythmSteps: [
          { kind: 'strum-down' },
          { kind: 'rest' },
          { kind: 'strum-down' },
          { kind: 'strum-up' },
          { kind: 'chuck' },
          { kind: 'pluck-bass' },
        ],
      }),
    );
  });

  it('supports drag and drop for chord progression, picker chords, custom rhythm, and custom string order', () => {
    renderPlayground();

    // 1. Reorder active progression slots: drag Slot 1 (C Major) onto Slot 2 (G Major)
    const progressionList = screen.getByRole('list', {
      name: 'Active chord progression',
    });
    const slotItems = Array.from(
      progressionList.querySelectorAll('[role="listitem"]'),
    );
    expect(slotItems).toHaveLength(4);
    fireEvent.dragStart(slotItems[0]!);
    fireEvent.dragOver(slotItems[1]!);
    fireEvent.drop(slotItems[1]!);

    expect(
      screen.getByRole('button', { name: 'Slot 1: G Major' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Slot 2: C Major' }),
    ).toBeInTheDocument();

    // 2. Drag a chord from Chord Picker Drawer onto Slot 1
    fireEvent.click(screen.getByRole('button', { name: /Tambah Chord/i }));
    const dChordPickerBtn = screen.getByRole('button', { name: 'D (D Major)' });
    const updatedSlot1 = progressionList.querySelectorAll('[role="listitem"]')[0]!;
    fireEvent.dragStart(dChordPickerBtn);
    fireEvent.dragOver(updatedSlot1);
    fireEvent.drop(updatedSlot1);
    expect(
      screen.getByRole('button', { name: 'Slot 1: D Major' }),
    ).toBeInTheDocument();

    // 3. Drag and drop Custom Pola steps (reorder & drop from palette)
    fireEvent.click(screen.getByRole('button', { name: /Pelan \/ Ballad/i }));
    const rhythmList = screen.getByRole('list', {
      name: 'Custom strum and picking sequence',
    });
    const rhythmItems = Array.from(
      rhythmList.querySelectorAll('[role="listitem"]'),
    );
    // Drag step 2 ('— Jeda') before step 1 ('↓ Turun')
    fireEvent.dragStart(rhythmItems[1]!);
    fireEvent.dragOver(rhythmItems[0]!);
    fireEvent.drop(rhythmItems[0]!);

    // Drag '+ × Mute (Chuck)' into rhythm sequence container
    const chuckPaletteBtn = screen.getByRole('button', {
      name: '+ × Mute (Chuck)',
    });
    fireEvent.dragStart(chuckPaletteBtn);
    fireEvent.dragOver(rhythmList);
    fireEvent.drop(rhythmList);

    vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
    fireEvent.keyDown(window, { key: '/' });
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        pattern: 'custom-rhythm',
        customRhythmSteps: [
          { kind: 'rest' },
          { kind: 'strum-down' },
          { kind: 'strum-down' },
          { kind: 'strum-up' },
          { kind: 'chuck' },
        ],
      }),
    );

    // 4. Drag and drop Custom String picking order in Tab 2
    fireEvent.click(
      screen.getByRole('tab', { name: /2\. Variasi & Custom Senar/i }),
    );
    const stringOrderList = screen.getByRole('list', {
      name: 'Custom string picking order',
    });
    const orderChips = Array.from(
      stringOrderList.querySelectorAll('[role="listitem"]'),
    );
    // Default order is [1, 3, 4, 5, 4, 3] => Senar 5, Senar 3, ...
    // Drag chip 1 (Senar 3) before chip 0 (Senar 5) => [3, 1, 4, 5, 4, 3]
    fireEvent.dragStart(orderChips[1]!);
    fireEvent.dragOver(orderChips[0]!);
    fireEvent.drop(orderChips[0]!);

    // Drag '+S6' (index 0) onto the container to append => [3, 1, 4, 5, 4, 3, 0]
    const addS6Btn = screen.getByRole('button', {
      name: 'Tambah Senar 6 ke urutan petik',
    });
    fireEvent.dragStart(addS6Btn);
    fireEvent.dragOver(stringOrderList);
    fireEvent.drop(stringOrderList);

    vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
    fireEvent.keyDown(window, { key: '.' });
    expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        pattern: 'custom-string',
        customStringOrder: [3, 1, 4, 5, 4, 3, 0],
      }),
    );
  });

  it('assigns custom picking/rhythm per chord slot, supports custom beats, and prevents cut-off at 180 BPM', () => {
    vi.useFakeTimers();
    try {
      renderPlayground();

      // Build a 12-step custom rhythm on Slot 1 (C Major)
      fireEvent.click(screen.getByRole('button', { name: /Pelan \/ Ballad/i }));
      for (let i = 0; i < 8; i++) {
        fireEvent.click(screen.getByRole('button', { name: '+ ↓ Turun' }));
      }
      // Assign custom rhythm specifically to Slot 1 (C)
      fireEvent.click(
        screen.getByRole('button', { name: /Assign ke Slot 1 \(C\)/i }),
      );
      expect(
        screen.getByRole('button', { name: /Terpasang di Slot 1 \(C\)/i }),
      ).toBeInTheDocument();

      // Switch global pattern to 'Fingerpick P-I-M-A'
      fireEvent.click(
        screen.getByRole('button', { name: 'Fingerpick P-I-M-A' }),
      );

      // Verify Slot 1 still plays its assigned 'custom-rhythm' while Slot 2 plays global 'fingerpick'
      vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
      fireEvent.keyDown(window, { key: '1' });
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
        [-1, 3, 2, 0, 1, 0],
        expect.objectContaining({
          pattern: 'custom-rhythm',
        }),
      );

      fireEvent.keyDown(window, { key: '2' });
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
        [3, 2, 0, 0, 0, 3],
        expect.objectContaining({ pattern: 'fingerpick' }),
      );

      // Set custom beats on Slot 2 (G) to 6 beats
      const slotBeatsInput = screen.getByLabelText('Ketukan khusus slot aktif');
      fireEvent.change(slotBeatsInput, { target: { value: '6' } });
      expect(slotBeatsInput).toHaveValue(6);

      // Select Slot 1, set speed to 180 BPM, global beats stays 4
      fireEvent.click(screen.getByRole('button', { name: 'Slot 1: C Major' }));
      const bpmSlider = screen.getByRole('slider', { name: /Kecepatan/i });
      fireEvent.change(bpmSlider, { target: { value: '180' } });

      // Start Auto-Play: at 180 BPM (333ms/beat), 12-step custom rhythm needs 6 beats (~2004ms)
      // With Pas Pola ON (default), after 4 beats (1332ms) it MUST NOT cut off Slot 1 yet!
      vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Putar Otomatis' }));
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(333 * 4 + 20);
      });
      // Still on Slot 1 (no premature switch to G!)
      expect(
        screen.getByRole('button', { name: 'Slot 1: C Major' }),
      ).toHaveAttribute('aria-current', 'true');

      // After beat 6 completes, advances cleanly to Slot 2 (G Major) with its global 'fingerpick'
      act(() => {
        vi.advanceTimersByTime(333 * 2 + 20);
      });
      expect(
        screen.getByRole('button', { name: 'Slot 2: G Major' }),
      ).toHaveAttribute('aria-current', 'true');
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
        [3, 2, 0, 0, 0, 3],
        expect.objectContaining({ pattern: 'fingerpick' }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports repeating the same pattern 2x on a chord slot and duplicating a slot', () => {
    vi.useFakeTimers();
    try {
      renderPlayground();

      // Assign 'Fingerpick P-I-M-A' to Slot 1 (C Major)
      fireEvent.click(
        screen.getByRole('button', { name: 'Fingerpick P-I-M-A' }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: /Assign .*Fingerpick.* ke Slot ini/i }),
      );

      // Cycle Slot 1 repeat pill from 1x -> 2x
      fireEvent.click(
        screen.getByRole('button', { name: 'Ulang pola di Slot 1 (C): 1x' }),
      );
      expect(
        screen.getByRole('button', { name: 'Ulang pola di Slot 1 (C): 2x' }),
      ).toBeInTheDocument();

      // Set global pattern to Strum Down and BPM to 120 (500ms/beat, 4 beats/cycle)
      fireEvent.click(screen.getByRole('button', { name: 'Strum Down ↓' }));
      fireEvent.change(screen.getByRole('slider', { name: /Kecepatan/i }), {
        target: { value: '120' },
      });

      // Start Auto-Play:
      // - Cycle 1 (0ms): plays C Major with fingerpick
      // - Cycle 2 (2000ms): stays on Slot 1 (C Major) and replays fingerpick (Putaran 2/2)
      // - Cycle 3 (4000ms): advances to Slot 2 (G Major) with strum-down
      vi.mocked(ChordPreviewSynth.playChordPreview).mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Putar Otomatis' }));
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(500 * 4 + 20);
      });
      expect(
        screen.getByRole('button', { name: 'Slot 1: C Major' }),
      ).toHaveAttribute('aria-current', 'true');
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenCalledTimes(2);
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
        [-1, 3, 2, 0, 1, 0],
        expect.objectContaining({ pattern: 'fingerpick' }),
      );

      act(() => {
        vi.advanceTimersByTime(500 * 4 + 20);
      });
      expect(
        screen.getByRole('button', { name: 'Slot 2: G Major' }),
      ).toHaveAttribute('aria-current', 'true');
      expect(ChordPreviewSynth.playChordPreview).toHaveBeenLastCalledWith(
        [3, 2, 0, 0, 0, 3],
        expect.objectContaining({ pattern: 'strum-down' }),
      );

      // Stop loop and test duplicating Slot 1 (C) -> Slot 2 becomes C Major clone too
      fireEvent.click(screen.getByRole('button', { name: 'Berhenti' }));
      fireEvent.click(
        screen.getByRole('button', { name: 'Duplikat Slot 1 (C)' }),
      );
      expect(
        screen.getByRole('button', { name: 'Slot 2: C Major' }),
      ).toHaveAttribute('aria-current', 'true');
      expect(
        screen.getByRole('button', { name: 'Slot 3: G Major' }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
