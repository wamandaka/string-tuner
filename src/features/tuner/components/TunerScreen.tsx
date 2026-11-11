import {
  AlertCircle,
  CheckCircle2,
  Mic,
  MicOff,
  SlidersHorizontal,
} from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { TUNING_PRESETS } from '../../../engines/pitch/NoteMapper';
import type { TuningPresetId } from '../../../types/settings';
import { useTuner } from '../hooks/useTuner';
import { StringSelector } from './StringSelector';
import { TunerGauge } from './TunerGauge';

function formatStatusLabel(
  runState: string,
  status: 'flat' | 'in-tune' | 'sharp' | null,
): { label: string; hint: string; tone: 'neutral' | 'accent' | 'warn' | 'danger' } {
  if (runState === 'error') {
    return {
      label: 'MIC UNAVAILABLE',
      hint: 'Grant microphone permission or check your audio device.',
      tone: 'danger',
    };
  }
  if (runState === 'starting') {
    return {
      label: 'STARTING',
      hint: 'Requesting microphone access...',
      tone: 'neutral',
    };
  }
  if (runState === 'idle') {
    return {
      label: 'STANDBY',
      hint: 'Tap Start Tuner to activate microphone pitch detection.',
      tone: 'neutral',
    };
  }
  if (!status) {
    return {
      label: 'LISTENING',
      hint: 'Pluck a single string clearly near your microphone.',
      tone: 'neutral',
    };
  }
  if (status === 'in-tune') {
    return {
      label: 'IN TUNE',
      hint: 'Perfectly tuned',
      tone: 'accent',
    };
  }
  if (status === 'flat') {
    return {
      label: 'FLAT',
      hint: 'Tighten string (tune up)',
      tone: 'warn',
    };
  }
  return {
    label: 'SHARP',
    hint: 'Loosen string (tune down)',
    tone: 'danger',
  };
}

