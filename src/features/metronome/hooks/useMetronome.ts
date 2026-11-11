import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import {
  MAX_BPM,
  MIN_BPM,
  MetronomeEngine,
  TIME_SIGNATURES,
  clampBpm,
  computeTapTempoBpm,
} from '../../../engines/metronome/MetronomeEngine';
import type { TimeSignatureId } from '../../../types/settings';
import type { MetronomeStatus } from '../metronome.types';

export function useMetronome() {
  const { preferences, updatePreference } = usePreferences();

  const [bpm, setBpmState] = useState<number>(preferences.metronomeBpm);
  const [timeSignature, setTimeSignatureState] = useState<TimeSignatureId>(
    preferences.metronomeTimeSignature,
  );
  const [volume, setVolumeState] = useState<number>(preferences.metronomeVolume);
  const [status, setStatus] = useState<MetronomeStatus>('stopped');
  const [activeBeat, setActiveBeat] = useState<number>(0); // 1-based while running, 0 when reset
  const [audioError, setAudioError] = useState<string | null>(null);

  const engineRef = useRef<MetronomeEngine | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const tapHistoryRef = useRef<number[]>([]);

  if (!engineRef.current) {
    engineRef.current = new MetronomeEngine({
      bpm,
      timeSignature,
      volume,
    });
  }

  const stopVisualLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const startVisualLoop = useCallback(() => {
    stopVisualLoop();
    const tick = () => {
      const engine = engineRef.current;
      if (!engine || !engine.getIsPlaying()) {
        return;
      }
      const dueBeat = engine.consumeDueBeat();
      if (dueBeat) {
        setActiveBeat(dueBeat.beatNumber);
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [stopVisualLoop]);

  const setBpm = useCallback(
    (next: number) => {
      const clamped = clampBpm(next);
      setBpmState(clamped);
      engineRef.current?.setBpm(clamped);
      updatePreference('metronomeBpm', clamped);
    },
    [updatePreference],
  );

  const stepBpm = useCallback(
    (delta: number) => {
      setBpm(bpm + delta);
    },
    [bpm, setBpm],
  );

  const setTimeSignature = useCallback(
    (next: TimeSignatureId) => {
      setTimeSignatureState(next);
      engineRef.current?.setTimeSignature(next);
      updatePreference('metronomeTimeSignature', next);
      const maxBeats = TIME_SIGNATURES[next].beatsPerMeasure;
      setActiveBeat((prev) => (prev > maxBeats ? 1 : prev));
    },
    [updatePreference],
  );

  const setVolume = useCallback(
    (next: number) => {
      const clamped = Math.min(1, Math.max(0, next));
      setVolumeState(clamped);
      engineRef.current?.setVolume(clamped);
      updatePreference('metronomeVolume', clamped);
    },
    [updatePreference],
  );

  const play = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setAudioError(null);
    try {
      await engine.start();
      setStatus('playing');
      startVisualLoop();
    } catch {
      setAudioError(
        'Audio playback could not start in this browser context.',
      );
      setStatus('stopped');
    }
  }, [startVisualLoop]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    stopVisualLoop();
    setStatus('paused');
  }, [stopVisualLoop]);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    stopVisualLoop();
    setStatus('stopped');
    setActiveBeat(0);
  }, [stopVisualLoop]);

  const togglePlayPause = useCallback(() => {
    if (status === 'playing') {
      pause();
    } else {
      void play();
    }
  }, [pause, play, status]);

  const tapTempo = useCallback(() => {
    const now = performance.now();
    const history = tapHistoryRef.current;
    if (history.length > 0 && now - history[history.length - 1]! > 2000) {
      history.length = 0;
    }
    history.push(now);
    if (history.length > 8) {
      history.shift();
    }
    const computed = computeTapTempoBpm(history);
    if (computed !== null) {
      setBpm(computed);
    }
  }, [setBpm]);

  useEffect(() => {
    return () => {
      stopVisualLoop();
      void engineRef.current?.dispose();
    };
  }, [stopVisualLoop]);

  return {
    bpm,
    minBpm: MIN_BPM,
    maxBpm: MAX_BPM,
    timeSignature,
    beatsPerMeasure: TIME_SIGNATURES[timeSignature].beatsPerMeasure,
    volume,
    status,
    activeBeat,
    audioError,
    setBpm,
    stepBpm,
    setTimeSignature,
    setVolume,
    play,
    pause,
    reset,
    togglePlayPause,
    tapTempo,
  };
}

