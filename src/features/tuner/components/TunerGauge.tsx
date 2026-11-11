import type { RefObject } from 'react';
import type { TuningStatus } from '../../../engines/pitch/CentsCalculator';
import type { TunerRunState } from '../tuner.types';

interface TunerGaugeProps {
  needleRef: RefObject<SVGGElement | null>;
  status: TuningStatus | null;
  runState: TunerRunState;
  hasSignal: boolean;
  inputLevel: number;
}

const NEEDLE_COLOR_MAP: Record<TuningStatus, string> = {
  flat: 'var(--st-warn)',
  'in-tune': 'var(--st-accent)',
  sharp: 'var(--st-danger)',
};

export function TunerGauge({
  needleRef,
  status,
  runState,
  hasSignal,
  inputLevel,
}: TunerGaugeProps) {
  const activeColor =
    runState === 'active' && hasSignal && status
      ? NEEDLE_COLOR_MAP[status]
      : 'var(--st-text-muted)';

  const isInTune = runState === 'active' && hasSignal && status === 'in-tune';

  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none">
      <svg
        viewBox="0 0 320 206"
        className="w-full overflow-visible"
        role="img"
        aria-label="Tuning needle gauge from 50 cents flat to 50 cents sharp"
      >
        {/* Left Flat Arc (-64deg to -12deg) */}
        <path
          d="M 52.2 115.3 A 120 120 0 0 1 135 50.6"
          fill="none"
          stroke="var(--st-surface-subtle)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Center In-Tune Sweet Spot Arc (-6deg to +6deg) */}
        <path
          d="M 147.5 48.7 A 120 120 0 0 1 172.5 48.7"
          fill="none"
          stroke={isInTune ? 'var(--st-accent)' : 'var(--st-border-strong)'}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Right Sharp Arc (+12deg to +64deg) */}
        <path
          d="M 185 50.6 A 120 120 0 0 1 267.8 115.3"
          fill="none"
          stroke="var(--st-surface-subtle)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Calibration Tick Marks at -50, -25, 0, +25, +50 cents */}
        {[-64, -32, 0, 32, 64].map((angle) => {
          const isCenter = angle === 0;
          return (
            <g
              key={angle}
              transform={`rotate(${angle} 160 168)`}
            >
              <line
                x1="160"
                y1={isCenter ? 28 : 34}
                x2="160"
                y2={isCenter ? 46 : 46}
                stroke={
                  isCenter && isInTune
                    ? 'var(--st-accent)'
                    : 'var(--st-text-muted)'
                }
                strokeWidth={isCenter ? '3' : '2'}
                strokeLinecap="round"
                opacity={isCenter ? 0.95 : 0.55}
              />
            </g>
          );
        })}

        {/* Labels */}
        <text
          x="36"
          y="156"
          textAnchor="middle"
          fill="var(--st-text-muted)"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.08em"
        >
          FLAT ♭
        </text>
        <text
          x="284"
          y="156"
          textAnchor="middle"
          fill="var(--st-text-muted)"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.08em"
        >
          SHARP ♯
        </text>

        {/* Moving Needle (GPU transform updated inside RAF) */}
        <g ref={needleRef} className="st-needle-arm">
          <line
            x1="160"
            y1="168"
            x2="160"
            y2="54"
            stroke={activeColor}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="160" cy="54" r="3.5" fill={activeColor} />
        </g>

        {/* Needle Pivot */}
        <circle
          cx="160"
          cy="168"
          r="11"
          fill={isInTune ? 'var(--st-accent)' : 'var(--st-surface-elevated)'}
          stroke={activeColor}
          strokeWidth="3"
        />
      </svg>

      {/* Subtle Signal Input Meter */}
      <div className="mx-auto mt-1 flex max-w-[200px] items-center gap-2">
        <span className="text-[10px] font-medium tracking-wider text-[var(--st-text-muted)] uppercase">
          Input
        </span>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--st-surface-subtle)]"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-[var(--st-accent)] transition-[width] duration-75"
            style={{
              width: `${Math.round(
                runState === 'active' ? Math.max(4, inputLevel * 100) : 0,
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