export function TunerScreen() {
  const { preferences } = usePreferences();
  const {
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
  } = useTuner({
    initialMode: preferences.defaultChromatic ? 'chromatic' : 'guitar',
    initialTuningId: preferences.defaultTuningId,
  });

  const statusMeta = formatStatusLabel(runState, reading?.status ?? null);
  const roundedCents = reading ? Math.round(reading.cents) : null;
  const formattedCents =
    roundedCents === null
      ? '--'
      : roundedCents > 0
        ? `+${roundedCents} cents`
        : `${roundedCents} cents`;

  const isRunning = runState === 'active' || runState === 'starting';

  return (
    <section
      aria-labelledby="tuner-heading"
      className="mx-auto flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1
            id="tuner-heading"
            className="text-lg font-semibold tracking-tight text-[var(--st-text)]"
          >
            {mode === 'chromatic' ? 'Chromatic Tuner' : 'Guitar Tuner'}
          </h1>
          <p className="text-xs text-[var(--st-text-muted)]">
            {mode === 'chromatic'
              ? 'All 12 notes · A4 = 440 Hz'
              : `${activePreset.name} · ${activePreset.description}`}
          </p>
        </div>

        <Badge tone={statusMeta.tone} className="uppercase">
          {reading?.status === 'in-tune' && runState === 'active' ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
          <span>{statusMeta.label}</span>
        </Badge>
      </div>

      {/* Mode & Tuning Preset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Tuner mode"
          className="inline-flex rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-1"
        >
          <button
            type="button"
            aria-pressed={mode === 'guitar'}
            onClick={() => changeMode('guitar')}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'guitar'
                ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
            }`}
          >
            Guitar
          </button>
          <button
            type="button"
            aria-pressed={mode === 'chromatic'}
            onClick={() => changeMode('chromatic')}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'chromatic'
                ? 'bg-[var(--st-accent)] text-[var(--st-accent-text)]'
                : 'text-[var(--st-text-muted)] hover:text-[var(--st-text)]'
            }`}
          >
            Chromatic
          </button>
        </div>

        {mode === 'guitar' ? (
          <div className="flex items-center gap-2">
            <label htmlFor="tuner-preset-select" className="visually-hidden">
              Tuning preset
            </label>
            <SlidersHorizontal
              className="h-4 w-4 text-[var(--st-text-muted)]"
              aria-hidden="true"
            />
            <select
              id="tuner-preset-select"
              value={tuningId}
              onChange={(event) =>
                changeTuning(event.target.value as TuningPresetId)
              }
              className="min-h-10 rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] px-3 py-1.5 text-xs font-medium text-[var(--st-text)]"
            >
              {TUNING_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* Main Tuning Stage */}
      <Card className="px-4 py-5 sm:px-6 sm:py-6">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-col items-center text-center"
        >
          <div className="flex items-baseline justify-center gap-1">
            <span
              data-testid="tuner-note"
              className="font-mono text-5xl font-bold tracking-tight text-[var(--st-text)] sm:text-6xl"
            >
              {reading ? reading.note : '--'}
            </span>
            {reading ? (
              <span className="font-mono text-xl font-semibold text-[var(--st-text-muted)]">
                {reading.octave}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-sm">
            <span
              data-testid="tuner-frequency"
              className="font-mono font-medium text-[var(--st-text)]"
            >
              {reading ? `${reading.frequency.toFixed(2)} Hz` : '0.00 Hz'}
            </span>
            <span aria-hidden="true" className="text-[var(--st-text-muted)]">
              ·
            </span>
            <span
              data-testid="tuner-cents"
              className={`font-mono font-semibold ${
                reading?.status === 'in-tune'
                  ? 'text-[var(--st-accent)]'
                  : reading?.status === 'flat'
                    ? 'text-[var(--st-warn)]'
                    : reading?.status === 'sharp'
                      ? 'text-[var(--st-danger)]'
                      : 'text-[var(--st-text-muted)]'
              }`}
            >
              {formattedCents}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <TunerGauge
            needleRef={needleRef}
            status={reading?.status ?? null}
            runState={runState}
            hasSignal={reading !== null}
            inputLevel={inputLevel}
          />
        </div>

        <p
          data-testid="tuner-status-hint"
          className={`mt-2 text-center text-sm font-medium ${
            reading?.status === 'in-tune' && runState === 'active'
              ? 'text-[var(--st-accent)]'
              : 'text-[var(--st-text-muted)]'
          }`}
        >
          {statusMeta.hint}
        </p>

        {/* Microphone Action Button */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => (isRunning ? void stop() : void start())}
            disabled={runState === 'starting'}
            className={`inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
              isRunning
                ? 'border border-[var(--st-border-strong)] bg-[var(--st-surface-elevated)] text-[var(--st-text)] hover:bg-[var(--st-surface-subtle)]'
                : 'bg-[var(--st-accent)] text-[var(--st-accent-text)] hover:opacity-95'
            }`}
          >
            {isRunning ? (
              <>
                <MicOff className="h-4 w-4" aria-hidden="true" />
                <span>
                  {runState === 'starting' ? 'Starting...' : 'Stop Tuner'}
                </span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                <span>Start Tuner</span>
              </>
            )}
          </button>

          <span className="text-xs text-[var(--st-text-muted)]">
            Microphone: {runState === 'active' ? 'active' : permissionState}
          </span>
        </div>
      </Card>

      {/* Graceful Error Banner */}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--st-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--st-danger)_10%,transparent)] p-4 text-sm"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--st-danger)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-[var(--st-text)]">
              {error.title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--st-text-muted)]">
              {error.message}
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-2.5 inline-flex min-h-9 items-center rounded-lg border border-[var(--st-border-strong)] bg-[var(--st-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--st-text)] hover:bg-[var(--st-surface-elevated)]"
            >
              Retry Microphone
            </button>
          </div>
        </div>
      ) : null}

      {/* Standard/Preset Guitar String Selector */}
      {mode === 'guitar' ? (
        <StringSelector
          strings={activePreset.strings}
          manualStringNumber={manualStringNumber}
          detectedStringNumber={reading?.matchedString?.stringNumber ?? null}
          onSelectString={toggleManualString}
          onSelectAuto={selectAutoMode}
        />
      ) : null}
    </section>
  );
}
