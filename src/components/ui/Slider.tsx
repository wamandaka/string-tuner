import { useId, type CSSProperties } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueText?: string;
  onChange: (value: number) => void;
  id?: string;
  showLabel?: boolean;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  valueText,
  onChange,
  id,
  showLabel = true,
}: SliderProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const style = {
    '--attr-min': String(min),
    '--attr-max': String(max),
    '--control-value': String(value),
  } as CSSProperties;

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className={
          showLabel
            ? 'mb-1 flex items-center justify-between text-xs font-medium text-[var(--st-text-muted)]'
            : 'visually-hidden'
        }
      >
        <span>{label}</span>
        {valueText ? (
          <span className="font-mono text-[var(--st-text)]">{valueText}</span>
        ) : null}
      </label>
      <input
        id={inputId}
        type="range"
        className="st-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        style={style}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

