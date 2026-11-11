import { useId } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
}: SwitchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descId = description ? `${inputId}-desc` : undefined;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className="block cursor-pointer text-sm font-medium text-[var(--st-text)]"
        >
          {label}
        </label>
        {description ? (
          <p
            id={descId}
            className="mt-0.5 text-xs text-[var(--st-text-muted)]"
          >
            {description}
          </p>
        ) : null}
      </div>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className="st-switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={descId}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

