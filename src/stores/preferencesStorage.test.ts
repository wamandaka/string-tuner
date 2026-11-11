import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFavoriteChordIds,
  loadFavoriteChordIds,
  saveFavoriteChordIds,
} from './favoritesStorage';
import {
  loadPreferences,
  resetStoredPreferences,
  savePreferences,
} from './preferencesStorage';
import { DEFAULT_PREFERENCES } from '../types/settings';

describe('local storage persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns dark-first defaults when storage is empty or malformed', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    window.localStorage.setItem('stringtune:preferences:v1', '{bad-json');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('saves, clamps, and resets user preferences', () => {
    savePreferences({
      theme: 'light',
      defaultTuningId: 'drop-d',
      defaultChromatic: true,
      metronomeBpm: 999,
      metronomeTimeSignature: '6/8',
      metronomeVolume: 0.5,
    });

    const loaded = loadPreferences();
    expect(loaded.theme).toBe('light');
    expect(loaded.defaultTuningId).toBe('drop-d');
    expect(loaded.defaultChromatic).toBe(true);
    expect(loaded.metronomeBpm).toBe(240);
    expect(loaded.metronomeTimeSignature).toBe('6/8');

    const reset = resetStoredPreferences();
    expect(reset).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('persists deduplicated favorite chord IDs', () => {
    saveFavoriteChordIds(['a-minor', 'c-major', 'a-minor']);
    expect(loadFavoriteChordIds()).toEqual(['a-minor', 'c-major']);

    clearFavoriteChordIds();
    expect(loadFavoriteChordIds()).toEqual([]);
  });
});

