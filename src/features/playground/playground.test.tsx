import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    // Pluck individual string 6 (E2) on E7
    const string6Btn = screen.getByRole('button', {
      name: /Pluck string 6 \(E\), E2/i,
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
      screen.getByRole('button', { name: 'String 6 (E): Muted' }),
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

    // Enable Pin Fret (Fingerstyle) mode and pin Fret 3 on String 1 over C Major [-1, 3, 2, 0, 1, 0]
    fireEvent.click(
      screen.getByRole('button', { name: /Pin Fret \(Fingerstyle\)/i }),
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

    // Remap 'Strum Down ↓' from Space to 'k' in Custom Key panel
    fireEvent.click(screen.getByRole('button', { name: 'Custom Key' }));
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

    // Bind this variation to custom key 'u' (Play by Custom Key)
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

    // Test Play by Custom String: disable String 1 (e), then Strum Custom Senar & Petik Urutan Senar
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
});
