import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../../../engines/audio/AudioEngine';
import {
  normalizeMicrophoneError,
  queryMicrophonePermission,
  requestMicrophoneStream,
  stopMicrophoneStream,
  type MicrophonePermissionState,
} from '../../../engines/audio/MicrophoneManager';
import { clampCentsForDisplay } from '../../../engines/pitch/CentsCalculator';
import { getTuningPreset } from '../../../engines/pitch/NoteMapper';
import { PitchDetector } from '../../../engines/pitch/PitchDetector';
import type { TuningPresetId } from '../../../types/settings';
import type {
  TunerErrorInfo,
  TunerMode,
  TunerReading,
  TunerRunState,
  UseTunerOptions,
} from '../tuner.types';

const UI_COMMIT_INTERVAL_MS = 42; // ~24 FPS UI updates
const STALE_SIGNAL_HOLD_MS = 950;
const MAX_NEEDLE_ANGLE_DEG = 64;

export function centsToNeedleAngle(cents: number): number {
  const clamped = clampCentsForDisplay(cents, 50);
  return (clamped / 50) * MAX_NEEDLE_ANGLE_DEG;
}

export function useTuner({ initialMode, initialTuningId }: UseTunerOptions) {
  const [runState, setRunState] = useState<TunerRunState>('idle');
  const [mode, setMode] = useState<TunerMode>(initialMode);
  const [tuningId, setTuningId] = useState<TuningPresetId>(initialTuningId);
  const [manualStringNumber, setManualStringNumber] = useState<
    6 | 5 | 4 | 3 | 2 | 1 | null
  >(null);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [error, setError] = useState<TunerErrorInfo | null>(null);
  const [permissionState, setPermissionState] =
    useState<MicrophonePermissionState>('unknown');

  const needleRef = useRef<SVGGElement | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const pitchDetectorRef = useRef<PitchDetector | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const runTokenRef = useRef(0);

  // Latest settings refs so RAF loop sees mode/tuning changes immediately without restarting audio
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const tuningIdRef = useRef(tuningId);
  tuningIdRef.current = tuningId;
  const manualStringRef = useRef(manualStringNumber);
  manualStringRef.current = manualStringNumber;

  const activePreset = useMemo(() => getTuningPreset(tuningId), [tuningId]);

  const setNeedleAngle = useCallback((angleDeg: number) => {
    if (needleRef.current) {
      needleRef.current.style.transform = `rotate(${angleDeg.toFixed(2)}deg)`;
    }
  }, []);

  const refreshPermissionState = useCallback(async () => {
    const status = await queryMicrophonePermission();
    if (isMountedRef.current) {
      setPermissionState(status);
    }
    return status;
  }, []);

  useEffect(() => {
    void refreshPermissionState();
  }, [refreshPermissionState]);

  const teardownAudio = useCallback(async () => {
    runTokenRef.current += 1;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (audioEngineRef.current) {
      await audioEngineRef.current.stop();
    }
    pitchDetectorRef.current?.reset();
    setNeedleAngle(0);
  }, [setNeedleAngle]);

  const stop = useCallback(async () => {
    await teardownAudio();
    if (isMountedRef.current) {
      setRunState('idle');
      setReading(null);
      setInputLevel(0);
    }
  }, [teardownAudio]);

  const start = useCallback(async () => {
    if (runState === 'starting' || runState === 'active') {
      return;
    }

    const token = ++runTokenRef.current;
    setRunState('starting');
    setError(null);
    setReading(null);
    setInputLevel(0);
    setNeedleAngle(0);

    let stream: MediaStream | null = null;
    try {
      stream = await requestMicrophoneStream();
      if (!isMountedRef.current || token !== runTokenRef.current) {
        stopMicrophoneStream(stream);
        return;
      }

      if (!audioEngineRef.current) {
        audioEngineRef.current = new AudioEngine();
      }
      if (!pitchDetectorRef.current) {
        pitchDetectorRef.current = new PitchDetector();
      } else {
        pitchDetectorRef.current.reset();
      }

      const session = await audioEngineRef.current.start(stream, 4096);
      stream = null; // Owned by AudioEngine now

      if (!isMountedRef.current || token !== runTokenRef.current) {
        await audioEngineRef.current.stop();
        return;
      }

      setRunState('active');
      void refreshPermissionState();

      let lastUiCommitTime = 0;
      let lastDetectedTime = 0;
      let currentAngle = 0;
      let targetAngle = 0;

      const tick = (now: number) => {
        if (!isMountedRef.current || token !== runTokenRef.current) {
          return;
        }

        const engine = audioEngineRef.current;
        const detector = pitchDetectorRef.current;
        if (!engine || !detector || !engine.isRunning()) {
          return;
        }

        const samples = engine.readTimeDomainData();
        if (samples) {
          const preset = getTuningPreset(tuningIdRef.current);
          const detected = detector.detect(samples, {
            sampleRate: session.sampleRate,
            mode: modeRef.current,
            strings: preset.strings,
            manualStringNumber:
              modeRef.current === 'guitar' ? manualStringRef.current : null,
          });

          if (detected) {
            lastDetectedTime = now;
            targetAngle = centsToNeedleAngle(detected.cents);
          } else if (
            lastDetectedTime > 0 &&
            now - lastDetectedTime > STALE_SIGNAL_HOLD_MS
          ) {
            targetAngle = 0;
          }

          // Smooth compositor transform update every frame
          currentAngle += (targetAngle - currentAngle) * 0.35;
          setNeedleAngle(currentAngle);

          // Commit React state at ~24 FPS (every >= 42ms)
          if (now - lastUiCommitTime >= UI_COMMIT_INTERVAL_MS) {
            lastUiCommitTime = now;
            if (detected) {
              setReading({
                frequency: detected.frequency,
                targetFrequency: detected.targetFrequency,
                note: detected.note,
                octave: detected.octave,
                noteLabel: detected.noteLabel,
                cents: detected.cents,
                status: detected.status,
                clarity: detected.clarity,
                rms: detected.rms,
                matchedString: detected.matchedString,
              });
              setInputLevel(Math.min(1, detected.rms * 6));
            } else {
              // Estimate subtle level even below pitch threshold
              let peak = 0;
              for (let i = 0; i < samples.length; i += 16) {
                const abs = Math.abs(samples[i]!);
                if (abs > peak) peak = abs;
              }
              setInputLevel(Math.min(1, peak * 3));
              if (
                lastDetectedTime > 0 &&
                now - lastDetectedTime > STALE_SIGNAL_HOLD_MS
              ) {
                setReading(null);
              }
            }
          }
        }

        rafIdRef.current = requestAnimationFrame(tick);
      };

      rafIdRef.current = requestAnimationFrame(tick);
    } catch (rawError) {
      stopMicrophoneStream(stream);
      const micError = normalizeMicrophoneError(rawError);
      if (isMountedRef.current && token === runTokenRef.current) {
        setError({
          code: micError.code,
          title: micError.title,
          message: micError.message,
        });
        setRunState('error');
        void refreshPermissionState();
      }
    }
  }, [refreshPermissionState, runState, setNeedleAngle]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void teardownAudio();
    };
  }, [teardownAudio]);

  const toggleManualString = useCallback(
    (stringNumber: 6 | 5 | 4 | 3 | 2 | 1) => {
      setMode('guitar');
      setManualStringNumber((prev) =>
        prev === stringNumber ? null : stringNumber,
      );
    },
    [],
  );

  const selectAutoMode = useCallback(() => {
    setManualStringNumber(null);
  }, []);

  const changeMode = useCallback((nextMode: TunerMode) => {
    setMode(nextMode);
    if (nextMode === 'chromatic') {
      setManualStringNumber(null);
    }
  }, []);

  const changeTuning = useCallback((nextTuningId: TuningPresetId) => {
    setTuningId(nextTuningId);
    setMode('guitar');
  }, []);

  return {
    runState,
    mode,
    tuningId,
    activePreset,
    manualStringNumber,
    reading,
    inputLevel,
    error,
    permissionState,
    needleRef,
    start,
    stop,
    changeMode,
    changeTuning,
    toggleManualString,
    selectAutoMode,
    refreshPermissionState,
  };
}

