import {
  Hand,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Slider } from '../../../components/ui/Slider';
import {
  TIME_SIGNATURE_LIST,
  getTempoMarking,
} from '../../../engines/metronome/MetronomeEngine';
import { useMetronome } from '../hooks/useMetronome';

export function MetronomeScreen() {
  const {
    bpm,
    minBpm,
    maxBpm,
    timeSignature,
    beatsPerMeasure,
    volume,
    status,
    activeBeat,
    audioError,
    setBpm,
    stepBpm,
    setTimeSignature,
    setVolume,
    togglePlayPause,
    reset,
    tapTempo,
  } = useMetronome();

  const tempoMarking = getTempoMarking(bpm);
  const isPlaying = status === 'playing';
  const volumePercent = Math.round(volume * 100);

  return (
    <section
      aria-labelledby="metronome-heading"
      className="mx-auto flex max-w-xl flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1
            id="metronome-heading"
            className="text-lg font-semibold tracking-tight text-[var(--st-text)]"
          >
            Metronome
          </h1>
          <p className="text-xs text-[var(--st-text-muted)]">
            Web Audio lookahead clock · Beat 1 accented
          </p>
        </div>

        <Badge tone={isPlaying ? 'accent' : 'neutral'} className="uppercase">
          <span>{status}</span>
        </Badge>
      </div>

      {/* Main BPM & Beat Visualization Card */}
      <Card className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="text-center">
          <span className="text-xs font-semibold tracking-widest text-[var(--st-accent)] uppercase">
            {tempoMarking}
          </span>
          <div className="mt-1 flex items-baseline justify-center gap-2">
            <span
              data-testid="metronome-bpm"
              className="font-mono text-6xl font-bold tracking-tight text-[var(--st-text)] tabular-nums"
            >
              {bpm}
            </span>
            <span className="text-sm font-semibold text-[var(--st-text-muted)]">
              BPM
            </span>
          </div>
        </div>

        {/* Visual Beat Indicator */}
        <div
          aria-label="Beat indicator"
          data-testid="beat-indicators"
          className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {Array.from({ length: beatsPerMeasure }, (_, idx) => {
            const beatNum = idx + 1;
            const isAccent = beatNum === 1;
            const isActive = activeBeat === beatNum;

            return (
              <div
                key={beatNum}
                data-active={isActive ? 'true' : 'false'}
                className={`st-beat-active flex h-11 w-11 items-center justify-center rounded-full border font-mono text-sm font-bold transition-colors ${
                  isActive
                    ? isAccent
                      ? 'scale-110 border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-accent-text)] shadow-md'
                      : 'scale-105 border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                    : isAccent
                      ? 'border-[var(--st-border-strong)] bg-[var(--st-surface-elevated)] text-[var(--st-text)]'
                      : 'border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text-muted)]'
                }`}
              >
                {beatNum}
              </div>
            );
          })}
        </div>

        {/* BPM Stepper & Slider */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease BPM by 1"
            onClick={() => stepBpm(-1)}
            disabled={bpm <= minBpm}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text)] transition-colors hover:border-[var(--st-border-strong)] disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>

          <Slider
            label="Tempo in beats per minute"
            showLabel={false}
            min={minBpm}
            max={maxBpm}
            value={bpm}
            valueText={`${bpm} BPM`}
            onChange={setBpm}
          />

          <button
            type="button"
            aria-label="Increase BPM by 1"
            onClick={() => stepBpm(1)}
            disabled={bpm >= maxBpm}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text)] transition-colors hover:border-[var(--st-border-strong)] disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Quick BPM Nudge Pills */}
        <div className="mt-2 flex items-center justify-center gap-2">
          {[-10, -5, +5, +10].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => stepBpm(delta)}
              className="min-h-8 rounded-lg border border-[var(--st-border)] bg-[var(--st-surface-elevated)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--st-text-muted)] transition-colors hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        {/* Primary Transport + Tap Tempo */}
        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto_auto]">
          <button
            type="button"
            onClick={togglePlayPause}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
              isPlaying
                ? 'border border-[var(--st-border-strong)] bg-[var(--st-surface-elevated)] text-[var(--st-text)] hover:bg-[var(--st-surface-subtle)]'
                : 'bg-[var(--st-accent)] text-[var(--st-accent-text)] hover:opacity-95'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>{status === 'paused' ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={tapTempo}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--st-border-strong)] bg-[var(--st-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--st-text)] transition-colors hover:bg-[var(--st-surface-subtle)]"
          >
            <Hand className="h-4 w-4" aria-hidden="true" />
            <span>Tap Tempo</span>
          </button>

          <button
            type="button"
            onClick={reset}
            aria-label="Reset metronome"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] px-4 py-3 text-sm font-medium text-[var(--st-text-muted)] transition-colors hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>

        {audioError ? (
          <p role="alert" className="mt-3 text-center text-xs text-[var(--st-danger)]">
            {audioError}
          </p>
        ) : null}
      </Card>

      {/* Time Signature & Volume Controls */}
      <Card className="flex flex-col gap-5 p-4 sm:p-5">
        <div>
          <span className="mb-2 block text-xs font-semibold tracking-wider text-[var(--st-text-muted)] uppercase">
            Time Signature
          </span>
          <div
            role="group"
            aria-label="Time signature"
            className="grid grid-cols-4 gap-2"
          >
            {TIME_SIGNATURE_LIST.map((sig) => {
              const selected = sig.id === timeSignature;
              return (
                <button
                  key={sig.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTimeSignature(sig.id)}
                  className={`min-h-11 rounded-xl border font-mono text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                      : 'border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text-muted)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]'
                  }`}
                >
                  {sig.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {volumePercent === 0 ? (
            <VolumeX
              className="h-5 w-5 shrink-0 text-[var(--st-text-muted)]"
              aria-hidden="true"
            />
          ) : (
            <Volume2
              className="h-5 w-5 shrink-0 text-[var(--st-text-muted)]"
              aria-hidden="true"
            />
          )}
          <Slider
            label="Click volume"
            min={0}
            max={100}
            value={volumePercent}
            valueText={`${volumePercent}%`}
            onChange={(val) => setVolume(val / 100)}
          />
        </div>
      </Card>
    </section>
  );
}
