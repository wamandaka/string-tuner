import { useState } from 'react';
import { FINGER_NAMES, type ChordDefinition } from '../chords.types';

interface ChordDiagramProps {
  chord: ChordDefinition;
  compact?: boolean;
}

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;
const NUM_FRETS = 4;

export function ChordDiagram({ chord, compact = false }: ChordDiagramProps) {
  const [selectedStringIdx, setSelectedStringIdx] = useState<number | null>(
    null,
  );

  const width = 180;
  const height = 192;
  const leftPad = 32;
  const rightPad = 20;
  const topPad = 30;
  const bottomPad = 22;

  const gridWidth = width - leftPad - rightPad;
  const gridHeight = height - topPad - bottomPad;
  const stringSpacing = gridWidth / 5;
  const fretSpacing = gridHeight / NUM_FRETS;

  const getStringX = (index: number) => leftPad + index * stringSpacing;
  const getFretY = (slotIndex: number) => topPad + slotIndex * fretSpacing;

  const selectedHint =
    selectedStringIdx !== null
      ? (() => {
          const fret = chord.frets[selectedStringIdx]!;
          const finger = chord.fingers[selectedStringIdx]!;
          const sName = STRING_LABELS[selectedStringIdx]!;
          const sNum = 6 - selectedStringIdx;
          if (fret < 0) return `String ${sNum} (${sName}): Muted`;
          if (fret === 0) return `String ${sNum} (${sName}): Open`;
          return `String ${sNum} (${sName}): Fret ${fret} · ${FINGER_NAMES[finger] ?? 'Finger'} (${finger})`;
        })()
      : null;

  const barre = chord.barre;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={compact ? 'h-44 w-40' : 'h-48 w-44'}
        role="img"
        aria-label={`${chord.name} chord diagram, base fret ${chord.baseFret}`}
      >
        {/* Nut or Base Fret Indicator */}
        {chord.baseFret === 1 ? (
          <rect
            x={leftPad - 1.5}
            y={topPad - 4}
            width={gridWidth + 3}
            height="5"
            rx="1.5"
            fill="var(--st-text)"
          />
        ) : (
          <text
            x={leftPad - 9}
            y={topPad + fretSpacing * 0.62}
            textAnchor="end"
            fill="var(--st-text-muted)"
            fontSize="11"
            fontWeight="700"
          >
            {chord.baseFret}fr
          </text>
        )}

        {/* Horizontal Fret Lines */}
        {Array.from({ length: NUM_FRETS + 1 }, (_, i) => {
          const y = getFretY(i);
          return (
            <line
              key={i}
              x1={leftPad}
              y1={y}
              x2={leftPad + gridWidth}
              y2={y}
              stroke="var(--st-border-strong)"
              strokeWidth={i === 0 ? '1.5' : '1.25'}
            />
          );
        })}

        {/* Vertical Strings (bass slightly thicker than treble) */}
        {STRING_LABELS.map((label, stringIdx) => {
          const x = getStringX(stringIdx);
          const isHighlighted = selectedStringIdx === stringIdx;
          const strokeW = 2.1 - stringIdx * 0.22;
          return (
            <g key={label + stringIdx}>
              <line
                x1={x}
                y1={topPad}
                x2={x}
                y2={topPad + gridHeight}
                stroke={
                  isHighlighted
                    ? 'var(--st-accent)'
                    : 'var(--st-text-muted)'
                }
                strokeOpacity={isHighlighted ? 0.95 : 0.45}
                strokeWidth={isHighlighted ? strokeW + 0.8 : strokeW}
              />
              <text
                x={x}
                y={topPad + gridHeight + 15}
                textAnchor="middle"
                fill="var(--st-text-muted)"
                fontSize="10"
                fontWeight="600"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Barre Indicator */}
        {barre ? (
          (() => {
            const relFret = barre.fret - chord.baseFret + 1;
            const cy = topPad + (relFret - 0.5) * fretSpacing;
            const x1 = getStringX(barre.fromStringIndex);
            const x2 = getStringX(barre.toStringIndex);
            const radius = 10.5;
            return (
              <g>
                <rect
                  x={x1 - radius}
                  y={cy - radius}
                  width={x2 - x1 + radius * 2}
                  height={radius * 2}
                  rx={radius}
                  fill="var(--st-accent)"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={cy + 4}
                  textAnchor="middle"
                  fill="var(--st-accent-text)"
                  fontSize="11"
                  fontWeight="700"
                >
                  {barre.finger}
                </text>
              </g>
            );
          })()
        ) : null}

        {/* Open / Muted Markers and Individual Finger Dots */}
        {chord.frets.map((fret, stringIdx) => {
          const x = getStringX(stringIdx);
          const finger = chord.fingers[stringIdx]!;
          const isCoveredByBarre =
            barre !== undefined &&
            fret === barre.fret &&
            finger === barre.finger &&
            stringIdx >= barre.fromStringIndex &&
            stringIdx <= barre.toStringIndex;

          if (fret < 0) {
            return (
              <g
                key={`marker-${stringIdx}`}
                onClick={() =>
                  setSelectedStringIdx((prev) =>
                    prev === stringIdx ? null : stringIdx,
                  )
                }
                className="cursor-pointer"
              >
                <line
                  x1={x - 4.5}
                  y1={topPad - 17}
                  x2={x + 4.5}
                  y2={topPad - 8}
                  stroke="var(--st-text-muted)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1={x + 4.5}
                  y1={topPad - 17}
                  x2={x - 4.5}
                  y2={topPad - 8}
                  stroke="var(--st-text-muted)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>
            );
          }

          if (fret === 0) {
            return (
              <circle
                key={`marker-${stringIdx}`}
                cx={x}
                cy={topPad - 12.5}
                r="5"
                fill="none"
                stroke="var(--st-text)"
                strokeWidth="1.8"
                onClick={() =>
                  setSelectedStringIdx((prev) =>
                    prev === stringIdx ? null : stringIdx,
                  )
                }
                className="cursor-pointer"
              />
            );
          }

          const relFret = fret - chord.baseFret + 1;
          const cy = topPad + (relFret - 0.5) * fretSpacing;
          const isSelected = selectedStringIdx === stringIdx;

          if (isCoveredByBarre) {
            return (
              <circle
                key={`barre-hit-${stringIdx}`}
                cx={x}
                cy={cy}
                r="11"
                fill="transparent"
                onClick={() =>
                  setSelectedStringIdx((prev) =>
                    prev === stringIdx ? null : stringIdx,
                  )
                }
                className="cursor-pointer"
              />
            );
          }

          return (
            <g
              key={`dot-${stringIdx}`}
              onClick={() =>
                setSelectedStringIdx((prev) =>
                  prev === stringIdx ? null : stringIdx,
                )
              }
              className="cursor-pointer"
            >
              <circle
                cx={x}
                cy={cy}
                r="10.5"
                fill={
                  isSelected
                    ? 'var(--st-text)'
                    : 'var(--st-accent)'
                }
              />
              <text
                x={x}
                y={cy + 3.8}
                textAnchor="middle"
                fill={
                  isSelected
                    ? 'var(--st-bg)'
                    : 'var(--st-accent-text)'
                }
                fontSize="11"
                fontWeight="700"
              >
                {finger}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="min-h-5 text-center text-[11px] font-medium text-(--st-text-muted)">
        {selectedHint ?? 'Tap a dot or marker to inspect string fingering'}
      </div>
    </div>
  );
}

